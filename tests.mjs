import assert from "node:assert/strict";
import {
  COLS,
  ROWS,
  HIDDEN_ROWS,
  GARBAGE,
  clone,
  emptyBoard,
  isSettled,
  findGroups,
  findClearingCells,
  applyGravity,
  simulate,
  scoreChain,
} from "./engine.js";
import { availablePlacements, place } from "./solver/move-generator.js";
import { MaxPriorityQueue } from "./solver/priority-queue.js";
import { evaluateLatentChain } from "./solver/latent-chain.js";
import { finalizeSuggestionResult } from "./solver/candidate-pipeline.js";
import {
  pruneRedundantPlacements,
  rankCandidates,
} from "./solver/candidate-utils.js";
import { createSearchPolicy } from "./solver/search-policy.js";
import { solveSuggestion } from "./solver/solver-registry.js";
import { SuggestionController } from "./solver/suggestion-controller.js";
import { SUGGESTION_SEARCH_CONFIG } from "./solver/suggestion-config.js";
import { generatePattern, getTsumo } from "./tokopuyo/queue.js";
import {
  DRAG_RETURN_HYSTERESIS_RATIO,
  DRAG_STEP_RATIO,
  START_HIT_SLOP_RATIO,
  cornerTargetAt,
  createTokopuyoGesture,
  tokopuyoStartColumnAt,
  updateTokopuyoGesture,
} from "./tokopuyo/gesture.js";
import {
  ORIENTATION,
  createActivePair,
  dropTsumo,
  enumerateTsumoPlacements,
  hardDrop,
  isPlacementReachable,
  movePair,
  pairCells,
  rotatePair,
} from "./tokopuyo/pair-engine.js";
import {
  decodeAmaBoard,
  encodeAmaBoard,
  encodeAmaPair,
  toAmaColor,
} from "./tokopuyo/ama-color-map.js";
import {
  actOnPair,
  commitActivePair,
  commitPairAtColumn,
  commitPairAtPlacement,
  createSession,
  previewHands,
  previewPairAtColumn,
  previewPairAtPlacement,
  redoSession,
  undoSession,
} from "./tokopuyo/session.js";
import {
  evaluateConstructionField,
  placementTearPenalty,
} from "./tokopuyo/construction-evaluator.js";
import { TOKOPUYO_SUGGESTION_CONFIG } from "./tokopuyo/suggestion-config.js";
import {
  AMA_FUTURE_PAIRINGS,
  aggregateAmaBranches,
  analyzeAmaBranches,
  compareAmaFutureProfiles,
  createAmaBranchQueue,
  evaluateAmaMove,
  summarizeAmaBranchScores,
} from "./tokopuyo/pressureless-ama.js";
import {
  buildAmaReplay,
  selectBestAmaBranch,
} from "./tokopuyo/ama-replay.js";
import { solveTokopuyoSuggestion } from "./tokopuyo/suggestion-solver.js";
import {
  createTokopuyoSuggestionMarks,
} from "./tokopuyo/suggestion-markers.js";
import {
  TOKOPUYO_ATTACK_SUGGESTION_CONFIG,
} from "./tokopuyo/attack-suggestion-config.js";
import {
  compareAttackCandidates,
  solveTokopuyoAttackSuggestion,
} from "./tokopuyo/attack-suggestion-solver.js";
import {
  analyzeMainChain,
  enumerateUnknownHands,
  evaluateFieldBalance,
  evaluateUnknownAcceptance,
  preservesMainChain,
} from "./tokopuyo/safety-evaluator.js";

const solveWithAma = (request) =>
  solveSuggestion({ ...request, solver: "ama" });
const solveWithBeam = (request) =>
  solveSuggestion({ ...request, solver: "beam" });
const solveWithHybrid = (request) =>
  solveSuggestion({ ...request, solver: "hybrid" });

const state = emptyBoard();
for (let col = 0; col < 4; col++) state[ROWS - 1][col] = "red";

assert.equal(findGroups(state).length, 1);
assert.equal(findGroups(state)[0].length, 4);
assert.equal(applyGravity(state)[ROWS - 1][0], "red");

const result = simulate(state);
assert.equal(result.chains, 1);
assert.equal(result.cleared, 4);
assert.equal(result.state.flat().filter(Boolean).length, 0);
assert.equal(result.score, 40);
assert.equal(result.rounds[0].score, 40);
assert.equal(result.rounds[0].cumulativeScore, 40);

const simultaneous = emptyBoard();
for (let col = 0; col < 4; col++) {
  simultaneous[ROWS - 1][col] = "red";
  simultaneous[ROWS - 2][col] = "blue";
}
assert.deepEqual(scoreChain(findGroups(simultaneous), 1), {
  score: 240,
  colorPuyos: 8,
  multiplier: 3,
});

const chain = emptyBoard();
for (let col = 0; col < 4; col++) chain[ROWS - 1][col] = "red";
chain[ROWS - 2][1] = "red";
chain[ROWS - 2][0] = "blue";
chain[ROWS - 2][2] = "blue";
chain[ROWS - 2][3] = "blue";
chain[ROWS - 3][1] = "blue";

assert.equal(simulate(chain).chains, 2);
assert.equal(COLS, 6);
assert.equal(ROWS, 13);
assert.equal(HIDDEN_ROWS, 1);
assert.equal(emptyBoard().length, 13);

const hiddenOnlyGroup = emptyBoard();
for (let col = 0; col < 4; col++) hiddenOnlyGroup[0][col] = "red";
assert.equal(findGroups(hiddenOnlyGroup).length, 0);
assert.equal(findClearingCells(hiddenOnlyGroup).length, 0);
assert.equal(simulate(hiddenOnlyGroup).chains, 1);
assert.equal(simulate(hiddenOnlyGroup).state.flat().filter(Boolean).length, 0);

const hiddenBridge = emptyBoard();
hiddenBridge[0][0] = "red";
for (let row = 1; row <= 4; row++) hiddenBridge[row][0] = "red";
for (let row = 5; row < ROWS; row++) {
  hiddenBridge[row][0] = row % 2 ? "blue" : "green";
}
const hiddenBridgeGroups = findGroups(hiddenBridge);
assert.equal(hiddenBridgeGroups.length, 1);
assert.deepEqual([...hiddenBridgeGroups[0]], [
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
]);
const hiddenBridgeResult = simulate(hiddenBridge);
assert.equal(hiddenBridgeResult.chains, 1);
assert.equal(hiddenBridgeResult.state[4][0], "red");

const gestureOptions = {
  cellSize: 100,
  viewportWidth: 400,
  viewportHeight: 800,
};

const fieldRect = { left: 100, top: 50, width: 600, height: 1300 };
const startHitSlop = 100 * START_HIT_SLOP_RATIO;
assert.equal(tokopuyoStartColumnAt(100, 100, fieldRect, COLS), 0);
assert.equal(tokopuyoStartColumnAt(699, 100, fieldRect, COLS), 5);
assert.equal(tokopuyoStartColumnAt(98, 100, fieldRect, COLS), 0);
assert.equal(tokopuyoStartColumnAt(702, 100, fieldRect, COLS), 5);
assert.equal(
  tokopuyoStartColumnAt(100 - startHitSlop, 100, fieldRect, COLS),
  0,
);
assert.equal(
  tokopuyoStartColumnAt(700 + startHitSlop, 100, fieldRect, COLS),
  5,
);
assert.equal(
  tokopuyoStartColumnAt(100 - startHitSlop - 1, 100, fieldRect, COLS),
  null,
);
assert.equal(
  tokopuyoStartColumnAt(100, 50 - startHitSlop - 1, fieldRect, COLS),
  null,
);

