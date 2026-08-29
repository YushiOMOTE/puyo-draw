export const SUGGESTION_SEARCH_CONFIG = Object.freeze({
  solver: "ama",
  maxAdditions: 8,
  resultLimit: 5,
  timeBudgetMs: 2_000,
  minimizationBudgetMs: 300,
  minimumChainGain: 2,
  targetChainGain: 3,
  maxTriggerPuyos: 1,
  beamWidth: 120,
  maxQueueSize: 5_000,
});
