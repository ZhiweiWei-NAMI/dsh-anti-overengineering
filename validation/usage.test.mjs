import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost, sessionUsage } from '../dsh-anti-overengineering/usage.js';

const direct = 'https://api.typesafe.ai/v1/systemone';
const gateway = 'https://opencode.ai/inference/v1/systemone';
test('official billable input tokens determine USD, not outputs or question count', () => {
  assert.equal(estimateCost({ model: 'jev-1.13.0', usage: { input_tokens: 1_000_000, output_tokens: 900 } }, direct), 0.042);
  assert.equal(estimateCost({ model: 'jev-1.14.0', usage: { input_tokens: 1_000_000 } }, direct), 0.042);
  assert.equal(estimateCost({ model: 'jev-1.13', usage: { input_tokens: 1_000_000 } }, gateway), 0.042);
  assert.equal(estimateCost({ model: 'jev-1.13-free', usage: { input_tokens: 100 } }, gateway), 0);
});
test('unavailable usage and unpriced models or providers never imply zero dollars', () => {
  for (const input_tokens of [undefined, null, -1, 1.5, Infinity, '120'])
    assert.equal(estimateCost({ usage: { input_tokens } }, direct, 'jev-latest'), null);
  assert.equal(estimateCost({ usage: { input_tokens: 100 } }, direct, 'unknown'), null);
  assert.equal(estimateCost({ usage: { input_tokens: 100 } }, 'https://example.com', 'jev-latest'), null);
  assert.equal(estimateCost({ usage: { input_tokens: 0 } }, direct, 'jev-latest'), 0);
});
test('historical attempts remain unpriced and existing totals survive restart', () => {
  assert.deepEqual(sessionUsage({ judgments: 7 }), { calls: 7, pricedCalls: 0, estimatedUsd: 0, ruleCounts: {} });
  const usage = { calls: 8, pricedCalls: 1, estimatedUsd: 0.042, ruleCounts: { AE01: 2 } };
  assert.deepEqual(sessionUsage(JSON.parse(JSON.stringify({ judgments: 8, usage }))), usage);
});
