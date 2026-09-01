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
import {
  analyzeMainChain,
  evaluateFieldBalance,
  evaluateUnknownAcceptance,
  findVisibleMainOpportunity,
} from "./safety-evaluator.js";

function boardKey(board) {
  return board
    .map((row) => row.map((cell) => cell?.[0] || "-").join(""))
    .join("/");
}

function nextLandingRow(board, col) {
  const topmostOccupied = board.findIndex((row) => row[col] !== null);
  return topmostOccupied === -1 ? ROWS - 1 : topmostOccupied - 1;
}

function triggerStatus(board, goal, minimumTriggerChains) {
  const { row, col, color } = goal.triggerPlan.cell;
  const actual = board[row][col];
  const landingRow = nextLandingRow(board, col);
  const blocked = Boolean(actual) || landingRow < row;
  const accessible = !blocked && landingRow === row;
  let chainsIfTriggered = 0;
  if (accessible) {
    const firingBoard = board.map((boardRow) => [...boardRow]);
    firingBoard[row][col] = color;
    chainsIfTriggered = simulate(firingBoard).chains;
  }
  return {
    blocked,
    accessible,
    chainsIfTriggered,
    ready: chainsIfTriggered >= minimumTriggerChains,
  };
}

function goalMetrics(board, goal, minimumTriggerChains) {
  let matched = 0;
  let conflicts = 0;
  let outside = 0;
  let required = 0;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const expected = goal.triggerPlan.constructionBoard[row][col];
      const actual = board[row][col];
      if (expected) required++;
      if (!actual) continue;
      if (actual === expected) {
        matched++;
      } else if (expected) conflicts++;
      else outside++;
    }
  }

  const trigger = triggerStatus(board, goal, minimumTriggerChains);
  const completion = required ? matched / required : 1;
  const chokePenalty = board[HIDDEN_ROWS][2] ? 1_000_000 : 0;
  const hiddenPenalty = board[0].filter(Boolean).length * 45_000;
  const score =
    matched * 1_600 -
    conflicts * 2_200 -
    outside * 420 -
    Number(trigger.blocked) * 1_000_000 -
    chokePenalty -
    hiddenPenalty +
    evaluateAmaField(board) * 2;

  return {
    score,
    matched,
    conflicts,
    outside,
    required,
    completion,
    trigger,
  };
}

function selectGoals(board, goals, limit, minimumTriggerChains) {
  return goals
    .map((goal) => ({
      goal,
      metrics: goalMetrics(board, goal, minimumTriggerChains),
    }))
    .filter(({ metrics }) => !metrics.trigger.blocked)
    .sort((left, right) => right.metrics.score - left.metrics.score)
    .slice(0, limit)
    .map(({ goal }) => goal);
}

function scoreNode(node, minimumTriggerChains) {
  const metrics = goalMetrics(
    node.board,
    node.goal,
    minimumTriggerChains,
  );
  const chainAdjustment = node.maxChains
    ? node.maxChains >= node.goal.targetChains
      ? 2_000_000 + node.maxChains * 80_000
      : -(1_200_000 + node.maxChains * 80_000)
    : 0;
  const emergencyPenalty = node.emergency ? 2_000_000 : 0;
  return {
    ...metrics,
    value: metrics.score + chainAdjustment - emergencyPenalty,
  };
}

function frontierGoalCells(board, goal, limit) {
  const cells = [];
  for (let col = 0; col < COLS; col++) {
    const topmost = board.findIndex((row) => row[col] !== null);
    const row = topmost === -1 ? ROWS - 1 : topmost - 1;
    if (row < HIDDEN_ROWS) continue;
    const color = goal.triggerPlan.constructionBoard[row][col];
    if (!color) continue;
    cells.push({ row, col, color, kind: "goal" });
  }
  return cells.slice(0, limit);
}

function findTriggerOpportunity(board, hand, goal, minimumTriggerChains) {
  const status = triggerStatus(board, goal, minimumTriggerChains);
  if (status.blocked) return null;
  const triggerCell = goal.triggerPlan.cell;
  let best = null;
  for (const placement of enumerateTsumoPlacements(board, hand)) {
    if (!placement.cells.some(({ row, col, color }) =>
      row === triggerCell.row &&
      col === triggerCell.col &&
      color === triggerCell.color
    )) continue;
    const result = simulate(placement.board);
    if (result.chains < minimumTriggerChains) continue;
    if (!best || result.chains > best.chains) {
      best = {
        col: placement.col,
        orientation: placement.orientation,
        cells: placement.cells,
        chains: result.chains,
      };
    }
  }
  return best;
}

function toCandidate(
  node,
  roadmapCellLimit,
  minimumTriggerChains,
  colors,
  currentMain,
  currentMainOpportunity,
) {
  const metrics = goalMetrics(
    node.board,
    node.goal,
    minimumTriggerChains,
  );
  const visibleOpportunity = node.triggerOpportunities.find(Boolean) || null;
  const visibleHandOffset = node.triggerOpportunities.findIndex(Boolean);
  const triggerState = node.maxChains >= minimumTriggerChains
    ? "firing"
    : visibleOpportunity
      ? visibleHandOffset === 0 ? "ready" : "soon"
      : metrics.trigger.ready ? "ready" : "building";
  const firstMoveMain = analyzeMainChain(node.firstBoard, colors);
  const horizonMain = analyzeMainChain(node.board, colors);
  const acceptance = evaluateUnknownAcceptance(
    node.board,
    colors,
    horizonMain,
  );
  const balance = evaluateFieldBalance(node.firstBoard);
  const plannedTrigger = {
    ...node.goal.triggerPlan.cell,
    state: triggerState,
    chainsIfTriggered: visibleOpportunity?.chains ||
      metrics.trigger.chainsIfTriggered,
    visibleHandOffset: visibleOpportunity ? visibleHandOffset : null,
  };
  return {
    moves: node.moves,
    targetChains: node.goal.targetChains,
    predictedChains: node.maxChains,
    progress: metrics.completion,
    goalCells: frontierGoalCells(
      node.board,
      node.goal,
      roadmapCellLimit,
    ),
    trigger: plannedTrigger,
    plannedTrigger,
    mainTrigger: currentMain.primary
      ? {
          ...currentMain.primary,
          state: currentMainOpportunity ? "ready" : "building",
          visibleHandOffset: currentMainOpportunity?.handOffset ?? null,
          routeCount: currentMain.routeCount,
          triggerColorCount: currentMain.triggerColors.length,
        }
      : null,
    mainChainsAfterMove: firstMoveMain.chains,
    mainChainsAtHorizon: horizonMain.chains,
    acceptance,
    balance,
    emergency: node.emergency,
    score: node.score,
  };
}

