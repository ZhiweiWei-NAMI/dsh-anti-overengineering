import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools';
import { createUserMessage, createAssistantMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import { Session, SessionId } from '@deepseek-ai/dsh-session';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import * as Guard from './guard/index.js';

// Real official Cordis, ToolRuntime, Session message constructors and durable JSON
// domain storage. Only external HTTP, credentials, preset choice and step clock
// are test fixtures. No inference server or user credentials are contacted.
const rules = JSON.parse(await readFile(new URL('./guard/rules.json', import.meta.url), 'utf8'));
const RULE_A = rules[0].id;
const RULE_B = rules[1].id;
const artifacts = fileURLToPath(new URL('./behavior-fixtures/', import.meta.url));
await mkdir(artifacts, { recursive: true });

function installJev(t, scoreSource = () => ({ [RULE_A]: 0.94 })) {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    const state = typeof body.state === 'string' ? JSON.parse(body.state) : body.state;
    requests.push({ url, options, body, state });
    const scores = scoreSource(requests.length, body, state);
    return Response.json({
      model: 'jev-fixture',
      answers: Object.fromEntries(Object.keys(body.questions).map(id => [id, {
        type: 'noul', noul: scores[id] ?? 0.04,
      }])),
      usage: { input_tokens: 120, output_tokens: 12 },
    });
  });
  return requests;
}

async function harness(config = {}, options = {}) {
  const root = options.root ?? await mkdtemp(join(artifacts, 'domain-'));
  const ctx = new Context();
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(ToolRuntime);
  await ctx.plugin(Storage);
  await ctx.plugin(StorageJson, { root });
  await ctx.plugin(StorageDomain, { backend: 'json' });
  const session = Session.create(SessionId(options.sessionId ?? 'guard-behavior-session'));
  const agent = { id: session.id, ctx, session };
  let round = 1;
  let preset = 'anti-overengineering';
  let bodyCalls = 0;
  const credentialRefs = [];
  ctx.provide('credentials', { async resolve(ref) {
    credentialRefs.push(ref);
    return { value: 'test-only-not-a-real-key', source: 'fixture' };
  } });
  ctx.provide('agentPresets', { composedPreset() { return preset; } });
  ctx.provide('sessionProjections', { stateOf(s, projection) {
    assert.equal(s, session);
    assert.equal(projection, 'sessionStats');
    return { steps: round - 1 };
  } });
  for (const name of ['write', 'edit', 'read']) ctx.tools.register(defineTool({
    name, description: `test ${name}`,
    parameters: {
      path: { type: 'string' },
      content: { type: 'string' },
      old_string: { type: 'string' },
      new_string: { type: 'string' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute() { bodyCalls += 1; return `${name} body executed`; },
  }));
  await ctx.plugin(Guard, config);
  session.append('turn/start', { turn: 1 });
  session.append('user/message', createUserMessage({
    source: { kind: 'user' }, content: [{ type: 'text', text: '只修复列表滚动跳动，保留既有交互。' }],
  }), { surfaceOp: 'append' });
  return {
    ctx, agent, root, credentialRefs,
    setPreset(value) { preset = value; },
    batch(atRound, calls = [{ name: 'write', arguments: { path: 'src/list.js', content: 'new FactoryRegistry();' } }]) {
      round = atRound;
      const identified = calls.map((call, index) => ({
        id: ToolCallId(`r${atRound}-call${index}`), name: call.name, arguments: call.arguments,
        ...(call.wireArguments === undefined ? {} : { wireArguments: call.wireArguments }),
      }));
      session.append('assistant/message', {
        stream: [], turn: 1, step: atRound,
        message: createAssistantMessage({
          content: identified.map(call => ({ type: 'tool-call', id: call.id, name: call.name, arguments: call.wireArguments ?? JSON.stringify(call.arguments) })),
          source: { provider: 'fixture', model: 'executor-fixture' },
        }),
      }, { surfaceOp: 'append' });
      return identified;
    },
    run(call) {
      return ctx.tools.execute({
        signal: new AbortController().signal,
        callId: call.id, name: call.name, arguments: call.arguments, agent,
      });
    },
    state() { return structuredClone(ctx.storageDomain.get('anti_overengineering_v1').table('sessions').get(agent.id)); },
    get bodyCalls() { return bodyCalls; },
    async close() { await ctx.fiber.dispose(); },
  };
}

function notes(result) { return (result.additionalContexts ?? []).filter(m => m.source.kind === 'anti-overengineering'); }
async function one(h, round) { return h.run(h.batch(round)[0]); }

test('native pre denial prevents body and native post carries one correction; HTTP is actual Noul shape', async t => {
  const requests = installJev(t);
  const h = await harness(); t.after(() => h.close());
  const result = await one(h, 1);
  assert.equal(result.isError, true);
  assert.equal(h.bodyCalls, 0);
  assert.equal(notes(result).length, 1);
  assert.match(notes(result)[0].content[0].text, /尚未执行/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-only-not-a-real-key');
  assert.equal(requests[0].body.model, 'jev-latest');
  assert.equal(Object.keys(requests[0].body.questions).length, rules.length);
  assert.ok(Object.values(requests[0].body.questions).every(q => q.type === 'noul' && typeof q.instructions === 'string'));
  assert.equal(requests[0].state.pending_writes[0].arguments.content, 'new FactoryRegistry();');
  assert.match(requests[0].state.user_requirements, /只修复列表/);
  assert.deepEqual(h.credentialRefs, ['JEV_API_KEY']);
  assert.equal(h.state().interventions, 1);
});

test('same assistant batch: parallel writes both blocked, one Jev call and one note despite cooldown reservation', async t => {
  const requests = installJev(t);
  const h = await harness(); t.after(() => h.close());
  const calls = h.batch(1, [
    { name: 'write', arguments: { path: 'a.js', content: 'new Registry();' } },
    { name: 'edit', arguments: { path: 'b.js', old_string: 'x', new_string: 'new Wrapper(x)' } },
  ]);
  const results = await Promise.all(calls.map(call => h.run(call)));
  assert.ok(results.every(r => r.isError));
  assert.equal(h.bodyCalls, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].state.pending_writes.length, 2);
  assert.equal(results.reduce((sum, r) => sum + notes(r).length, 0), 1);
  assert.equal(h.state().judgments, 1);
  assert.equal(h.state().interventions, 1);
});

test('optional raw-string apply_patch remains complete beside a native write in the same judged batch', async t => {
  const requests = installJev(t);
  const h = await harness(); t.after(() => h.close());
  const patch = '*** Begin Patch\n*** Update File: src/list.js\n@@\n-old();\n+new FactoryRegistry(); // 保留原始换行与中文\n*** End Patch';
  const calls = h.batch(1, [
    { name: 'write', arguments: { path: 'src/first.js', content: 'const first = true;' } },
    { name: 'apply_patch', arguments: patch, wireArguments: patch },
  ]);
  const result = await h.run(calls[0]);
  assert.equal(result.isError, true);
  assert.equal(h.bodyCalls, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].state.pending_writes.length, 2);
  assert.deepEqual(requests[0].state.pending_writes[0].arguments, calls[0].arguments);
  assert.equal(requests[0].state.pending_writes[1].tool, 'apply_patch');
  assert.equal(requests[0].state.pending_writes[1].arguments, patch);
  assert.equal(notes(result).length, 1);
});

test('native ask remains ask when rules pass; native approval still runs before body', async t => {
  const requests = installJev(t, () => ({}));
  const h = await harness(); t.after(() => h.close());
  const approvals = [];
  h.ctx.provide('approval', { async request(req) { approvals.push(req); return 'allowed-once'; } });
  h.ctx.on('tools/pre-execute', async () => ({ kind: 'ask', reason: 'existing permission policy' }));
  const result = await one(h, 1);
  assert.equal(result.isError, false);
  assert.equal(requests.length, 1);
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].reason, 'existing permission policy');
  assert.equal(h.bodyCalls, 1);
});