const advanceGesture = (state, x, y) =>
  updateTokopuyoGesture(state, x, y, gestureOptions);

let dragState = createTokopuyoGesture(200, 300);
let dragUpdate = advanceGesture(
  dragState,
  200 + 100 * DRAG_STEP_RATIO - 1,
  300,
);
assert.equal(dragUpdate.columnDelta, 0);
dragUpdate = advanceGesture(
  dragUpdate.state,
  200 + 100 * DRAG_STEP_RATIO,
  300,
);
assert.equal(dragUpdate.columnDelta, 1);
dragUpdate = advanceGesture(
  dragUpdate.state,
  200 + 100 * (DRAG_STEP_RATIO - DRAG_RETURN_HYSTERESIS_RATIO) + 1,
  300,
);
assert.equal(dragUpdate.columnDelta, 0);
dragUpdate = advanceGesture(
  dragUpdate.state,
  200 + 100 * (DRAG_STEP_RATIO - DRAG_RETURN_HYSTERESIS_RATIO),
  300,
);
assert.equal(dragUpdate.columnDelta, -1);

let verticalState = createTokopuyoGesture(200, 300);
let verticalUpdate = advanceGesture(verticalState, 200, 231);
assert.equal(verticalUpdate.rotationSteps, null);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 230);
assert.equal(verticalUpdate.rotationSteps, 1);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 160);
assert.equal(verticalUpdate.rotationSteps, 2);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 90);
assert.equal(verticalUpdate.rotationSteps, 3);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 20);
assert.equal(verticalUpdate.rotationSteps, 4);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 300);
assert.equal(verticalUpdate.rotationSteps, 0);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 370);
assert.equal(verticalUpdate.rotationSteps, -1);
verticalUpdate = advanceGesture(verticalUpdate.state, 200, 440);
assert.equal(verticalUpdate.rotationSteps, -2);

let verticalHysteresis = createTokopuyoGesture(200, 300);
let hysteresisUpdate = advanceGesture(verticalHysteresis, 200, 230);
hysteresisUpdate = advanceGesture(hysteresisUpdate.state, 200, 247);
assert.equal(hysteresisUpdate.rotationSteps, null);
hysteresisUpdate = advanceGesture(hysteresisUpdate.state, 200, 248);
assert.equal(hysteresisUpdate.rotationSteps, 0);

const combinedUpdate = advanceGesture(
  createTokopuyoGesture(200, 300),
  270,
  230,
);
assert.equal(combinedUpdate.columnDelta, 1);
assert.equal(combinedUpdate.rotationSteps, 1);

let crossedAxes = advanceGesture(
  createTokopuyoGesture(200, 300),
  340,
  300,
);
assert.equal(crossedAxes.columnDelta, 2);
crossedAxes = advanceGesture(crossedAxes.state, 129, 300);
assert.equal(crossedAxes.columnDelta, -3);

assert.equal(cornerTargetAt(10, 10, 400, 800, 40), "top-left");
assert.equal(cornerTargetAt(390, 790, 400, 800, 40), "bottom-right");
let cancelState = createTokopuyoGesture(200, 300);
let cancelUpdate = advanceGesture(cancelState, 10, 10);
assert.equal(cancelUpdate.state.cancelCorner, "top-left");
cancelUpdate = advanceGesture(cancelUpdate.state, 200, 200);
assert.equal(cancelUpdate.state.cancelCorner, null);
assert.equal(cancelUpdate.state.columnSteps, 0);
assert.equal(cancelUpdate.state.rotationSteps, 0);

let cornerStart = createTokopuyoGesture(10, 790, gestureOptions);
let cornerStartUpdate = advanceGesture(cornerStart, 15, 785);
assert.equal(cornerStartUpdate.state.cancelCorner, null);
cornerStart = advanceGesture(cornerStartUpdate.state, 200, 600).state;
cornerStartUpdate = advanceGesture(cornerStart, 10, 790);
assert.equal(cornerStartUpdate.state.cancelCorner, "bottom-left");

const seedZeroPattern = generatePattern(0);
assert.equal(seedZeroPattern.number, 1);
assert.equal(seedZeroPattern.hands.length, 128);
assert.equal(seedZeroPattern.colors.length, 4);
assert.deepEqual(getTsumo(seedZeroPattern, 128), getTsumo(seedZeroPattern, 0));
assert.throws(() => generatePattern(-1), RangeError);
assert.throws(() => generatePattern(65_536), RangeError);
assert.equal(generatePattern(65_535).number, 65_536);
assert.deepEqual(generatePattern(0), seedZeroPattern);
assert.deepEqual(
  encodeAmaPair(seedZeroPattern.hands[0], seedZeroPattern.colors),
  {
    axis: seedZeroPattern.colors.indexOf(seedZeroPattern.hands[0].axis),
    child: seedZeroPattern.colors.indexOf(seedZeroPattern.hands[0].child),
  },
);
assert.equal(toAmaColor(seedZeroPattern.colors[0], seedZeroPattern.colors), 0);
assert.equal(toAmaColor(seedZeroPattern.colors[1], seedZeroPattern.colors), 1);
assert.equal(toAmaColor(seedZeroPattern.colors[2], seedZeroPattern.colors), 2);
assert.equal(toAmaColor(seedZeroPattern.colors[3], seedZeroPattern.colors), 3);
const amaEncodingBoard = emptyBoard();
amaEncodingBoard[ROWS - 1] = [
  "purple",
  "green",
  "red",
  "blue",
  GARBAGE,
  null,
];
assert.equal(
  encodeAmaBoard(
    amaEncodingBoard,
    ["purple", "green", "red", "blue"],
  ).slice(-6),
  "RYGB#.",
);
assert.deepEqual(
  decodeAmaBoard(
    `${".".repeat(72)}RYGB#.`,
    ["purple", "green", "red", "blue"],
  )[ROWS - 1],
  ["purple", "green", "red", "blue", GARBAGE, null],
);
assert.throws(
  () => encodeAmaBoard(
    amaEncodingBoard,
    ["red", "green", "blue", "yellow"],
  ),
  RangeError,
);
assert.equal(
  generatePattern(34_066).hands
    .slice(0, 8)
    .map(({ axis, child }) => `${axis[0]}${child[0]}`)
    .join(""),
  "bpbpbpypgybgbpbb",
);

const activePair = createActivePair({ axis: "red", child: "blue" });
assert.deepEqual(pairCells(activePair), [
  { row: 0, col: 2, color: "red", role: "axis" },
  { row: -1, col: 2, color: "blue", role: "child" },
]);
const movedPair = movePair(emptyBoard(), activePair, 1);
assert.equal(movedPair.axis.col, 3);
assert.equal(rotatePair(emptyBoard(), activePair, 1).orientation, ORIENTATION.RIGHT);

const wallPair = {
  ...activePair,
  axis: { row: 2, col: 0 },
  orientation: ORIENTATION.UP,
};
const wallKicked = rotatePair(emptyBoard(), wallPair, -1);
assert.equal(wallKicked.orientation, ORIENTATION.LEFT);
assert.equal(wallKicked.axis.col, 1);

