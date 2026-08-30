import { COLS, HIDDEN_ROWS, clone, emptyBoard, simulate } from "../engine.js";
import {
  createActivePair,
  hardDrop,
  isPairValid,
  movePair,
  rotatePair,
} from "./pair-engine.js";
import { generatePattern, getTsumo } from "./queue.js";

const CHOKE_COL = 2;

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
  if (!["up", "right", "down", "left"].includes(direction)) {
    throw new RangeError(`Unsupported Tokopuyo drop direction: ${direction}`);
  }

  let pair = createActivePair(getTsumo(session.pattern, session.handIndex));
  pair.axis = { row: pair.axis.row, col };
  if (!isPairValid(session.board, pair)) return null;

  if (direction === "right") pair = rotatePair(session.board, pair, 1);
  if (direction === "left") pair = rotatePair(session.board, pair, -1);
  if (direction === "up") {
    pair = { ...pair, orientation: 2, blockedRotation: null };
    if (!isPairValid(session.board, pair)) return null;
  }

  if (
    (direction === "right" || direction === "left") &&
    pair.orientation === 0
  ) return null;

  return commitPair(session, pair);
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
