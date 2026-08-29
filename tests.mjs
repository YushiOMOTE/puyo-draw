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
import { solveWithBeam } from "./solver/beam-solver.js";

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
const suggestionResult = solveWithBeam({
  board: suggestionBoard,
  colors: ["red", "green", "blue", "yellow"],
  maxAdditions: 1,
  resultLimit: 5,
  timeBudgetMs: 1_000,
  beamWidth: 24,
});
assert.ok(suggestionResult.candidates.length > 0);
assert.equal(suggestionResult.candidates[0].chains, 1);
assert.equal(suggestionResult.candidates[0].placements.length, 1);
assert.equal(suggestionResult.candidates[0].placements[0].color, "red");

console.log("Chain logic tests passed");
