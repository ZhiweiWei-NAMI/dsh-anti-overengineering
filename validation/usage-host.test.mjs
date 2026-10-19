import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection';
import { installConnection } from '@deepseek-ai/dsh-client-connection/client';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools';
import { createUserMessage, createAssistantMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session';
import AgentRegistry from '@deepseek-ai/dsh-agent';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { z } from 'zod';
import { initialState } from '../dsh-anti-overengineering/policy.js';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import * as Guard from '../dsh-anti-overengineering/index.js';

// Real Cordis, tool executor, live SessionStore events and durable JSON storage.
// Jev HTTP, credentials, preset choice and step clock are fixtures.
// Native Host/Client Connection services run in separate Cordis fibers;
// lifecycle tests invoke the native pre-step waterfall and append real turn ends.
const rules = JSON.parse(await readFile(new URL('../dsh-anti-overengineering/rules.json', import.meta.url), 'utf8'));
const [A, B] = rules.map(rule => rule.id);
const DOMAIN = 'anti_overengineering_behavior_v1';
const COST = 0.042; // One million input tokens; output tokens are free.

function jev(t, respond = body => Response.json({
  model: 'jev-latest',
  answers: Object.fromEntries(Object.keys(body.questions).map(id => [id, { type: 'noul', noul: id === A || id === B ? 0.95 : 0.01 }])),
  usage: { input_tokens: 1_000_000, output_tokens: 900_000 },
})) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body, state: JSON.parse(body.state) });
    return respond(body);
  });
  return requests;
}

async function harness(t, config = {}, options = {}) {
  const root = options.root ?? await mkdtemp(join(tmpdir(), 'dsh-usage-host-'));
  const ctx = new Context();
  let closed = false;
  async function close() {
    if (!closed) { closed = true; await ctx.fiber.dispose(); }
  }
  t.after(async () => { await close(); if (!options.root) await rm(root, { recursive: true, force: true }); });
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(SessionStore);
  await ctx.plugin(AgentRegistry);
  await ctx.plugin(Storage);
  await ctx.plugin(StorageJson, { root });
  await ctx.plugin(StorageDomain, { backend: 'json' });
  const credentialRefs = [];
  ctx.provide('credentials', { async resolve(ref) {
    credentialRefs.push(ref);
    return options.missingCredential ? undefined : { value: 'fixture-only', source: 'fixture' };
  } });
  let preset = 'anti-overengineering';
  ctx.provide('agentPresets', { composedPreset() { return preset; } });
  let shared;
  const client = new Context();
  t.after(() => client.fiber.dispose());
  let principal = { kind: 'owner' };
  if (options.web) {
    await ctx.plugin({ name: 'native-connection', apply(provider) {
      new HostConnectionService(provider, [], {
        isAuthenticated() { return false; }, authenticateApi() { return false; },
      });
    } });
    shared = ctx.get('connection').createSharedFetchHandler('/api');
    installConnection(client, { transport: { fetch(input, init) {
      return shared.fetch(new Request(new URL(input, 'http://fixture/'), init), { principal });
    } } });
  }
  const rounds = new WeakMap();
  ctx.provide('sessionProjections', { stateOf(session, projection) {
    assert.equal(projection, 'sessionStats');
    return { steps: rounds.get(session) - 1 };
  } });
  let bodyCalls = 0;
  for (const name of ['write', 'read']) ctx.tools.register(defineTool({
    name, description: `fixture ${name}`, parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute() { bodyCalls++; return 'executed'; },
  }));
  await ctx.plugin(Guard, config);
  function agent(id = 'usage-session', register = true) {
    const session = ctx.sessions.create(SessionId(id));
    session.append('turn/start', { turn: 1 });
    session.append('user/message', createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: '修复现有问题，不新增框架。' }] }), { surfaceOp: 'append' });
    const who = { id: session.id, ctx, session };
    if (register) ctx.effect(() => ctx.agents.enter(who, undefined));
    return who;
  }
  const defaultAgent = agent();
  return {
    root, close, agent, credentialRefs,
    setPreset(value) { preset = value; },
    request(body, headers = { 'content-type': 'application/json' }) {
      return shared.fetch(new Request('http://fixture/api/anti-overengineering/turn-usage', {
        method: 'POST', headers, body,
      }), { principal: { kind: 'owner' } });
    },
    rpc(payload = { sessionId: defaultAgent.id, turn: 1 }, who = { kind: 'owner' }, endpoint = 'turn-usage') {
      principal = who;
      return client.get('connection').rpc.call('/api', 'anti-overengineering/' + endpoint, payload, new AbortController().signal);
    },
    async preStep(who = defaultAgent, turn = 1) {
      const result = await ctx.waterfall(ctx, 'agent/pre-step', {
        agent: who, messages: who.session.deriveMessages(), turn, step: 1, signal: new AbortController().signal,
      }, async () => ({ kind: 'enter', messages: [] }));
      assert.deepEqual(result, { kind: 'enter', messages: [] });
    },
    end(kind = 'completed', turn = 1, who = defaultAgent) {
      who.session.append('turn/end', { turn, reason: { kind } });
    },
    start(turn, who = defaultAgent) { who.session.append('turn/start', { turn }); },
    snapshots() { return ctx.storageDomain.get(DOMAIN).table('turns'); },
    get bodyCalls() { return bodyCalls; },
    state(who = defaultAgent) { return structuredClone(ctx.storageDomain.get(DOMAIN).table('sessions').get(who.id)); },
    async batch(round, names = ['write'], who = defaultAgent) {
      rounds.set(who.session, round);
      const calls = names.map((name, index) => ({ id: ToolCallId(`${who.id}-${round}-${index}`), name }));
      who.session.append('assistant/message', {
        stream: [], turn: 1, step: round,
        message: createAssistantMessage({ source: { provider: 'fixture', model: 'fixture' },
          content: calls.map(call => ({ type: 'tool-call', ...call, arguments: '{}' })),
        }),
      }, { surfaceOp: 'append' });
      return Promise.all(calls.map(call => ctx.tools.execute({
        signal: new AbortController().signal, callId: call.id, name: call.name, arguments: {}, agent: who,
      })));
    },
  };
}
function notes(results) {
  return results.flatMap(result => result.additionalContexts ?? []).filter(message => message.source.kind === 'anti-overengineering');
}
function usage(h, calls, pricedCalls, ruleCounts = {}) {
  assert.deepEqual(h.state().usage, {
    calls, pricedCalls, estimatedUsd: pricedCalls * COST, ruleCounts,
    inputTokens: pricedCalls * 1_000_000, tokenCalls: pricedCalls,
  });
}

