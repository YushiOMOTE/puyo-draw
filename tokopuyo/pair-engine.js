import { COLS, ROWS, applyGravity, clone } from "../engine.js";

export const SPAWN_ROW = 0;
export const SPAWN_COL = 2;
export const VIRTUAL_TOP_ROW = -1;

export const ORIENTATION = Object.freeze({
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
});

const OFFSETS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export function createActivePair(tsumo) {
  return {
    axis: { row: SPAWN_ROW, col: SPAWN_COL },
    axisColor: tsumo.axis,
    childColor: tsumo.child,
    orientation: ORIENTATION.UP,
    blockedRotation: null,
  };
}

export function pairCells(pair) {
  const [rowDelta, colDelta] = OFFSETS[pair.orientation];
  return [
    { ...pair.axis, color: pair.axisColor, role: "axis" },
    {
      row: pair.axis.row + rowDelta,
      col: pair.axis.col + colDelta,
      color: pair.childColor,
      role: "child",
    },
  ];
}

export function isPairValid(board, pair) {
  return pairCells(pair).every(
    ({ row, col }) =>
      row >= VIRTUAL_TOP_ROW &&
      row < ROWS &&
      col >= 0 &&
      col < COLS &&
      (row < 0 || !board[row][col]),
  );
}

export function movePair(board, pair, colDelta) {
  if (colDelta !== -1 && colDelta !== 1) {
    throw new RangeError("Pair movement must be exactly one column");
  }
  const moved = {
    ...pair,
    axis: { row: pair.axis.row, col: pair.axis.col + colDelta },
    blockedRotation: null,
  };
  return isPairValid(board, moved) ? moved : { ...pair, blockedRotation: null };
}

export function rotatePair(board, pair, direction) {
  if (direction !== -1 && direction !== 1) {
    throw new RangeError("Rotation direction must be -1 or 1");
  }

  const orientation = (pair.orientation + direction + 4) % 4;
  const rotated = { ...pair, orientation, blockedRotation: null };
  if (isPairValid(board, rotated)) return rotated;

  const isVerticalTarget =
    orientation === ORIENTATION.UP || orientation === ORIENTATION.DOWN;
  if (pair.axis.row <= SPAWN_ROW && isVerticalTarget) {
    return { ...pair, blockedRotation: null };
  }

  const [targetRow, targetCol] = OFFSETS[orientation];
  const kicked = {
    ...rotated,
    axis: {
      row: pair.axis.row - targetRow,
      col: pair.axis.col - targetCol,
    },
  };
  if (isPairValid(board, kicked)) return kicked;

  if (pair.blockedRotation === direction) {
    const [currentRow, currentCol] = OFFSETS[pair.orientation];
    const quickTurn = {
      ...pair,
      axis: {
        row: pair.axis.row + currentRow,
        col: pair.axis.col + currentCol,
      },
      orientation: (pair.orientation + 2) % 4,
      blockedRotation: null,
    };
    if (isPairValid(board, quickTurn)) return quickTurn;
  }

  return { ...pair, blockedRotation: direction };
}

export function hardDrop(board, pair) {
  if (!isPairValid(board, pair)) return null;

  let dropped = { ...pair, axis: { ...pair.axis }, blockedRotation: null };
  while (true) {
    const candidate = {
      ...dropped,
      axis: { row: dropped.axis.row + 1, col: dropped.axis.col },
    };
    if (!isPairValid(board, candidate)) break;
    dropped = candidate;
  }

  const locked = clone(board);
  for (const { row, col, color } of pairCells(dropped)) {
    if (row >= 0) locked[row][col] = color;
  }

  return { pair: dropped, board: applyGravity(locked) };
}
