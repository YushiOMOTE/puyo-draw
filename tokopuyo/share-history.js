import {
  COLORS,
  GARBAGE,
  HIDDEN_ROWS,
  ROWS,
  applyGravity,
  emptyBoard,
  findClearingCells,
} from "../engine.js";
import {
  ORIENTATION,
  createActivePair,
  createGarbagePair,
} from "./pair-engine.js";
import { getTsumo } from "./queue.js";
import {
  commitActivePair,
  commitPairAtPlacement,
  restoreSessionSnapshot,
  setGarbageMode,
  snapshotSession,
} from "./session.js";

const VERSION = 1;
const HEADER_IMPLICIT_EMPTY = 0x10;
const HEADER_EXPLICIT_INITIAL = 0x11;
const MAX_SEQUENCE = 1024;
const MAX_MOVES = 512;
const MAX_PAYLOAD_BYTES = 2048;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const CELL_CODES = new Map([
  [null, 0],
  ["red", 1],
  ["green", 2],
  ["blue", 3],
  ["yellow", 4],
  ["purple", 5],
  [GARBAGE, 6],
]);
const CODE_CELLS = [null, ...COLORS, GARBAGE];

class BitWriter {
  constructor() {
    this.bytes = [];
    this.current = 0;
    this.bits = 0;
  }

  write(value, width) {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) {
      throw new RangeError("Value does not fit in the requested bit width");
    }
    for (let shift = width - 1; shift >= 0; shift--) {
      this.current = (this.current << 1) | ((value >> shift) & 1);
      this.bits++;
      if (this.bits === 8) {
        this.bytes.push(this.current);
        this.current = 0;
        this.bits = 0;
      }
    }
  }

  align() {
    while (this.bits) this.write(0, 1);
  }

  writeByte(value) {
    this.align();
    this.bytes.push(value);
  }

  writeVarUint(value) {
    this.align();
    for (const byte of encodeVarUint(value)) this.bytes.push(byte);
  }

  finish() {
    this.align();
    return Uint8Array.from(this.bytes);
  }
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitOffset = 0;
  }

  read(width) {
    if (this.bitOffset + width > this.bytes.length * 8) {
      throw new RangeError("Replay payload ended before a section was complete");
    }
    let value = 0;
    for (let index = 0; index < width; index++) {
      const byte = this.bytes[this.bitOffset >> 3];
      const shift = 7 - (this.bitOffset & 7);
      value = (value << 1) | ((byte >> shift) & 1);
      this.bitOffset++;
    }
    return value;
  }

  alignAndCheckZeroPadding() {
    while (this.bitOffset & 7) {
      if (this.read(1) !== 0) {
        throw new RangeError("Replay payload contains non-zero padding");
      }
    }
  }

  readByte() {
    this.alignAndCheckZeroPadding();
    return this.read(8);
  }

  readVarUint(maximum) {
    this.alignAndCheckZeroPadding();
    let value = 0;
    let multiplier = 1;
    let length = 0;
    while (length < 5) {
      const byte = this.read(8);
      length++;
      value += (byte & 0x7f) * multiplier;
      if (!Number.isSafeInteger(value)) {
        throw new RangeError("Replay count is outside the supported range");
      }
      if (!(byte & 0x80)) {
        if (encodeVarUint(value).length !== length || value > maximum) {
          throw new RangeError("Replay count is non-canonical or too large");
        }
        return value;
      }
      multiplier *= 128;
    }
    throw new RangeError("Replay count is malformed");
  }

  atEnd() {
    return this.bitOffset === this.bytes.length * 8;
  }

  remainingBitsAreZero() {
    while (!this.atEnd()) {
      if (this.read(1) !== 0) return false;
    }
    return true;
  }
}

function encodeVarUint(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError("Replay count is outside the supported range");
  }
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 128);
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return bytes;
}

function encodeBase64Url(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] : 0;
    const third = hasThird ? bytes[index + 2] : 0;
    output += BASE64URL[first >> 2];
    output += BASE64URL[((first & 3) << 4) | (second >> 4)];
    if (hasSecond) output += BASE64URL[((second & 15) << 2) | (third >> 6)];
    if (hasThird) output += BASE64URL[third & 63];
  }
  return output;
}

function decodeBase64Url(value) {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > Math.ceil((MAX_PAYLOAD_BYTES * 4) / 3) ||
    value.length % 4 === 1 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new TypeError("Replay payload is not valid unpadded Base64url");
  }

  const bytes = [];
  let buffer = 0;
  let bitCount = 0;
  for (const character of value) {
    buffer = (buffer << 6) | BASE64URL.indexOf(character);
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >> bitCount) & 0xff);
      buffer &= (1 << bitCount) - 1;
    }
  }
  if (buffer !== 0 || bytes.length > MAX_PAYLOAD_BYTES) {
    throw new RangeError("Replay payload is non-canonical or too large");
  }
  return Uint8Array.from(bytes);
}

