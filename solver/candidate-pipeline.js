import { finalizeCandidates } from "./candidate-utils.js";

function toDisplayCandidate(rawCandidate) {
  const { searchPlacements, ...candidate } = rawCandidate;
  return { ...candidate, placements: searchPlacements };
}

export function finalizeSuggestionResult(rawResult, request) {
  const { rawCandidates, ...result } = rawResult;
  const candidates = finalizeCandidates(
    rawCandidates.map(toDisplayCandidate),
    request.resultLimit,
    request,
  );
  return { ...result, candidates };
}
