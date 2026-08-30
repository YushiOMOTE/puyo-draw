import assert from "node:assert/strict";
import {
  COLS,
  ROWS,
  HIDDEN_ROWS,
  GARBAGE,
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
  cornerTargetAt,
  createTokopuyoGesture,
  updateTokopuyoGesture,
} from "./tokopuyo/gesture.js";
import {
  ORIENTATION,
  createActivePair,
  hardDrop,
  movePair,
  pairCells,
  rotatePair,
} from "./tokopuyo/pair-engine.js";
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

const gestureOptions = {
  cellSize: 100,
  viewportWidth: 400,
  viewportHeight: 800,
};
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

const kickedSession = createSession(0);
assert.equal(commitPairAtColumn(kickedSession, 0, "left"), null);
assert.ok(commitPairAtColumn(kickedSession, 0, "right"));

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

const gameOverSession = createSession(0);
for (let row = HIDDEN_ROWS; row < ROWS; row++) {
  gameOverSession.board[row][2] = row % 2 ? "red" : "blue";
}
gameOverSession.activePair = createActivePair({ axis: "green", child: "yellow" });
assert.ok(commitActivePair(gameOverSession));
assert.equal(gameOverSession.gameOver, true);
assert.equal(actOnPair(gameOverSession, "left"), false);
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
