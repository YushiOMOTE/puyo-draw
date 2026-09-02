import { dropTsumo } from "./pair-engine.js";

export const AMA_BRANCH_COUNT = 6;

function cellSetKey(cells) {
  return cells
    .map(({ row, col, color }) => `${row},${col},${color}`)
    .sort()
    .join("|");
}

export function analyzeAmaBranches(request, branches) {
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
  return candidates;
}

export function aggregateAmaBranches(request, branches) {
  return analyzeAmaBranches(request, branches)
    .slice(0, request.resultLimit ?? 4);
}

export function summarizeAmaBranchScores(scores) {
  if (!Array.isArray(scores) || scores.length !== AMA_BRANCH_COUNT) {
    throw new TypeError("Ama branch summary requires six scores");
  }
  if (scores.some((score) => !Number.isFinite(score) || score < 0)) {
    throw new TypeError("Ama branch scores must be non-negative numbers");
  }
  const total = scores.reduce((sum, score) => sum + score, 0);
  return {
    total,
    average: Math.floor(total / scores.length),
    minimum: Math.min(...scores),
    maximum: Math.max(...scores),
  };
}

export function evaluateAmaMove(lastTurn, candidates) {
  if (!lastTurn?.placement?.cells?.length) {
    throw new TypeError("Last-move review requires locked pair cells");
  }
  if (!Array.isArray(candidates)) {
    throw new TypeError("Last-move review requires Ama candidates");
  }
  if (!candidates.length) {
    return {
      verdict: lastTurn.result.gameOver
        ? "no-surviving-choice"
        : "unavailable",
      best: null,
      user: null,
      rank: null,
      legalCount: 0,
      averageGap: null,
      branches: null,
      userStats: null,
      bestStats: null,
      branchComparisons: null,
      aggregateRetention: null,
    };
  }

  const best = candidates[0];
  const userKey = cellSetKey(lastTurn.placement.cells);
  const userIndex = candidates.findIndex(
    (candidate) => cellSetKey(candidate.moves[0].cells) === userKey,
  );
  if (userIndex < 0) {
    return {
      verdict: lastTurn.result.gameOver ? "game-over" : "unavailable",
      best,
      user: null,
      rank: null,
      legalCount: candidates.length,
      averageGap: null,
      branches: null,
      userStats: null,
      bestStats: summarizeAmaBranchScores(best.branchScores),
      branchComparisons: null,
      aggregateRetention: null,
    };
  }

  const user = candidates[userIndex];
  const branches = { user: 0, tied: 0, ama: 0 };
  const branchComparisons = user.branchScores.map((score, index) => {
    const bestScore = best.branchScores[index];
    if (score > bestScore) branches.user++;
    else if (score === bestScore) branches.tied++;
    else branches.ama++;
    return {
      branch: index,
      userScore: score,
      amaScore: bestScore,
      winner: score > bestScore ? "user" : score === bestScore ? "tied" : "ama",
    };
  });

  const samePlacement = cellSetKey(best.moves[0].cells) === userKey;
  return {
    verdict: samePlacement
      ? "top-choice"
      : user.score === best.score
        ? "tied-choice"
        : "different-choice",
    best,
    user,
    rank: userIndex + 1,
    legalCount: candidates.length,
    averageGap: best.averageScore - user.averageScore,
    branches,
    userStats: summarizeAmaBranchScores(user.branchScores),
    bestStats: summarizeAmaBranchScores(best.branchScores),
    branchComparisons,
    aggregateRetention: best.score > 0 ? user.score / best.score : 1,
  };
}