test('host initializes native storage and publishes usage with a valid baseline table name', async t => {
  const requests = jev(t);
  const h = await harness(t, {}, { web: true });
  assert.deepEqual(await h.rpc(), { ok: true, value: null });
  h.start(2);
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 2 }), { ok: true, value: { pending: true } });
  const results = await h.batch(1);
  assert.equal(requests.length, 1);
  assert.equal(notes(results).length, 1);
  h.end('completed', 2);
  const snapshot = await h.rpc({ sessionId: 'usage-session', turn: 2 });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.calls, 1);
  assert.equal(snapshot.value.inputTokens, 1_000_000);
  assert.equal(snapshot.value.currentTurn.calls, 1);
  await h.close();
  const disk = JSON.parse(await readFile(join(h.root, `${DOMAIN}.json`), 'utf8'));
  assert.ok(Object.hasOwn(disk.tables.turn_baselines, JSON.stringify(['usage-session', 2])));
});

test('missing historical snapshots are not pending just because the session is active', async t => {
  const h = await harness(t, {}, { web: true });
  h.start(5);
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 4 }), { ok: true, value: null });
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 5 }), { ok: true, value: { pending: true } });
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 6 }), { ok: true, value: null });
  h.end('completed', 5);
  assert.equal((await h.rpc({ sessionId: 'usage-session', turn: 5 })).value.calls, 0);
  h.start(6);
  h.setPreset('standard');
  h.end('completed', 6);
  h.setPreset('anti-overengineering');
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 6 }), { ok: true, value: null });
  await h.close();
  const reopened = await harness(t, {}, { root: h.root, web: true });
  assert.deepEqual(await reopened.rpc({ sessionId: 'usage-session', turn: 6 }), { ok: true, value: null });
});

test('parallel tool batch judges and bills once, counts every hit and emits one correction', async t => {
  const requests = jev(t);
  const h = await harness(t, { cadence: { maxRulesPerIntervention: 1 } });
  const results = await h.batch(1, ['write', 'read', 'write']);
  assert.deepEqual(results.map(result => result.isError), [true, false, true]);
  assert.equal(h.bodyCalls, 1);
  assert.equal(notes(results).length, 1);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].state.pending_tools.map(tool => tool.tool), ['write', 'write']);
  assert.equal(requests[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(h.state().judgments, 1);
  assert.equal(h.state().interventions, 1);
  assert.equal(h.state().lastDecision.injectedRuleIds.length, 1);
  usage(h, 1, 1, { [A]: 1, [B]: 1 });
});