const wedgedBoard = emptyBoard();
wedgedBoard[2][1] = "green";
wedgedBoard[2][3] = "yellow";
const wedgedPair = {
  ...activePair,
  axis: { row: 2, col: 2 },
  orientation: ORIENTATION.UP,
};
const blockedOnce = rotatePair(wedgedBoard, wedgedPair, 1);
assert.equal(blockedOnce.orientation, ORIENTATION.UP);
assert.equal(blockedOnce.blockedRotation, 1);
const quickTurned = rotatePair(wedgedBoard, blockedOnce, 1);
assert.equal(quickTurned.orientation, ORIENTATION.DOWN);
assert.equal(quickTurned.axis.row, 1);

const splitBoard = emptyBoard();
splitBoard[ROWS - 1][2] = "green";
splitBoard[ROWS - 1][3] = "yellow";
splitBoard[ROWS - 2][3] = "yellow";
const horizontalPair = {
  ...activePair,
  orientation: ORIENTATION.RIGHT,
};
const splitDrop = hardDrop(splitBoard, horizontalPair);
assert.equal(splitDrop.board[ROWS - 2][2], "red");
assert.equal(splitDrop.board[ROWS - 3][3], "blue");
const pureSplitDrop = dropTsumo(
  splitBoard,
  { axis: "red", child: "blue" },
  2,
  ORIENTATION.RIGHT,
);
assert.deepEqual(pureSplitDrop.board, splitDrop.board);
assert.deepEqual(
  pureSplitDrop.cells.map(({ row, col, role }) => ({ row, col, role })),
  [
    { row: ROWS - 2, col: 2, role: "axis" },
    { row: ROWS - 3, col: 3, role: "child" },
  ],
);
const emptyPairPlacements = enumerateTsumoPlacements(
  emptyBoard(),
  { axis: "red", child: "blue" },
);
assert.equal(emptyPairPlacements.length, 22);
assert.equal(
  new Set(emptyPairPlacements.map(({ cells }) =>
    cells.map(({ row, col, color }) => `${row},${col},${color}`).sort().join("|"),
  )).size,
  emptyPairPlacements.length,
);
assert.equal(
  enumerateTsumoPlacements(
    emptyBoard(),
    { axis: "red", child: "red" },
  ).length,
  11,
);
assert.throws(
  () => enumerateTsumoPlacements(
    emptyBoard(),
    { axis: "red", child: "blue" },
    64,
  ),
  RangeError,
);

function boardWithHeights(heights) {
  const result = emptyBoard();
  heights.forEach((height, col) => {
    for (let offset = 0; offset < height; offset++) {
      result[ROWS - 1 - offset][col] = offset % 2 ? "blue" : "red";
    }
  });
  return result;
}

const blockedPathBoard = boardWithHeights([3, 12, 1, 0, 5, 12]);
const blockedPathPlacements = enumerateTsumoPlacements(
  blockedPathBoard,
  { axis: "red", child: "blue" },
);
assert.equal(blockedPathPlacements.length, 10);
assert.equal(
  isPlacementReachable(blockedPathBoard, 0, ORIENTATION.UP),
  false,
);
assert.equal(
  hardDrop(blockedPathBoard, {
    ...createActivePair({ axis: "red", child: "blue" }),
    axis: { row: 0, col: 0 },
  }),
  null,
);

const row14LandingBoard = boardWithHeights([0, 0, 11, 12, 0, 0]);
const row14Drop = dropTsumo(
  row14LandingBoard,
  { axis: "red", child: "blue" },
  3,
  ORIENTATION.UP,
);
assert.ok(row14Drop);
assert.equal(row14Drop.board[0][3], "red");
assert.equal(row14Drop.row14, 1 << 3);
assert.deepEqual(
  row14Drop.cells.map(({ row, col, role }) => ({ row, col, role })),
  [
    { row: 0, col: 3, role: "axis" },
    { row: -1, col: 3, role: "child" },
  ],
);
assert.equal(
  dropTsumo(
    row14LandingBoard,
    { axis: "red", child: "blue" },
    3,
    ORIENTATION.UP,
    1 << 3,
  ),
  null,
);

function placementKey(col, orientation) {
  return `${col},${orientation}`;
}

function buttonReachablePlacements(board, row14 = 0) {
  const initial = createActivePair({ axis: "red", child: "blue" });
  const stateKey = (pair) => [
    pair.axis.row,
    pair.axis.col,
    pair.orientation,
    pair.blockedRotation ?? "none",
  ].join(",");
  const pending = [initial];
  const visited = new Set([stateKey(initial)]);
  const placements = new Set();
  while (pending.length) {
    const pair = pending.shift();
    const dropped = hardDrop(board, pair, row14);
    if (dropped) {
      placements.add(placementKey(pair.axis.col, pair.orientation));
    }
    for (const next of [
      movePair(board, pair, -1),
      movePair(board, pair, 1),
      rotatePair(board, pair, -1),
      rotatePair(board, pair, 1),
    ]) {
      const key = stateKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      pending.push(next);
    }
  }
  return placements;
}

for (const [parityBoard, parityRow14] of [
  [emptyBoard(), 0],
  [blockedPathBoard, 0],
  [boardWithHeights([6, 9, 10, 3, 10, 3]), 32],
  [boardWithHeights([12, 1, 0, 5, 12, 13]), 54],
]) {
  const generated = new Set(
    enumerateTsumoPlacements(
      parityBoard,
      { axis: "red", child: "blue" },
      parityRow14,
    ).map(({ col, orientation }) => placementKey(col, orientation)),
  );
  assert.deepEqual(buttonReachablePlacements(parityBoard, parityRow14), generated);
}
const solverTopOutBoard = emptyBoard();
for (let row = 0; row < ROWS; row++) {
  solverTopOutBoard[row][0] = row % 2 ? "red" : "blue";
}
assert.equal(
  dropTsumo(
    solverTopOutBoard,
    { axis: "green", child: "yellow" },
    0,
    ORIENTATION.UP,
  ),
  null,
);

const tokopuyoSession = createSession(0);
assert.deepEqual(previewHands(tokopuyoSession), [
  getTsumo(seedZeroPattern, 1),
  getTsumo(seedZeroPattern, 2),
]);
actOnPair(tokopuyoSession, "left");
const committed = commitActivePair(tokopuyoSession);
assert.ok(committed);
assert.equal(tokopuyoSession.handIndex, 1);
assert.equal(tokopuyoSession.history.length, 1);
assert.equal(undoSession(tokopuyoSession), true);
assert.equal(tokopuyoSession.handIndex, 0);
assert.equal(tokopuyoSession.activePair.axis.col, 2);
assert.equal(redoSession(tokopuyoSession), true);
assert.equal(tokopuyoSession.handIndex, 1);

const row14Session = createSession(0);
row14Session.board = boardWithHeights([0, 0, 11, 12, 0, 0]);
assert.ok(commitPairAtPlacement(row14Session, 3, ORIENTATION.UP));
assert.equal(row14Session.row14, 1 << 3);
assert.equal(undoSession(row14Session), true);
assert.equal(row14Session.row14, 0);
assert.equal(redoSession(row14Session), true);
assert.equal(row14Session.row14, 1 << 3);

const kickedSession = createSession(0);
const leftWallKick = commitPairAtColumn(kickedSession, 0, "left");
assert.ok(leftWallKick);
assert.equal(leftWallKick.droppedPair.axis.col, 1);
assert.equal(leftWallKick.droppedPair.orientation, ORIENTATION.LEFT);

