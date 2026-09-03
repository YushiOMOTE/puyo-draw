import { HIDDEN_ROWS, clone, simulate } from "../engine.js";
import { CHOKE_COL } from "./session.js";
import { dropTsumo } from "./pair-engine.js";

export function selectBestAmaBranch(candidate) {
  if (!candidate?.branchScores?.length) return null;
  const score = Math.max(...candidate.branchScores);
  const tiedBranches = candidate.branchScores.flatMap((value, branch) =>
    value === score ? [branch] : []);
  return {
    branch: tiedBranches[0],
    score,
    tiedBranches,
  };
}

export function buildAmaReplay(initialBoard, initialRow14, witness) {
  if (!witness?.moves?.length || witness.score <= 0) {
    throw new TypeError("Ama replay requires a positive-score witness path");
  }
  let board = clone(initialBoard);
  let row14 = initialRow14;
  const hands = witness.moves.map((move) => {
    const beforeBoard = clone(board);
    const beforeRow14 = row14;
    const dropped = dropTsumo(
      board,
      move.pair,
      move.col,
      move.orientation,
      row14,
    );
    if (!dropped) throw new Error("Ama replay contains an illegal placement");
    const result = simulate(dropped.board);
    board = result.state;
    row14 = dropped.row14;
    return {
      ...move,
      beforeBoard,
      beforeRow14,
      lockedBoard: clone(dropped.board),
      lockedRow14: dropped.row14,
      cells: dropped.cells.map((cell) => ({ ...cell })),
      result,
      afterBoard: clone(result.state),
      afterRow14: dropped.row14,
      gameOver: Boolean(result.state[HIDDEN_ROWS][CHOKE_COL]),
    };
  });
  const firingHand = hands.at(-1);
  if (
    firingHand.result.score !== witness.score ||
    firingHand.result.chains !== witness.chainCount
  ) {
    throw new Error("Ama replay score did not match its witness");
  }
  return {
    branch: witness.branch,
    score: witness.score,
    chainCount: witness.chainCount,
    hands,
  };
}
