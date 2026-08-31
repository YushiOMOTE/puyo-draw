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

export function pairAtPlacement(board, tsumo, col, orientation) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  if (!Object.values(ORIENTATION).includes(orientation)) return null;

  const pair = {
    ...createActivePair(tsumo),
    axis: { row: SPAWN_ROW, col },
    orientation,
  };
  return isPairValid(board, pair) ? pair : null;
}

function landingCells(board, pair) {
  const byColumn = new Map();
  for (const cell of pairCells(pair)) {
    const cells = byColumn.get(cell.col) || [];
    cells.push(cell);
    byColumn.set(cell.col, cells);
  }

  const landed = [];
  for (const [col, cells] of byColumn) {
    const topmostOccupied = board.findIndex((row) => row[col] !== null);
    let row = topmostOccupied === -1 ? ROWS - 1 : topmostOccupied - 1;
    cells
      .sort((left, right) => right.row - left.row)
      .forEach((cell) => landed.push({ ...cell, row: row-- }));
  }
  return landed;
}

export function dropTsumo(board, tsumo, col, orientation) {
  const pair = pairAtPlacement(board, tsumo, col, orientation);
  if (!pair) return null;

  const cells = landingCells(board, pair);
  if (cells.some(({ row }) => row < 0)) return null;
  const locked = clone(board);
  for (const { row, col: cellCol, color } of cells) {
    locked[row][cellCol] = color;
  }
  return { board: locked, cells, pair };
}

export function enumerateTsumoPlacements(board, tsumo) {
  const placements = [];
  const seen = new Set();

  for (let col = 0; col < COLS; col++) {
    for (const orientation of Object.values(ORIENTATION)) {
      const dropped = dropTsumo(board, tsumo, col, orientation);
      if (!dropped) continue;
      const key = dropped.cells
        .map(({ row, col: cellCol, color }) => `${row},${cellCol},${color}`)
        .sort()
        .join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      placements.push({ col, orientation, ...dropped });
    }
  }

  return placements;
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