const rightWallKickSession = createSession(0);
const rightWallKick = commitPairAtColumn(rightWallKickSession, 5, "right");
assert.ok(rightWallKick);
assert.equal(rightWallKick.droppedPair.axis.col, 4);
assert.equal(rightWallKick.droppedPair.orientation, ORIENTATION.RIGHT);

const upsideDownFlickSession = createSession(0);
const upsideDownFlick = commitPairAtColumn(upsideDownFlickSession, 2, "down");
assert.ok(upsideDownFlick);
assert.equal(upsideDownFlick.droppedPair.orientation, ORIENTATION.DOWN);

const skippedRotationSession = createSession(0);
assert.equal(
  previewPairAtPlacement(skippedRotationSession, 0, ORIENTATION.LEFT),
  null,
);
assert.ok(
  previewPairAtPlacement(skippedRotationSession, 0, ORIENTATION.DOWN),
);

const tappedColumnSession = createSession(0);
assert.deepEqual(
  previewPairAtColumn(tappedColumnSession, 5, "straight").map(
    ({ row, col }) => ({ row, col }),
  ),
  [
    { row: 0, col: 5 },
    { row: -1, col: 5 },
  ],
);
assert.deepEqual(
  previewPairAtPlacement(tappedColumnSession, 5, ORIENTATION.UP).map(
    ({ row, col }) => ({ row, col }),
  ),
  [
    { row: 0, col: 5 },
    { row: -1, col: 5 },
  ],
);
tappedColumnSession.board[0][5] = "green";
assert.equal(
  previewPairAtPlacement(tappedColumnSession, 5, ORIENTATION.UP),
  null,
);

const splitPreviewSession = createSession(0);
splitPreviewSession.board[ROWS - 1][2] = "green";
const splitPreview = previewPairAtColumn(splitPreviewSession, 2, "right");
assert.deepEqual(
  splitPreview.map(({ row, col }) => ({ row, col })),
  [
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ],
);

const upsideDownStackSession = createSession(0);
upsideDownStackSession.board[ROWS - 1][2] = "green";
assert.ok(
  commitPairAtPlacement(upsideDownStackSession, 2, ORIENTATION.DOWN),
);
assert.equal(
  upsideDownStackSession.board[ROWS - 2][2],
  seedZeroPattern.hands[0].child,
);
assert.equal(
  upsideDownStackSession.board[ROWS - 3][2],
  seedZeroPattern.hands[0].axis,
);

const upsideDownSession = createSession(0);
assert.ok(commitPairAtColumn(upsideDownSession, 0, "down"));
assert.equal(
  upsideDownSession.board[ROWS - 1][0],
  seedZeroPattern.hands[0].child,
);
assert.equal(
  upsideDownSession.board[ROWS - 2][0],
  seedZeroPattern.hands[0].axis,
);

const firingSession = createSession(0);
for (let row = ROWS - 3; row < ROWS; row++) {
  firingSession.board[row][0] = "red";
}
firingSession.activePair = {
  ...createActivePair({ axis: "red", child: "blue" }),
  axis: { row: 0, col: 0 },
};
const firingCommit = commitActivePair(firingSession);
assert.equal(firingCommit.result.chains, 1);
assert.equal(firingSession.chainCount, 1);
assert.equal(firingSession.board[ROWS - 1][0], "blue");
assert.deepEqual(firingSession.lastTurn.beforeBoard[ROWS - 3].slice(0, 2), [
  "red",
  null,
]);
assert.equal(firingSession.lastTurn.handIndex, 0);
assert.deepEqual(firingSession.lastTurn.current, { axis: "red", child: "blue" });
assert.deepEqual(firingSession.lastTurn.next, getTsumo(firingSession.pattern, 1));
assert.equal(firingSession.lastTurn.placement.cells.length, 2);
assert.deepEqual(firingSession.lastTurn.result, {
  chains: 1,
  score: firingCommit.result.score,
  gameOver: false,
});
assert.equal(undoSession(firingSession), true);
assert.equal(firingSession.lastTurn, null);
assert.equal(redoSession(firingSession), true);
assert.equal(firingSession.lastTurn.result.chains, 1);