test('global and same-rule cooldowns still count and price each judged hit', async t => {
  const requests = jev(t);
  const h = await harness(t);
  await h.batch(1);
  const global = await h.batch(2);
  assert.equal(h.state().lastDecision.status, 'global-cooldown');
  assert.ok(global.every(result => !result.isError));
  assert.equal(notes(global).length, 0);
  const sameRule = await h.batch(4);
  assert.equal(h.state().lastDecision.status, 'same-rule-cooldown');
  assert.ok(sameRule.every(result => !result.isError));
  assert.equal(notes(sameRule).length, 0);
  assert.equal(requests.length, 3);
  assert.equal(h.state().interventions, 1);
  usage(h, 3, 3, { [A]: 3, [B]: 3 });
});

test('missing credentials do not count as an HTTP call or priced expense', async t => {
  const requests = jev(t);
  const h = await harness(t, {}, { missingCredential: true });
  assert.equal((await h.batch(1))[0].isError, false);
  assert.equal(requests.length, 0);
  assert.deepEqual(h.credentialRefs, ['JEV_API_KEY']);
  assert.equal(h.state().lastDecision.status, 'jev-error-allow');
  assert.equal(h.state().judgments, 1);
  usage(h, 0, 0);
});

test('HTTP failure counts an attempted call with unknown rather than free expense', async t => {
  const requests = jev(t, () => new Response('unavailable', { status: 503 }));
  const h = await harness(t, { judge: { onError: 'deny' } });
  const results = await h.batch(1, ['write', 'read']);
  assert.deepEqual(results.map(result => result.isError), [true, false]);
  assert.equal(h.bodyCalls, 1);
  assert.equal(requests.length, 1);
  assert.equal(h.state().lastDecision.status, 'jev-error-deny');
  usage(h, 1, 0);
  assert.equal(notes(results).length, 0);
});

test('malformed scores retain valid usage pricing without recording rule hits', async t => {
  const requests = jev(t, () => Response.json({
    model: 'jev-latest', answers: { [A]: { type: 'noul', noul: 'invalid' } },
    usage: { input_tokens: 1_000_000, output_tokens: 900_000 },
  }));
  const h = await harness(t);
  assert.equal((await h.batch(1))[0].isError, false);
  assert.equal(requests.length, 1);
  assert.equal(h.state().lastDecision.status, 'jev-error-allow');
  assert.deepEqual(h.state().lastDecision.hitIds, []);
  assert.equal(h.state().interventions, 0);
  usage(h, 1, 1);
});

test('usage survives storage close/reopen and stays isolated between sessions', async t => {
  const requests = jev(t);
  const first = await harness(t);
  await first.batch(1);
  const before = first.state();
  await first.close();
  const disk = await readFile(join(first.root, `${DOMAIN}.json`), 'utf8');
  assert.ok(disk.includes('usage-session'));
  const reopened = await harness(t, {}, { root: first.root });
  assert.deepEqual(reopened.state(), before);
  const other = reopened.agent('other-session');
  assert.equal(reopened.state(other), undefined);
  const readOnly = await reopened.batch(1, ['read'], other);
  assert.equal(readOnly[0].isError, false);
  assert.equal(reopened.state(other), undefined);
  assert.equal(requests.length, 1);
  await reopened.batch(2, ['write'], other);
  assert.deepEqual(reopened.state(), before);
  assert.deepEqual(reopened.state(other).usage, before.usage);
  await reopened.batch(2);
  usage(reopened, 2, 2, { [A]: 2, [B]: 2 });
  assert.deepEqual(reopened.state(other).usage, before.usage);
  assert.equal(requests.length, 3);
  await reopened.close();
});

for (const reason of ['completed', 'interrupted']) test(`native ${reason} turn end stores a frozen cumulative usage snapshot`, async t => {
  jev(t);
  const h = await harness(t, {}, { web: true });
  await h.preStep();
  await h.batch(1);
  h.end(reason);
  const snapshot = await h.rpc();
  assert.deepEqual(snapshot, { ok: true, value: h.state().usage });
  h.start(2);
  await h.preStep(undefined, 2);
  await h.batch(2);
  h.end('completed', 2);
  assert.deepEqual(await h.rpc(), snapshot);
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 2 }), {
    ok: true, value: { ...h.state().usage, currentTurn: snapshot.value },
  });
  assert.equal(snapshot.value.calls, 1);
  assert.equal(h.state().usage.calls, 2);
  await h.close();
  assert.equal((await h.request('{}')).status, 404);
  const reopened = await harness(t, {}, { root: h.root, web: true });
  assert.deepEqual(await reopened.rpc(), snapshot);
  await reopened.close();
});

