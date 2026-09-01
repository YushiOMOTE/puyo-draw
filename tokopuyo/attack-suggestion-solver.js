import {
  HIDDEN_ROWS,
  applyGravity,
  findClearingCells,
  simulate,
} from "../engine.js";
import { enumerateTsumoPlacements } from "./pair-engine.js";

const CHOKE_COL = 2;

function moveKey(move) {
  return move.cells
    .map(({ row, col, color }) => `${row},${col},${color}`)
    .sort()
    .join("|");
}

function candidateKey(candidate) {
  return candidate.moves.map(moveKey).join("/");
}

export function compareAttackCandidates(left, right) {
  return (
    right.score - left.score ||
    left.fireHandOffset - right.fireHandOffset ||
    left.chains - right.chains ||
    candidateKey(left).localeCompare(candidateKey(right))
  );
}

function toMove(placement, handOffset) {
  return {
    handOffset,
    col: placement.col,
    orientation: placement.orientation,
    cells: placement.cells,
  };
}

export function solveTokopuyoAttackSuggestion(request) {
  const startedAt = performance.now();
  const {
    board,
    hands,
    lookaheadHands = 3,
    resultLimit = 10,
    timeBudgetMs = 2_500,
  } = request;
  const selectedHands = hands.slice(0, lookaheadHands);
  const stableBoard = applyGravity(board);
  if (!selectedHands.length || findClearingCells(stableBoard).length) {
    return { solver: "tokopuyo-attack", candidates: [], timedOut: false };
  }

  let frontier = [{ board: stableBoard, moves: [] }];
  const found = [];
  let timedOut = false;

  for (let depth = 0; depth < selectedHands.length; depth++) {
    const next = [];
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
        if (result.state[HIDDEN_ROWS][CHOKE_COL]) continue;
        const moves = [...node.moves, toMove(placement, depth)];
        if (result.chains) {
          found.push({
            moves,
            fireHandOffset: depth,
            score: result.score,
            chains: result.chains,
            cleared: result.cleared,
          });
        } else {
          next.push({ board: result.state, moves });
        }
      }
      if (timedOut) break;
    }
    if (timedOut) break;
    frontier = next;
    if (!frontier.length) break;
  }

  if (timedOut) {
    return { solver: "tokopuyo-attack", candidates: [], timedOut: true };
  }

  const unique = new Map();
  for (const candidate of found.sort(compareAttackCandidates)) {
    const key = candidateKey(candidate);
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return {
    solver: "tokopuyo-attack",
    candidates: [...unique.values()].slice(0, resultLimit),
    timedOut: false,
  };
}
