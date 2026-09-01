import {
  COLS,
  HIDDEN_ROWS,
  ROWS,
  clone,
  findClearingCells,
  findGroups,
  isSettled,
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

// Every field is independently verified to have a stable, empty one-puyo
// trigger that can be filled legally from above. The long-chain defaults keep
// several structural alternatives because compatibility matters most there.
const CHAIN_TEMPLATES = {
  1: [[
    "......", "......", "......", "......", "......", "......", "......",
    "......", "......", "......", "......", "......", "rrrr..",
  ]],
  2: [[
    "......", "......", "......", "......", "......", "......", "......",
    "......", "......", "......", "...r..", "..gg..", "rrrgg.",
  ]],
  3: [[
    "......", "......", "......", "......", "......", "......", "......",
    "......", "......", "...r..", "...gg.", "..gbb.", "rrrgbb",
  ]],
  4: [[
    "......", "......", "......", "......", "......", "......", "......",
    "......", "...rg.", "...gb.", "...by.", "..gyyy", "rrrgbb",
  ]],
  5: [[
    "......", "......", "......", "......", "......", "......", "...r..",
    "...g..", "..rbg.", "..ryb.", "..rry.", "..gyy.", "rrrgbb",
  ]],
  6: [[
    "......", "......", "......", "......", "....g.", "....b.", "....y.",
    "...ry.", "...grg", "...bgg", "...ygb", "..gyrr", "rrrgbr",
  ]],
  7: [[
    "......", "......", "......", "......", ".....b", ".....r", "...rgr",
    "...gbg", "...byg", "...yrg", "..bbbb", "..gyyg", "rrrgbr",
  ]],
  8: [[
    "......", "......", "......", "......", "...r.b", "...g.r", "...bgr",
    "...ybg", "...byg", "..gbrg", "..rybb", ".yygyg", "rryybr",
  ]],
  9: [[
    "......", "......", "......", "......", "...r.b", "...g.r", "...bgr",
    "..gybg", "..rbyg", ".rybrg", ".rrybb", ".yrgyg", "rryybr",
  ]],
  10: [[
    "......", "......", "......", "......", "...r.b", "...g.r", "..gbgr",
    ".rrybg", ".yybyg", ".rrbrg", ".ggybb", "ggrgyg", "ryrybr",
  ]],
  11: [[
    "......", "......", "......", "......", "...r.b", "...g.r", ".rgbgr",
    ".yrybg", "brybyg", "bgrbrg", "bbgybb", "ggrgyg", "ryrybr",
  ]],
  12: [[
    "......", "......", ".r....", ".y....", ".r.r.b", ".g.g.r", ".ggbgr",
    ".yrybg", "ybybyg", "yyrbrg", "gygybb", "rbrgyg", "bbrybr",
  ]],
  13: [
    [
      "......", "......", "..b...", "..br..", "..gyy.", ".ybrrg", ".rbbrg",
      "rryrgb", "yryrrg", "rgbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
    [
      "......", "......", "......", ".g.r..", ".b.yy.", ".ybrrg", "rrbbrg",
      "yrgrgb", "yrbrrg", "rybyyy", "grbgrr", "gbygby", "gbrgby",
    ],
    [
      "......", "......", "......", "..br..", ".gbyy.", ".ygrrg", ".rbbrg",
      "rryrgb", "yryrrg", "rbbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
    [
      "......", "......", "......", "y..r..", "y..yy.", "r.brrg", "rrbbrg",
      "rbgrgb", "yybrrg", "rgbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
  ],
  14: [
    [
      "......", ".y....", ".yb...", ".ybr..", ".rgyy.", ".rbrrg", ".rybrg",
      "gggrgb", "grbrrg", "rgbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
    [
      "......", ".y....", ".y....", ".ybr..", ".rbyy.", ".rgrrg", "ggbbrg",
      "gryrgb", "grbrrg", "rgbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
    [
      "......", "..b...", "..b...", ".ygr..", ".rbyy.", ".ggrrg", "ggbbrg",
      "rryrgb", "yryrrg", "rgbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
    [
      "......", "......", "..b...", ".ybr..", ".rgyy.", "ggbrrg", "ggbbrg",
      "rryrgb", "yryrrg", "rgbyyy", "grbgrr", "gbygby", "gbrgby",
    ],
  ],
};

function parseTemplate(rows) {
  return rows.map((row) => [...row].map((symbol) => SYMBOLS[symbol]));
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

function nextLandingRow(board, col) {
  const topmostOccupied = board.findIndex((row) => row[col] !== null);
  return topmostOccupied === -1 ? ROWS - 1 : topmostOccupied - 1;
}

function triggerPlanFor(board, targetChains) {
  const candidates = [];
  for (const [row, col] of findClearingCells(board)) {
    if (row < HIDDEN_ROWS || (row === HIDDEN_ROWS && col === 2)) continue;
    const color = board[row][col];
    const constructionBoard = clone(board);
    constructionBoard[row][col] = null;
    if (!isSettled(constructionBoard)) continue;
    if (findClearingCells(constructionBoard).length) continue;
    if (nextLandingRow(constructionBoard, col) !== row) continue;

    const firingBoard = clone(constructionBoard);
    firingBoard[row][col] = color;
    const result = simulate(firingBoard);
    if (result.chains !== targetChains) continue;
    const group = findGroups(firingBoard).find((cells) =>
      cells.some(([groupRow, groupCol]) =>
        groupRow === row && groupCol === col,
      ),
    );
    if (!group) continue;

    candidates.push({
      cell: { row, col, color },
      color,
      group: group.map(([groupRow, groupCol]) => ({
        row: groupRow,
        col: groupCol,
      })),
      accessCells: Array.from({ length: row }, (_, accessRow) => ({
        row: accessRow,
        col,
      })),
      constructionBoard,
      chains: result.chains,
    });
  }

  candidates.sort(
    (left, right) =>
      right.cell.row - left.cell.row ||
      Math.abs(left.cell.col - 2.5) - Math.abs(right.cell.col - 2.5),
  );
  return candidates[0] || null;
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
  for (const [templateIndex, rows] of CHAIN_TEMPLATES[targetChains].entries()) {
    const base = parseTemplate(rows);
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
        const triggerPlan = triggerPlanFor(board, targetChains);
        if (!triggerPlan) continue;
        goals.push({
          id: `${templateIndex}:${permutationIndex}:${Number(reflected)}`,
          board,
          targetChains,
          triggerCell: triggerPlan.cell,
          triggerPlan,
        });
      }
    }
  }
  if (!goals.length) {
    throw new Error("No Tokopuyo chain goal has a legal trigger plan");
  }
  return goals;
}