test('text-only selected turns snapshot zero usage; other presets and untracked sessions stay hidden', async t => {
  const requests = jev(t);
  const h = await harness(t, {}, { web: true });
  await h.preStep();
  h.end();
  assert.deepEqual(await h.rpc(), { ok: true, value: {
    calls: 0, pricedCalls: 0, estimatedUsd: 0, ruleCounts: {}, inputTokens: 0, tokenCalls: 0,
  } });
  assert.equal(h.state(), undefined);
  h.start(2);
  h.setPreset('standard');
  await h.preStep(undefined, 2);
  h.end('completed', 2);
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 2 }), { ok: true, value: null });
  h.setPreset('anti-overengineering');
  const untracked = h.agent('untracked-session', false);
  h.end('completed', 1, untracked);
  assert.deepEqual(await h.rpc({ sessionId: untracked.id, turn: 1 }), { ok: true, value: null });
  assert.equal(requests.length, 0);
});

test('turn ending before any pre-step snapshots usage and follows current preset on the same session', async t => {
  const requests = jev(t);
  const h = await harness(t, {}, { web: true });
  const zero = { ok: true, value: {
    calls: 0, pricedCalls: 0, estimatedUsd: 0, ruleCounts: {}, inputTokens: 0, tokenCalls: 0,
  } };
  h.end('interrupted');
  assert.deepEqual(await h.rpc(), zero);
  h.start(2);
  h.setPreset('standard');
  h.end('interrupted', 2);
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 2 }), { ok: true, value: null });
  h.start(3);
  h.setPreset('anti-overengineering');
  h.end('completed', 3);
  assert.deepEqual(await h.rpc({ sessionId: 'usage-session', turn: 3 }), zero);
  assert.deepEqual(await h.rpc(), zero);
  assert.equal(requests.length, 0);
});

test('turn usage RPC validates owner and payload before returning stored data', async t => {
  jev(t);
  const h = await harness(t, {}, { web: true });
  await h.preStep(); h.end();
  await assert.rejects(h.rpc(undefined, { kind: 'guest' }), /HTTP 403/);
  for (const payload of [null, {}, { sessionId: 42, turn: 1 }, { sessionId: 'usage-session', turn: -1 },
    { sessionId: 'usage-session', turn: 1.5 }, { sessionId: 'usage-session', turn: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal((await h.rpc(payload)).error.code, 'bad-request');
  }
  await assert.rejects(h.rpc(undefined, undefined, 'unknown'), /HTTP 404/);
  assert.deepEqual(await h.rpc({ sessionId: 'unknown-session', turn: 0 }), { ok: true, value: null });
  assert.equal((await h.request('{}', { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await h.request('{')).status, 400);
  assert.equal((await h.request('{}')).status, 400);
  assert.equal((await h.request(JSON.stringify({
    type: 'client-request', rpcId: 'fixture', method: 'unknown', payload: {},
  }))).status, 400);
});

test('RPC waits for an in-flight snapshot write and reports a rejected write', async t => {
  jev(t);
  const h = await harness(t, {}, { web: true });
  await h.preStep();
  const table = h.snapshots();
  const put = table.put.bind(table);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  t.mock.method(table, 'put', async (...args) => { await gate; return put(...args); });
  h.end();
  let settled = false;
  const pending = h.rpc().then(result => { settled = true; return result; });
  await Promise.resolve();
  assert.equal(settled, false);
  release();
  assert.equal((await pending).value.calls, 0);
  h.start(2);
  t.mock.method(table, 'put', async () => { throw new Error('fixture storage failure'); });
  h.end('completed', 2);
  assert.equal((await h.rpc({ sessionId: 'usage-session', turn: 2 })).error.code, 'usage-unavailable');
});

test('legacy sessions-only domain opens with an empty turns table and preserves unknown historical expense', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-usage-legacy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const legacy = new Context();
  await legacy.plugin(Storage);
  await legacy.plugin(StorageJson, { root });
  await legacy.plugin(StorageDomain, { backend: 'json' });
  const domain = await legacy.storageDomain.open(defineDomain({
    name: DOMAIN, version: 1, tables: { sessions: domainTable(z.unknown()) },
  }));
  const state = { ...initialState(), judgments: 3 };
  await domain.table('sessions').put('usage-session', state);
  await domain.close();
  await legacy.fiber.dispose();
  const requests = jev(t);
  const h = await harness(t, {}, { root, web: true });
  assert.deepEqual(h.state(), state);
  assert.deepEqual(await h.rpc(), { ok: true, value: null });
  await h.preStep();
  h.end();
  const historical = { calls: 3, pricedCalls: 0, estimatedUsd: 0, ruleCounts: {} };
  assert.deepEqual(await h.rpc(), { ok: true, value: historical });
  h.start(2);
  await h.batch(1);
  usage(h, 4, 1, { [A]: 1, [B]: 1 });
  assert.deepEqual(await h.rpc(), { ok: true, value: historical });
  assert.equal(requests.length, 1);
  await h.close();
});
