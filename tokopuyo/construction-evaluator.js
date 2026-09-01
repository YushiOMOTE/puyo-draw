import { COLS, HIDDEN_ROWS, ROWS } from "../engine.js";

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function cellKey(row, col) {
  return `${row},${col}`;
}

function colorGroups(board) {
  const visited = new Set();
  const groups = [];

  for (let row = HIDDEN_ROWS; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const color = board[row][col];
      const key = cellKey(row, col);
      if (!color || visited.has(key)) continue;

      const cells = [];
      const queue = [[row, col]];
      visited.add(key);
      while (queue.length) {
        const [currentRow, currentCol] = queue.pop();
        cells.push([currentRow, currentCol]);
        for (const [rowDelta, colDelta] of DIRECTIONS) {
          const nextRow = currentRow + rowDelta;
          const nextCol = currentCol + colDelta;
          const nextKey = cellKey(nextRow, nextCol);
          if (
            nextRow >= HIDDEN_ROWS &&
            nextRow < ROWS &&
            nextCol >= 0 &&
            nextCol < COLS &&
            !visited.has(nextKey) &&
            board[nextRow][nextCol] === color
          ) {
            visited.add(nextKey);
            queue.push([nextRow, nextCol]);
          }
        }
      }
      groups.push({ color, cells });
    }
  }
  return groups;
}

function columnMetrics(board) {
  const heights = [];
  let hidden = 0;
  for (let col = 0; col < COLS; col++) {
    const top = board.findIndex((row) => row[col] !== null);
    heights.push(top === -1 ? 0 : ROWS - top);
    if (board[0][col]) hidden++;
  }
  const roughness = heights.slice(1).reduce(
    (sum, height, index) => sum + Math.abs(height - heights[index]),
    0,
  );
  return {
    heights,
    peak: Math.max(...heights),
    roughness,
    hidden,
    leftRightDifference: Math.abs(
      heights.slice(0, 3).reduce((sum, height) => sum + height, 0) -
        heights.slice(3).reduce((sum, height) => sum + height, 0),
    ),
  };
}

function connectionMetrics(board, groups) {
  let usefulPuyos = 0;
  let pairs = 0;
  let triples = 0;
  let exposedGroups = 0;
  let buriedSingles = 0;

  for (const group of groups) {
    const size = group.cells.length;
    if (size >= 2) usefulPuyos += size;
    if (size === 2) pairs++;
    if (size === 3) triples++;

    let hasOpenEdge = false;
    for (const [row, col] of group.cells) {
      if (size === 1 && board[row - 1]?.[col]) buriedSingles++;
      for (const [rowDelta, colDelta] of DIRECTIONS) {
        const nextRow = row + rowDelta;
        const nextCol = col + colDelta;
        if (
          nextRow >= HIDDEN_ROWS &&
          nextRow < ROWS &&
          nextCol >= 0 &&
          nextCol < COLS &&
          board[nextRow][nextCol] === null
        ) {
          hasOpenEdge = true;
        }
      }
    }
    if (hasOpenEdge) exposedGroups++;
  }

  let colorContacts = 0;
  let verticalTransitions = 0;
  for (let row = HIDDEN_ROWS; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const color = board[row][col];
      if (!color) continue;
      const right = board[row][col + 1];
      const below = board[row + 1]?.[col];
      if (right && right !== color) colorContacts++;
      if (below && below !== color) verticalTransitions++;
    }
  }

  return {
    usefulPuyos,
    pairs,
    triples,
    exposedGroups,
    buriedSingles,
    colorContacts,
    verticalTransitions,
  };
}

export function evaluateConstructionField(board, mainChain = null) {
  const groups = colorGroups(board);
  const columns = columnMetrics(board);
  const connections = connectionMetrics(board, groups);
  const occupied = groups.reduce((sum, group) => sum + group.cells.length, 0);
  const resourceEfficiency = occupied
    ? connections.usefulPuyos / occupied
    : 0;
  const triggerHeight = mainChain?.primary
    ? ROWS - mainChain.primary.row - 1
    : null;
  const deathRisk = Boolean(board[HIDDEN_ROWS][2]);

  const shapeScore =
    connections.triples * 150 +
    connections.pairs * 55 +
    connections.exposedGroups * 8 +
    connections.colorContacts * 5 +
    connections.verticalTransitions * 9 +
    Math.round(resourceEfficiency * 120) -
    connections.buriedSingles * 14 -
    columns.roughness * 12 -
    columns.leftRightDifference * 3 -
    Math.max(0, columns.peak - 9) * 90 -
    columns.hidden * 2_000;
  const mainScore = mainChain
    ? mainChain.chains * 120_000 +
      mainChain.routeCount * 1_200 -
      (triggerHeight ?? 0) * 180
    : 0;

  return {
    score: deathRisk ? -10_000_000 : mainScore + shapeScore,
    shapeScore,
    occupied,
    resourceEfficiency,
    triggerHeight,
    groups: {
      pairs: connections.pairs,
      triples: connections.triples,
      usefulPuyos: connections.usefulPuyos,
      exposed: connections.exposedGroups,
    },
    columns,
    deathRisk,
  };
}

export function placementTearPenalty(cells) {
  if (cells.length !== 2 || cells[0].col === cells[1].col) return 0;
  return Math.abs(cells[0].row - cells[1].row) * 35;
}
