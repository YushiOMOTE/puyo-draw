import { GARBAGE, HIDDEN_ROWS, ROWS } from "../engine.js";

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function connectedPotential(board) {
  const visited = new Set();
  let score = 0;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const color = board[row][col];
      const startKey = `${row},${col}`;
      if (!color || color === GARBAGE || visited.has(startKey)) continue;

      let size = 0;
      const queue = [[row, col]];
      visited.add(startKey);
      while (queue.length) {
        const [currentRow, currentCol] = queue.pop();
        size++;
        for (const [rowDelta, colDelta] of DIRECTIONS) {
          const nextRow = currentRow + rowDelta;
          const nextCol = currentCol + colDelta;
          const key = `${nextRow},${nextCol}`;
          if (
            nextRow >= 0 &&
            nextRow < board.length &&
            nextCol >= 0 &&
            nextCol < board[nextRow].length &&
            !visited.has(key) &&
            board[nextRow][nextCol] === color
          ) {
            visited.add(key);
            queue.push([nextRow, nextCol]);
          }
        }
      }

      score += size * size * 5;
      if (size === 2) score += 10;
      if (size === 3) score += 35;
    }
  }

  return score;
}

function bridgePotential(board) {
  let score = 0;

  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== null) continue;
      const neighbors = new Map();
      for (const [rowDelta, colDelta] of DIRECTIONS) {
        const color = board[row + rowDelta]?.[col + colDelta];
        if (color && color !== GARBAGE) {
          neighbors.set(color, (neighbors.get(color) || 0) + 1);
        }
      }
      for (const count of neighbors.values()) {
        if (count >= 2) score += count * 14;
      }
    }
  }

  return score;
}

function shapePenalty(board) {
  const heights = [];
  let holes = 0;
  let hiddenPuyos = 0;

  for (let col = 0; col < board[0].length; col++) {
    let top = ROWS;
    let foundPuyo = false;
    for (let row = 0; row < ROWS; row++) {
      if (board[row][col]) {
        top = Math.min(top, row);
        foundPuyo = true;
        if (row < HIDDEN_ROWS) hiddenPuyos++;
      } else if (foundPuyo) {
        holes++;
      }
    }
    heights.push(ROWS - top);
  }

  const roughness = heights
    .slice(1)
    .reduce(
      (total, height, index) => total + Math.abs(height - heights[index]),
      0,
    );
  const peak = Math.max(...heights);
  return (
    holes * 18 +
    roughness * 4 +
    Math.max(0, peak - 9) * 24 +
    hiddenPuyos * 500
  );
}

export function evaluateAmaField(board) {
  return (
    connectedPotential(board) + bridgePotential(board) - shapePenalty(board)
  );
}
