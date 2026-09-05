import {
  COLS,
  COLORS,
  GARBAGE,
  HIDDEN_ROWS,
  ROWS,
  applyGravity,
  clone,
  emptyBoard,
  findClearingCells,
  simulate,
} from "../engine.js";
import {
  ORIENTATION,
  createActivePair,
  dropTsumo,
  hardDrop,
  pairAtPlacement as createPairAtPlacement,
  pairCells,
  movePair,
  rotatePair,
} from "./pair-engine.js";
import { generatePattern, getTsumo, randomSeedForPalette } from "./queue.js";

export const CHOKE_COL = 2;

function assertBoard(board) {
  if (
    !Array.isArray(board) ||
    board.length !== ROWS ||
    board.some((row) => !Array.isArray(row) || row.length !== COLS)
  ) {
    throw new TypeError("Tokopuyo starting board must be a 13 by 6 board");
  }

  const validCells = new Set([...COLORS, GARBAGE, null]);
  if (board.some((row) => row.some((cell) => !validCells.has(cell)))) {
    throw new TypeError("Tokopuyo starting board contains an invalid cell");
  }
}

function assertStartingOptions({ board, row14 = 0, openingHands, palette }) {
  assertBoard(board);

  const gravityBoard = applyGravity(board);
  if (board.some((row, rowIndex) =>
    row.some((cell, col) => cell !== gravityBoard[rowIndex][col])
  )) {
    throw new RangeError("Tokopuyo starting board must be settled");
  }
  if (findClearingCells(board).length) {
    throw new RangeError("Tokopuyo starting board must not be ready to fire");
  }
  if (board[HIDDEN_ROWS][CHOKE_COL]) {
    throw new RangeError("Tokopuyo starting board has an occupied choke point");
  }

  if (
    !Array.isArray(palette) ||
    palette.length !== 4 ||
    new Set(palette).size !== palette.length ||
    palette.some((color) => !COLORS.includes(color))
  ) {
    throw new TypeError("Tokopuyo palette must contain four distinct colors");
  }

  if (!Number.isInteger(row14) || row14 < 0 || row14 >= (1 << COLS)) {
    throw new RangeError("Tokopuyo row 14 must be a six-bit occupancy mask");
  }

  const paletteColors = new Set(palette);
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null && cell !== GARBAGE && !paletteColors.has(cell)) {
        throw new RangeError(
          `Starting board color is not in the selected Tokopuyo palette: ${cell}`,
        );
      }
    }
  }

  if (!Array.isArray(openingHands) || openingHands.length !== 3) {
    throw new TypeError("Tokopuyo opening hands must contain exactly three pairs");
  }
  for (const hand of openingHands) {
    if (
      !hand ||
      !paletteColors.has(hand.axis) ||
      !paletteColors.has(hand.child)
    ) {
      throw new RangeError(
        "Tokopuyo opening hands must use colors from the selected palette",
      );
    }
  }
}

function customPattern(pattern, openingHands) {
  const hands = pattern.hands.map((hand, index) =>
    Object.freeze(index < openingHands.length
      ? { axis: openingHands[index].axis, child: openingHands[index].child }
      : { ...hand }),
  );
  return Object.freeze({
    ...pattern,
    colors: Object.freeze([...pattern.colors]),
    hands: Object.freeze(hands),
  });
}
function pairAtPlacement(session, col, orientation) {
  return createPairAtPlacement(
    session.board,
    getTsumo(session.pattern, session.handIndex),
    col,
    orientation,
    session.row14,
  );
}

function pairAtColumn(session, col, direction) {
  if (direction === "straight") {
    return pairAtPlacement(session, col, ORIENTATION.UP);
  }
  if (direction === "down") return pairAtPlacement(session, col, ORIENTATION.DOWN);
  const orientation = direction === "right"
    ? ORIENTATION.RIGHT
    : ORIENTATION.LEFT;
  const kickedCol = direction === "right" && col === COLS - 1
    ? col - 1
    : direction === "left" && col === 0
      ? col + 1
      : col;
  return pairAtPlacement(
    session,
    kickedCol,
    orientation,
  );
}

function cloneLastTurn(lastTurn) {
  if (!lastTurn) return null;
  return {
    beforeBoard: clone(lastTurn.beforeBoard),
    beforeRow14: lastTurn.beforeRow14,
    handIndex: lastTurn.handIndex,
    current: { ...lastTurn.current },
    next: { ...lastTurn.next },
    placement: {
      ...lastTurn.placement,
      cells: lastTurn.placement.cells.map((cell) => ({ ...cell })),
    },
    result: { ...lastTurn.result },
  };
}

function canonicalSnapshot(session) {
  return {
    board: clone(session.board),
    row14: session.row14,
    handIndex: session.handIndex,
    chainCount: session.chainCount,
    cumulativeScore: session.cumulativeScore,
    gameOver: session.gameOver,
    lastTurn: cloneLastTurn(session.lastTurn),
  };
}

function restoreSnapshot(session, snapshot) {
  session.board = clone(snapshot.board);
  session.row14 = snapshot.row14 ?? 0;
  session.handIndex = snapshot.handIndex;
  session.chainCount = snapshot.chainCount;
  session.cumulativeScore = snapshot.cumulativeScore;
  session.gameOver = snapshot.gameOver;
  session.lastTurn = cloneLastTurn(snapshot.lastTurn);
  session.activePair = createActivePair(getTsumo(session.pattern, session.handIndex));
}

