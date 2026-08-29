export const SUGGESTION_SEARCH_CONFIG = Object.freeze({
  solver: "hybrid",
  maxAdditions: 20,
  resultLimit: 8,
  timeBudgetMs: 5_000,
  minimizationBudgetMs: 300,
  minimumChainGain: 2,
  targetChainGain: 3,
  maxTriggerPuyos: 1,
  beamWidth: 48,
  maxQueueSize: 5_000,
});
