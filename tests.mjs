import assert from "node:assert/strict";
import {
  COLS,
  ROWS,
  HIDDEN_ROWS,
  GARBAGE,
  emptyBoard,
  findGroups,
  findClearingCells,
  applyGravity,
  simulate,
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

const solveWithAma = (request) =>
  solveSuggestion({ ...request, solver: "ama" });
const solveWithBeam = (request) =>
  solveSuggestion({ ...request, solver: "beam" });

const state = emptyBoard();
for (let col = 0; col < 4; col++) state[ROWS - 1][col] = "red";

assert.equal(findGroups(state).length, 1);
assert.equal(findGroups(state)[0].length, 4);
assert.equal(applyGravity(state)[ROWS - 1][0], "red");

const result = simulate(state);
assert.equal(result.chains, 1);
assert.equal(result.cleared, 4);
assert.equal(result.state.flat().filter(Boolean).length, 0);

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
