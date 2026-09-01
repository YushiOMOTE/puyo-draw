export function createTokopuyoSuggestionMarks(candidate, board) {
  const marks = new Map();
  const mainTrigger = candidate.mainTrigger || null;

  for (const cell of mainTrigger?.targetCells || []) {
    if (board[cell.row][cell.col] !== mainTrigger.color) continue;
    marks.set(`${cell.row},${cell.col}`, {
      color: mainTrigger.color,
      isIgnitionTarget: true,
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