const gameOverSession = createSession(0);
for (let row = HIDDEN_ROWS + 1; row < ROWS; row++) {
  gameOverSession.board[row][2] = row % 2 ? "red" : "blue";
}
gameOverSession.activePair = createActivePair({ axis: "green", child: "yellow" });
assert.ok(commitActivePair(gameOverSession));
assert.equal(gameOverSession.gameOver, true);
assert.equal(actOnPair(gameOverSession, "left"), false);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.lookaheadHands, 3);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.visibleHands, 2);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.depth, 16);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.width, 250);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.branchCount, 6);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.workerCount, 3);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.timeBudgetMs, 8_000);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.visibleSearchRatio, 0.72);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.maximumConstructionHeight, 11);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.allowEmergencyClearFallback, true);
assert.equal(TOKOPUYO_SUGGESTION_CONFIG.safetyCandidateLimit, 10);
assert.equal(enumerateUnknownHands(seedZeroPattern.colors).length, 16);
const amaAggregate = aggregateAmaBranches(
  {
    board: emptyBoard(),
    row14: 0,
    current: { axis: "red", child: "blue" },
    branchCount: 6,
    resultLimit: 2,
  },
  Array.from({ length: 6 }, (_, branch) => ({
    branch,
    candidates: [
      { col: 0, orientation: ORIENTATION.UP, score: (branch + 1) * 100 },
      { col: 1, orientation: ORIENTATION.RIGHT, score: 25 },
    ],
  })),
);
assert.equal(amaAggregate.length, 2);
assert.equal(amaAggregate[0].solver, "pressureless-ama");
assert.equal(amaAggregate[0].col, 0);
assert.equal(amaAggregate[0].score, 2_100);
assert.equal(amaAggregate[0].averageScore, 350);
assert.deepEqual(amaAggregate[0].branchScores, [100, 200, 300, 400, 500, 600]);
assert.equal(amaAggregate[0].moves.length, 1);
const amaAllCandidates = analyzeAmaBranches(
  {
    board: emptyBoard(),
    row14: 0,
    current: { axis: "red", child: "blue" },
    branchCount: 6,
  },
  Array.from({ length: 6 }, (_, branch) => ({
    branch,
    candidates: [
      { col: 0, orientation: ORIENTATION.UP, score: (branch + 1) * 100 },
      { col: 1, orientation: ORIENTATION.RIGHT, score: 25 },
    ],
  })),
);
const reviewedMove = evaluateAmaMove({
  placement: { cells: amaAllCandidates[1].moves[0].cells },
  result: { gameOver: false },
}, amaAllCandidates);
assert.equal(reviewedMove.verdict, "different-choice");
assert.equal(reviewedMove.rank, 2);
assert.equal(reviewedMove.legalCount, 2);
assert.equal(reviewedMove.averageGap, 325);
assert.deepEqual(reviewedMove.branches, { user: 0, tied: 0, ama: 6 });
assert.deepEqual(reviewedMove.userStats, {
  total: 150,
  average: 25,
  mean: 25,
  minimum: 25,
  maximum: 25,
  variance: 0,
  standardDeviation: 0,
  relativeDispersion: 0,
});
assert.deepEqual(reviewedMove.bestStats, {
  total: 2_100,
  average: 350,
  mean: 350,
  minimum: 100,
  maximum: 600,
  variance: 175_000 / 6,
  standardDeviation: Math.sqrt(175_000 / 6),
  relativeDispersion: Math.sqrt(175_000 / 6) / 350,
});
assert.equal(reviewedMove.branchComparisons.length, 6);
assert.equal(reviewedMove.branchComparisons[0].winner, "ama");
assert.equal(reviewedMove.aggregateRetention, 150 / 2_100);
assert.deepEqual(summarizeAmaBranchScores([0, 10, 20, 30, 40, 50]), {
  total: 150,
  average: 25,
  mean: 25,
  minimum: 0,
  maximum: 50,
  variance: 1_750 / 6,
  standardDeviation: Math.sqrt(1_750 / 6),
  relativeDispersion: Math.sqrt(1_750 / 6) / 25,
});
assert.throws(() => summarizeAmaBranchScores([1, 2]), /requires six scores/);
assert.deepEqual(compareAmaFutureProfiles(
  summarizeAmaBranchScores([100, 100, 100, 100, 100, 100]),
  summarizeAmaBranchScores([0, 50, 100, 150, 200, 300]),
), { potentialLeader: "ama", stabilityLeader: "user" });
assert.deepEqual(compareAmaFutureProfiles(
  summarizeAmaBranchScores([100, 100, 100, 100, 100, 100]),
  summarizeAmaBranchScores([104, 104, 104, 104, 104, 104]),
), { potentialLeader: "ama", stabilityLeader: "similar" });
assert.deepEqual(compareAmaFutureProfiles(
  summarizeAmaBranchScores([0, 0, 0, 0, 0, 0]),
  summarizeAmaBranchScores([100, 100, 100, 100, 100, 100]),
), { potentialLeader: "ama", stabilityLeader: "unavailable" });
assert.equal(AMA_FUTURE_PAIRINGS.length, 6);
assert.deepEqual(createAmaBranchQueue(
  { axis: "red", child: "blue" },
  { axis: "yellow", child: "green" },
  ["red", "yellow", "green", "blue"],
  0,
  6,
), [
  { axis: "red", child: "blue" },
  { axis: "yellow", child: "green" },
  { axis: "red", child: "yellow" },
  { axis: "green", child: "blue" },
  { axis: "red", child: "yellow" },
  { axis: "green", child: "blue" },
]);
assert.deepEqual(selectBestAmaBranch({
  branchScores: [40, 100, 20, 100, 0, 30],
}), { branch: 1, score: 100, tiedBranches: [1, 3] });
const simpleAmaReplay = buildAmaReplay(emptyBoard(), 0, {
  branch: 0,
  score: 40,
  chainCount: 1,
  moves: [
    {
      handOffset: 0,
      pair: { axis: "red", child: "red" },
      col: 0,
      orientation: ORIENTATION.UP,
    },
    {
      handOffset: 1,
      pair: { axis: "red", child: "red" },
      col: 0,
      orientation: ORIENTATION.UP,
    },
  ],
});
assert.equal(simpleAmaReplay.hands.length, 2);
assert.equal(simpleAmaReplay.hands[0].result.chains, 0);
assert.equal(simpleAmaReplay.hands[1].result.chains, 1);
assert.equal(simpleAmaReplay.hands[1].result.score, 40);
assert.equal(simpleAmaReplay.hands[1].afterBoard.flat().filter(Boolean).length, 0);
const tiedAmaCandidates = amaAllCandidates.map((candidate, index) =>
  index === 1
    ? {
      ...candidate,
      score: amaAllCandidates[0].score,
      averageScore: amaAllCandidates[0].averageScore,
    }
    : candidate
);
assert.equal(evaluateAmaMove({
  placement: { cells: tiedAmaCandidates[1].moves[0].cells },
  result: { gameOver: false },
}, tiedAmaCandidates).verdict, "tied-choice");
assert.equal(evaluateAmaMove({
  placement: {
    cells: [...amaAllCandidates[0].moves[0].cells]
      .reverse()
      .map(({ role: _role, ...cell }) => cell),
  },
  result: { gameOver: false },
}, amaAllCandidates).verdict, "top-choice");
assert.equal(evaluateAmaMove({
  placement: { cells: [{ row: 0, col: 2, color: "red" }] },
  result: { gameOver: true },
}, amaAllCandidates).verdict, "game-over");
assert.equal(evaluateAmaMove({
  placement: { cells: [{ row: 0, col: 2, color: "red" }] },
  result: { gameOver: true },
}, []).verdict, "no-surviving-choice");
assert.throws(
  () => aggregateAmaBranches(
    {
      board: emptyBoard(),
      row14: 0,
      current: { axis: "red", child: "blue" },
      branchCount: 6,
    },
    [],
  ),
  /incomplete branch set/,
);
assert.throws(
  () => aggregateAmaBranches(
    {
      board: emptyBoard(),
      row14: 0,
      current: { axis: "red", child: "blue" },
      branchCount: 2,
    },
    [
      { branch: 0, candidates: [] },
      { branch: 0, candidates: [] },
    ],
  ),
  /invalid future branches/,
);
const safetyBoard = emptyBoard();
safetyBoard[ROWS - 1][0] = "red";
safetyBoard[ROWS - 1][1] = "red";
safetyBoard[ROWS - 1][2] = "red";
const safetyMain = analyzeMainChain(safetyBoard, seedZeroPattern.colors);
assert.equal(safetyMain.chains, 1);
assert.ok(safetyMain.routes.some(({ row, col, color }) =>
  row === ROWS - 1 && col === 3 && color === "red"
));
assert.deepEqual(safetyMain.primary.targetCells, [
  { row: ROWS - 1, col: 0 },
  { row: ROWS - 1, col: 1 },
  { row: ROWS - 1, col: 2 },
]);
assert.equal(preservesMainChain(safetyBoard, safetyMain), true);
const coveredSafety = evaluateUnknownAcceptance(
  safetyBoard,
  seedZeroPattern.colors,
  safetyMain,
);
assert.equal(coveredSafety.totalHands, 16);
assert.ok(coveredSafety.safeHands > 0);
assert.ok(coveredSafety.safeHands <= coveredSafety.totalHands);
const emptyBalance = evaluateFieldBalance(emptyBoard());
assert.equal(emptyBalance.capacityDifference, 0);
assert.equal(emptyBalance.legalColumns, 6);
const emptyConstruction = evaluateConstructionField(emptyBoard());
assert.equal(emptyConstruction.resourceEfficiency, 0);
assert.equal(emptyConstruction.deathRisk, false);
assert.equal(placementTearPenalty([
  { row: 12, col: 0 },
  { row: 10, col: 1 },
]), 70);
const protectedMainBoard = emptyBoard();
for (let col = 0; col < 3; col++) {
  protectedMainBoard[ROWS - 1][col] = seedZeroPattern.colors[0];
}
const protectedMainSuggestion = solveTokopuyoSuggestion({
  kind: "tokopuyo",
  board: protectedMainBoard,
  hands: seedZeroPattern.hands.slice(0, 3),
  colors: seedZeroPattern.colors,
  ...TOKOPUYO_SUGGESTION_CONFIG,
  beamWidth: 60,
  safetyCandidateLimit: 4,
  timeBudgetMs: 1_800,
});
assert.equal(protectedMainSuggestion.currentMainChains, 1);
assert.ok(protectedMainSuggestion.candidates.length > 0);
assert.ok(protectedMainSuggestion.candidates.every(
  (candidate) => candidate.mainChainsAfterMove >= 1,
));
const tokopuyoSuggestion = solveTokopuyoSuggestion({
  kind: "tokopuyo",
  board: emptyBoard(),
  hands: seedZeroPattern.hands.slice(0, 3),
  colors: seedZeroPattern.colors,
  ...TOKOPUYO_SUGGESTION_CONFIG,
  beamWidth: 60,
  safetyCandidateLimit: 4,
  timeBudgetMs: 1_800,
});
assert.ok(tokopuyoSuggestion.candidates.length > 0);
assert.equal(tokopuyoSuggestion.solver, "tokopuyo-ama-style");
assert.ok(tokopuyoSuggestion.candidates[0].moves.length >= 1);
assert.ok(tokopuyoSuggestion.candidates[0].moves.length <= 3);
assert.equal(tokopuyoSuggestion.candidates[0].moves[0].cells.length, 2);
assert.equal(tokopuyoSuggestion.candidates[0].acceptance.totalHands, 16);
assert.ok(tokopuyoSuggestion.candidates[0].acceptance.evaluatedHands <= 16);
assert.equal(typeof tokopuyoSuggestion.candidates[0].mainChainsAfterMove, "number");
assert.equal(typeof tokopuyoSuggestion.candidates[0].mainChainsAtHorizon, "number");
assert.equal(typeof tokopuyoSuggestion.candidates[0].balance.score, "number");
assert.equal(typeof tokopuyoSuggestion.candidates[0].construction.score, "number");
assert.equal(typeof tokopuyoSuggestion.candidates[0].potentialChains, "number");
assert.equal("plannedTrigger" in tokopuyoSuggestion.candidates[0], false);
assert.equal("goalCells" in tokopuyoSuggestion.candidates[0], false);
for (const candidate of tokopuyoSuggestion.candidates) {
  assert.equal(candidate.emergency, false);
  assert.ok(candidate.acceptance.safeHands <= candidate.acceptance.evaluatedHands);
  assert.ok(
    candidate.construction.columns.peak <=
      TOKOPUYO_SUGGESTION_CONFIG.maximumConstructionHeight,
  );
}
const ignitionTargetBoard = emptyBoard();
for (let col = 0; col < 3; col++) {
  ignitionTargetBoard[ROWS - 1][col] = "blue";
}
const overlappingIgnitionMarks = createTokopuyoSuggestionMarks({
  mainTrigger: {
    row: ROWS - 1,
    col: 3,
    color: "blue",
    state: "building",
    targetCells: [
      { row: ROWS - 1, col: 0 },
      { row: ROWS - 1, col: 1 },
      { row: ROWS - 1, col: 2 },
    ],
  },
  moves: [
    {
      handOffset: 0,
      cells: [{ row: ROWS - 1, col: 4, color: "green" }],
    },
    {
      handOffset: 1,
      cells: [{ row: ROWS - 1, col: 2, color: "purple" }],
    },
  ],
}, ignitionTargetBoard);
assert.deepEqual(overlappingIgnitionMarks.get(`${ROWS - 1},2`), {
  color: "purple",
  kind: "future",
  step: "2",
});
assert.deepEqual(overlappingIgnitionMarks.get(`${ROWS - 1},0`), {
  color: "blue",
  isIgnitionTarget: true,
  ignitionState: "building",
});
assert.equal(overlappingIgnitionMarks.has(`${ROWS - 1},3`), false);
assert.deepEqual(overlappingIgnitionMarks.get(`${ROWS - 1},4`), {
  color: "green",
  kind: "current",
  step: null,
});
assert.equal(TOKOPUYO_ATTACK_SUGGESTION_CONFIG.lookaheadHands, 3);
assert.equal(TOKOPUYO_ATTACK_SUGGESTION_CONFIG.resultLimit, 10);

