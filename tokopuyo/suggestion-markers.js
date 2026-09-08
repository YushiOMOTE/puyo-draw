import {
  COLS,
  ROWS,
  clone,
  findClearingCells,
  findGroups,
} from "../engine.js";

function addAmaChainMarks(marks, diagnostic) {
  const addedCells = diagnostic?.selectedProbe
    ? diagnostic.selectedProbe.addedCells || []
    : diagnostic?.firingCells || [];
  if (!addedCells.length || !diagnostic.board) return;

  const probeBoard = clone(diagnostic.board);
  for (const cell of addedCells) {
    if (
      cell.row >= 0 &&
      cell.row < probeBoard.length &&
      cell.col >= 0 &&
      cell.col < probeBoard[cell.row].length &&
      !probeBoard[cell.row][cell.col]
    ) {
      probeBoard[cell.row][cell.col] = cell.color;
    }
  }

  let current = probeBoard.map((row, rowIndex) => row.map((color, col) =>
    color ? { color, originRow: rowIndex, originCol: col } : null));
  let chainNumber = 0;
  while (true) {
    const currentBoard = current.map((row) => row.map((cell) => cell?.color || null));
    const groups = findGroups(currentBoard);
    if (!groups.length) break;

    chainNumber++;
    for (const group of groups) {
      for (const [row, col] of group) {
        const token = current[row][col];
        if (!token) continue;
        const key = `${token.originRow},${token.originCol}`;
        const mark = marks.get(key);
        if (mark) {
          mark.chainNumber = chainNumber;
        } else {
          const isProbeCell = addedCells.some(
            (cell) => cell.row === token.originRow && cell.col === token.originCol,
          );
          marks.set(key, {
            color: token.color,
            kind: isProbeCell ? "probe" : "chain-group",
            chainNumber,
          });
        }
      }
    }

    const removed = findClearingCells(currentBoard);
    const removedKeys = new Set(removed.map(([row, col]) => `${row},${col}`));
    const next = current.map((row, rowIndex) => row.map((cell, col) =>
      removedKeys.has(`${rowIndex},${col}`) ? null : cell));
    current = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (let col = 0; col < COLS; col++) {
      const tokens = next
        .map((row) => row[col])
        .filter(Boolean);
      tokens.forEach((cell, index) => {
        current[ROWS - tokens.length + index][col] = cell;
      });
    }
  }

  for (const cell of addedCells) {
    const key = `${cell.row},${cell.col}`;
    if (marks.has(key)) continue;
    marks.set(key, {
      color: cell.color,
      kind: "probe",
    });
  }
}

export function createTokopuyoSuggestionMarks(candidate, board, diagnostic = null) {
  const marks = new Map();
  const mainTrigger = candidate.mainTrigger || null;

  for (const cell of mainTrigger?.targetCells || []) {
    if (board[cell.row][cell.col] !== mainTrigger.color) continue;
    marks.set(`${cell.row},${cell.col}`, {
      color: mainTrigger.color,
      isIgnitionTarget: true,
      ignitionState: mainTrigger.state,
    });
  }

  [...candidate.moves].reverse().forEach((move) => {
    const step = move.handOffset + 1;
    move.cells.forEach(({ row, col, color }) => {
      marks.set(`${row},${col}`, {
        color,
        kind: step === 1 ? "current" : "future",
        step: step > 1 ? String(step) : null,
      });
    });
  });

  addAmaChainMarks(marks, diagnostic);

  return marks;
}
