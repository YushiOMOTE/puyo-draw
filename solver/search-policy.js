import { candidateScore, candidateVisualKey } from "./candidate-utils.js";
import { evaluateLatentChain } from "./latent-chain.js";

export function createSearchPolicy(request) {
  const { board, maxTriggerPuyos = 1 } = request;
  const baselinePotential = evaluateLatentChain(board, { maxTriggerPuyos });
  const baselineChains = baselinePotential.chains;
  const rawCandidates = [];
  const seenCandidates = new Set();

  return {
    baselinePotential,
    baselineChains,
    canSearch: baselinePotential.source !== "immediate",

    assess(candidateBoard, searchPlacements) {
      const potential = evaluateLatentChain(candidateBoard, {
        maxTriggerPuyos,
      });
      if (potential.source === "immediate") {
        return { expandable: false, potential };
      }

      if (potential.chains > baselineChains) {
        const rawCandidate = {
          searchPlacements: [...searchPlacements],
          triggerPlacements: potential.triggerPlacements,
          chains: potential.chains,
          chainGain: potential.chains - baselineChains,
          cleared: potential.cleared,
          score: candidateScore(
            potential,
            searchPlacements.length + potential.triggerPlacements.length,
          ),
        };
        const key = candidateVisualKey(
          {
            ...rawCandidate,
            placements: rawCandidate.searchPlacements,
          },
          board,
        );
        if (!seenCandidates.has(key)) {
          seenCandidates.add(key);
          rawCandidates.push(rawCandidate);
        }
      }

      return { expandable: true, potential };
    },

    candidates() {
      return rawCandidates;
    },
  };
}
