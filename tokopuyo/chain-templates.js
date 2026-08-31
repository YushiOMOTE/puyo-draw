import {
  COLS,
  ROWS,
  applyGravity,
  findClearingCells,
  simulate,
} from "../engine.js";

const TEMPLATE_COLORS = ["red", "green", "blue", "yellow"];
const SYMBOLS = {
  r: "red",
  g: "green",
  b: "blue",
  y: "yellow",
  ".": null,
};

// Each template is a verified fourteen-chain field. Smaller goals are derived
// by advancing the field until only the requested number of rounds remains.
const FOURTEEN_CHAIN_TEMPLATES = [
  [
    "......", "......", ".y....", ".rr.y.", ".rg.rg", "gyrrgb", "byrbgr",
    "ybyggr", "yybbrb", "bgygyy", "bgbrry", "grgrbb",
    "rgrggg",
  ],
  [
    "......", "......", ".y....", ".rr..g", ".rgr.b", "gyrbyr", "byrgrr",
    "ybyggg", "yybbrb", "bgygyy", "bgbrry", "grgrbb",
    "rgrggg",
  ],
  [
    "......", ".y....", ".rr...", ".rgr..", ".yrb..", "gyrb.g", "bbyryb",
    "yybgrb", "yrrryy", "bgygry", "bgbggg", "grgrbb",
    "rgrggg",
  ],
  [
    "......", ".y....", ".rr...", ".rg..g", ".yr..b", "gyrr.b", "bbybyy",
    "yybbry", "yrrryg", "bgygrg", "bgbrgg", "grgrbb",
    "rgrggg",
  ],
];

function parseTemplate(rows) {
  return rows.map((row) => [...row].map((symbol) => SYMBOLS[symbol]));
}

function boardAfterRounds(board, rounds) {
  if (!rounds) return board;
  const result = simulate(board);
  return applyGravity(result.rounds[rounds - 1].state);
}

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, itemIndex) => itemIndex !== index)).map(
      (rest) => [value, ...rest],
    ),
  );
}

function remapBoard(board, colorMap, reflected) {
  return board.map((row) => {
    const mapped = row.map((color) => colorMap.get(color) || null);
    return reflected ? mapped.reverse() : mapped;
  });
}

function triggerCellFor(board) {
  const clearing = findClearingCells(board);
  const clearKeys = new Set(clearing.map(([row, col]) => `${row},${col}`));
  const candidates = clearing.filter(([row, col]) => {
    for (let above = 0; above < row; above++) {
      if (board[above][col] && !clearKeys.has(`${above},${col}`)) return false;
    }
    return true;
  });
  const [row, col] = candidates[0] || clearing[0];
  return { row, col, color: board[row][col] };
}

function validateTargetChains(targetChains) {
  if (!Number.isInteger(targetChains) || targetChains < 1 || targetChains > 14) {
    throw new RangeError("Tokopuyo target chains must be from 1 through 14");
  }
}

export function createChainGoals(targetChains, colors) {
  validateTargetChains(targetChains);
  if (!Array.isArray(colors) || colors.length !== 4) {
    throw new RangeError("Tokopuyo chain goals require exactly four colors");
  }

  const goals = [];
  for (const [templateIndex, rows] of FOURTEEN_CHAIN_TEMPLATES.entries()) {
    const base = boardAfterRounds(parseTemplate(rows), 14 - targetChains);
    for (const [permutationIndex, colorOrder] of permutations(colors).entries()) {
      const colorMap = new Map(
        TEMPLATE_COLORS.map((color, index) => [color, colorOrder[index]]),
      );
      for (const reflected of [false, true]) {
        const board = remapBoard(base, colorMap, reflected);
        if (board.length !== ROWS || board.some((row) => row.length !== COLS)) {
          throw new Error("Invalid Tokopuyo chain template dimensions");
        }
        const result = simulate(board);
        if (result.chains !== targetChains) {
          throw new Error("Invalid Tokopuyo chain template result");
        }
        goals.push({
          id: `${templateIndex}:${permutationIndex}:${Number(reflected)}`,
          board,
          targetChains,
          triggerCell: triggerCellFor(board),
        });
      }
    }
  }
  return goals;
}
