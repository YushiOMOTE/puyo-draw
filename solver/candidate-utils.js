import { clone } from "../engine.js";
import { evaluateLatentChain } from "./latent-chain.js";

export function candidateScore(result, additions) {
  // Chain count dominates: a longer extension always beats a cheap short one.
  // For equal chains, a compact completion is more useful than extra clears.
  return result.chains * 1_000_000 - additions * 1_000 + result.cleared;
}

function boardWithPlacements(baseBoard, placements) {
  const board = clone(baseBoard);
  for (const { row, col, color } of placements) board[row][col] = color;
  return board;
}

function supportsHigherPuyo(board, placement) {
  for (let row = 0; row < placement.row; row++) {
    if (board[row][placement.col] !== null) return true;
  }
  return false;
}

export function pruneRedundantPlacements(
  baseBoard,
  candidate,
  { maxTriggerPuyos = 1, minimizationDeadline = Infinity } = {},
) {
  const baselineChains = candidate.chains - candidate.chainGain;
  let minimized = { ...candidate, placements: [...candidate.placements] };
  let index = 0;

  while (index < minimized.placements.length) {
    if (performance.now() >= minimizationDeadline) return null;
    const placement = minimized.placements[index];
    const currentBoard = boardWithPlacements(baseBoard, minimized.placements);
    if (supportsHigherPuyo(currentBoard, placement)) {
      index++;
      continue;
    }

    const placements = minimized.placements.filter(
      (_, placementIndex) => placementIndex !== index,
    );
    const potential = evaluateLatentChain(
      boardWithPlacements(baseBoard, placements),
      { maxTriggerPuyos },
    );
    if (
      potential.source === "immediate" ||
      potential.chains < minimized.chains
    ) {
      index++;
      continue;
    }

    minimized = {
      ...minimized,
      placements,
      triggerPlacements: potential.triggerPlacements,
      chains: potential.chains,
      chainGain: potential.chains - baselineChains,
      cleared: potential.cleared,
      score: candidateScore(
        potential,
        placements.length + potential.triggerPlacements.length,
      ),
    };
    index = 0;
  }

  return minimized;
}

export function candidateVisualKey(candidate, baseBoard = null) {
  const existingColors = new Set(baseBoard?.flat().filter(Boolean) || []);
  const aliases = new Map();
  const visible = [
    ...candidate.placements,
    ...(candidate.triggerPlacements || []),
  ].sort(
    (left, right) =>
      left.row - right.row ||
      left.col - right.col ||
      left.color.localeCompare(right.color),
  );

  return visible
    .map(({ row, col, color }) => {
      if (existingColors.has(color)) return `${row},${col},${color}`;
      if (!aliases.has(color)) aliases.set(color, `new${aliases.size}`);
      return `${row},${col},${aliases.get(color)}`;
    })
    .join("|");
}

export function rankCandidates(
  candidates,
  resultLimit,
  options = {},
) {
  const {
    minimumChainGain = 1,
    targetChainGain = minimumChainGain,
    board = null,
  } = options;
  const uniqueCandidates = new Map();
  for (const candidate of candidates) {
    const key = candidateVisualKey(candidate, board);
    const existing = uniqueCandidates.get(key);
    if (!existing || candidate.score > existing.score) {
      uniqueCandidates.set(key, candidate);
    }
  }

  const unique = [...uniqueCandidates.values()];
  const preferred = unique.filter(
    (candidate) => candidate.chainGain >= minimumChainGain,
  );
  const pool = preferred.length ? preferred : unique;

  return pool
    .sort(
      (left, right) =>
        Number(right.chainGain >= targetChainGain) -
          Number(left.chainGain >= targetChainGain) ||
        right.score - left.score ||
        left.placements.length - right.placements.length,
    )
    .slice(0, resultLimit);
}

export function finalizeCandidates(candidates, resultLimit, options = {}) {
  const deadline =
    performance.now() + (options.minimizationBudgetMs ?? 300);
  const shortlist = rankCandidates(
    candidates,
    Math.max(resultLimit * 2, resultLimit),
    options,
  );
  const minimized = [];
  for (const candidate of shortlist) {
    const result = pruneRedundantPlacements(options.board, candidate, {
      ...options,
      minimizationDeadline: deadline,
    });
    if (result) minimized.push(result);
  }
  return rankCandidates(minimized, resultLimit, options);
}
