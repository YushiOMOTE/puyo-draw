import {
  GARBAGE,
  applyGravity,
  clone,
  findClearingCells,
  simulate,
} from "../engine.js";
import { availablePlacements, place } from "./move-generator.js";

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function findColorGroups(board) {
  const visited = new Set();
  const groups = [];

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const color = board[row][col];
      const startKey = `${row},${col}`;
      if (!color || color === GARBAGE || visited.has(startKey)) continue;

      const cells = [];
      const queue = [[row, col]];
      visited.add(startKey);
      while (queue.length) {
        const [currentRow, currentCol] = queue.pop();
        cells.push([currentRow, currentCol]);
        for (const [rowDelta, colDelta] of DIRECTIONS) {
          const nextRow = currentRow + rowDelta;
          const nextCol = currentCol + colDelta;
          const key = `${nextRow},${nextCol}`;
          if (
            nextRow >= 0 &&
            nextRow < board.length &&
            nextCol >= 0 &&
            nextCol < board[nextRow].length &&
            !visited.has(key) &&
            board[nextRow][nextCol] === color
          ) {
            visited.add(key);
            queue.push([nextRow, nextCol]);
          }
        }
      }

      groups.push({ color, cells, triggerCost: Math.max(0, 4 - cells.length) });
    }
  }

  return groups;
}

function findPotentialTriggerGroups(board, maxTriggerPuyos) {
  return findColorGroups(board).filter(
    (group) =>
      group.cells.length < 4 && group.triggerCost <= maxTriggerPuyos,
  );
}

function virtualTrigger(board, group) {
  const next = clone(board);
  const removed = new Set();

  for (const [row, col] of group.cells) {
    next[row][col] = null;
    removed.add(`${row},${col}`);
  }

  for (const [row, col] of group.cells) {
    for (const [rowDelta, colDelta] of DIRECTIONS) {
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (next[nextRow]?.[nextCol] === GARBAGE) {
        next[nextRow][nextCol] = null;
        removed.add(`${nextRow},${nextCol}`);
      }
    }
  }

  const followUp = simulate(next);
  return {
    chains: 1 + followUp.chains,
    cleared: 4 + removed.size - group.cells.length + followUp.cleared,
    triggerCost: group.triggerCost,
    triggerColor: group.color,
  };
}

function findLegalTriggerPlans(board, group) {
  let frontier = [{ board, placements: [] }];

  for (let depth = 0; depth < group.triggerCost; depth++) {
    const nextFrontier = [];
    for (const node of frontier) {
      for (const move of availablePlacements(node.board, [group.color])) {
        nextFrontier.push({
          board: place(node.board, move),
          placements: [...node.placements, move],
        });
      }
    }
    frontier = nextFrontier;
  }

  return frontier
    .filter((node) => {
      const clearing = new Set(
        findClearingCells(node.board).map(([row, col]) => `${row},${col}`),
      );
      return group.cells.every(([row, col]) => clearing.has(`${row},${col}`));
    })
    .map((node) => ({
      placements: node.placements,
      result: simulate(node.board),
    }));
}

function evaluateTriggerGroup(board, group) {
  const virtual = virtualTrigger(board, group);
  const legalPlans = findLegalTriggerPlans(board, group);
  if (!legalPlans.length) return null;

  legalPlans.sort((left, right) => {
    const leftDistance = Math.abs(left.result.chains - virtual.chains);
    const rightDistance = Math.abs(right.result.chains - virtual.chains);
    return leftDistance - rightDistance || left.result.chains - right.result.chains;
  });
  const selected = legalPlans[0];
  return {
    chains: selected.result.chains,
    cleared: selected.result.cleared,
    triggerCost: group.triggerCost,
    triggerColor: group.color,
    triggerPlacements: selected.placements,
    source: "virtual",
  };
}

export function evaluateLatentChain(board, { maxTriggerPuyos = 1 } = {}) {
  const stableBoard = applyGravity(board);
  const immediate = simulate(stableBoard);
  if (immediate.chains) {
    return {
      chains: immediate.chains,
      cleared: immediate.cleared,
      triggerCost: 0,
      triggerColor: null,
      triggerPlacements: [],
      source: "immediate",
    };
  }

  let best = {
    chains: 0,
    cleared: 0,
    triggerCost: null,
    triggerColor: null,
    triggerPlacements: [],
    source: "none",
  };

  for (const group of findPotentialTriggerGroups(stableBoard, maxTriggerPuyos)) {
    const result = evaluateTriggerGroup(stableBoard, group);
    if (!result) continue;
    if (
      result.chains > best.chains ||
      (result.chains === best.chains && result.triggerCost < best.triggerCost)
    ) {
      best = result;
    }
  }

  return best;
}
