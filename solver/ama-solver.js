import { evaluateAmaField } from "./ama-evaluator.js";
import { availablePlacements, place } from "./move-generator.js";
import { MaxPriorityQueue } from "./priority-queue.js";

const FIELD_CODES = {
  red: "r",
  green: "g",
  blue: "b",
  yellow: "y",
  purple: "p",
  garbage: "x",
};

function fieldKey(board) {
  return board
    .map((row) => row.map((cell) => FIELD_CODES[cell] || "-").join(""))
    .join("/");
}

function searchPriority(board, potential, additions, baselineChains) {
  const chainGain = Math.max(0, potential.chains - baselineChains);
  return (
    chainGain * 100_000 +
    potential.chains * 10_000 +
    evaluateAmaField(board) -
    additions * 20
  );
}

/** @param {import('./contract.js').SuggestionRequest} request */
export function searchWithAma(request, policy) {
  const startedAt = performance.now();
  const {
    board,
    colors,
    maxAdditions,
    timeBudgetMs,
    maxQueueSize = 5_000,
  } = request;
  const { baselinePotential, baselineChains } = policy;

  const queue = new MaxPriorityQueue();
  const visited = new Map([[fieldKey(board), 0]]);
  let expanded = 0;
  let transpositionHits = 0;
  let timedOut = false;

  queue.push({
    board,
    placements: [],
    potential: baselinePotential,
    priority: evaluateAmaField(board),
  });

  while (queue.size) {
    if (performance.now() - startedAt >= timeBudgetMs) {
      timedOut = true;
      break;
    }

    const node = queue.pop();
    if (node.placements.length >= maxAdditions) continue;
    expanded++;

    for (const move of availablePlacements(node.board, colors)) {
      if (performance.now() - startedAt >= timeBudgetMs) {
        timedOut = true;
        break;
      }

      const placements = [...node.placements, move];
      const nextBoard = place(node.board, move);
      const depth = placements.length;
      const key = fieldKey(nextBoard);
      const visitedDepth = visited.get(key);
      if (visitedDepth !== undefined && visitedDepth <= depth) {
        transpositionHits++;
        continue;
      }
      visited.set(key, depth);

      const assessment = policy.assess(nextBoard, placements);
      if (!assessment.expandable) continue;
      const { potential } = assessment;

      queue.push({
        board: nextBoard,
        placements,
        potential,
        priority: searchPriority(nextBoard, potential, depth, baselineChains),
      });
    }

    if (expanded % 64 === 0) queue.retainBest(maxQueueSize);
    if (timedOut) break;
  }

  return {
    solver: "ama",
    baselineChains,
    rawCandidates: policy.candidates(),
    timedOut,
    stats: { expanded, transpositionHits, visited: visited.size },
  };
}