function compareSafeCandidates(left, right) {
  return (
    right.acceptance.safeHands - left.acceptance.safeHands ||
    right.mainChainsAfterMove - left.mainChainsAfterMove ||
    right.balance.score - left.balance.score ||
    right.score - left.score
  );
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
    minimumTriggerChainRatio = 0.9,
    allowEmergencyClearFallback = true,
    safetyCandidateLimit = 12,
  } = request;
  const minimumTriggerChains = Math.ceil(
    targetChains * minimumTriggerChainRatio,
  );
  const selectedHands = hands.slice(0, lookaheadHands);
  if (!selectedHands.length) return { candidates: [], timedOut: false };
  const stableBoard = applyGravity(board);
  const currentMain = analyzeMainChain(stableBoard, colors);
  const currentMainOpportunity = findVisibleMainOpportunity(
    stableBoard,
    selectedHands.slice(0, 1),
    currentMain,
  );
  const mainChainCache = new Map();
  const mainChainFor = (candidateBoard) => {
    const key = boardKey(candidateBoard);
    if (!mainChainCache.has(key)) {
      mainChainCache.set(key, analyzeMainChain(candidateBoard, colors));
    }
    return mainChainCache.get(key);
  };

  const goals = selectGoals(
    board,
    createChainGoals(targetChains, colors),
    goalVariantLimit,
    minimumTriggerChains,
  );
  let frontier = goals.map((goal) => ({
    board: stableBoard,
    goal,
    moves: [],
    maxChains: 0,
    emergency: false,
    triggerOpportunities: [],
    score: goalMetrics(board, goal, minimumTriggerChains).score,
  }));
  let timedOut = false;

  for (let depth = 0; depth < selectedHands.length; depth++) {
    const safeSeen = new Map();
    const emergencySeen = new Map();
    for (const node of frontier) {
      const triggerOpportunity = findTriggerOpportunity(
        node.board,
        selectedHands[depth],
        node.goal,
        minimumTriggerChains,
      );
      for (const placement of enumerateTsumoPlacements(
        node.board,
        selectedHands[depth],
      )) {
        if (performance.now() - startedAt >= timeBudgetMs) {
          timedOut = true;
          break;
        }
        const result = simulate(placement.board);
        const prematureClear =
          result.chains > 0 && result.chains < minimumTriggerChains;
        if (
          depth === 0 &&
          !result.chains &&
          currentMain.chains &&
          mainChainFor(result.state).chains < currentMain.chains
        ) continue;
        const usesPlannedTrigger = placement.cells.some(({ row, col, color }) =>
          row === node.goal.triggerPlan.cell.row &&
          col === node.goal.triggerPlan.cell.col &&
          color === node.goal.triggerPlan.cell.color
        );
        if (
          result.chains >= minimumTriggerChains &&
          !usesPlannedTrigger
        ) continue;
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
          firstBoard: depth === 0 ? result.state : node.firstBoard,
          emergency: node.emergency || prematureClear,
          triggerOpportunities: [
            ...node.triggerOpportunities,
            triggerOpportunity
              ? { handOffset: depth, ...triggerOpportunity }
              : null,
          ],
        };
        const scored = scoreNode(child, minimumTriggerChains);
        if (!result.chains && scored.trigger.blocked) continue;
        child.score = scored.value;
        const key = `${node.goal.id}:${boardKey(child.board)}`;
        const destination = prematureClear ? emergencySeen : safeSeen;
        const existing = destination.get(key);
        if (!existing || child.score > existing.score) {
          destination.set(key, child);
        }
      }
      if (timedOut) break;
    }
    const next = [
      ...(safeSeen.size || !allowEmergencyClearFallback
        ? safeSeen.values()
        : emergencySeen.values()),
    ];
    next.sort((left, right) => right.score - left.score);
    frontier = next.slice(0, beamWidth);
    if (!frontier.length || timedOut) break;
  }

  const unique = new Map();
  for (const node of frontier.sort((left, right) => right.score - left.score)) {
    if (!node.moves.length) continue;
    const key = candidateFirstMoveKey(node);
    if (!unique.has(key)) unique.set(key, node);
    if (unique.size >= safetyCandidateLimit) break;
  }

  const candidates = [...unique.values()]
    .map((node) => toCandidate(
      node,
      roadmapCellLimit,
      minimumTriggerChains,
      colors,
      currentMain,
      currentMainOpportunity,
    ))
    .sort(compareSafeCandidates)
    .slice(0, resultLimit);

  return {
    solver: "tokopuyo-chain-goal",
    candidates,
    timedOut,
    targetChains,
    currentMainChains: currentMain.chains,
  };
}
