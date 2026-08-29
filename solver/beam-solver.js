import { availablePlacements, place } from "./move-generator.js";

function fieldPotential(board) {
  let occupied = 0;
  let adjacentPairs = 0;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const color = board[row][col];
      if (!color || color === "garbage") continue;
      occupied++;
      if (board[row][col + 1] === color) adjacentPairs++;
      if (board[row + 1]?.[col] === color) adjacentPairs++;
    }
  }

  return occupied + adjacentPairs * 3;
}

function nodeScore(board, placements) {
  return fieldPotential(board) - placements.length * 0.1;
}

/** @param {import('./contract.js').SuggestionRequest} request */
export function searchWithBeam(request, policy) {
  const startedAt = performance.now();
  const { board, colors, maxAdditions, timeBudgetMs, beamWidth } =
    request;
  const { baselinePotential, baselineChains } = policy;

  let frontier = [{ board, placements: [], potential: baselinePotential }];
  let timedOut = false;

  for (let depth = 1; depth <= maxAdditions && frontier.length; depth++) {
    const nextFrontier = [];

    for (const node of frontier) {
      for (const move of availablePlacements(node.board, colors)) {
        if (performance.now() - startedAt >= timeBudgetMs) {
          timedOut = true;
          break;
        }

        const placements = [...node.placements, move];
        const nextBoard = place(node.board, move);
        const assessment = policy.assess(nextBoard, placements);
        if (!assessment.expandable) continue;
        const { potential } = assessment;
        nextFrontier.push({
          board: nextBoard,
          placements,
          potential,
        });
      }
      if (timedOut) break;
    }
    if (timedOut) break;

    nextFrontier.sort(
      (left, right) =>
        nodeScore(right.board, right.placements) -
        nodeScore(left.board, left.placements),
    );
    frontier = nextFrontier.slice(0, beamWidth);
  }

  return {
    solver: "beam",
    baselineChains,
    rawCandidates: policy.candidates(),
    timedOut,
  };
}