const attackTieCandidates = [
  {
    score: 1_000,
    fireHandOffset: 1,
    chains: 1,
    moves: [{ cells: [{ row: 12, col: 1, color: "red" }] }],
  },
  {
    score: 1_000,
    fireHandOffset: 0,
    chains: 3,
    moves: [{ cells: [{ row: 12, col: 2, color: "red" }] }],
  },
  {
    score: 1_000,
    fireHandOffset: 0,
    chains: 2,
    moves: [{ cells: [{ row: 12, col: 3, color: "red" }] }],
  },
];
attackTieCandidates.sort(compareAttackCandidates);
assert.deepEqual(
  attackTieCandidates.map(({ fireHandOffset, chains }) => [
    fireHandOffset,
    chains,
  ]),
  [[0, 2], [0, 3], [1, 1]],
);

const attackBoard = emptyBoard();
for (let col = 0; col < 3; col++) attackBoard[ROWS - 1][col] = "red";
const immediateAttack = solveTokopuyoAttackSuggestion({
  board: attackBoard,
  hands: [
    { axis: "red", child: "blue" },
    { axis: "green", child: "yellow" },
    { axis: "blue", child: "green" },
  ],
  ...TOKOPUYO_ATTACK_SUGGESTION_CONFIG,
  timeBudgetMs: 5_000,
});
assert.equal(immediateAttack.timedOut, false);
assert.ok(immediateAttack.candidates.length > 0);
assert.ok(immediateAttack.candidates.length <= 10);
assert.equal(immediateAttack.candidates[0].fireHandOffset, 0);
assert.equal(immediateAttack.candidates[0].moves.length, 1);
for (let index = 1; index < immediateAttack.candidates.length; index++) {
  assert.ok(
    compareAttackCandidates(
      immediateAttack.candidates[index - 1],
      immediateAttack.candidates[index],
    ) <= 0,
  );
}

const delayedAttackHands = [
  { axis: "blue", child: "green" },
  { axis: "red", child: "yellow" },
  { axis: "green", child: "blue" },
];
const delayedAttack = solveTokopuyoAttackSuggestion({
  board: attackBoard,
  hands: delayedAttackHands,
  ...TOKOPUYO_ATTACK_SUGGESTION_CONFIG,
  timeBudgetMs: 5_000,
});
assert.equal(delayedAttack.timedOut, false);
assert.ok(delayedAttack.candidates.some(
  ({ fireHandOffset, moves }) => fireHandOffset === 1 && moves.length === 2,
));
for (const candidate of delayedAttack.candidates) {
  assert.equal(candidate.moves.length, candidate.fireHandOffset + 1);
  let replayBoard = clone(attackBoard);
  candidate.moves.forEach((move, handOffset) => {
    const placement = dropTsumo(
      replayBoard,
      delayedAttackHands[handOffset],
      move.col,
      move.orientation,
    );
    assert.ok(placement);
    const replayResult = simulate(placement.board);
    assert.equal(Boolean(replayResult.state[HIDDEN_ROWS][2]), false);
    assert.equal(replayResult.chains > 0, handOffset === candidate.fireHandOffset);
    replayBoard = replayResult.state;
  });
}

const nextNextAttack = solveTokopuyoAttackSuggestion({
  board: attackBoard,
  hands: [
    { axis: "blue", child: "green" },
    { axis: "yellow", child: "purple" },
    { axis: "red", child: "blue" },
  ],
  ...TOKOPUYO_ATTACK_SUGGESTION_CONFIG,
  timeBudgetMs: 5_000,
});
assert.equal(nextNextAttack.timedOut, false);
assert.ok(nextNextAttack.candidates.length > 0);
assert.ok(nextNextAttack.candidates.every(
  ({ fireHandOffset, moves }) => fireHandOffset === 2 && moves.length === 3,
));

