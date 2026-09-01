import { HIDDEN_ROWS, applyGravity, simulate } from "../engine.js";
import { enumerateTsumoPlacements } from "./pair-engine.js";
import {
  evaluateConstructionField,
  placementTearPenalty,
} from "./construction-evaluator.js";
import {
  analyzeMainChain,
  enumerateUnknownHands,
  evaluateFieldBalance,
  findVisibleMainOpportunity,
} from "./safety-evaluator.js";

function boardKey(board) {
  return board
    .map((row) => row.map((cell) => cell?.[0] || "-").join(""))
    .join("/");
}

function firstMoveKey(node) {
  return node.moves[0].cells
    .map(({ row, col, color }) => `${row},${col},${color}`)
    .sort()
    .join("|");
}

function isGameOver(board) {
  return Boolean(board[HIDDEN_ROWS][2]);
}

function createMainChainReader(colors) {
  const cache = new Map();
  return (board) => {
    const key = boardKey(board);
    if (!cache.has(key)) cache.set(key, analyzeMainChain(board, colors));
    return cache.get(key);
  };
}

function scoreStableBoard(board, mainChain, cells = []) {
  const evaluation = evaluateConstructionField(board, mainChain);
  return {
    evaluation,
    value: evaluation.score - placementTearPenalty(cells),
  };
}

function preservesChainSize(mainChain, baseline) {
  return !baseline.chains || mainChain.chains >= baseline.chains;
}

function compareNodes(left, right) {
  return (
    right.mainChain.chains - left.mainChain.chains ||
    right.score - left.score ||
    right.evaluation.resourceEfficiency - left.evaluation.resourceEfficiency
  );
}

function retainDiverse(nodes, limit) {
  const byBoard = new Map();
  for (const node of nodes.sort(compareNodes)) {
    const key = boardKey(node.board);
    if (!byBoard.has(key)) byBoard.set(key, node);
  }

  const heightCounts = new Map();
  const selected = [];
  for (const node of byBoard.values()) {
    const profile = node.evaluation.columns.heights.join(",");
    const count = heightCounts.get(profile) || 0;
    if (count >= 3) continue;
    heightCounts.set(profile, count + 1);
    selected.push(node);
    if (selected.length >= limit) break;
  }
  return selected;
}

function evaluateUnknownFuture(
  board,
  colors,
  baselineMain,
  mainChainFor,
  deadline,
) {
  const hands = enumerateUnknownHands(colors);
  let safeHands = 0;
  let safePlacements = 0;
  let evaluatedHands = 0;
  let potentialSum = 0;
  let worstPotential = Infinity;

  for (const hand of hands) {
    if (performance.now() >= deadline) break;
    let best = null;
    let handSafePlacements = 0;
    for (const placement of enumerateTsumoPlacements(board, hand)) {
      if (performance.now() >= deadline) break;
      const result = simulate(placement.board);
      if (isGameOver(result.state)) continue;
      const childMain = mainChainFor(result.state);
      const preserves = result.chains
        ? result.chains >= baselineMain.chains
        : preservesChainSize(childMain, baselineMain);
      if (!preserves) continue;
      handSafePlacements++;
      const construction = evaluateConstructionField(result.state, childMain);
      const value =
        childMain.chains * 120_000 +
        construction.shapeScore -
        placementTearPenalty(placement.cells);
      if (!best || value > best.value) {
        best = { value, chains: Math.max(result.chains, childMain.chains) };
      }
    }
    if (best) {
      safeHands++;
      safePlacements += handSafePlacements;
      potentialSum += best.chains;
      worstPotential = Math.min(worstPotential, best.chains);
    }
    evaluatedHands++;
  }

  return {
    safeHands,
    totalHands: hands.length,
    evaluatedHands,
    safePlacements,
    coverage: evaluatedHands ? safeHands / evaluatedHands : 0,
    averagePotential: safeHands ? potentialSum / safeHands : 0,
    worstPotential: worstPotential === Infinity ? 0 : worstPotential,
  };
}

function toCandidate(
  node,
  colors,
  currentMain,
  currentMainOpportunity,
  mainChainFor,
  deadline,
) {
  const firstMain = mainChainFor(node.firstBoard);
  const horizonMain = node.mainChain;
  const acceptance = evaluateUnknownFuture(
    node.board,
    colors,
    horizonMain,
    mainChainFor,
    deadline,
  );
  const mainTrigger = currentMain.primary
    ? {
        ...currentMain.primary,
        state: currentMainOpportunity ? "ready" : "building",
        visibleHandOffset: currentMainOpportunity?.handOffset ?? null,
        routeCount: currentMain.routeCount,
        triggerColorCount: currentMain.triggerColors.length,
      }
    : null;
  return {
    moves: node.moves,
    predictedChains: node.maxChains,
    potentialChains: horizonMain.chains,
    mainTrigger,
    mainChainsAfterMove: firstMain.chains,
    mainChainsAtHorizon: horizonMain.chains,
    acceptance,
    balance: evaluateFieldBalance(node.firstBoard),
    construction: node.evaluation,
    emergency: node.emergency,
    score:
      node.score +
      acceptance.coverage * 35_000 +
      acceptance.averagePotential * 8_000,
  };
}

