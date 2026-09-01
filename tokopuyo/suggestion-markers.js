export function createTokopuyoSuggestionMarks(candidate, board) {
  const marks = new Map();
  const mainTrigger = candidate.mainTrigger || null;

  if (mainTrigger && !board[mainTrigger.row][mainTrigger.col]) {
    marks.set(`${mainTrigger.row},${mainTrigger.col}`, {
      color: mainTrigger.color,
      isIgnition: true,
      ignitionState: mainTrigger.state,
    });
  }

  [...candidate.moves].reverse().forEach((move) => {
    const step = move.handOffset + 1;
    move.cells.forEach(({ row, col, color }) => {
      marks.set(`${row},${col}`, {
        color,
        kind: step === 1 ? "current" : "future",
        step: step > 1 ? String(step) : null,
      });
    });
  });

  return marks;
}