const chokeAttackBoard = emptyBoard();
chokeAttackBoard[ROWS - 1][3] = "red";
chokeAttackBoard[ROWS - 2][3] = "red";
chokeAttackBoard[ROWS - 3][3] = "red";
const chokeColumnColors = [
  "purple", "blue", "green", "yellow", "blue", "green",
  "yellow", "blue", "green", "yellow", "blue",
];
chokeColumnColors.forEach((color, index) => {
  chokeAttackBoard[ROWS - 1 - index][2] = color;
});
const chokeAttackHand = { axis: "yellow", child: "red" };
const doomedFiringPlacements = enumerateTsumoPlacements(
  chokeAttackBoard,
  chokeAttackHand,
).filter((placement) => {
  const firing = simulate(placement.board);
  return firing.chains > 0 && Boolean(firing.state[HIDDEN_ROWS][2]);
});
assert.ok(doomedFiringPlacements.length > 0);
const safeChokeAttack = solveTokopuyoAttackSuggestion({
  board: chokeAttackBoard,
  hands: [chokeAttackHand],
  lookaheadHands: 1,
  resultLimit: 10,
  timeBudgetMs: 5_000,
});
assert.ok(safeChokeAttack.candidates.length > 0);
for (const candidate of safeChokeAttack.candidates) {
  const move = candidate.moves[0];
  const placement = dropTsumo(
    chokeAttackBoard,
    chokeAttackHand,
    move.col,
    move.orientation,
  );
  assert.ok(placement);
  assert.equal(Boolean(simulate(placement.board).state[HIDDEN_ROWS][2]), false);
}
assert.equal(SUGGESTION_SEARCH_CONFIG.maxAdditions, 20);
assert.equal(SUGGESTION_SEARCH_CONFIG.resultLimit, 8);
assert.equal(SUGGESTION_SEARCH_CONFIG.timeBudgetMs, 5_000);
assert.equal(SUGGESTION_SEARCH_CONFIG.solver, "hybrid");
assert.equal(SUGGESTION_SEARCH_CONFIG.beamWidth, 48);

const settledBoard = emptyBoard();
settledBoard[ROWS - 1][0] = "red";
settledBoard[ROWS - 2][0] = GARBAGE;
assert.equal(isSettled(settledBoard), true);
assert.equal(isSettled(emptyBoard()), true);

const floatingBoard = emptyBoard();
floatingBoard[ROWS - 2][0] = "red";
assert.equal(isSettled(floatingBoard), false);

const garbageBoard = emptyBoard();
for (let col = 0; col < 4; col++) garbageBoard[ROWS - 1][col] = "red";
garbageBoard[ROWS - 2][0] = GARBAGE;
garbageBoard[ROWS - 2][1] = GARBAGE;
garbageBoard[ROWS - 3][0] = GARBAGE;

const garbageResult = simulate(garbageBoard);
assert.equal(findClearingCells(garbageBoard).length, 6);
assert.equal(garbageResult.chains, 1);
assert.equal(garbageResult.cleared, 6);
assert.equal(garbageResult.state.flat().filter(Boolean).length, 1);
assert.equal(garbageResult.state.flat().filter((value) => value === GARBAGE).length, 1);

const suggestionBoard = emptyBoard();
for (let col = 0; col < 3; col++) suggestionBoard[ROWS - 1][col] = "red";
assert.equal(evaluateLatentChain(suggestionBoard).chains, 1);
assert.equal(evaluateLatentChain(suggestionBoard).triggerCost, 1);
assert.equal(evaluateLatentChain(suggestionBoard).triggerPlacements.length, 1);
assert.equal(evaluateLatentChain(suggestionBoard).triggerPlacements[0].color, "red");

const pairTriggerBoard = emptyBoard();
pairTriggerBoard[ROWS - 1][0] = "yellow";
pairTriggerBoard[ROWS - 1][1] = "yellow";
assert.equal(
  evaluateLatentChain(pairTriggerBoard, { maxTriggerPuyos: 1 }).chains,
  0,
);
assert.equal(
  evaluateLatentChain(pairTriggerBoard, { maxTriggerPuyos: 2 }).chains,
  1,
);
assert.equal(
  evaluateLatentChain(pairTriggerBoard, { maxTriggerPuyos: 2 })
    .triggerPlacements.length,
  2,
);

const triggerOnlyResult = solveWithAma({
  board: suggestionBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 1,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  maxQueueSize: 100,
});
assert.equal(triggerOnlyResult.baselineChains, 1);
assert.equal(triggerOnlyResult.candidates.length, 0);

const extensionBoard = emptyBoard();
for (let col = 0; col < 3; col++) {
  extensionBoard[ROWS - 1][col] = "red";
  extensionBoard[ROWS - 2][col] = "blue";
}
assert.equal(evaluateLatentChain(extensionBoard).chains, 1);

const suggestionResult = solveWithBeam({
  board: extensionBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 1,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  beamWidth: 24,
});
assert.ok(suggestionResult.candidates.length > 0);
assert.equal(suggestionResult.candidates[0].chains, 2);
assert.equal(suggestionResult.candidates[0].chainGain, 1);
assert.equal(suggestionResult.candidates[0].placements.length, 1);
assert.equal(suggestionResult.candidates[0].triggerPlacements.length, 1);
assert.notDeepEqual(suggestionResult.candidates[0].placements[0], {
  row: ROWS - 1,
  col: 3,
  color: "red",
});
assert.equal(
  evaluateLatentChain(
    place(extensionBoard, suggestionResult.candidates[0].placements[0]),
  ).chains,
  2,
);

const amaSuggestionResult = solveWithAma({
  board: extensionBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 1,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  maxQueueSize: 100,
});
assert.equal(amaSuggestionResult.solver, "ama");
assert.ok(amaSuggestionResult.candidates.length > 0);
assert.equal(amaSuggestionResult.candidates[0].chains, 2);
assert.equal(amaSuggestionResult.candidates[0].chainGain, 1);
assert.equal(amaSuggestionResult.candidates[0].placements.length, 1);

const longChainBoard = emptyBoard();
for (const [row, col, color] of [
  [12, 0, "red"],
  [11, 0, "red"],
  [10, 0, "green"],
  [9, 0, "green"],
  [8, 0, "yellow"],
  [7, 0, "yellow"],
  [6, 0, "yellow"],
  [5, 0, "green"],
  [12, 1, "green"],
  [11, 1, "red"],
  [10, 1, "green"],
  [9, 1, "red"],
]) {
  longChainBoard[row][col] = color;
}
assert.equal(evaluateLatentChain(longChainBoard).chains, 3);
const longChainResult = solveWithHybrid({
  board: longChainBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 10,
  resultLimit: 4,
  timeBudgetMs: 3_000,
  minimizationBudgetMs: 500,
  minimumChainGain: 2,
  targetChainGain: 3,
  maxTriggerPuyos: 1,
  beamWidth: 36,
});
assert.equal(longChainResult.solver, "hybrid");
assert.ok(longChainResult.candidates.length > 0);
assert.equal(longChainResult.candidates[0].chains, 5);
assert.equal(longChainResult.candidates[0].chainGain, 2);
const longChainCandidate = longChainResult.candidates[0];
let completedLongChainBoard = longChainBoard;
for (const placement of [
  ...longChainCandidate.placements,
  ...longChainCandidate.triggerPlacements,
]) {
  completedLongChainBoard = place(completedLongChainBoard, placement);
}
assert.equal(simulate(completedLongChainBoard).chains, 5);

