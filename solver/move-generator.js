import { HIDDEN_ROWS, ROWS, clone } from "../engine.js";

/**
 * Return the next cell a puyo would occupy in each column. This deliberately
 * uses the current drawing rather than changing the user's board by gravity.
 */
export function availablePlacements(board, colors) {
  const moves = [];

  for (let col = 0; col < board[0].length; col++) {
    const topmostOccupied = board.findIndex((row) => row[col] !== null);
    const row = topmostOccupied === -1 ? ROWS - 1 : topmostOccupied - 1;

    const isHidden = row < HIDDEN_ROWS;
    const isChokePoint = row === HIDDEN_ROWS && col === 2;
    if (
      row < 0 ||
      board[row][col] !== null ||
      isHidden ||
      isChokePoint
    ) {
      continue;
    }
    for (const color of colors) moves.push({ row, col, color });
  }

  return moves;
}

export function place(board, move) {
  const next = clone(board);
  next[move.row][move.col] = move.color;
  return next;
}
