/** Deterministic sampling and intervention policy; Jev supplies only rule scores. */

export function initialState() {
  return {
    lastToolRound: 0, toolRounds: 0, judgments: 0, interventions: 0,
    lastInterventionRound: null, ruleLastRounds: {}, windowRounds: [],
    lastDecision: null,
  };
}

export function checkEligibility(state, round, cadence) {
  if (state.lastToolRound !== round) {
    state.lastToolRound = round;
    state.toolRounds += 1;
  }
  if (cadence.maxInterventionsPerSession > 0 && state.interventions >= cadence.maxInterventionsPerSession)
    return "session-intervention-limit";
  if (cadence.maxJevCallsPerSession > 0 && state.judgments >= cadence.maxJevCallsPerSession)
    return "session-jev-limit";
  if ((state.toolRounds - 1) % cadence.checkEveryToolRounds !== 0)
    return "sampling";
  return null;
}

export function selectIntervention(scores, rules, state, round, config) {
  const hits = rules.filter(rule => scores[rule.id] >= (config.rules[rule.id]?.threshold ?? config.threshold));
  const result = { hitIds: hits.map(rule => rule.id), selected: [], reason: "below-threshold" };
  if (!hits.length) return result;
  const c = config.cadence;
  if (state.lastInterventionRound !== null && round - state.lastInterventionRound <= c.globalCooldownRounds)
    return { ...result, reason: "global-cooldown" };
  const window = state.windowRounds.filter(r => round - r < c.windowRounds);
  if (c.maxInterventionsPerWindow > 0 && window.length >= c.maxInterventionsPerWindow)
    return { ...result, reason: "rolling-window-limit" };
  const selected = hits.filter(rule => {
    const previous = state.ruleLastRounds[rule.id];
    const cooldown = config.rules[rule.id]?.cooldownRounds ?? c.sameRuleCooldownRounds;
    return previous === undefined || round - previous > cooldown;
  }).sort((a, b) => scores[b.id] - scores[a.id] || a.id.localeCompare(b.id))
    .slice(0, c.maxRulesPerIntervention);
  if (!selected.length) return { ...result, reason: "same-rule-cooldown" };
  state.interventions += 1;
  state.lastInterventionRound = round;
  state.windowRounds = [...window, round];
  for (const rule of selected) state.ruleLastRounds[rule.id] = round;
  return { ...result, selected, reason: "intervene" };
}

/** A Noul is the returned affirmative value, not an additional confidence field. */
export function parseScores(body, rules) {
  const scores = {};
  for (const rule of rules) {
    const answer = body.answers?.[rule.id];
    if (answer?.type !== "noul" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1)
      throw new Error(`Invalid Jev Noul answer for ${rule.id}`);
    scores[rule.id] = answer.noul;
  }
  return scores;
}