function writeInitialState(writer, state) {
  for (const row of state.board) {
    for (const cell of row) {
      const code = CELL_CODES.get(cell);
      if (code === undefined) throw new TypeError("Replay board has an invalid cell");
      writer.write(code, 3);
    }
  }
  for (let col = 0; col < 6; col++) {
    writer.write((state.row14 >> col) & 1, 1);
  }
}

function readInitialState(reader) {
  const board = emptyBoard();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const code = reader.read(3);
      if (code >= CODE_CELLS.length) {
        throw new RangeError("Replay initial state contains a reserved cell code");
      }
      board[row][col] = CODE_CELLS[code];
    }
  }
  let row14 = 0;
  for (let col = 0; col < 6; col++) row14 |= reader.read(1) << col;
  validateInitialState({ board, row14 });
  return { board, row14 };
}

function validateInitialState({ board, row14 }) {
  const settled = applyGravity(board);
  if (board.some((row, rowIndex) =>
    row.some((cell, col) => cell !== settled[rowIndex][col])
  )) {
    throw new RangeError("Replay initial board must be settled");
  }
  if (findClearingCells(board).length) {
    throw new RangeError("Replay initial board must not already be firing");
  }
  if (board[HIDDEN_ROWS][2]) {
    throw new RangeError("Replay initial board has an occupied choke point");
  }
  if (!Number.isInteger(row14) || row14 < 0 || row14 >= 64) {
    throw new RangeError("Replay row 14 must be a six-bit occupancy mask");
  }
}

function decodePayload(payload) {
  const bytes = decodeBase64Url(payload);
  if (bytes.length < 3) throw new RangeError("Replay payload is incomplete");
  const reader = new BitReader(bytes);
  const header = reader.readByte();
  const version = header >> 4;
  const flags = header & 0x0f;
  if (version !== VERSION) throw new RangeError("Replay version is not supported");
  if (flags & 0x0e) throw new RangeError("Replay header has reserved flags set");

  const initialState = flags & 1
    ? readInitialState(reader)
    : { board: emptyBoard(), row14: 0 };
  if (
    flags & 1 &&
    initialState.row14 === 0 &&
    initialState.board.every((row) => row.every((cell) => cell === null))
  ) {
    throw new RangeError("Explicit empty initial state is non-canonical");
  }

  const sequenceCount = reader.readVarUint(MAX_SEQUENCE);
  const sequence = [];
  for (let index = 0; index < sequenceCount; index++) {
    const axis = reader.read(3);
    const child = reader.read(3);
    if (axis < 1 || axis > 5 || child < 1 || child > 5) {
      throw new RangeError("Replay tsumo contains an invalid physical color");
    }
    sequence.push({ axis: COLORS[axis - 1], child: COLORS[child - 1] });
  }
  reader.alignAndCheckZeroPadding();

  const moveCount = reader.readVarUint(MAX_MOVES);
  const moves = [];
  let pairCount = 0;
  for (let index = 0; index < moveCount; index++) {
    const kind = reader.read(1);
    const col = reader.read(3);
    const detail = reader.read(2);
    if (col > 5) throw new RangeError("Replay operation has an invalid column");
    if (kind === 0) {
      pairCount++;
      moves.push({ kind: "pair", col, orientation: detail });
    } else {
      if (detail !== 0) {
        throw new RangeError("Garbage operation reserved bits must be zero");
      }
      moves.push({ kind: "garbage", col, orientation: ORIENTATION.UP });
    }
  }
  reader.alignAndCheckZeroPadding();
  if (!reader.atEnd()) throw new RangeError("Replay payload has trailing bytes");
  if (pairCount > sequence.length) {
    throw new RangeError("Replay has fewer tsumos than pair placements");
  }
  return { initialState, sequence, moves };
}

function historyTimeline(session) {
  const initial = session.history[0] || snapshotSession(session);
  const appliedTurns = session.history.slice(1).map((snapshot) => snapshot.lastTurn);
  if (session.lastTurn) appliedTurns.push(session.lastTurn);
  const futureTurns = [...session.future].reverse().map((snapshot) => snapshot.lastTurn);
  const turns = [...appliedTurns, ...futureTurns];
  if (turns.some((turn) => !turn?.placement)) {
    throw new TypeError("Tokopuyo history contains an incomplete recorded operation");
  }
  const moves = turns.map((turn) => turn.mode === "garbage"
    ? { kind: "garbage", col: turn.placement.col }
    : {
      kind: "pair",
      col: turn.placement.col,
      orientation: turn.placement.orientation,
    });
  return { initial, moves };
}