const necessaryPlacement = suggestionResult.candidates[0].placements[0];
let redundantSuggestionBoard = place(extensionBoard, necessaryPlacement);
redundantSuggestionBoard = place(redundantSuggestionBoard, {
  row: ROWS - 1,
  col: 4,
  color: "green",
});
redundantSuggestionBoard = place(redundantSuggestionBoard, {
  row: ROWS - 1,
  col: 5,
  color: "yellow",
});
const redundantPotential = evaluateLatentChain(redundantSuggestionBoard);
const minimizedSuggestion = pruneRedundantPlacements(
  extensionBoard,
  {
    placements: [
      necessaryPlacement,
      { row: ROWS - 1, col: 4, color: "green" },
      { row: ROWS - 1, col: 5, color: "yellow" },
    ],
    triggerPlacements: redundantPotential.triggerPlacements,
    chains: redundantPotential.chains,
    chainGain: redundantPotential.chains - 1,
    cleared: redundantPotential.cleared,
    score: 0,
  },
);
assert.deepEqual(minimizedSuggestion.placements, [necessaryPlacement]);
assert.equal(minimizedSuggestion.chains, 2);

const sharedPolicy = createSearchPolicy({
  board: extensionBoard,
  maxTriggerPuyos: 1,
});
const searchPlacements = [
  necessaryPlacement,
  { row: ROWS - 1, col: 4, color: "green" },
  { row: ROWS - 1, col: 5, color: "yellow" },
];
const sharedAssessment = sharedPolicy.assess(
  redundantSuggestionBoard,
  searchPlacements,
);
assert.equal(sharedAssessment.expandable, true);
assert.equal(sharedPolicy.candidates()[0].searchPlacements.length, 3);
const sharedPipelineResult = finalizeSuggestionResult(
  {
    solver: "test",
    baselineChains: sharedPolicy.baselineChains,
    rawCandidates: sharedPolicy.candidates(),
    timedOut: false,
  },
  {
    board: extensionBoard,
    resultLimit: 5,
    minimumChainGain: 1,
    targetChainGain: 1,
    maxTriggerPuyos: 1,
    minimizationBudgetMs: 1_000,
  },
);
assert.deepEqual(sharedPipelineResult.candidates[0].placements, [
  necessaryPlacement,
]);
assert.equal("rawCandidates" in sharedPipelineResult, false);
const budgetExpiredSuggestion = pruneRedundantPlacements(
  extensionBoard,
  {
    placements: [
      necessaryPlacement,
      { row: ROWS - 1, col: 4, color: "green" },
    ],
    triggerPlacements: redundantPotential.triggerPlacements,
    chains: redundantPotential.chains,
    chainGain: redundantPotential.chains - 1,
    cleared: redundantPotential.cleared,
    score: 0,
  },
  { minimizationDeadline: 0 },
);
assert.equal(budgetExpiredSuggestion, null);

const alreadyTriggered = emptyBoard();
for (let col = 0; col < 4; col++) alreadyTriggered[ROWS - 1][col] = "red";
assert.equal(evaluateLatentChain(alreadyTriggered).triggerPlacements.length, 0);
const noFalseExtension = solveWithAma({
  board: alreadyTriggered,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 1,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  maxQueueSize: 100,
});
assert.equal(noFalseExtension.baselineChains, 1);
assert.equal(noFalseExtension.candidates.length, 0);
assert.equal(evaluateLatentChain(alreadyTriggered).source, "immediate");
assert.equal(noFalseExtension.timedOut, false);

const fallbackController = new SuggestionController();
await assert.rejects(
  fallbackController.solve({
    board: alreadyTriggered,
    colors: ["red", "green", "blue", "yellow"],
    maxAdditions: 1,
    resultLimit: 5,
    timeBudgetMs: 100,
    maxQueueSize: 100,
  }),
  /not supported/,
);

const confirmedTriggerBoard = emptyBoard();
confirmedTriggerBoard[ROWS - 3][0] = "green";
confirmedTriggerBoard[ROWS - 2][0] = "green";
confirmedTriggerBoard[ROWS - 1][0] = "green";
confirmedTriggerBoard[ROWS - 2][1] = "green";
confirmedTriggerBoard[ROWS - 1][1] = "red";
confirmedTriggerBoard[ROWS - 1][2] = "red";

const confirmedAmaResult = solveWithAma({
  board: confirmedTriggerBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 8,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  maxQueueSize: 100,
});
assert.equal(confirmedAmaResult.baselineChains, 1);
assert.equal(confirmedAmaResult.candidates.length, 0);
assert.equal(confirmedAmaResult.timedOut, false);

const confirmedBeamResult = solveWithBeam({
  board: confirmedTriggerBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 8,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  beamWidth: 24,
});
assert.equal(confirmedBeamResult.baselineChains, 1);
assert.equal(confirmedBeamResult.candidates.length, 0);
assert.equal(confirmedBeamResult.timedOut, false);

const chokeBoard = emptyBoard();
for (let row = HIDDEN_ROWS + 1; row < ROWS; row++) {
  chokeBoard[row][2] = "blue";
}
assert.equal(
  availablePlacements(chokeBoard, ["red"]).some(
    ({ row, col }) => row === HIDDEN_ROWS && col === 2,
  ),
  false,
);

const priorityQueue = new MaxPriorityQueue();
priorityQueue.push({ priority: 1 });
priorityQueue.push({ priority: 3 });
priorityQueue.push({ priority: 2 });
assert.equal(priorityQueue.pop().priority, 3);
assert.equal(priorityQueue.pop().priority, 2);
assert.equal(priorityQueue.pop().priority, 1);

const goalRanked = rankCandidates(
  [
    {
      chainGain: 1,
      score: 9_000,
      placements: [{ row: 12, col: 0, color: "red" }],
    },
    {
      chainGain: 2,
      score: 2_000,
      placements: [
        { row: 12, col: 1, color: "green" },
        { row: 11, col: 1, color: "green" },
      ],
    },
    {
      chainGain: 3,
      score: 1_000,
      placements: [
        { row: 12, col: 2, color: "blue" },
        { row: 11, col: 2, color: "blue" },
        { row: 10, col: 2, color: "blue" },
      ],
    },
  ],
  5,
  { minimumChainGain: 2, targetChainGain: 3 },
);
assert.deepEqual(
  goalRanked.map(({ chainGain }) => chainGain),
  [3, 2],
);

const duplicateSuggestions = rankCandidates(
  [
    {
      chainGain: 2,
      score: 2_000,
      placements: [{ row: 12, col: 0, color: "red" }],
      triggerPlacements: [{ row: 12, col: 1, color: "green" }],
    },
    {
      chainGain: 2,
      score: 1_000,
      placements: [{ row: 12, col: 1, color: "green" }],
      triggerPlacements: [{ row: 12, col: 0, color: "red" }],
    },
  ],
  5,
  { board: emptyBoard() },
);
assert.equal(duplicateSuggestions.length, 1);
assert.equal(duplicateSuggestions[0].score, 2_000);

const colorSymmetricSuggestions = rankCandidates(
  [
    {
      chainGain: 2,
      score: 2_000,
      placements: [{ row: 12, col: 0, color: "red" }],
      triggerPlacements: [{ row: 12, col: 1, color: "green" }],
    },
    {
      chainGain: 2,
      score: 1_000,
      placements: [{ row: 12, col: 0, color: "blue" }],
      triggerPlacements: [{ row: 12, col: 1, color: "yellow" }],
    },
  ],
  5,
  { board: emptyBoard() },
);
assert.equal(colorSymmetricSuggestions.length, 1);

console.log("Chain logic tests passed");
