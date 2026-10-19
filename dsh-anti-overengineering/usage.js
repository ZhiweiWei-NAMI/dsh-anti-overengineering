/** Official input-token list prices; outputs are free. Verified 2026-10-19.
 * https://docs.typesafe.ai/models
 * https://opencode.ai/v2/docs/console/models/#pricing
 */
export function estimateCost(body, endpoint, requestedModel) {
  const tokens = inputTokens(body);
  if (tokens === null) return null;
  const url = new URL(endpoint);
  const model = body.model ?? requestedModel;
  const official = url.protocol === "https:" && url.hostname === "api.typesafe.ai"
    && ["jev-latest", "jev-preview", "jev-1.13.0", "jev-1.14.0"].includes(model);
  const opencode = url.protocol === "https:" && url.hostname === "opencode.ai";
  if (opencode && model === "jev-1.13-free") return 0;
  if (official || (opencode && ["jev-1.13", "jev-1.13.0"].includes(model)))
    return tokens * 0.042 / 1_000_000;
  return null;
}

/** Only reported, nonnegative integer input-token usage is known. */
export function inputTokens(body) {
  const tokens = body?.usage?.input_tokens;
  return Number.isSafeInteger(tokens) && tokens >= 0 ? tokens : null;
}

/** Missing historical usage stays explicitly incomplete rather than becoming free. */
export function sessionUsage(state) {
  return state.usage ?? { calls: state.judgments, pricedCalls: 0, estimatedUsd: 0, ruleCounts: {},
    ...(state.judgments === 0 ? { inputTokens: 0, tokenCalls: 0 } : {}) };
}

/** Subtract a captured turn baseline without attributing historical calls to this turn. */
export function usageDelta(total, baseline) {
  const ruleCounts = {};
  for (const [id, count] of Object.entries(total.ruleCounts)) {
    const delta = count - (baseline.ruleCounts[id] ?? 0);
    if (delta > 0) ruleCounts[id] = delta;
  }
  return {
    calls: total.calls - baseline.calls,
    pricedCalls: total.pricedCalls - baseline.pricedCalls,
    estimatedUsd: Math.max(0, total.estimatedUsd - baseline.estimatedUsd),
    ruleCounts,
    inputTokens: (total.inputTokens ?? 0) - (baseline.inputTokens ?? 0),
    tokenCalls: (total.tokenCalls ?? 0) - (baseline.tokenCalls ?? 0),
  };
}