function encodePayload(session) {
  const { initial, moves } = historyTimeline(session);
  if (moves.length > MAX_MOVES) throw new RangeError("Tokopuyo history is too long to share");
  const pairCount = moves.filter((move) => move.kind === "pair").length;
  const sequenceCount = Math.max(session.pattern.hands.length, pairCount);
  if (sequenceCount > MAX_SEQUENCE) {
    throw new RangeError("Tokopuyo queue is too long to share");
  }

  const explicitInitial = initial.row14 !== 0 ||
    initial.board.some((row) => row.some(Boolean));
  validateInitialState(initial);

  const writer = new BitWriter();
  writer.writeByte(explicitInitial ? HEADER_EXPLICIT_INITIAL : HEADER_IMPLICIT_EMPTY);
  if (explicitInitial) writeInitialState(writer, initial);
  writer.writeVarUint(sequenceCount);
  for (let index = 0; index < sequenceCount; index++) {
    const hand = getTsumo(session.pattern, index);
    const axis = COLORS.indexOf(hand.axis) + 1;
    const child = COLORS.indexOf(hand.child) + 1;
    if (axis < 1 || child < 1) {
      throw new TypeError("Tokopuyo queue contains an invalid physical color");
    }
    writer.write(axis, 3);
    writer.write(child, 3);
  }
  writer.align();
  writer.writeVarUint(moves.length);
  for (const move of moves) {
    if (move.kind === "pair") {
      if (!Number.isInteger(move.col) || move.col < 0 || move.col > 5) {
        throw new RangeError("Tokopuyo history contains an invalid column");
      }
      if (!Number.isInteger(move.orientation) || move.orientation < 0 || move.orientation > 3) {
        throw new RangeError("Tokopuyo history contains an invalid orientation");
      }
      writer.write(0, 1);
      writer.write(move.col, 3);
      writer.write(move.orientation, 2);
    } else {
      if (!Number.isInteger(move.col) || move.col < 0 || move.col > 5) {
        throw new RangeError("Tokopuyo history contains an invalid garbage column");
      }
      writer.write(1, 1);
      writer.write(move.col, 3);
      writer.write(0, 2);
    }
  }
  const bytes = writer.finish();
  if (bytes.length > MAX_PAYLOAD_BYTES) throw new RangeError("Replay payload is too large");
  return encodeBase64Url(bytes);
}

export function loadTokopuyoHistory(payload) {
  const replay = decodePayload(payload);
  const hands = replay.sequence;
  const colorsUsed = new Set([
    ...replay.initialState.board.flat().filter((cell) => COLORS.includes(cell)),
    ...hands.flatMap(({ axis, child }) => [axis, child]),
  ]);
  const palette = [
    ...COLORS.filter((color) => colorsUsed.has(color)).slice(0, 4),
    ...COLORS.filter((color) => !colorsUsed.has(color)).slice(0, 4 - Math.min(4, colorsUsed.size)),
  ];
  const pattern = Object.freeze({
    seed: null,
    number: null,
    colors: Object.freeze(palette),
    hands: Object.freeze(hands.map((hand) => Object.freeze({ ...hand }))),
  });
  const session = {
    seed: null,
    pattern,
    board: replay.initialState.board.map((row) => [...row]),
    row14: replay.initialState.row14,
    handIndex: 0,
    activePair: hands.length ? createActivePair(getTsumo(pattern, 0)) : null,
    chainCount: 0,
    cumulativeScore: 0,
    gameOver: false,
    lastTurn: null,
    garbageMode: false,
    savedActivePair: null,
    busy: false,
    history: [],
    future: [],
    customOpening: Boolean(replay.initialState.row14) ||
      replay.initialState.board.some((row) => row.some(Boolean)),
    coachingCompatible: colorsUsed.size <= 4,
    sharedHistory: true,
  };

  const initialSnapshot = snapshotSession(session);
  const posts = [];
  let pairIndex = 0;
  for (const move of replay.moves) {
    let result;
    if (move.kind === "garbage") {
      if (!session.garbageMode) setGarbageMode(session, true);
      session.activePair = createGarbagePair(move.col);
      result = commitActivePair(session);
    } else {
      if (session.garbageMode) setGarbageMode(session, false);
      if (pairIndex >= replay.sequence.length) {
        throw new RangeError("Replay is missing a tsumo for a pair placement");
      }
      result = commitPairAtPlacement(session, move.col, move.orientation);
      pairIndex++;
    }
    if (!result) throw new RangeError("Replay contains an illegal Tokopuyo operation");
    posts.push(snapshotSession(session));
  }

  restoreSessionSnapshot(session, initialSnapshot);
  session.history = [];
  session.future = posts.reverse();
  session.activePair = hands.length ? createActivePair(getTsumo(pattern, 0)) : null;
  return session;
}

export function readTokopuyoShareFromLocation(location = window.location) {
  const params = new URLSearchParams(location.hash.startsWith("#")
    ? location.hash.slice(1)
    : location.hash);
  const values = params.getAll("r");
  return values.length === 1 ? values[0] : null;
}

export function createTokopuyoShareUrl(session, href = window.location.href) {
  const url = new URL(href);
  url.hash = `r=${encodePayload(session)}`;
  return url.href;
}
