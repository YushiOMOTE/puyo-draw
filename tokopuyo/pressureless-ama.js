import { dropTsumo } from "./pair-engine.js";

export const AMA_BRANCH_COUNT = 6;

export function aggregateAmaBranches(request, branches) {
  const branchCount = request.branchCount ?? AMA_BRANCH_COUNT;
  if (branches.length !== branchCount) {
    throw new Error("Pressureless Ama returned an incomplete branch set");
  }

  const orderedBranches = [...branches].sort((left, right) =>
    left.branch - right.branch
  );
  if (orderedBranches.some(({ branch }, index) => branch !== index)) {
    throw new Error("Pressureless Ama returned invalid future branches");
  }
  const aggregate = new Map();
  for (const branch of orderedBranches) {
    for (const candidate of branch.candidates) {
      const key = `${candidate.col},${candidate.orientation}`;
      let result = aggregate.get(key);
      if (!result) {
        result = {
          col: candidate.col,
          orientation: candidate.orientation,
          branchScores: Array(branchCount).fill(0),
          score: 0,
        };
        aggregate.set(key, result);
      }
      result.branchScores[branch.branch] = candidate.score;
      result.score += candidate.score;
    }
  }

  const candidates = [];
  for (const candidate of aggregate.values()) {
    const placement = dropTsumo(
      request.board,
      request.current,
      candidate.col,
      candidate.orientation,
      request.row14,
    );
    if (!placement) {
      throw new Error("Pressureless Ama returned a non-committable placement");
    }
    candidates.push({
      solver: "pressureless-ama",
      col: candidate.col,
      orientation: candidate.orientation,
      score: candidate.score,
      averageScore: Math.floor(candidate.score / branchCount),
      branchScores: candidate.branchScores,
      moves: [{
        handOffset: 0,
        col: candidate.col,
        orientation: candidate.orientation,
        cells: placement.cells,
      }],
    });
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates.slice(0, request.resultLimit ?? 4);
}