export function createSession(seed) {
  const pattern = generatePattern(seed);
  return {
    seed,
    pattern,
    board: emptyBoard(),
    row14: 0,
    handIndex: 0,
    activePair: createActivePair(getTsumo(pattern, 0)),
    chainCount: 0,
    cumulativeScore: 0,
    gameOver: false,
    lastTurn: null,
    busy: false,
    history: [],
    future: [],
  };
}

/**
 * Create a Tokopuyo session from a settled Drawing-mode position.
 *
 * The selected palette determines a matching generated seed. The first three
 * generated hands are replaced by the supplied opening hands; hand four and
 * onward continue at the selected seed's normal generated queue.
 */
export function createSessionFromPosition(
  { board, row14 = 0, openingHands, palette },
  random = Math.random,
) {
  assertStartingOptions({ board, row14, openingHands, palette });

  const seed = randomSeedForPalette(palette, random);
  const pattern = customPattern(generatePattern(seed), openingHands);
  return {
    seed,
    pattern,
    board: clone(board),
    row14,
    handIndex: 0,
    activePair: createActivePair(getTsumo(pattern, 0)),
    chainCount: 0,
    cumulativeScore: 0,
    gameOver: false,
    lastTurn: null,
    busy: false,
    history: [],
    future: [],
    customOpening: true,
  };
}

// Name kept as a concise alias for callers that use "board" terminology.
export const createSessionFromBoard = createSessionFromPosition;

export function previewHands(session) {
  return [
    getTsumo(session.pattern, session.handIndex + 1),
    getTsumo(session.pattern, session.handIndex + 2),
  ];
}

export function actOnPair(session, action) {
  if (session.busy || session.gameOver) return false;
  const before = session.activePair;
  if (action === "left") {
    session.activePair = movePair(session.board, before, -1);
  } else if (action === "right") {
    session.activePair = movePair(session.board, before, 1);
  } else if (action === "counterclockwise") {
    session.activePair = rotatePair(session.board, before, -1);
  } else if (action === "clockwise") {
    session.activePair = rotatePair(session.board, before, 1);
  } else {
    throw new RangeError(`Unsupported Tokopuyo action: ${action}`);
  }
  return session.activePair !== before;
}

function commitDroppedPair(session, dropped) {
  if (session.busy || session.gameOver) return null;
  if (!dropped) return null;

  const before = canonicalSnapshot(session);
  const current = {
    axis: dropped.pair.axisColor,
    child: dropped.pair.childColor,
  };
  const next = getTsumo(session.pattern, session.handIndex + 1);
  const result = simulate(dropped.board);
  session.history.push(before);
  session.future = [];
  session.board = result.state;
  session.row14 = dropped.row14;
  session.handIndex++;
  session.chainCount = result.chains;
  session.cumulativeScore = result.score;
  session.gameOver = Boolean(session.board[HIDDEN_ROWS][CHOKE_COL]);
  session.lastTurn = {
    beforeBoard: clone(before.board),
    beforeRow14: before.row14,
    handIndex: before.handIndex,
    current: { ...current },
    next: { ...next },
    placement: {
      col: dropped.pair.axis.col,
      orientation: dropped.pair.orientation,
      cells: dropped.cells.map((cell) => ({ ...cell })),
    },
    result: {
      chains: result.chains,
      score: result.score,
      gameOver: session.gameOver,
    },
  };
  session.activePair = createActivePair(
    getTsumo(session.pattern, session.handIndex),
  );

  return {
    droppedPair: dropped.pair,
    lockedBoard: dropped.board,
    lockedRow14: dropped.row14,
    result,
  };
}

function commitPair(session, pair) {
  const dropped = hardDrop(session.board, pair, session.row14);
  return commitDroppedPair(session, dropped);
}

export function commitActivePair(session) {
  return commitPair(session, session.activePair);
}

export function commitPairAtColumn(session, col, direction) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) {
    throw new RangeError("Tokopuyo target column is out of range");
  }
  if (!["straight", "right", "down", "left"].includes(direction)) {
    throw new RangeError(`Unsupported Tokopuyo drop direction: ${direction}`);
  }

  const pair = pairAtColumn(session, col, direction);
  if (!pair) return null;
  return commitPair(session, pair);
}

export function previewPairAtColumn(session, col, direction) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  const pair = pairAtColumn(session, col, direction);
  return pair ? pairCells(pair) : null;
}

export function commitPairAtPlacement(session, col, orientation) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) {
    throw new RangeError("Tokopuyo target column is out of range");
  }
  if (!Object.values(ORIENTATION).includes(orientation)) {
    throw new RangeError("Unsupported Tokopuyo placement orientation");
  }

  const dropped = dropTsumo(
    session.board,
    getTsumo(session.pattern, session.handIndex),
    col,
    orientation,
    session.row14,
  );
  return commitDroppedPair(session, dropped);
}

export function previewPairAtPlacement(session, col, orientation) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  const pair = pairAtPlacement(session, col, orientation);
  return pair ? pairCells(pair) : null;
}

export function undoSession(session) {
  if (session.busy || !session.history.length) return false;
  session.future.push(canonicalSnapshot(session));
  restoreSnapshot(session, session.history.pop());
  return true;
}

export function redoSession(session) {
  if (session.busy || !session.future.length) return false;
  session.history.push(canonicalSnapshot(session));
  restoreSnapshot(session, session.future.pop());
  return true;
}
