import {
  COLS,
  HIDDEN_ROWS,
  ROWS,
  clone,
  findGroups,
  simulate,
} from "../engine.js";
import { enumerateTsumoPlacements } from "./pair-engine.js";

function nextLandingRow(board, col) {
  const topmostOccupied = board.findIndex((row) => row[col] !== null);
  return topmostOccupied === -1 ? ROWS - 1 : topmostOccupied - 1;
}

function canUseCell(row, col) {
  return row >= HIDDEN_ROWS && !(row === HIDDEN_ROWS && col === 2);
}

function routeKey({ row, col, color }) {
  return `${row},${col},${color}`;
}

export function analyzeMainChain(board, colors) {
  const routes = [];
  for (const color of colors) {
    for (let col = 0; col < COLS; col++) {
      const row = nextLandingRow(board, col);
      if (!canUseCell(row, col)) continue;
      const firingBoard = clone(board);
      firingBoard[row][col] = color;
      const ignitionGroup = findGroups(firingBoard).find((group) =>
        group.some(([groupRow, groupCol]) =>
          groupRow === row && groupCol === col
        )
      );
      const result = simulate(firingBoard);
      if (!result.chains) continue;
      routes.push({
        row,
        col,
        color,
        chains: result.chains,
        cleared: result.cleared,
        targetCells: (ignitionGroup || [])
          .filter(([groupRow, groupCol]) =>
            groupRow !== row || groupCol !== col
          )
          .map(([groupRow, groupCol]) => ({
            row: groupRow,
            col: groupCol,
          })),
      });
    }
  }

  routes.sort(
    (left, right) =>
      right.chains - left.chains ||
      right.cleared - left.cleared ||
      right.row - left.row ||
      Math.abs(left.col - 2.5) - Math.abs(right.col - 2.5),
  );
  const chains = routes[0]?.chains || 0;
  const mainRoutes = routes.filter((route) => route.chains === chains);
  return {
    chains,
    primary: mainRoutes[0] || null,
    routes: mainRoutes,
    routeCount: mainRoutes.length,
    triggerColors: [...new Set(mainRoutes.map((route) => route.color))],
  };
}

function routeStillFires(board, route, minimumChains) {
  if (board[route.row][route.col]) return false;
  if (nextLandingRow(board, route.col) !== route.row) return false;
  const firingBoard = clone(board);
  firingBoard[route.row][route.col] = route.color;
  return simulate(firingBoard).chains >= minimumChains;
}

function keepsMainChain(board, mainChain) {
  if (!mainChain.chains) return true;
  return mainChain.routes.some((route) =>
    routeStillFires(board, route, mainChain.chains)
  );
}

function isSafeResponse(placement, mainChain) {
  const result = simulate(placement.board);
  if (result.state[HIDDEN_ROWS][2]) return false;
  if (result.chains >= mainChain.chains && result.chains > 0) return true;
  return keepsMainChain(result.state, mainChain);
}

export function enumerateUnknownHands(colors) {
  return colors.flatMap((axis) =>
    colors.map((child) => ({ axis, child }))
  );
}

export function evaluateUnknownAcceptance(board, colors, mainChain) {
  const hands = enumerateUnknownHands(colors);
  let safeHands = 0;
  let safePlacements = 0;

  for (const hand of hands) {
    let handPlacements = 0;
    for (const placement of enumerateTsumoPlacements(board, hand)) {
      if (!isSafeResponse(placement, mainChain)) continue;
      handPlacements++;
    }
    if (handPlacements) safeHands++;
    safePlacements += handPlacements;
  }

  return {
    safeHands,
    totalHands: hands.length,
    safePlacements,
    coverage: hands.length ? safeHands / hands.length : 0,
  };
}

export function findVisibleMainOpportunity(board, hands, mainChain) {
  if (!mainChain.primary) return null;
  for (let handOffset = 0; handOffset < hands.length; handOffset++) {
    let best = null;
    for (const placement of enumerateTsumoPlacements(board, hands[handOffset])) {
      const usesRoute = mainChain.routes.some((route) =>
        placement.cells.some(({ row, col, color }) =>
          row === route.row && col === route.col && color === route.color
        )
      );
      if (!usesRoute) continue;
      const result = simulate(placement.board);
      if (result.chains < mainChain.chains) continue;
      if (!best || result.chains > best.chains) {
        best = { handOffset, chains: result.chains };
      }
    }
    if (best) return best;
  }
  return null;
}

export function evaluateFieldBalance(board) {
  const heights = [];
  let legalColumns = 0;
  for (let col = 0; col < COLS; col++) {
    const row = nextLandingRow(board, col);
    const height = row === ROWS - 1 && !board[row][col]
      ? 0
      : ROWS - row - 1;
    heights.push(height);
    if (canUseCell(row, col)) legalColumns++;
  }
  const leftHeight = heights.slice(0, 3).reduce((sum, value) => sum + value, 0);
  const rightHeight = heights.slice(3).reduce((sum, value) => sum + value, 0);
  const roughness = heights.slice(1).reduce(
    (sum, height, index) => sum + Math.abs(height - heights[index]),
    0,
  );
  const peak = Math.max(...heights);
  return {
    heights,
    legalColumns,
    capacityDifference: Math.abs(leftHeight - rightHeight),
    roughness,
    peak,
    score:
      legalColumns * 20 -
      Math.abs(leftHeight - rightHeight) * 2 -
      roughness * 3 -
      Math.max(0, peak - 9) * 30,
  };
}

export function preservesMainChain(board, mainChain) {
  return keepsMainChain(board, mainChain);
}