function compareCandidates(left, right) {
  return (
    right.mainChainsAfterMove - left.mainChainsAfterMove ||
    right.acceptance.coverage - left.acceptance.coverage ||
    right.mainChainsAtHorizon - left.mainChainsAtHorizon ||
    right.acceptance.averagePotential - left.acceptance.averagePotential ||
    right.construction.resourceEfficiency -
      left.construction.resourceEfficiency ||
    right.score - left.score
  );
}

export function solveTokopuyoSuggestion(request) {
  const startedAt = performance.now();
  const {
    board,
    hands,
    colors,
    lookaheadHands = 3,
    resultLimit = 4,
    beamWidth = 240,
    timeBudgetMs = 8_000,
    visibleSearchRatio = 0.72,
    maximumConstructionHeight = 11,
    safetyCandidateLimit = 10,
    allowEmergencyClearFallback = true,
  } = request;
  const selectedHands = hands.slice(0, lookaheadHands);
  if (!selectedHands.length) return { candidates: [], timedOut: false };

  const stableBoard = applyGravity(board);
  const mainChainFor = createMainChainReader(colors);
  const currentMain = mainChainFor(stableBoard);
  const currentMainOpportunity = findVisibleMainOpportunity(
    stableBoard,
    selectedHands.slice(0, 1),
    currentMain,
  );
  const initialEvaluation = evaluateConstructionField(stableBoard, currentMain);
  let frontier = [{
    board: stableBoard,
    moves: [],
    maxChains: 0,
    emergency: false,
    firstBoard: stableBoard,
    mainChain: currentMain,
    evaluation: initialEvaluation,
    score: initialEvaluation.score,
  }];
  let emergencyFrontier = [];
  let timedOut = false;
  const searchDeadline = startedAt + timeBudgetMs * visibleSearchRatio;
  const finalDeadline = startedAt + timeBudgetMs;

  for (let depth = 0; depth < selectedHands.length; depth++) {
    const stableChildren = [];
    const emergencyChildren = [];
    for (const node of frontier) {
      for (const placement of enumerateTsumoPlacements(
        node.board,
        selectedHands[depth],
      )) {
        if (performance.now() >= searchDeadline) {
          timedOut = true;
          break;
        }
        const result = simulate(placement.board);
        if (isGameOver(result.state)) continue;
        const childMain = mainChainFor(result.state);
        if (
          depth === 0 &&
          !result.chains &&
          !preservesChainSize(childMain, currentMain)
        ) continue;

        const scored = scoreStableBoard(
          result.state,
          childMain,
          placement.cells,
        );
        if (
          !result.chains &&
          scored.evaluation.columns.peak > maximumConstructionHeight
        ) continue;
        const child = {
          board: result.state,
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
          emergency: node.emergency || Boolean(result.chains),
          firstBoard: depth === 0 ? result.state : node.firstBoard,
          mainChain: childMain,
          evaluation: scored.evaluation,
          score: scored.value,
        };
        (result.chains ? emergencyChildren : stableChildren).push(child);
      }
      if (timedOut) break;
    }

    if (emergencyChildren.length) {
      emergencyFrontier = retainDiverse(emergencyChildren, beamWidth);
    }
    if (!stableChildren.length) {
      if (allowEmergencyClearFallback && emergencyFrontier.length) {
        frontier = emergencyFrontier;
      }
      break;
    }
    frontier = retainDiverse(stableChildren, beamWidth);
    if (timedOut) break;
  }

  const byFirstMove = new Map();
  for (const node of frontier.sort(compareNodes)) {
    if (!node.moves.length) continue;
    const key = firstMoveKey(node);
    if (!byFirstMove.has(key)) byFirstMove.set(key, node);
    if (byFirstMove.size >= safetyCandidateLimit) break;
  }

  const candidates = [];
  for (const node of byFirstMove.values()) {
    candidates.push(toCandidate(
      node,
      colors,
      currentMain,
      currentMainOpportunity,
      mainChainFor,
      finalDeadline,
    ));
  }
  candidates.sort(compareCandidates);

  return {
    solver: "tokopuyo-ama-style",
    candidates: candidates.slice(0, resultLimit),
    timedOut: timedOut || performance.now() >= finalDeadline,
    currentMainChains: currentMain.chains,
  };
}
