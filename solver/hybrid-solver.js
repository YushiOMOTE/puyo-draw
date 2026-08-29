import { findClearingCells } from "../engine.js";
import { evaluateAmaField } from "./ama-evaluator.js";
import { availablePlacements, place } from "./move-generator.js";

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

function heightProfile(board) {
  return board[0]
    .map((_, col) => {
      const top = board.findIndex((row) => row[col] !== null);
      return top === -1 ? 0 : board.length - top;
    })
    .join(",");
}

function nodeScore(board, potential, additions, baselineChains) {
  const chainGain = Math.max(0, potential.chains - baselineChains);
  const residualScore = potential.residualState
    ? evaluateAmaField(potential.residualState)
    : 0;
  return (
    chainGain * 100_000 +
    potential.chains * 10_000 +
    residualScore * 8 +
    evaluateAmaField(board) -
    additions * 20
  );
}

function retainDiverseBest(nodes, beamWidth) {
  nodes.sort((left, right) => right.score - left.score);
  const selected = [];
  const perShape = new Map();
  const shapeLimit = Math.max(2, Math.floor(beamWidth / 24));

  for (const node of nodes) {
    const shape = heightProfile(node.board);
    const count = perShape.get(shape) || 0;
    if (count >= shapeLimit) continue;
    perShape.set(shape, count + 1);
    selected.push(node);
    if (selected.length >= beamWidth) break;
  }

  if (selected.length < beamWidth) {
    const selectedKeys = new Set(selected.map(({ key }) => key));
    for (const node of nodes) {
      if (selectedKeys.has(node.key)) continue;
      selected.push(node);
      if (selected.length >= beamWidth) break;
    }
  }

  return selected;
}

function pairedColumnMacros(board, colors) {
  const macros = [];
  const firstMoves = availablePlacements(board, colors);

  for (let col = 0; col < board[0].length; col++) {
    const columnFirstMoves = firstMoves.filter(
      (move) => move.col === col,
    );
    const columnMacros = [];
    for (const first of columnFirstMoves) {
      const intermediate = place(board, first);
      if (findClearingCells(intermediate).length) continue;
      for (const second of availablePlacements(intermediate, colors)) {
        if (second.col !== col) continue;
        const nextBoard = place(intermediate, second);
        if (findClearingCells(nextBoard).length) continue;
        columnMacros.push({
          moves: [first, second],
          board: nextBoard,
          score: evaluateAmaField(nextBoard),
        });
      }
    }
    columnMacros.sort((left, right) => right.score - left.score);
    macros.push(...columnMacros.slice(0, 2));
  }

  return macros;
}

function expansionActions(board, colors, allowMacros) {
  const singles = availablePlacements(board, colors).map((move) => ({
    moves: [move],
    board: place(board, move),
  }));
  return allowMacros
    ? [...pairedColumnMacros(board, colors), ...singles]
    : singles;
}

/**
 * A depth-stratified beam that scores both the current field and the residue
 * left after its best legal trigger. The residue score rewards chain parts
 * that only become adjacent after the board's existing chain fires.
 *
 * @param {import('./contract.js').SuggestionRequest} request
 */
export function searchWithHybrid(request, policy) {
  const startedAt = performance.now();
  const {
    board,
    colors,
    maxAdditions,
    timeBudgetMs,
    beamWidth = 120,
  } = request;
  const { baselinePotential, baselineChains } = policy;
  const visited = new Map([[fieldKey(board), 0]]);
  const frontiers = Array.from({ length: maxAdditions + 1 }, () => []);
  frontiers[0] = [
    {
      board,
      placements: [],
      potential: baselinePotential,
      key: fieldKey(board),
      score: nodeScore(board, baselinePotential, 0, baselineChains),
    },
  ];
  let expanded = 0;
  let transpositionHits = 0;
  let deepestDepth = 0;
  let timedOut = false;

  for (let depth = 0; depth < maxAdditions; depth++) {
    const frontier = retainDiverseBest(frontiers[depth], beamWidth);
    if (!frontier.length) continue;

    for (const node of frontier) {
      expanded++;
      const allowMacros = depth + 2 <= maxAdditions;
      for (const action of expansionActions(node.board, colors, allowMacros)) {
        if (performance.now() - startedAt >= timeBudgetMs) {
          timedOut = true;
          break;
        }

        const placements = [...node.placements, ...action.moves];
        const nextBoard = action.board;
        const nextDepth = placements.length;
        const key = fieldKey(nextBoard);
        const visitedDepth = visited.get(key);
        if (visitedDepth !== undefined && visitedDepth <= nextDepth) {
          transpositionHits++;
          continue;
        }
        visited.set(key, nextDepth);

        const assessment = policy.assess(nextBoard, placements);
        if (!assessment.expandable) continue;
        frontiers[nextDepth].push({
          board: nextBoard,
          placements,
          potential: assessment.potential,
          key,
          score: nodeScore(
            nextBoard,
            assessment.potential,
            nextDepth,
            baselineChains,
          ),
        });
        deepestDepth = Math.max(deepestDepth, nextDepth);
      }
      if (timedOut) break;
    }

    if (timedOut) break;
  }

  return {
    solver: "hybrid",
    baselineChains,
    rawCandidates: policy.candidates(),
    timedOut,
    stats: {
      expanded,
      transpositionHits,
      visited: visited.size,
      deepestDepth,
    },
  };
}
