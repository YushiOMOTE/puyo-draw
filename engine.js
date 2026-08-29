export const COLS = 6;
export const ROWS = 13;
export const HIDDEN_ROWS = 1;
export const COLORS = ["red", "green", "blue", "yellow", "purple"];
export const GARBAGE = "garbage";

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function clone(state) {
  return state.map((row) => [...row]);
}

export function findGroups(state) {
  const seen = new Set();
  const groups = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (
        !state[row][col] ||
        state[row][col] === GARBAGE ||
        seen.has(`${row},${col}`)
      ) continue;

      const color = state[row][col];
      const group = [];
      const queue = [[row, col]];
      seen.add(`${row},${col}`);

      while (queue.length) {
        const [currentRow, currentCol] = queue.shift();
        group.push([currentRow, currentCol]);

        for (const [rowDelta, colDelta] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nextRow = currentRow + rowDelta;
          const nextCol = currentCol + colDelta;
          const key = `${nextRow},${nextCol}`;

          if (
            nextRow >= 0 &&
            nextRow < ROWS &&
            nextCol >= 0 &&
            nextCol < COLS &&
            !seen.has(key) &&
            state[nextRow][nextCol] === color
          ) {
            seen.add(key);
            queue.push([nextRow, nextCol]);
          }
        }
      }

      if (group.length >= 4) groups.push(group);
    }
  }

  return groups;
}

export function applyGravity(state) {
  const next = emptyBoard();

  for (let col = 0; col < COLS; col++) {
    let targetRow = ROWS - 1;

    for (let row = ROWS - 1; row >= 0; row--) {
      if (state[row][col]) next[targetRow--][col] = state[row][col];
    }
  }

  return next;
}

function findAdjacentGarbage(state, clearedCells) {
  const garbage = new Set();

  for (const [row, col] of clearedCells) {
    for (const [rowDelta, colDelta] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      const key = `${nextRow},${nextCol}`;

      if (
        nextRow >= 0 &&
        nextRow < ROWS &&
        nextCol >= 0 &&
        nextCol < COLS &&
        state[nextRow][nextCol] === GARBAGE &&
        !garbage.has(key)
      ) {
        garbage.add(key);
      }
    }
  }

  return [...garbage].map((key) => key.split(",").map(Number));
}

export function findClearingCells(state) {
  const clearedGroups = findGroups(state).flat();
  if (!clearedGroups.length) return [];

  return [...clearedGroups, ...findAdjacentGarbage(state, clearedGroups)];
}

export function simulate(state) {
  let current = applyGravity(state);
  let chains = 0;
  let cleared = 0;
  const rounds = [];

  while (true) {
    const removed = findClearingCells(current);
    if (!removed.length) break;

    const next = clone(current);
    removed.forEach(([row, col]) => {
      next[row][col] = null;
    });

    chains++;
    cleared += removed.length;
    rounds.push({ state: next, count: removed.length });
    current = applyGravity(next);
  }

  return { state: current, chains, cleared, rounds };
}
