import { COLS, ROWS, applyGravity, clone } from "../engine.js";

export const SPAWN_ROW = 0;
export const SPAWN_COL = 2;
export const VIRTUAL_TOP_ROW = -1;
export const EMPTY_ROW_14 = 0;

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

function hasRow14Puyo(row14, col) {
  return Boolean(row14 & (1 << col));
}

function assertRow14(row14) {
  if (!Number.isInteger(row14) || row14 < 0 || row14 >= (1 << COLS)) {
    throw new RangeError("Tokopuyo row 14 must be a six-bit occupancy mask");
  }
}

export function isPairValid(board, pair) {
  return pairCells(pair).every(
    ({ row, col }) =>
      row >= VIRTUAL_TOP_ROW &&
      row < ROWS &&
      col >= 0 &&
      col < COLS &&
      (row === VIRTUAL_TOP_ROW || !board[row][col]),
  );
}

export function columnHeights(board) {
  return Array.from({ length: COLS }, (_, col) => {
    const topmostOccupied = board.findIndex((row) => row[col] !== null);
    return topmostOccupied === -1 ? 0 : ROWS - topmostOccupied;
  });
}

export function isPlacementReachable(
  board,
  col,
  orientation,
  row14 = EMPTY_ROW_14,
) {
  assertRow14(row14);
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return false;
  if (!Object.values(ORIENTATION).includes(orientation)) return false;

  const heights = columnHeights(board);
  if (heights[SPAWN_COL] > 11) return false;

  if (heights[col] + (orientation === ORIENTATION.DOWN ? 1 : 0) > 12) {
    return false;
  }

  const childCol = col + OFFSETS[orientation][1];
  if (childCol < 0 || childCol >= COLS) return false;
  const childHeight =
    heights[childCol] + (orientation === ORIENTATION.UP ? 1 : 0);
  if (childHeight === 13 && hasRow14Puyo(row14, childCol)) return false;

  const crossingColumns = [
    [1, 0],
    [1],
    [],
    [3],
    [3, 4],
    [3, 4, 5],
  ];
  const floorKickColumns = [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5],
    [],
    [2, 1, 0],
    [3, 2, 1, 0],
    [4, 3, 2, 1, 0],
  ];

  let crossingTarget = col;
  if (orientation === ORIENTATION.RIGHT && col >= SPAWN_COL) {
    crossingTarget++;
  } else if (orientation === ORIENTATION.LEFT && col <= SPAWN_COL) {
    crossingTarget--;
  }

  let floorKickOrigin = null;
  for (const crossingCol of crossingColumns[crossingTarget]) {
    if (heights[crossingCol] > 12) return false;
    if (heights[crossingCol] === 12 && floorKickOrigin === null) {
      floorKickOrigin = crossingCol;
    }
  }

  if (floorKickOrigin === null) return true;
  if (heights[1] > 11 && heights[3] > 11) return true;

  for (const kickCol of floorKickColumns[floorKickOrigin]) {
    if (heights[kickCol] > 11) break;
    if (heights[kickCol] === 11) return true;
  }
  return false;
}

export function pairAtPlacement(
  board,
  tsumo,
  col,
  orientation,
  row14 = EMPTY_ROW_14,
) {
  if (!isPlacementReachable(board, col, orientation, row14)) return null;

  const pair = {
    ...createActivePair(tsumo),
    axis: { row: SPAWN_ROW, col },
    orientation,
  };
  return pair;
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

export function dropTsumo(
  board,
  tsumo,
  col,
  orientation,
  row14 = EMPTY_ROW_14,
) {
  const pair = pairAtPlacement(board, tsumo, col, orientation, row14);
  if (!pair) return null;

  const cells = landingCells(board, pair);
  if (cells.some(({ row }) => row < VIRTUAL_TOP_ROW)) return null;
  const locked = clone(board);
  let nextRow14 = row14;
  for (const { row, col: cellCol, color } of cells) {
    if (row === VIRTUAL_TOP_ROW) {
      nextRow14 |= 1 << cellCol;
    } else {
      locked[row][cellCol] = color;
    }
  }
  return { board: locked, row14: nextRow14, cells, pair };
}

export function enumerateTsumoPlacements(
  board,
  tsumo,
  row14 = EMPTY_ROW_14,
) {
  const placements = [];
  const orientations = tsumo.axis === tsumo.child
    ? [ORIENTATION.UP, ORIENTATION.RIGHT]
    : Object.values(ORIENTATION);

  for (let col = 0; col < COLS; col++) {
    for (const orientation of orientations) {
      const dropped = dropTsumo(board, tsumo, col, orientation, row14);
      if (!dropped) continue;
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
  return isPairValid(board, moved)
    ? moved
    : { ...pair, blockedRotation: null };
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

export function hardDrop(board, pair, row14 = EMPTY_ROW_14) {
  const dropped = dropTsumo(
    board,
    { axis: pair.axisColor, child: pair.childColor },
    pair.axis.col,
    pair.orientation,
    row14,
  );
  if (!dropped) return null;
  const axisCell = dropped.cells.find(({ role }) => role === "axis");
  return {
    ...dropped,
    pair: {
      ...pair,
      axis: { row: axisCell.row, col: axisCell.col },
      blockedRotation: null,
    },
    board: applyGravity(dropped.board),
  };
}
