/**
 * @typedef {Object} SuggestionRequest
 * @property {Array<Array<string | null>>} board
 * @property {string[]} colors
 * @property {number} maxAdditions
 * @property {number} resultLimit
 * @property {number} timeBudgetMs
 * @property {number} [minimizationBudgetMs]
 * @property {number} beamWidth
 * @property {number} [maxQueueSize]
 * @property {'ama' | 'beam'} [solver]
 * @property {number} [minimumChainGain]
 * @property {number} [targetChainGain]
 * @property {number} [maxTriggerPuyos]
 */

/**
 * @typedef {Object} RawSuggestionCandidate
 * @property {Array<{row: number, col: number, color: string}>} searchPlacements
 * @property {Array<{row: number, col: number, color: string}>} triggerPlacements
 * @property {number} chains
 * @property {number} chainGain
 * @property {number} cleared
 * @property {number} score
 */

/**
 * @typedef {Object} SuggestionCandidate
 * @property {Array<{row: number, col: number, color: string}>} placements
 * @property {Array<{row: number, col: number, color: string}>} triggerPlacements
 * @property {number} chains
 * @property {number} chainGain
 * @property {number} cleared
 * @property {number} score
 */

export function boardKey(board, colors) {
  const field = board
    .map((row) => row.map((cell) => cell || "-").join(""))
    .join("/");
  return `${colors.join(",")}:${field}`;
}
