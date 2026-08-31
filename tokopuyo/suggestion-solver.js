import {
  COLS,
  HIDDEN_ROWS,
  ROWS,
  applyGravity,
  simulate,
} from "../engine.js";
import { evaluateAmaField } from "../solver/ama-evaluator.js";
import { enumerateTsumoPlacements } from "./pair-engine.js";
import { createChainGoals } from "./chain-templates.js";

function boardKey(board) {
  return board
    .map((row) => row.map((cell) => cell?.[0] || "-").join(""))
    .join("/");
}

function goalMetrics(board, goal) {
  let matched = 0;
  let constructionMatched = 0;
  let conflicts = 0;
  let outside = 0;
  let required = 0;
  let occupiedTrigger = false;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const expected = goal.board[row][col];
      const actual = board[row][col];
      const isTrigger =
        row === goal.triggerCell.row && col === goal.triggerCell.col;
      if (expected && !isTrigger) required++;
      if (!actual) continue;
      if (isTrigger && actual === expected) occupiedTrigger = true;
      if (actual === expected) {
        matched++;
        if (!isTrigger) constructionMatched++;
      } else if (expected) conflicts++;
      else outside++;
    }
  }

  const completion = required ? constructionMatched / required : 1;
  const triggerPenalty = occupiedTrigger && completion < 0.86 ? 18_000 : 0;
  const chokePenalty = board[HIDDEN_ROWS][2] ? 1_000_000 : 0;
  const hiddenPenalty = board[0].filter(Boolean).length * 45_000;
  const score =
    matched * 1_600 -
    conflicts * 2_200 -
    outside * 420 -
    triggerPenalty -
    chokePenalty -
    hiddenPenalty +
    evaluateAmaField(board) * 2;

  return { score, matched, conflicts, outside, required, completion };
}

function selectGoals(board, goals, limit) {
  return goals
    .map((goal) => ({ goal, metrics: goalMetrics(board, goal) }))
    .sort((left, right) => right.metrics.score - left.metrics.score)
    .slice(0, limit)
    .map(({ goal }) => goal);
}

function scoreNode(node) {
  const metrics = goalMetrics(node.board, node.goal);
  const chainAdjustment = node.maxChains
    ? node.maxChains >= node.goal.targetChains
      ? 2_000_000 + node.maxChains * 80_000
      : -(1_200_000 + node.maxChains * 80_000)
    : 0;
  return {
    ...metrics,
    value: metrics.score + chainAdjustment,
  };
}

function frontierGoalCells(board, goal, limit) {
  const cells = [];
  const metrics = goalMetrics(board, goal);
  for (let col = 0; col < COLS; col++) {
    const topmost = board.findIndex((row) => row[col] !== null);
    const row = topmost === -1 ? ROWS - 1 : topmost - 1;
    if (row < HIDDEN_ROWS) continue;
    const color = goal.board[row][col];
    if (!color) continue;
    const isTrigger =
      row === goal.triggerCell.row && col === goal.triggerCell.col;
    if (isTrigger && metrics.completion < 0.86) continue;
    cells.push({ row, col, color, kind: "goal" });
  }
  return cells.slice(0, limit);
}

function toCandidate(node, roadmapCellLimit) {
  const metrics = goalMetrics(node.board, node.goal);
  return {
    moves: node.moves,
    targetChains: node.goal.targetChains,
    predictedChains: node.maxChains,
    progress: metrics.completion,
    goalCells: frontierGoalCells(node.board, node.goal, roadmapCellLimit),
    score: node.score,
  };
}

function candidateFirstMoveKey(candidate) {
  return candidate.moves[0].cells
    .map(({ row, col, color }) => `${row},${col},${color}`)
    .sort()
    .join("|");
}

export function solveTokopuyoSuggestion(request) {
  const startedAt = performance.now();
  const {
    board,
    hands,
    colors,
    targetChains,
    lookaheadHands = 3,
    resultLimit = 4,
    beamWidth = 180,
    timeBudgetMs = 2_500,
    goalVariantLimit = 16,
    roadmapCellLimit = 8,
  } = request;
  const selectedHands = hands.slice(0, lookaheadHands);
  if (!selectedHands.length) return { candidates: [], timedOut: false };

  const goals = selectGoals(
    board,
    createChainGoals(targetChains, colors),
    goalVariantLimit,
  );
  let frontier = goals.map((goal) => ({
    board: applyGravity(board),
    goal,
    moves: [],
    maxChains: 0,
    score: goalMetrics(board, goal).score,
  }));
  let timedOut = false;

  for (let depth = 0; depth < selectedHands.length; depth++) {
    const next = [];
    const seen = new Map();
    for (const node of frontier) {
      for (const placement of enumerateTsumoPlacements(
        node.board,
        selectedHands[depth],
      )) {
        if (performance.now() - startedAt >= timeBudgetMs) {
          timedOut = true;
          break;
        }
        const result = simulate(placement.board);
        const child = {
          board: result.state,
          goal: node.goal,
          moves: [
            ...node.moves,
            {
              handOffset: depth,
              col: placement.col,
              orientation: placement.orientation,
              cells: placement.cells,
              chains: result.chains,
            },
          ],
          maxChains: Math.max(node.maxChains, result.chains),
        };
        const scored = scoreNode(child);
        child.score = scored.value;
        const key = `${node.goal.id}:${boardKey(child.board)}`;
        const existing = seen.get(key);
        if (!existing || child.score > existing.score) seen.set(key, child);
      }
      if (timedOut) break;
    }
    next.push(...seen.values());
    next.sort((left, right) => right.score - left.score);
    frontier = next.slice(0, beamWidth);
    if (!frontier.length || timedOut) break;
  }

  const unique = new Map();
  for (const node of frontier.sort((left, right) => right.score - left.score)) {
    if (!node.moves.length) continue;
    const candidate = toCandidate(node, roadmapCellLimit);
    const key = candidateFirstMoveKey(candidate);
    if (!unique.has(key)) unique.set(key, candidate);
    if (unique.size >= resultLimit) break;
  }

  return {
    solver: "tokopuyo-chain-goal",
    candidates: [...unique.values()],
    timedOut,
    targetChains,
  };
}
