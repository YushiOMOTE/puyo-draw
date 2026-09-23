import { COLS, COLORS, GARBAGE, ROWS, emptyBoard } from "../engine.js";
import { ORIENTATION } from "./pair-engine.js";

export const PUYOP_ENCODE_CHAR =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ[]";

const FIELD_TYPE = Object.freeze({
  0: null,
  1: "red",
  2: "green",
  3: "blue",
  4: "yellow",
  5: "purple",
  6: GARBAGE,
});

function invalid(message) {
  throw new RangeError(`Invalid Puyo Op payload: ${message}`);
}

function decodeCharacter(character) {
  const value = PUYOP_ENCODE_CHAR.indexOf(character);
  if (value < 0) invalid(`unsupported character ${JSON.stringify(character)}`);
  return value;
}

function decodeField(code) {
  let types;
  if (code.startsWith("=")) {
    types = [...code.slice(1)].map(decodeCharacter);
  } else {
    types = [...code].flatMap((character) => {
      const value = decodeCharacter(character);
      return [value >> 3, value & 7];
    });
  }

  const cellCount = ROWS * COLS;
  if (types.length > cellCount) invalid("field contains too many cells");
  types = Array(cellCount - types.length).fill(0).concat(types);

  const board = emptyBoard();
  types.forEach((type, index) => {
    if (!Object.hasOwn(FIELD_TYPE, type)) {
      invalid(`unsupported field type ${type}`);
    }
    board[Math.floor(index / COLS)][index % COLS] = FIELD_TYPE[type];
  });
  return board;
}

function decodeEntries(code) {
  if (code.length % 2) invalid("NEXT/history data has an incomplete entry");
  const entries = [];
  let foundFuture = false;

  for (let index = 0; index < code.length; index += 2) {
    const oneData = decodeCharacter(code[index]) |
      (decodeCharacter(code[index + 1]) << 6);
    if ((oneData >> 9) === 7) invalid("nuisance entries are not supported");

    const settingNum = oneData & 0x7f;
    const pieceType = Math.floor(settingNum / 25);
    if (pieceType !== 0) invalid(`unsupported piece type ${pieceType}`);
    const firstColor = Math.floor(settingNum / 5) % 5;
    const secondColor = settingNum % 5;
    const historyNum = oneData >> 7;
    const placement = historyNum
      ? {
        col: (historyNum >> 2) - 1,
        orientation: historyNum & 3,
      }
      : null;

    if (placement && (placement.col < 0 || placement.col >= COLS)) {
      invalid("placement column is outside the field");
    }
    if (placement && !Object.values(ORIENTATION).includes(placement.orientation)) {
      invalid("placement direction is invalid");
    }
    if (placement && foundFuture) {
      invalid("played entries cannot follow unplayed NEXT entries");
    }
    if (!placement) foundFuture = true;

    entries.push({
      pair: { axis: COLORS[firstColor], child: COLORS[secondColor] },
      placement,
    });
  }
  return entries;
}

function normalizePayload(value) {
  if (typeof value !== "string") invalid("payload must be text");
  let payload = value.trim();
  if (!payload) invalid("payload is empty");

  try {
    const url = new URL(payload);
    if (url.hostname !== "www.puyop.com" && url.hostname !== "puyop.com") {
      invalid("full URL is not a Puyo Op URL");
    }
    const marker = "/s/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) invalid("full URL does not contain /s/");
    payload = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch (error) {
    if (error instanceof RangeError) throw error;
  }

  payload = payload.replace(/^\/?s\//, "").replace(/^\//, "");
  if (!payload) invalid("payload is empty");
  return payload;
}

export function parsePuyopPayload(value) {
  const payload = normalizePayload(value);
  const withoutNazo = payload.split("-", 1)[0];
  const separator = withoutNazo.indexOf("_");
  const fieldCode = separator < 0
    ? withoutNazo
    : withoutNazo.slice(0, separator);
  const nextCode = separator < 0
    ? ""
    : withoutNazo.slice(separator + 1);

  return {
    board: decodeField(fieldCode),
    entries: decodeEntries(nextCode),
  };
}
