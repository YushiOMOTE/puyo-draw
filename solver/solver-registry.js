import { searchWithAma } from "./ama-solver.js";
import { searchWithBeam } from "./beam-solver.js";
import { searchWithHybrid } from "./hybrid-solver.js";
import { finalizeSuggestionResult } from "./candidate-pipeline.js";
import { createSearchPolicy } from "./search-policy.js";

const solvers = {
  ama: searchWithAma,
  beam: searchWithBeam,
  hybrid: searchWithHybrid,
};

export function solveSuggestion(request) {
  const solverName = request.solver || "hybrid";
  const solver = solvers[solverName];
  if (!solver) throw new Error(`Unknown suggestion solver: ${solverName}`);

  const policy = createSearchPolicy(request);
  if (!policy.canSearch) {
    return {
      solver: solverName,
      baselineChains: policy.baselineChains,
      candidates: [],
      timedOut: false,
    };
  }

  return finalizeSuggestionResult(solver(request, policy), request);
}
