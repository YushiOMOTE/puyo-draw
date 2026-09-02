import { COLS, HIDDEN_ROWS, clone, emptyBoard, simulate } from "../engine.js";
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
import { generatePattern, getTsumo } from "./queue.js";

const CHOKE_COL = 2;
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
