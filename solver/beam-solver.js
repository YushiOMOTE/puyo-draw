import { simulate } from "../engine.js";
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

function candidateScore(result, additions) {
  // Chain count dominates: a longer extension always beats a cheap short one.
  // For equal chains, a compact completion is more useful than extra clears.
  return result.chains * 1_000_000 - additions * 1_000 + result.cleared;
}

function nodeScore(board, placements) {
  return fieldPotential(board) - placements.length * 0.1;
}

function placementKey(placements) {
  return placements
    .map(({ row, col, color }) => `${row},${col},${color}`)
    .sort()
    .join("|");
}

/** @param {import('./contract.js').SuggestionRequest} request */
export function solveWithBeam(request) {
  const startedAt = performance.now();
  const { board, colors, maxAdditions, resultLimit, timeBudgetMs, beamWidth } =
    request;
  let frontier = [{ board, placements: [] }];
  const candidates = [];
  const seenCandidates = new Set();
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
        const result = simulate(nextBoard);

        if (result.chains) {
          const key = placementKey(placements);
          if (!seenCandidates.has(key)) {
            seenCandidates.add(key);
            candidates.push({
              placements,
              chains: result.chains,
              cleared: result.cleared,
              score: candidateScore(result, placements.length),
            });
          }
        }
        nextFrontier.push({ board: nextBoard, placements });
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

  candidates.sort(
    (left, right) =>
      right.score - left.score || left.placements.length - right.placements.length,
  );
  return { candidates: candidates.slice(0, resultLimit), timedOut };
}
