export const TOKOPUYO_SUGGESTION_CONFIG = Object.freeze({
  targetChains: 13,
  lookaheadHands: 3,
  resultLimit: 4,
  beamWidth: 180,
  timeBudgetMs: 2_500,
  goalVariantLimit: 16,
  roadmapCellLimit: 8,
  safetyCandidateLimit: 12,
  minimumTriggerChainRatio: 0.9,
  allowEmergencyClearFallback: true,
});
