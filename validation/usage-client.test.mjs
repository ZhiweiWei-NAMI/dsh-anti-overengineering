import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dsh-anti-overengineering/client.js', import.meta.url), 'utf8');
function fixture(result = { ok: true, value: null }, timers = { setTimeout, clearTimeout }) {
  let plugin, component, resource, dictionaries;
  const disposers = [], calls = [];
  const context = {
    URL, console, ...timers,
    window: { __ModuleLoader__: { load(row) {
      assert.equal(row.id, 'dsh-anti-overengineering');
      plugin = row.factory(name => {
        assert.equal(name, 'react');
        return { createElement: (tag, props, text) => ({ tag, props, text }) };
      });
    } } },
  };
  vm.runInNewContext(source, context);
  plugin.apply({
    effect(fn) { disposers.push(fn()); },
    locale: { register(_ns, values) { dictionaries = values; return () => { dictionaries = null; }; } },
    resources: { register(value) { resource = value; return () => { resource = null; }; } },
    connection: { rpc: { async call(...args) { calls.push(args); return typeof result === 'function' ? result(...args) : result; } } },
    slots: {
      inject(name, fn) { assert.equal(name, 'conversation.chat.turnTail'); disposers.push(fn()); },
      register(options, value) {
        assert.equal(options.name, 'conversation.chat.turnTail'); component = value;
        return () => { component = null; };
      },
    },
  });
  return {
    render(value, language = 'zh', status = 'live') {
      return component({ sessionId: 'session-one', turn: { turn: 2 },
        useResource(address) { assert.equal(address, 'dsh-resource://anti-overengineering-usage/session-one/2'); return { status, value }; },
        t(key, args = {}) { return dictionaries[language][key].replace(/\{(\w+)\}/g, (_, name) => args[name]); },
      });
    },
    async fetch(signal = new AbortController().signal) {
      const values = [];
      for await (const value of resource.open('dsh-resource://anti-overengineering-usage/session-one/2', { signal })) values.push(value);
      return values;
    },
    calls,
    dispose() { for (const dispose of disposers.reverse()) dispose(); assert.equal(component, null); assert.equal(resource, null); assert.equal(dictionaries, null); },
  };
}
const usage = { calls: 2, pricedCalls: 2, estimatedUsd: 0.000084, ruleCounts: { AE02: 1, AE01: 2 } };
test('one muted localized line, stable rule order and six decimal USD', () => {
  const f = fixture();
  const zh = f.render(usage);
  assert.equal(zh.tag, 'div');
  assert.equal(zh.text, '本会话 · Jev：2 次调用 · 输入 token：未知 · 规则命中：AE01×2 · AE02×1 · 预估 USD 0.000084');
  assert.equal(f.render(usage, 'en').text, 'Session · Jev: 2 calls · Input tokens: unknown · Rule hits: AE01×2 · AE02×1 · Est. USD 0.000084');
  assert.equal(zh.props.style.font, 'var(--dsw-font-xxs-12)');
  f.dispose();
});
test('unknown, partial, zero, unavailable and missing historic snapshots stay distinct', () => {
  const f = fixture();
  assert.match(f.render({ ...usage, pricedCalls: 0 }).text, /未知$/);
  assert.match(f.render({ ...usage, pricedCalls: 1 }).text, /0.000084（1\/2 次已计价）$/);
  assert.equal(f.render({ calls: 0, pricedCalls: 0, estimatedUsd: 0, ruleCounts: {} }).text,
    '本会话 · Jev：0 次调用 · 输入 token：0 · 规则命中：无 · 预估 USD 0.000000');
  assert.equal(f.render(null), null);
  assert.equal(f.render(undefined, 'zh', 'loading'), null);
  assert.equal(f.render(undefined, 'en', 'failed').text, 'Jev session usage unavailable');
  f.dispose();
});
test('a running turn waits beyond the old retry limit, then renders its snapshot', async () => {
  const delays = [];
  let requests = 0;
  const snapshot = { ...usage, inputTokens: 4014, tokenCalls: 2, currentTurn: usage };
  const f = fixture(() => ++requests <= 8
    ? { ok: true, value: { pending: true } }
    : { ok: true, value: snapshot }, {
    setTimeout(fn, delay) { delays.push(delay); queueMicrotask(fn); return delays.length; },
    clearTimeout() {},
  });
  const frames = await f.fetch();
  assert.equal(frames.length, 1);
  assert.equal(frames[0].ok, true);
  assert.equal(frames[0].value, snapshot);
  assert.deepEqual(delays, [100, 250, 500, 1000, 2000, 2000, 2000, 2000]);
  assert.match(f.render(snapshot).text, /本轮 · Jev：2 次调用/);
  assert.match(f.render(snapshot).text, /输入 token：4014/);
  f.dispose();
});

test('pending polling stops when the resource is released', async () => {
  const controller = new AbortController();
  let requests = 0;
  const f = fixture(() => {
    if (++requests === 8) controller.abort();
    return { ok: true, value: { pending: true } };
  }, {
    setTimeout(fn) { queueMicrotask(fn); return 1; },
    clearTimeout() {},
  });
  assert.equal((await f.fetch(controller.signal)).length, 0);
  assert.equal(requests, 8);
  f.dispose();
});

test('resource uses authenticated RPC, validates replies, and stops publishing after abort', async () => {
  const f = fixture({ ok: true, value: usage });
  assert.equal((await f.fetch())[0].value, usage);
  assert.equal(f.calls[0][0], '/api');
  assert.equal(f.calls[0][1], 'anti-overengineering/turn-usage');
  assert.equal(f.calls[0][2].sessionId, 'session-one');
  assert.equal(f.calls[0][2].turn, 2);
  const controller = new AbortController(); controller.abort();
  assert.equal((await f.fetch(controller.signal)).length, 0);
  f.dispose();
  for (const value of [{ ...usage, calls: -1 }, { ...usage, pricedCalls: 3 }, { ...usage, ruleCounts: [] }]) {
    const invalid = fixture({ ok: true, value });
    assert.equal((await invalid.fetch())[0].ok, false);
    invalid.dispose();
  }
});
