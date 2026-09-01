export const COLS = 6;
export const ROWS = 13;
export const HIDDEN_ROWS = 1;
export const COLORS = ["red", "green", "blue", "yellow", "purple"];
export const GARBAGE = "garbage";

const CHAIN_BONUSES = [0, 0, 8, 16];
const GROUP_BONUSES = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10];
const COLOR_BONUSES = [0, 0, 3, 6, 12, 24];

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function clone(state) {
  return state.map((row) => [...row]);
}

export function isSettled(state) {
  for (let col = 0; col < COLS; col++) {
    let foundEmptyCell = false;

    for (let row = ROWS - 1; row >= 0; row--) {
      if (row < HIDDEN_ROWS) continue;
      if (!state[row][col]) {
        foundEmptyCell = true;
      } else if (foundEmptyCell) {
        return false;
      }
    }
  }

  return true;
}

export function findGroups(state) {
  const seen = new Set();
  const groups = [];

  for (let row = HIDDEN_ROWS; row < ROWS; row++) {
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
            nextRow >= HIDDEN_ROWS &&
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

      if (group.length >= 4) {
        group.color = color;
        groups.push(group);
      }
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
        nextRow >= HIDDEN_ROWS &&
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

export function chainBonus(chain) {
  if (chain >= 35) return 999;
  if (chain >= 4) return (chain - 3) * 32;
  return CHAIN_BONUSES[chain] ?? 0;
}

export function groupBonus(size) {
  return GROUP_BONUSES[Math.min(size, GROUP_BONUSES.length - 1)] ?? 0;
}

export function colorBonus(colorCount) {
  return COLOR_BONUSES[Math.min(colorCount, COLOR_BONUSES.length - 1)] ?? 0;
}

export function scoreChain(groups, chain) {
  const colorPuyos = groups.reduce((total, group) => total + group.length, 0);
  const colors = new Set(groups.map((group) => group.color));
  const multiplier = Math.max(
    1,
    Math.min(
      999,
      chainBonus(chain) +
        groups.reduce((total, group) => total + groupBonus(group.length), 0) +
        colorBonus(colors.size),
    ),
  );

  return {
    score: colorPuyos * 10 * multiplier,
    colorPuyos,
    multiplier,
  };
}

export function simulate(state) {
  let current = applyGravity(state);
  let chains = 0;
  let cleared = 0;
  let score = 0;
  const rounds = [];

  while (true) {
    const groups = findGroups(current);
    const removed = groups.length
      ? [...groups.flat(), ...findAdjacentGarbage(current, groups.flat())]
      : [];
    if (!removed.length) break;

    const next = clone(current);
    removed.forEach(([row, col]) => {
      next[row][col] = null;
    });

    chains++;
    cleared += removed.length;
    const chainScore = scoreChain(groups, chains);
    score += chainScore.score;
    rounds.push({
      state: next,
      count: removed.length,
      score: chainScore.score,
      cumulativeScore: score,
      multiplier: chainScore.multiplier,
    });
    current = applyGravity(next);
  }

  return { state: current, chains, cleared, score, rounds };
}
