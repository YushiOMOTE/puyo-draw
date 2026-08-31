import { COLS, HIDDEN_ROWS, clone, emptyBoard, simulate } from "../engine.js";
import {
  ORIENTATION,
  createActivePair,
  hardDrop,
  pairAtPlacement as createPairAtPlacement,
  pairCells,
  movePair,
  rotatePair,
} from "./pair-engine.js";
import { generatePattern, getTsumo } from "./queue.js";

const CHOKE_COL = 2;
const PLACEMENT_ORIENTATIONS = Object.freeze({
  straight: ORIENTATION.UP,
  right: ORIENTATION.RIGHT,
  down: ORIENTATION.DOWN,
  left: ORIENTATION.LEFT,
});

function pairAtPlacement(session, col, orientation) {
  return createPairAtPlacement(
    session.board,
    getTsumo(session.pattern, session.handIndex),
    col,
    orientation,
  );
}

function canonicalSnapshot(session) {
  return {
    board: clone(session.board),
    handIndex: session.handIndex,
    chainCount: session.chainCount,
    cumulativeScore: session.cumulativeScore,
    gameOver: session.gameOver,
  };
}

function restoreSnapshot(session, snapshot) {
  session.board = clone(snapshot.board);
  session.handIndex = snapshot.handIndex;
  session.chainCount = snapshot.chainCount;
  session.cumulativeScore = snapshot.cumulativeScore;
  session.gameOver = snapshot.gameOver;
  session.activePair = createActivePair(getTsumo(session.pattern, session.handIndex));
}

export function createSession(seed) {
  const pattern = generatePattern(seed);
  return {
    seed,
    pattern,
    board: emptyBoard(),
    handIndex: 0,
    activePair: createActivePair(getTsumo(pattern, 0)),
    chainCount: 0,
    cumulativeScore: 0,
    gameOver: false,
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

function commitPair(session, pair) {
  if (session.busy || session.gameOver) return null;
  const dropped = hardDrop(session.board, pair);
  if (!dropped) return null;

  const before = canonicalSnapshot(session);
  const result = simulate(dropped.board);
  session.history.push(before);
  session.future = [];
  session.board = result.state;
  session.handIndex++;
  session.chainCount = result.chains;
  session.cumulativeScore = result.score;
  session.gameOver = Boolean(session.board[HIDDEN_ROWS][CHOKE_COL]);
  session.activePair = createActivePair(
    getTsumo(session.pattern, session.handIndex),
  );

  return { droppedPair: dropped.pair, lockedBoard: dropped.board, result };
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

  const pair = pairAtPlacement(session, col, PLACEMENT_ORIENTATIONS[direction]);
  if (!pair) return null;
  return commitPair(session, pair);
}

export function previewPairAtColumn(session, col, direction) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  const pair = pairAtPlacement(session, col, PLACEMENT_ORIENTATIONS[direction]);
  return pair ? pairCells(pair) : null;
}

export function commitPairAtPlacement(session, col, orientation) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) {
    throw new RangeError("Tokopuyo target column is out of range");
  }
  if (!Object.values(ORIENTATION).includes(orientation)) {
    throw new RangeError("Unsupported Tokopuyo placement orientation");
  }

  const pair = pairAtPlacement(session, col, orientation);
  return pair ? commitPair(session, pair) : null;
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