test('rule violation narrows native ask to deny without body or approval bypass', async t => {
  const requests = installJev(t);
  const h = await harness(); t.after(() => h.close());
  let approvals = 0;
  h.ctx.provide('approval', { async request() { approvals++; return 'allowed-once'; } });
  h.ctx.on('tools/pre-execute', async () => ({ kind: 'ask', reason: 'existing permission policy' }));
  const result = await one(h, 1);
  assert.equal(result.isError, true);
  assert.equal(requests.length, 1);
  assert.equal(approvals, 0);
  assert.equal(h.bodyCalls, 0);
  assert.equal(notes(result).length, 1);
});

test('existing downstream denial is preserved without a Jev call', async t => {
  const requests = installJev(t);
  const h = await harness(); t.after(() => h.close());
  h.ctx.on('tools/pre-execute', async () => ({ kind: 'deny', reason: 'existing policy denial' }));
  const result = await one(h, 1);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /existing policy denial/);
  assert.equal(requests.length, 0);
  assert.equal(h.bodyCalls, 0);
});

test('downstream post block and its existing context survive additional correction', async t => {
  installJev(t);
  const h = await harness(); t.after(() => h.close());
  const oldContext = createUserMessage({ source: { kind: 'fixture-post', form: 'notice', summary: 'existing context' }, content: [{ type: 'text', text: 'retain existing context' }] });
  h.ctx.on('tools/post-execute', async () => ({
    kind: 'block', feedback: [{ type: 'text', text: 'downstream block' }], additionalContexts: [oldContext],
  }));
  const result = await one(h, 1);
  assert.equal(result.isError, true);
  assert.equal(h.bodyCalls, 0);
  assert.equal(result.content[0].text, 'downstream block');
  assert.equal(result.additionalContexts.length, 2);
  assert.equal(result.additionalContexts[0].id, oldContext.id);
  assert.equal(notes(result).length, 1);
});

test('global cooldown 2 and same-rule cooldown 6 have exact boundaries; cooled A does not suppress fresh B', async t => {
  const requests = installJev(t, (_n, _body, state) => {
    const id = state.pending_writes[0].id;
    return id.startsWith('r4-') ? { [RULE_A]: 0.96, [RULE_B]: 0.94 } : { [RULE_A]: 0.96 };
  });
  const h = await harness(); t.after(() => h.close());
  assert.equal((await one(h, 1)).isError, true);
  assert.equal((await one(h, 2)).isError, false); assert.equal(h.state().lastDecision.status, 'global-cooldown');
  assert.equal((await one(h, 3)).isError, false); assert.equal(h.state().lastDecision.status, 'global-cooldown');
  assert.equal((await one(h, 4)).isError, true); assert.deepEqual(h.state().lastDecision.injectedRuleIds, [RULE_B]);
  assert.equal((await one(h, 7)).isError, false); assert.equal(h.state().lastDecision.status, 'same-rule-cooldown');
  assert.equal((await one(h, 8)).isError, true); assert.deepEqual(h.state().lastDecision.injectedRuleIds, [RULE_A]);
  assert.equal(requests.length, 6); // Cooldowns mute intervention, not judgment.
});

test('rolling-window intervention limit reopens exactly at the window boundary', async t => {
  const requests = installJev(t);
  const h = await harness({ cadence: {
    globalCooldownRounds: 0, sameRuleCooldownRounds: 0,
    windowRounds: 4, maxInterventionsPerWindow: 2, maxInterventionsPerSession: 0,
  } }); t.after(() => h.close());
  assert.equal((await one(h, 1)).isError, true);
  assert.equal((await one(h, 2)).isError, true);
  assert.equal((await one(h, 3)).isError, false); assert.equal(h.state().lastDecision.status, 'rolling-window-limit');
  assert.equal((await one(h, 4)).isError, false); assert.equal(h.state().lastDecision.status, 'rolling-window-limit');
  assert.equal((await one(h, 5)).isError, true);
  assert.deepEqual(h.state().windowRounds, [2, 5]);
  assert.equal(requests.length, 5);
});

test('native durable storage close/reopen preserves session cap, avoiding another Jev call', async t => {
  const requests = installJev(t);
  const config = { cadence: { globalCooldownRounds: 0, sameRuleCooldownRounds: 0, maxInterventionsPerSession: 1 } };
  const first = await harness(config);
  assert.equal((await one(first, 1)).isError, true);
  const root = first.root;
  await first.close();
  const disk = JSON.parse(await readFile(join(root, 'anti_overengineering_v1.json'), 'utf8'));
  assert.ok(JSON.stringify(disk).includes('guard-behavior-session'));
  const reopened = await harness(config, { root }); t.after(() => reopened.close());
  assert.equal(reopened.state().interventions, 1);
  assert.equal((await one(reopened, 9)).isError, false);
  assert.equal(reopened.state().lastDecision.status, 'session-intervention-limit');
  assert.equal(reopened.bodyCalls, 1);
  assert.equal(requests.length, 1);
});

test('native durable storage reopen retains rule/global/window fields', async t => {
  installJev(t);
  const first = await harness();
  assert.equal((await one(first, 1)).isError, true);
  const before = first.state(); const root = first.root;
  await first.close();
  const reopened = await harness({}, { root }); t.after(() => reopened.close());
  assert.deepEqual(reopened.state(), before);
  assert.equal((await one(reopened, 3)).isError, false);
  assert.equal(reopened.state().lastDecision.status, 'global-cooldown');
  assert.equal((await one(reopened, 7)).isError, false);
  assert.equal(reopened.state().lastDecision.status, 'same-rule-cooldown');
  assert.equal((await one(reopened, 8)).isError, true);
});

test('ordinary reads and agents using another preset neither judge nor write intervention state', async t => {
  const requests = installJev(t);
  const h = await harness(); t.after(() => h.close());
  const read = h.batch(1, [{ name: 'read', arguments: { path: 'a.js' } }])[0];
  assert.equal((await h.run(read)).isError, false);
  h.setPreset('standard');
  assert.equal((await one(h, 2)).isError, false);
  assert.equal(requests.length, 0);
  assert.equal(h.state(), undefined);
});
