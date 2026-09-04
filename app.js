import {
  COLS,
  ROWS,
  HIDDEN_ROWS,
  emptyBoard,
  clone,
  isSettled,
  findClearingCells,
  applyGravity,
  simulate,
} from "./engine.js";
import { SuggestionController } from "./solver/suggestion-controller.js";
import { SUGGESTION_SEARCH_CONFIG } from "./solver/suggestion-config.js";
import { dropTsumo, pairCells } from "./tokopuyo/pair-engine.js";
import {
  createTokopuyoSuggestionMarks,
} from "./tokopuyo/suggestion-markers.js";
import { TOKOPUYO_SUGGESTION_CONFIG } from "./tokopuyo/suggestion-config.js";
import {
  PressurelessAmaController,
} from "./tokopuyo/pressureless-ama-controller.js";
import {
  AMA_FUTURE_PAIRINGS,
  compareAmaFutureProfiles,
  evaluateAmaMove,
} from "./tokopuyo/pressureless-ama.js";
import {
  buildAmaReplay,
  selectBestAmaBranch,
} from "./tokopuyo/ama-replay.js";
import {
  TOKOPUYO_ATTACK_SUGGESTION_CONFIG,
} from "./tokopuyo/attack-suggestion-config.js";
import { getTsumo, randomSeed } from "./tokopuyo/queue.js";
import {
  actOnPair,
  commitActivePair,
  createSession,
  previewHands,
  redoSession,
  undoSession,
} from "./tokopuyo/session.js";

const boardEl = document.querySelector("#board");
const boardWrap = document.querySelector(".board-wrap");
const statusEl = document.querySelector("#status");
const chainEl = document.querySelector("#chainNumber");
const chainBadge = document.querySelector("#chainBadge");
const tokopuyoChainReadout = document.querySelector("#tokopuyoChainReadout");
const tokopuyoChainNumberEl = document.querySelector("#tokopuyoChainNumber");
const tokopuyoChainScoreEl = document.querySelector("#tokopuyoChainScore");
const suggestionLoadingEl = document.querySelector("#suggestionLoading");
const flickMenu = document.querySelector("#flickMenu");
const toastEl = document.querySelector("#toast");
const helpOverlay = document.querySelector("#helpOverlay");
const closeHelpButton = document.querySelector("#closeHelp");
const activePairLayer = document.querySelector("#activePairLayer");
const tokopuyoPreview = document.querySelector("#tokopuyoPreview");
const nextPairEl = document.querySelector("#nextPair");
const nextNextPairEl = document.querySelector("#nextNextPair");
const patternNumberEl = document.querySelector("#patternNumber");
const toggleAppModeButton = document.querySelector("#toggleAppMode");
const leftSidebar = document.querySelector(".left-sidebar");
const resetSlot = document.querySelector("#resetSlot");
const modeSlot = document.querySelector("#modeSlot");
const helpSlot = document.querySelector("#helpSlot");
const resetButton = document.querySelector("#reset");
const helpButton = document.querySelector("#help");
const drawingHelp = document.querySelector("#drawingHelp");
const tokopuyoHelp = document.querySelector("#tokopuyoHelp");
const tokopuyoControls = document.querySelector("#tokopuyoControls");
const tokopuyoStepControls = document.querySelector("#tokopuyoStepControls");
const toggleTokopuyoStepModeButton = document.querySelector("#toggleTokopuyoStepMode");
const stepChainBackButton = document.querySelector("#stepChainBack");
const stepChainForwardButton = document.querySelector("#stepChainForward");
const playChainStepsButton = document.querySelector("#playChainSteps");
const stopChainStepsButton = document.querySelector("#stopChainSteps");
const attackSuggestButton = document.querySelector("#attackSuggest");
const reviewLastMoveButton = document.querySelector("#reviewLastMove");
const reviewOverlay = document.querySelector("#reviewOverlay");
const closeReviewButton = document.querySelector("#closeReview");
const reviewTitleEl = document.querySelector("#reviewTitle");
const reviewSummaryEl = document.querySelector("#reviewSummary");
const reviewOutcomeEl = document.querySelector("#reviewOutcome");
const reviewStatsEl = document.querySelector("#reviewStats");
const reviewBranchesEl = document.querySelector("#reviewBranches");
const reviewRangesEl = document.querySelector("#reviewRanges");
const reviewBranchSectionEl = document.querySelector("#reviewBranchSection");
const reviewBranchChartEl = document.querySelector("#reviewBranchChart");
const reviewFutureSummaryEl = document.querySelector("#reviewFutureSummary");
const reviewFutureMetricsEl = document.querySelector("#reviewFutureMetrics");
const reviewUserPlacementEl = document.querySelector("#reviewUserPlacement");
const reviewAmaPlacementEl = document.querySelector("#reviewAmaPlacement");
const reviewUserBoardStateEl = document.querySelector("#reviewUserBoardState");
const reviewAmaBoardStateEl = document.querySelector("#reviewAmaBoardState");
const reviewUserBoardEl = document.querySelector("#reviewUserBoard");
const reviewAmaBoardEl = document.querySelector("#reviewAmaBoard");
const reviewEvaluationSectionEl = document.querySelector("#reviewEvaluationSection");
const reviewEvaluationSummaryEl = document.querySelector("#reviewEvaluationSummary");
const reviewContributionChartEl = document.querySelector("#reviewContributionChart");
const reviewInsightCardsEl = document.querySelector("#reviewInsightCards");
const reviewSignalTableEl = document.querySelector("#reviewSignalTable");
const reviewUserReplayButton = document.querySelector("#reviewUserReplay");
const reviewAmaReplayButton = document.querySelector("#reviewAmaReplay");
const reviewReplayPanelEl = document.querySelector("#reviewReplayPanel");
const reviewReplaySourceEl = document.querySelector("#reviewReplaySource");
const reviewReplayMetaEl = document.querySelector("#reviewReplayMeta");
const reviewReplayPairEl = document.querySelector("#reviewReplayPair");
const reviewReplayBoardEl = document.querySelector("#reviewReplayBoard");
const reviewReplayStatusEl = document.querySelector("#reviewReplayStatus");
const closeReviewReplayButton = document.querySelector("#closeReviewReplay");
const resetReviewReplayButton = document.querySelector("#resetReviewReplay");
const nextReviewReplayButton = document.querySelector("#nextReviewReplay");
const playReviewReplayButton = document.querySelector("#playReviewReplay");

let board = emptyBoard();
let selectedTool = "red";
let history = [];
let future = [];
let initialBoard = clone(board);
let chainCount = 0;
let cumulativeScore = 0;
let isSimulating = false;
let garbageMode = false;
let paletteIndex = 0;
let isSuggesting = false;
let suggestionSession = null;
let suggestionMarks = new Map();
let suggestionRevision = 0;
let appMode = "drawing";
let tokopuyoSession = null;
let tokopuyoBoardOverride = null;
let tokopuyoDisplayedChain = null;
let tokopuyoSuggestionSession = null;
let tokopuyoAttackSuggestionSession = null;
let tokopuyoSuggestionMarks = new Map();
let tokopuyoStepMode = false;
let tokopuyoStepResolution = null;
let tokopuyoStepRevision = 0;
let reviewReplayContext = null;
let reviewReplayState = null;
let reviewReplayRevision = 0;
const amaAnalysisCache = new Map();
const AMA_ANALYSIS_CACHE_LIMIT = 8;
const suggestionController = new SuggestionController();
const pressurelessAmaController = new PressurelessAmaController({
  workerCount: TOKOPUYO_SUGGESTION_CONFIG.workerCount,
});

const colorFlickTools = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
];
const fourColorPalettes = [
  "purple",
  ...colorFlickTools.filter((color) => color !== "purple"),
].map((excludedColor) =>
  colorFlickTools.filter((color) => color !== excludedColor),
);
const locale = navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
const messages = {
  noChain: {
    en: "No group of four or more can be cleared",
    ja: "4個以上つながったぷよがありません",
  },
  undo: { en: "Undo applied", ja: "Undoしました" },
  redo: { en: "Redo applied", ja: "Redoしました" },
  cleared: { en: "Board cleared", ja: "盤面をクリアしました" },
  reset: { en: "Board reset", ja: "盤面をリセットしました" },
  chain: {
    en: (count, puyos, score, cumulative) =>
      `Chain ${count}: +${score.toLocaleString()} points (${cumulative.toLocaleString()} total), ${puyos} puyos clearing`,
    ja: (count, puyos, score, cumulative) =>
      `${count}連鎖目：${puyos}個消去、+${score.toLocaleString()}点（累積${cumulative.toLocaleString()}点）`,
  },
  complete: {
    en: (count, puyos) =>
      `${count} chain${count === 1 ? "" : "s"}! ${puyos} puyos cleared`,
    ja: (count, puyos) => `${count}連鎖！ ${puyos}個のぷよが消えました`,
  },
  score: {
    en: (chains, score) => `${chains} chain${chains === 1 ? "" : "s"}: ${score.toLocaleString()} points`,
    ja: (chains, score) => `${chains}連鎖：累積${score.toLocaleString()}点`,
  },
  scoreSummary: {
    en: (score, chains) =>
      `${score.toLocaleString()} points / ${chains} chain${chains === 1 ? "" : "s"}`,
    ja: (score, chains) => `${score.toLocaleString()}点 / ${chains}連鎖`,
  },
  garbageMode: {
    en: (enabled) => `Garbage mode ${enabled ? "on" : "off"}`,
    ja: (enabled) => `お邪魔ありを${enabled ? "オン" : "オフ"}にしました`,
  },
  palette: {
    en: (index) =>
      index === fourColorPalettes.length
        ? "Five-color palette"
        : `Four-color palette ${index + 1} of 5`,
    ja: (index) =>
      index === fourColorPalettes.length
        ? "5色パレット"
        : `4色パレット ${index + 1}/5`,
  },
  suggestionSearching: {
    en: "Finding chain extensions…",
    ja: "連鎖の伸ばし方を探索中…",
  },
  suggestionNone: {
    en: "No chain extension found",
    ja: "連鎖を伸ばす候補が見つかりませんでした",
  },
  suggestion: {
    en: (index, total, chains, additions, chainGain) =>
      `Suggestion ${index}/${total}: potential ${chains} chain${chains === 1 ? "" : "s"} (+${chainGain}) with ${additions} added puyo${additions === 1 ? "" : "s"}`,
    ja: (index, total, chains, additions, chainGain) =>
      `提案 ${index}/${total}：${additions}個追加で${chains}連鎖候補（+${chainGain}連鎖）`,
  },
  suggestionError: {
    en: "Could not calculate suggestions",
    ja: "提案を計算できませんでした",
  },
  pressurelessAmaSuggestion: {
    en: (index, total, score, branches, elapsed) =>
      `Pressureless Ama ${index}/${total}: ${score.toLocaleString()}-point average of the maximum chains found across ${branches} sampled futures (${elapsed.toLocaleString()} ms)`,
    ja: (index, total, score, branches, elapsed) =>
      `Pressureless Ama ${index}/${total}：${branches}未来列で見つけた最大連鎖スコアの平均 ${score.toLocaleString()}点（${elapsed.toLocaleString()}ms）`,
  },
  suggestionAlreadyFiring: {
    en: "Suggestions are unavailable because the board can already fire",
    ja: "すでに発火可能な盤面のため、提案を計算できません",
  },
  suggestionFloating: {
    en: "Land all puyos before calculating suggestions",
    ja: "すべてのぷよを着地させてから提案を計算してください",
  },
  tokopuyoReset: {
    en: (number) => `Started new pattern No.${number}`,
    ja: (number) => `新しいパターン No.${number} を開始しました`,
  },
  tokopuyoGameOver: {
    en: "Game over — reset or undo to continue",
    ja: "ゲームオーバー：リセットまたはUndoで続けられます",
  },
  tokopuyoSuggestionSearching: {
    en: "Searching for a resilient long-chain build…",
    ja: "長連鎖へ育つ積み方を探索中…",
  },
  tokopuyoSuggestionNone: {
    en: "No safe construction move was found",
    ja: "安全な構築手が見つかりませんでした",
  },
  tokopuyoSuggestion: {
    en: (index, total, potential, efficiency, ignition, emergency) =>
      `${emergency ? "Emergency clear · " : ""}Plan ${index}/${total}: ${potential ? `${potential}-chain main potential` : "building a main-chain base"} · ${efficiency}% resource connection · ${ignition}`,
    ja: (index, total, potential, efficiency, ignition, emergency) =>
      `${emergency ? "緊急消去 · " : ""}構築案 ${index}/${total}：${potential ? `本線候補${potential}連鎖` : "本線土台を構築中"} · 連結効率${efficiency}% · ${ignition}`,
  },
  tokopuyoAttackSearching: {
    en: "Finding the strongest visible attacks…",
    ja: "見えているツモから最大攻撃を探索中…",
  },
  tokopuyoAttackNone: {
    en: "No safe attack was found within the visible pairs",
    ja: "見えているツモ内に安全な発火手順がありません",
  },
  tokopuyoAttack: {
    en: (index, total, score, chains, timing) =>
      `Attack ${index}/${total}: ${score.toLocaleString()} points · ${chains} chain${chains === 1 ? "" : "s"} · fires on ${timing}`,
    ja: (index, total, score, chains, timing) =>
      `攻撃候補 ${index}/${total}：${score.toLocaleString()}点・${chains}連鎖・${timing}で発火`,
  },
};

const localizedColors = {
  red: { en: "red", ja: "赤" },
  green: { en: "green", ja: "緑" },
  blue: { en: "blue", ja: "青" },
  yellow: { en: "yellow", ja: "黄" },
  purple: { en: "purple", ja: "紫" },
};

function getFlickTools() {
  return [
    ...(paletteIndex === fourColorPalettes.length
      ? colorFlickTools
      : fourColorPalettes[paletteIndex]),
    ...(garbageMode ? ["garbage"] : []),
  ];
}

let flick = {
  kind: "drawing",
  row: -1,
  col: -1,
  startX: 0,
  startY: 0,
  moved: false,
  choice: null,
  tools: [],
  suppressClick: false,
  pointerId: null,
  intent: "straight",
};

function renderPreviewPair(element, tsumo) {
  element.innerHTML = "";
  for (const color of [tsumo.child, tsumo.axis]) {
    const puyo = document.createElement("i");
    puyo.className = `preview-puyo ${color}`;
    element.append(puyo);
  }
}

function renderActivePair() {
  activePairLayer.innerHTML = "";
  const visible =
    appMode === "tokopuyo" &&
    tokopuyoSession &&
    !tokopuyoSession.busy &&
    !tokopuyoSession.gameOver &&
    !tokopuyoBoardOverride;
  activePairLayer.hidden = !visible;
  if (!visible) return;

  const boardRect = boardEl.getBoundingClientRect();
  const wrapRect = boardWrap.getBoundingClientRect();
  const cellSize = boardRect.width / COLS;
  const displayCells = pairCells(tokopuyoSession.activePair);
  for (const { row, col, color, role } of displayCells) {
    const puyo = document.createElement("span");
    puyo.className = `active-puyo ${color}`;
    puyo.ariaLabel = `${role === "axis" ? "Axis" : "Child"} ${color} puyo`;
    puyo.style.width = `${cellSize * 0.78}px`;
    puyo.style.height = `${cellSize * 0.78}px`;
    const cell = row >= 0 ? boardEl.children[row * COLS + col] : null;
    const cellRect = cell?.getBoundingClientRect();
    const centerX = cellRect
      ? cellRect.left + cellRect.width / 2 - wrapRect.left
      : boardRect.left - wrapRect.left + (col + 0.5) * cellSize;
    const centerY = cellRect
      ? cellRect.top + cellRect.height / 2 - wrapRect.top
      : boardRect.top - wrapRect.top + (row + 0.5) * cellSize;
    puyo.style.left = `${centerX}px`;
    puyo.style.top = `${centerY}px`;
    activePairLayer.append(puyo);
  }

  for (let col = 0; col < COLS; col++) {
    const suggestion = tokopuyoSuggestionMarks.get(`-1,${col}`);
    if (!suggestion) continue;
    const marker = document.createElement("span");
    marker.className = `suggestion-marker virtual-suggestion-marker ${suggestion.color}${
      suggestion.kind ? ` ${suggestion.kind}` : ""
    }`;
    if (suggestion.step) marker.dataset.step = suggestion.step;
    marker.ariaHidden = "true";
    marker.style.width = `${cellSize * 0.78}px`;
    marker.style.height = `${cellSize * 0.78}px`;
    marker.style.left = `${
      boardRect.left - wrapRect.left + (col + 0.5) * cellSize
    }px`;
    marker.style.top = `${
      boardRect.top - wrapRect.top - 0.5 * cellSize
    }px`;
    activePairLayer.append(marker);
  }
}

function updateModeUi() {
  const isTokopuyo = appMode === "tokopuyo";
  if (isTokopuyo) {
    leftSidebar.append(resetButton, toggleAppModeButton, helpButton);
  } else {
    resetSlot.append(resetButton);
    modeSlot.append(toggleAppModeButton);
    helpSlot.append(helpButton);
  }
  document.body.dataset.mode = appMode;
  document.querySelectorAll(".drawing-only").forEach((element) => {
    element.hidden = isTokopuyo;
  });
  chainBadge.hidden = isTokopuyo;
  tokopuyoChainReadout.hidden = !isTokopuyo;
  tokopuyoPreview.hidden = !isTokopuyo;
  tokopuyoControls.hidden = !isTokopuyo || Boolean(tokopuyoStepResolution);
  tokopuyoStepControls.hidden = !isTokopuyo || !tokopuyoStepResolution;
  attackSuggestButton.hidden = !isTokopuyo;
  reviewLastMoveButton.hidden = !isTokopuyo;
  toggleTokopuyoStepModeButton.hidden = !isTokopuyo;
  drawingHelp.hidden = isTokopuyo;
  tokopuyoHelp.hidden = !isTokopuyo;

  toggleAppModeButton.ariaLabel = isTokopuyo
    ? "Return to Drawing mode"
    : "Open Tokopuyo mode";
  toggleAppModeButton.title = toggleAppModeButton.ariaLabel;
  toggleAppModeButton.innerHTML = isTokopuyo
    ? '<svg class="drawing-mode-icon" viewBox="0 0 28 32" aria-hidden="true"><path d="M12.1 14.3 23.1.4c.8-1 2.1-1.1 3-.2 1 .9 1.2 2.3.4 3.4l-9.1 14.3-5.3-3.6Z"/><path d="m11.4 15.1 5.3 3.5-1.6 2.5c-1 1.7-2.5 2.1-4 .9l-1.4-1.1c-1.6-1.3-1.7-2.3-.1-4.3l1.8-1.5Z"/><path fill-rule="evenodd" d="M8.1 21.1c-2.7-.2-4.7 1.8-5.5 5.3-.6 2.9-1.5 4.7-1.5 4.7 3.5 1.4 7.3-.1 9.8-2.6 2.4-2.4 1.4-5 1.4-5L9 21.2l-.9-.1Zm.9 1.1c-2 0-3.2 1.5-3.7 3.1-.2.9.5 1.4 1.2.8l1-.7c.6-.5 1.3.1.9.8l-.6.9c-.3.7.4 1.1 1 .5l.6-.6c.7-.6 1.4.1 1 1l-.6.8c-.5.8.4 1.3 1.1.7 1.5-1.2 2-3.6 1.1-5.5l-3-1.8Z"/></svg>'
    : '<span class="mode-pair-icon" aria-hidden="true"><i></i><i></i></span>';
  const suggestButton = document.querySelector("#suggest");
  suggestButton.ariaLabel = isTokopuyo
    ? "Suggest a resilient long-chain construction move"
    : "Suggest chain extensions";
  suggestButton.title = suggestButton.ariaLabel;
  resetButton.ariaLabel = isTokopuyo ? "Start a new Tokopuyo pattern" : "Reset";
  resetButton.title = resetButton.ariaLabel;
  toggleTokopuyoStepModeButton.classList.toggle("active", tokopuyoStepMode);
  toggleTokopuyoStepModeButton.ariaPressed = String(tokopuyoStepMode);
  toggleTokopuyoStepModeButton.ariaLabel = tokopuyoStepMode
    ? "Disable Tokopuyo chain step mode"
    : "Enable Tokopuyo chain step mode";
  toggleTokopuyoStepModeButton.title = toggleTokopuyoStepModeButton.ariaLabel;

  if (isTokopuyo && tokopuyoSession) {
    const [next, nextNext] = previewHands(tokopuyoSession);
    renderPreviewPair(nextPairEl, next);
    renderPreviewPair(nextNextPairEl, nextNext);
    patternNumberEl.textContent = `No.${tokopuyoSession.pattern.number}`;
  }
}

function render() {
  const renderedBoard =
    appMode === "tokopuyo"
      ? tokopuyoBoardOverride || tokopuyoSession?.board || emptyBoard()
      : board;
  boardEl.innerHTML = "";

  renderedBoard.forEach((row, r) =>
    row.forEach((color, c) => {
      const cell = document.createElement("button");
      const areaClass = r < HIDDEN_ROWS ? " hidden-cell" : "";
      const boundaryClass = r === HIDDEN_ROWS - 1 ? " hidden-boundary" : "";

      cell.className = `cell${areaClass}${boundaryClass}`;
      cell.type = "button";
      cell.role = "gridcell";
      cell.disabled = isSimulating || isSuggesting;
      cell.ariaLabel = `${r < HIDDEN_ROWS ? "Hidden area " : ""}${ROWS - r} row ${
        c + 1
      } column ${color || "empty"}${
        r === HIDDEN_ROWS && c === 2 ? " choke point" : ""
      }`;
      if (appMode !== "tokopuyo") {
        cell.addEventListener("pointerdown", (event) => openFlick(r, c, event));
      }
      cell.addEventListener("click", () => {
        if (appMode === "tokopuyo") return;
        if (flick.suppressClick) {
          flick.suppressClick = false;
          return;
        }
        editCell(r, c);
      });

      if (color) {
        const puyo = document.createElement("span");
        puyo.className = `puyo ${color}`;
        cell.append(puyo);
      }

      const suggestion = appMode === "drawing"
        ? suggestionMarks.get(`${r},${c}`)
        : tokopuyoSuggestionMarks.get(`${r},${c}`);
      if (suggestion) {
        const marker = document.createElement("span");
        marker.className = `suggestion-marker ${suggestion.color}${
          suggestion.isTrigger ? " trigger" : ""
        }${suggestion.kind ? ` ${suggestion.kind}` : ""}${
          suggestion.isIgnitionTarget
            ? ` ignition-target ignition-${suggestion.ignitionState}`
            : ""
        }`;
        if (suggestion.step) marker.dataset.step = suggestion.step;
        marker.ariaHidden = "true";
        cell.append(marker);
        if (suggestion.isIgnitionTarget) {
          cell.ariaLabel += ` current main-chain ${suggestion.color} ignition target`;
        }
      }

      if (r === HIDDEN_ROWS && c === 2) {
        const mark = document.createElement("span");
        mark.className = "dead-mark";
        mark.textContent = "×";
        mark.ariaHidden = "true";
        cell.append(mark);
      }

      boardEl.append(cell);
    }),
  );

  const tokopuyoBusy = tokopuyoSession?.busy || false;
  const isTokopuyoStepResolving = Boolean(tokopuyoStepResolution);
  document.querySelector("#undo").disabled = appMode === "tokopuyo"
    ? !tokopuyoSession?.history.length || (tokopuyoBusy && !isTokopuyoStepResolving) || isSuggesting
    : !history.length || isSimulating || isSuggesting;
  document.querySelector("#redo").disabled = appMode === "tokopuyo"
    ? !tokopuyoSession?.future.length || (tokopuyoBusy && !isTokopuyoStepResolving) || isSuggesting
    : !future.length || isSimulating || isSuggesting;
  document.querySelector("#simulate").disabled = isSimulating || isSuggesting;
  document.querySelector("#reset").disabled = appMode === "tokopuyo"
    ? (tokopuyoBusy && !isTokopuyoStepResolving) || isSuggesting
    : isSimulating || isSuggesting;
  document.querySelector("#suggest").disabled = appMode === "tokopuyo"
    ? isSuggesting || tokopuyoBusy || !tokopuyoSession || tokopuyoSession.gameOver
    : isSimulating || isSuggesting;
  attackSuggestButton.disabled =
    appMode !== "tokopuyo" ||
    isSuggesting ||
    tokopuyoBusy ||
    !tokopuyoSession ||
    tokopuyoSession.gameOver;
  reviewLastMoveButton.disabled =
    appMode !== "tokopuyo" ||
    isSuggesting ||
    tokopuyoBusy ||
    !tokopuyoSession?.lastTurn;
  toggleAppModeButton.disabled =
    isSimulating || isSuggesting || Boolean(tokopuyoSession?.busy);
  toggleTokopuyoStepModeButton.disabled =
    appMode !== "tokopuyo" || isSuggesting || Boolean(tokopuyoStepResolution);
  document.querySelectorAll(".pair-control-btn").forEach((button) => {
    if (button.closest("#tokopuyoStepControls")) return;
    button.disabled = appMode !== "tokopuyo" || tokopuyoBusy || isSuggesting || !tokopuyoSession || tokopuyoSession.gameOver;
  });
  const stepResolution = tokopuyoStepResolution;
  stepChainBackButton.disabled =
    !stepResolution || stepResolution.advancing || stepResolution.stepIndex === 0;
  stepChainForwardButton.disabled =
    !stepResolution ||
    stepResolution.advancing ||
    stepResolution.stepIndex >= stepResolution.result.rounds.length;
  playChainStepsButton.disabled =
    !stepResolution ||
    stepResolution.advancing ||
    stepResolution.playing ||
    stepResolution.stepIndex >= stepResolution.result.rounds.length;
  stopChainStepsButton.disabled = !stepResolution || !stepResolution.playing;
  suggestionLoadingEl.hidden = !isSuggesting;
  boardEl.setAttribute(
    "aria-busy",
    String(isSuggesting || (appMode === "tokopuyo" && tokopuyoBusy)),
  );
  const displayedChain =
    appMode === "tokopuyo"
      ? tokopuyoDisplayedChain ?? tokopuyoSession?.chainCount ?? 0
      : chainCount;
  const displayedScore = Number(
    appMode === "tokopuyo"
      ? tokopuyoSession?.cumulativeScore ?? 0
      : cumulativeScore,
  );
  chainEl.textContent = String(displayedChain);
  tokopuyoChainNumberEl.textContent = String(displayedChain);
  tokopuyoChainScoreEl.textContent = displayedScore.toLocaleString();
  updateModeUi();
  renderActivePair();
}

function snapshot() {
  return { board: clone(board), chains: chainCount, score: cumulativeScore };
}

function restoreSnapshot(state) {
  board = clone(state.board);
  chainCount = state.chains;
  cumulativeScore = state.score;
}

function editCell(row, col) {
  if (appMode !== "drawing" || isSimulating || isSuggesting) return;

  const nextValue = selectedTool === "erase" ? null : selectedTool;
  if (board[row][col] === nextValue) {
    if (nextValue === null && suggestionMarks.has(`${row},${col}`)) {
      clearSuggestionAt(row, col);
      invalidateSuggestions();
      render();
    }
    return;
  }

  history.push(snapshot());
  future = [];
  board[row][col] = nextValue;
  clearSuggestionAt(row, col);
  invalidateSuggestions();
  render();
}

function clearSuggestionAt(row, col) {
  suggestionMarks.delete(`${row},${col}`);
}

function clearSuggestions() {
  suggestionMarks.clear();
  suggestionSession = null;
  suggestionRevision++;
}

function clearTokopuyoSuggestions() {
  closeLastMoveReview();
  tokopuyoSuggestionMarks.clear();
  tokopuyoSuggestionSession = null;
  tokopuyoAttackSuggestionSession = null;
  suggestionRevision++;
}

function invalidateSuggestions() {
  if (suggestionSession) suggestionSession.stale = true;
}

function boardsEqual(left, right) {
  return left.every((row, rowIndex) =>
    row.every((value, colIndex) => value === right[rowIndex][colIndex]),
  );
}

function setTool(tool) {
  selectedTool = tool;

  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.ariaPressed = String(active);
  });
}

function setGarbageMode(enabled) {
  garbageMode = enabled;

  const button = document.querySelector("#toggleGarbage");
  button.classList.toggle("active", enabled);
  button.ariaPressed = String(enabled);

  if (flick.row >= 0) {
    closeFlick();
    flick.row = -1;
  }

  clearSuggestions();

  showToast(
    localizedMessage(
      messages.garbageMode,
      enabled,
    ),
  );
  render();
}

function updatePaletteButton() {
  const button = document.querySelector("#cyclePalette");
  const isFiveColor = paletteIndex === fourColorPalettes.length;
  const palette = isFiveColor ? colorFlickTools : fourColorPalettes[paletteIndex];
  button.ariaLabel = isFiveColor
    ? "Five-color palette"
    : "Change four-color palette";
  button.title = isFiveColor
    ? "Five-color palette"
    : "Change four-color palette";
  button.setAttribute("data-five-color", String(isFiveColor));
  button.innerHTML = `<span class="palette-icon" aria-hidden="true">${palette
    .map((color) => `<i class="${color}"></i>`)
    .join("")}</span>`;
}

function cyclePalette() {
  paletteIndex = (paletteIndex + 1) % (fourColorPalettes.length + 1);
  clearSuggestions();
  updatePaletteButton();
  render();
  showToast(localizedMessage(messages.palette, paletteIndex));
}

function undo() {
  if (appMode === "tokopuyo") {
    if (isSuggesting) return;
    cancelTokopuyoStepResolution();
    if (!tokopuyoSession || !undoSession(tokopuyoSession)) return;
    clearTokopuyoSuggestions();
    tokopuyoBoardOverride = null;
    tokopuyoDisplayedChain = null;
    render();
    showToast(messages.undo[locale]);
    return;
  }
  if (!history.length || isSimulating) return;

  future.push(snapshot());
  restoreSnapshot(history.pop());
  clearSuggestions();
  render();
  showToast(messages.undo[locale]);
}

function redo() {
  if (appMode === "tokopuyo") {
    if (isSuggesting) return;
    cancelTokopuyoStepResolution();
    if (!tokopuyoSession || !redoSession(tokopuyoSession)) return;
    clearTokopuyoSuggestions();
    tokopuyoBoardOverride = null;
    tokopuyoDisplayedChain = null;
    render();
    showToast(messages.redo[locale]);
    return;
  }
  if (!future.length || isSimulating) return;

  history.push(snapshot());
  restoreSnapshot(future.pop());
  clearSuggestions();
  render();
  showToast(messages.redo[locale]);
}

function setStatus(message) {
  statusEl.textContent = message;
}

let toastTimer;
function showToast(message, duration = 1800) {
  const boardRect = boardWrap.getBoundingClientRect();
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.style.left = `${boardRect.left}px`;
  toastEl.style.top = `${boardRect.top + 6}px`;
  toastEl.style.width = `${boardRect.width}px`;
  toastEl.hidden = false;
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, duration);
}

function localizedMessage(message, ...args) {
  const value = message[locale];
  return typeof value === "function" ? value(...args) : value;
}

async function runSimulation() {
  if (isSimulating) return;

  clearSuggestions();

  const beforeSimulation = clone(board);
  const beforeSnapshot = snapshot();
  board = applyGravity(board);
  render();
  const result = simulate(board);
  if (!result.chains) {
    if (!boardsEqual(beforeSimulation, board)) {
      history.push(beforeSnapshot);
      future = [];
      render();
    }
    showToast(messages.noChain[locale]);
    return;
  }

  isSimulating = true;
  document.querySelector("#simulate").disabled = true;
  document.querySelector("#suggest").disabled = true;
  history.push(beforeSnapshot);
  future = [];

  let step = 0;
  for (const round of result.rounds) {
    chainCount = ++step;
    cumulativeScore = round.cumulativeScore;

    const cells = [...boardEl.children];
    findClearingCells(board)
      .forEach(([row, col]) =>
        cells[row * COLS + col].classList.add("clearing"),
      );

    await new Promise((resolve) => setTimeout(resolve, 420));
    board = applyGravity(round.state);
    render();
    await new Promise((resolve) => setTimeout(resolve, 280));
  }

  board = result.state;
  chainCount = result.chains;
  cumulativeScore = result.score;
  isSimulating = false;
  document.querySelector("#simulate").disabled = false;
  render();
}

function activeSuggestionColors() {
  return paletteIndex === fourColorPalettes.length
    ? colorFlickTools
    : fourColorPalettes[paletteIndex];
}

function displaySuggestion(candidate, index, total) {
  suggestionMarks = new Map();
  candidate.placements.forEach(({ row, col, color }) => {
    suggestionMarks.set(`${row},${col}`, { color, isTrigger: false });
  });
  (candidate.triggerPlacements || []).forEach(({ row, col, color }) => {
    suggestionMarks.set(`${row},${col}`, { color, isTrigger: true });
  });
  render();
}

function pressurelessAmaKey({ board, row14, seed, handIndex }) {
  const field = board
    .map((row) => row.map((cell) => cell || "-").join(""))
    .join("/");
  return [
    "pressureless-ama",
    seed,
    handIndex,
    row14,
    field,
  ].join(":");
}

function tokopuyoSuggestionKey() {
  if (!tokopuyoSession) return "";
  return pressurelessAmaKey(tokopuyoSession);
}

function lastTurnReviewKey() {
  if (!tokopuyoSession?.lastTurn) return "";
  const turn = tokopuyoSession.lastTurn;
  return pressurelessAmaKey({
    board: turn.beforeBoard,
    row14: turn.beforeRow14,
    seed: tokopuyoSession.seed,
    handIndex: turn.handIndex,
  });
}

function cacheAmaAnalysis(key, candidates) {
  amaAnalysisCache.delete(key);
  amaAnalysisCache.set(key, candidates);
  while (amaAnalysisCache.size > AMA_ANALYSIS_CACHE_LIMIT) {
    amaAnalysisCache.delete(amaAnalysisCache.keys().next().value);
  }
}

function tokopuyoAttackSuggestionKey() {
  if (!tokopuyoSession) return "";
  const field = tokopuyoSession.board
    .map((row) => row.map((cell) => cell || "-").join(""))
    .join("/");
  return [
    "attack",
    tokopuyoSession.seed,
    tokopuyoSession.handIndex,
    tokopuyoSession.row14,
    field,
  ].join(":");
}

function displayTokopuyoSuggestion(candidate, index, total) {
  tokopuyoSuggestionMarks = createTokopuyoSuggestionMarks(
    candidate,
    tokopuyoSession.board,
  );
  render();
  if (candidate.solver === "pressureless-ama") {
    statusEl.textContent = messages.pressurelessAmaSuggestion[locale](
      index + 1,
      total,
      candidate.averageScore,
      candidate.branchScores.length,
      candidate.searchElapsedMs,
    );
    return;
  }
  const mainColor = candidate.mainTrigger
    ? localizedColors[candidate.mainTrigger.color]?.[locale] ||
      candidate.mainTrigger.color
    : null;
  const targetCount = candidate.mainTrigger?.targetCells?.length || 0;
  const ignition = locale === "ja"
    ? candidate.mainTrigger
      ? `現在${candidate.mainTrigger.chains}連鎖：${mainColor}${targetCount}個組が発火対象（${candidate.mainTrigger.state === "ready" ? "このツモで発火可能" : `${mainColor}1ぷよで発火`}） · 未知ツモ受け ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`
      : `未知ツモ受け ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`
    : candidate.mainTrigger
      ? `Current ${candidate.mainTrigger.chains}-chain: ${targetCount} connected ${mainColor} puyos are the ignition target (${candidate.mainTrigger.state === "ready" ? "current pair can fire" : `fires with one ${mainColor} puyo`}) · Unknown-pair coverage ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`
      : `Unknown-pair coverage ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`;
}

function displayTokopuyoAttackSuggestion(candidate, index, total) {
  tokopuyoSuggestionMarks = new Map();
  [...candidate.moves].reverse().forEach((move) => {
    const step = move.handOffset + 1;
    move.cells.forEach(({ row, col, color }) => {
      tokopuyoSuggestionMarks.set(`${row},${col}`, {
        color,
        kind: step === 1 ? "current" : "future",
        step: step > 1 ? String(step) : null,
      });
    });
  });
  render();
}

function describePlacement({ col, orientation }) {
  const directions = ["up", "right", "down", "left"];
  return `Column ${col + 1}, child ${directions[orientation]}`;
}

function renderReviewMiniBoard(
  element,
  board,
  row14,
  placementCells = [],
  evidenceCells = [],
  clearingCells = [],
) {
  const placements = new Map(
    placementCells.map((cell) => [`${cell.row},${cell.col}`, cell]),
  );
  const evidence = new Map(
    evidenceCells.map((cell) => [`${cell.row},${cell.col}`, cell]),
  );
  const clearing = new Set(
    clearingCells.map(({ row, col }) => `${row},${col}`),
  );
  element.replaceChildren();
  for (let row = -1; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("span");
      cell.className = `review-mini-cell${
        row === -1 ? " review-row14" : row < HIDDEN_ROWS ? " review-hidden" : ""
      }${row === HIDDEN_ROWS && col === 2 ? " review-choke" : ""}`;
      const placement = placements.get(`${row},${col}`);
      const evidenceCell = evidence.get(`${row},${col}`);
      const color = placement?.color || evidenceCell?.color ||
        (row >= 0 ? board[row][col] : null);
      const occupiedRow14 = row === -1 && Boolean(row14 & (1 << col));
      if (color || occupiedRow14) {
        const puyo = document.createElement("span");
        puyo.className = `review-mini-puyo${
          color ? ` ${color}` : " review-row14-occupied"
        }${placement ? " review-placement" : ""}${
          evidenceCell ? " review-evidence" : ""
        }${clearing.has(`${row},${col}`) ? " clearing" : ""
        }`;
        cell.append(puyo);
      }
      element.append(cell);
    }
  }
}

const AMA_SIGNAL_PRESENTATION = {
  potentialChain: ["Probe chain", "Chain steps found by Ama's best trigger probe."],
  triggerHeight: ["Trigger height", "Height of the selected hypothetical trigger column."],
  requiredPuyos: ["Puyos to trigger", "Same-color puyos added by the selected probe; fewer is rewarded."],
  extensionSpace: ["Extension space", "Horizontal room Ama detects around the selected trigger."],
  quietLink2: ["Probe residue pairs", "Two-connection markers left after the hypothetical trigger."],
  quietLink3: ["Probe residue triples", "Three-connection markers left after the hypothetical trigger."],
  formMatch: ["Form match", "Best relative-color match among Ama's GTR, FRON, and SGTR templates."],
  shapeDeviation: ["Shape deviation", "Distance from Ama's preferred relative column-height profile; lower is rewarded."],
  wells: ["Well depth", "Total depth of columns below their neighbors; lower is rewarded."],
  bumps: ["Bump height", "Total height of interior columns above both neighbors; lower is rewarded."],
  boardLink2: ["Board pairs", "Cells classified by Ama as two-connection markers."],
  boardLink3: ["Board triples", "Cells classified by Ama as three-connection markers."],
  row14Blockage: ["Row 14 blockage", "Special-row occupancy that reduces reachable horizontal space."],
  sideBias: ["Side bias", "Left/right height relative to the center; its current weight is zero."],
  garbageCount: ["Garbage", "Garbage puyos on the evaluated field."],
  pairSplit: ["Pair split", "Whether a horizontal Current pair separated across unequal heights."],
  immediateClear: ["Immediate clear", "Chain steps fired by Current; Ama applies an action cost."],
};

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
}

function formatSignalCalculation(signal) {
  return `${signal.rawValue.toLocaleString()} × ${signal.weight.toLocaleString()} = ${formatSigned(signal.contribution)}`;
}

function capitalizeColor(color) {
  return color ? color[0].toUpperCase() + color.slice(1) : "Unknown";
}

function maskBoardCells(mask) {
  if (!mask) return [];
  return mask.flatMap((row, rowIndex) => row.flatMap((color, col) =>
    color ? [{ row: rowIndex, col, color }] : []));
}

function diagnosticEvidenceCells(diagnostic, signalId) {
  if (!diagnostic) return [];
  if ([
    "potentialChain", "triggerHeight", "requiredPuyos", "extensionSpace",
    "quietLink2", "quietLink3",
  ].includes(signalId)) {
    return diagnostic.selectedProbe?.addedCells || [];
  }
  if (signalId === "boardLink2") return maskBoardCells(diagnostic.link2Mask);
  if (signalId === "boardLink3") return maskBoardCells(diagnostic.link3Mask);
  if (signalId === "immediateClear") return maskBoardCells(diagnostic.clearedMask);
  if (signalId === "garbageCount") {
    return diagnostic.board.flatMap((row, rowIndex) => row.flatMap((color, col) =>
      color === "garbage" ? [{ row: rowIndex, col, color }] : []));
  }
  if (signalId === "row14Blockage") {
    return Array.from({ length: COLS }, (_, col) =>
      diagnostic.row14 & (1 << col) ? { row: -1, col, color: null } : null)
      .filter(Boolean);
  }
  const columnValues = signalId === "shapeDeviation"
    ? diagnostic.shapeDeviation
    : signalId === "wells"
      ? diagnostic.wellDepth
      : signalId === "bumps" ? diagnostic.bumpHeight : null;
  if (!columnValues) return [];
  return columnValues.flatMap((value, col) => {
    const height = diagnostic.heights[col];
    return value > 0 && height > 0
      ? [{ row: 13 - height, col, color: diagnostic.board[13 - height][col] }]
      : [];
  });
}

function renderDiagnosticEvidence(
  userDiagnostic,
  amaDiagnostic,
  signalId,
) {
  renderReviewMiniBoard(
    reviewUserBoardEl,
    userDiagnostic.board,
    userDiagnostic.row14,
    [],
    diagnosticEvidenceCells(userDiagnostic, signalId),
  );
  renderReviewMiniBoard(
    reviewAmaBoardEl,
    amaDiagnostic.board,
    amaDiagnostic.row14,
    [],
    diagnosticEvidenceCells(amaDiagnostic, signalId),
  );
  reviewUserBoardStateEl.textContent = "Resolved field · evidence";
  reviewAmaBoardStateEl.textContent = "Resolved field · evidence";
  reviewUserBoardEl.setAttribute(
    "aria-label",
    "Your resolved field with Ama evaluation evidence",
  );
  reviewAmaBoardEl.setAttribute(
    "aria-label",
    "Ama's resolved field with evaluation evidence",
  );
}

function futurePairingText(branch) {
  const colors = tokopuyoSession?.pattern.colors || [];
  return AMA_FUTURE_PAIRINGS[branch]
    .map(([axis, child]) =>
      `${capitalizeColor(colors[axis])}–${capitalizeColor(colors[child])}`)
    .join(" / ");
}

function createFuturePairingIcon(branch) {
  const colors = tokopuyoSession?.pattern.colors || [];
  const icon = document.createElement("span");
  icon.className = "review-future-pairing";
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", futurePairingText(branch));
  AMA_FUTURE_PAIRINGS[branch].forEach((pair, pairIndex) => {
    if (pairIndex) {
      const separator = document.createElement("i");
      separator.className = "review-pair-separator";
      separator.textContent = "/";
      icon.append(separator);
    }
    const group = document.createElement("span");
    group.className = "review-pair-group";
    pair.forEach((colorIndex) => {
      const dot = document.createElement("i");
      dot.className = `review-color-dot ${colors[colorIndex]}`;
      group.append(dot);
    });
    icon.append(group);
  });
  return icon;
}

function createReviewHelp(label, text, action = null) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const body = document.createElement("div");
  const paragraph = document.createElement("p");
  details.className = "review-help";
  summary.textContent = "?";
  summary.setAttribute("aria-label", `Explain ${label}`);
  body.className = "review-help-body";
  paragraph.textContent = text;
  body.append(paragraph);
  if (action) body.append(action);
  details.append(summary, body);
  return details;
}

function appendComparisonMetric({
  container,
  label,
  help,
  userValue,
  amaValue,
  format,
  lowerIsBetter = false,
}) {
  const metric = document.createElement("article");
  const heading = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = label;
  heading.className = "review-metric-heading";
  heading.append(title, createReviewHelp(label, help));
  metric.append(heading);
  const numericValues = [userValue, amaValue].filter(Number.isFinite);
  const minimum = Math.min(...numericValues);
  const maximum = Math.max(...numericValues);
  const useRelativeScale = minimum < 0;
  [["You", "user", userValue], ["Ama", "ama", amaValue]].forEach(
    ([name, kind, value]) => {
      const row = document.createElement("div");
      const nameEl = document.createElement("small");
      const track = document.createElement("span");
      const fill = document.createElement("i");
      const valueEl = document.createElement("span");
      const otherValue = kind === "user" ? amaValue : userValue;
      const isBetter = Number.isFinite(value) && Number.isFinite(otherValue) &&
        (lowerIsBetter ? value < otherValue : value > otherValue);
      row.className = `review-metric-row${isBetter ? " is-better" : ""}`;
      nameEl.textContent = name;
      track.className = "review-metric-track";
      fill.className = `review-metric-fill ${kind}`;
      fill.style.setProperty(
        "--metric-width",
        Number.isFinite(value)
          ? `${useRelativeScale
            ? maximum === minimum
              ? 100
              : 18 + (value - minimum) / (maximum - minimum) * 82
            : Math.max(2, value / Math.max(1, maximum) * 100)}%`
          : "0%",
      );
      valueEl.className = "review-metric-value";
      valueEl.textContent = Number.isFinite(value) ? format(value) : "—";
      track.append(fill);
      row.append(nameEl, track, valueEl);
      metric.append(row);
    },
  );
  container.append(metric);
}

function renderFutureCoaching(evaluation) {
  reviewFutureMetricsEl.replaceChildren();
  if (!evaluation.userStats || !evaluation.bestStats) {
    reviewFutureSummaryEl.textContent = "Future potential is unavailable for the excluded move.";
    return;
  }
  const comparison = compareAmaFutureProfiles(
    evaluation.userStats,
    evaluation.bestStats,
  );
  const potentialText = comparison.potentialLeader === "tied"
    ? "Potential tied"
    : comparison.potentialLeader === "user"
      ? "You: higher potential"
      : "Ama: higher potential";
  const stabilityText = comparison.stabilityLeader === "similar"
    ? "similar consistency"
    : comparison.stabilityLeader === "user"
      ? "you: steadier"
      : comparison.stabilityLeader === "ama"
        ? "Ama: steadier"
        : "consistency unavailable";
  reviewFutureSummaryEl.textContent = `${potentialText} · ${stabilityText}`;
  appendComparisonMetric({
    container: reviewFutureMetricsEl,
    label: "Potential",
    help: "Average maximum chain score found across Ama's six fixed test continuations. Higher is better.",
    userValue: evaluation.userStats.mean,
    amaValue: evaluation.bestStats.mean,
    format: (value) => value.toLocaleString(undefined, { maximumFractionDigits: 1 }),
  });
  appendComparisonMetric({
    container: reviewFutureMetricsEl,
    label: "Variation",
    help: "Relative dispersion across the six test continuations. Lower means the result depended less on the tested pairing pattern.",
    userValue: evaluation.userStats.relativeDispersion,
    amaValue: evaluation.bestStats.relativeDispersion,
    format: (value) => `${(value * 100).toFixed(0)}%`,
    lowerIsBetter: true,
  });
}

function createDiagnosticInsight(userDiagnostic, amaDiagnostic) {
  if (!userDiagnostic?.survives || !amaDiagnostic?.survives) return [];
  const insights = [];
  const userProbe = userDiagnostic.selectedProbe;
  const amaProbe = amaDiagnostic.selectedProbe;
  if (userProbe || amaProbe) {
    const describe = (probe) => probe
      ? `${probe.chainCount}-chain with ${probe.requiredPuyos} added ${probe.color} puyo${probe.requiredPuyos === 1 ? "" : "s"} in column ${probe.column + 1}`
      : "no multi-chain trigger within three added puyos";
    insights.push({
      title: "Best trigger probe",
      body: `You: ${describe(userProbe)}. Ama: ${describe(amaProbe)}.`,
    });
  }
  return insights;
}

function renderContributionChart(
  userDiagnostic,
  amaDiagnostic,
) {
  reviewContributionChartEl.replaceChildren();
  if (!userDiagnostic.survives || !amaDiagnostic.survives) return;
  const differences = Object.entries(AMA_SIGNAL_PRESENTATION)
    .map(([id, [label, meaning]]) => ({
      id,
      label,
      meaning,
      user: userDiagnostic.signals[id],
      ama: amaDiagnostic.signals[id],
      edge: userDiagnostic.signals[id].contribution -
        amaDiagnostic.signals[id].contribution,
    }))
    .filter(({ edge }) => edge !== 0)
    .sort((left, right) => Math.abs(right.edge) - Math.abs(left.edge))
    .slice(0, 5);
  if (!differences.length) return;
  const heading = document.createElement("div");
  const title = document.createElement("strong");
  const legend = document.createElement("span");
  heading.className = "review-contribution-heading";
  title.textContent = "Largest evaluation gaps";
  legend.innerHTML = '<i class="review-legend-user"></i>You <i class="review-legend-ama"></i>Ama';
  heading.append(title, legend);
  reviewContributionChartEl.append(heading);
  const scale = Math.max(...differences.map(({ edge }) => Math.abs(edge)));
  differences.forEach(({ id, label, meaning, user, ama, edge }) => {
    const row = document.createElement("div");
    const labelGroup = document.createElement("div");
    const name = document.createElement("strong");
    const track = document.createElement("span");
    const fill = document.createElement("i");
    const value = document.createElement("span");
    const evidenceAvailable =
      diagnosticEvidenceCells(userDiagnostic, id).length > 0 ||
      diagnosticEvidenceCells(amaDiagnostic, id).length > 0;
    let action = null;
    if (evidenceAvailable) {
      action = document.createElement("button");
      action.type = "button";
      action.className = "review-show-evidence";
      action.textContent = "Show on boards";
      action.addEventListener("click", () => renderDiagnosticEvidence(
        userDiagnostic,
        amaDiagnostic,
        id,
      ));
    }
    row.className = "review-contribution-row";
    labelGroup.className = "review-contribution-label";
    name.textContent = label;
    labelGroup.append(name, createReviewHelp(
      label,
      `${meaning} You: ${formatSignalCalculation(user)}. Ama: ${formatSignalCalculation(ama)}.`,
      action,
    ));
    track.className = "review-contribution-track";
    fill.className = `review-contribution-fill ${edge > 0 ? "user" : "ama"}`;
    fill.style.setProperty("--edge-width", `${Math.abs(edge) / scale * 50}%`);
    value.className = "review-contribution-value";
    value.textContent = Math.abs(edge).toLocaleString();
    track.append(fill);
    row.append(labelGroup, track, value);
    reviewContributionChartEl.append(row);
  });
}

function renderEvaluationCoaching(
  userDiagnostic,
  amaDiagnostic,
) {
  const available = Boolean(userDiagnostic && amaDiagnostic);
  reviewEvaluationSectionEl.hidden = !available;
  reviewEvaluationSummaryEl.replaceChildren();
  reviewContributionChartEl.replaceChildren();
  reviewInsightCardsEl.replaceChildren();
  reviewSignalTableEl.replaceChildren();
  if (!available) return;
  const userPriority = userDiagnostic.staticTotal + userDiagnostic.actionTotal;
  const amaPriority = amaDiagnostic.staticTotal + amaDiagnostic.actionTotal;
  if (userDiagnostic.survives && amaDiagnostic.survives) {
    appendComparisonMetric({
      container: reviewEvaluationSummaryEl,
      label: "Immediate priority",
      help: "The weighted board score Ama uses to retain fields in beam search. Higher is favored at this stage, but this is not the final move score.",
      userValue: userPriority,
      amaValue: amaPriority,
      format: (value) => value.toLocaleString(),
    });
    renderContributionChart(
      userDiagnostic,
      amaDiagnostic,
    );
  } else {
    reviewEvaluationSummaryEl.textContent = "One field was excluded.";
  }
  createDiagnosticInsight(userDiagnostic, amaDiagnostic).forEach(({ title, body }) => {
    const card = document.createElement("article");
    const heading = document.createElement("strong");
    const paragraph = document.createElement("p");
    heading.textContent = title;
    paragraph.textContent = body;
    card.append(heading, paragraph);
    reviewInsightCardsEl.append(card);
  });
  if (!userDiagnostic.survives || !amaDiagnostic.survives) return;
  const header = document.createElement("div");
  header.className = "review-signal-row review-signal-header";
  ["Feature", "You", "Ama"].forEach((text) => {
    const cell = document.createElement("span");
    cell.textContent = text;
    header.append(cell);
  });
  reviewSignalTableEl.append(header);
  Object.entries(AMA_SIGNAL_PRESENTATION).forEach(([id, [label, meaning]]) => {
    const user = userDiagnostic.signals[id];
    const ama = amaDiagnostic.signals[id];
    const row = document.createElement("div");
    row.className = "review-signal-row";
    const description = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = label;
    const hasEvidence =
      diagnosticEvidenceCells(userDiagnostic, id).length > 0 ||
      diagnosticEvidenceCells(amaDiagnostic, id).length > 0;
    let show = null;
    if (hasEvidence) {
      show = document.createElement("button");
      show.type = "button";
      show.className = "review-show-evidence";
      show.textContent = "Show on boards";
      show.addEventListener("click", () =>
        renderDiagnosticEvidence(
          userDiagnostic,
          amaDiagnostic,
          id,
        ));
    }
    description.append(name, createReviewHelp(
      label,
      `${meaning} You: ${formatSignalCalculation(user)}. Ama: ${formatSignalCalculation(ama)}.`,
      show,
    ));
    const userValue = document.createElement("span");
    const amaValue = document.createElement("span");
    const formName = (diagnostic) => ["GTR", "FRON", "SGTR"][diagnostic.bestForm];
    userValue.textContent = `${formatSigned(user.contribution)}${
      id === "formMatch" && formName(userDiagnostic) ? ` · ${formName(userDiagnostic)}` : ""
    }`;
    amaValue.textContent = `${formatSigned(ama.contribution)}${
      id === "formMatch" && formName(amaDiagnostic) ? ` · ${formName(amaDiagnostic)}` : ""
    }`;
    row.append(description, userValue, amaValue);
    reviewSignalTableEl.append(row);
  });
}

function appendReviewStat(value, label, help) {
  const stat = document.createElement("article");
  stat.className = "review-stat";
  const strong = document.createElement("strong");
  strong.textContent = value;
  const labelGroup = document.createElement("span");
  const small = document.createElement("small");
  small.textContent = label;
  labelGroup.className = "review-stat-label";
  labelGroup.append(small, createReviewHelp(label, help));
  stat.append(strong, labelGroup);
  reviewStatsEl.append(stat);
}

function appendReviewRange(stats, label) {
  const range = document.createElement("span");
  range.className = "review-range";
  range.textContent = label;
  const value = document.createElement("strong");
  value.textContent = stats
    ? `${stats.minimum.toLocaleString()}–${stats.maximum.toLocaleString()}`
    : "—";
  range.append(value);
  reviewRangesEl.append(range);
}

function renderReviewBranchSummary(branches) {
  reviewBranchesEl.replaceChildren();
  if (!branches) {
    reviewBranchesEl.textContent = "No future score";
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  const headerRow = document.createElement("tr");
  const valueRow = document.createElement("tr");
  [["Favored move", "label"], ["You", "user"], ["Tied", "tied"], ["Ama", "ama"]]
    .forEach(([label, kind]) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.className = kind;
      cell.textContent = label;
      headerRow.append(cell);
    });
  const rowLabel = document.createElement("th");
  rowLabel.scope = "row";
  rowLabel.textContent = "Futures";
  valueRow.append(rowLabel);
  [[branches.user, "user"], [branches.tied, "tied"], [branches.ama, "ama"]]
    .forEach(([count, kind]) => {
      const cell = document.createElement("td");
      cell.className = kind;
      cell.textContent = count;
      valueRow.append(cell);
    });
  head.append(headerRow);
  body.append(valueRow);
  table.append(head, body);
  reviewBranchesEl.append(table);
}

function renderReviewBranchChart(comparisons) {
  reviewBranchChartEl.replaceChildren();
  reviewBranchSectionEl.hidden = !comparisons;
  if (!comparisons) return;
  const scale = Math.max(
    1,
    ...comparisons.flatMap(({ userScore, amaScore }) => [userScore, amaScore]),
  );
  comparisons.forEach(({ branch, userScore, amaScore }) => {
    const row = document.createElement("div");
    row.className = "review-branch-row";
    const label = createFuturePairingIcon(branch);
    const bars = document.createElement("div");
    bars.className = "review-branch-bars";
    [["You", "user", userScore], ["Ama", "ama", amaScore]].forEach(
      ([name, kind, score]) => {
        const line = document.createElement("div");
        line.className = "review-branch-line";
        const nameEl = document.createElement("small");
        nameEl.textContent = name;
        const track = document.createElement("span");
        track.className = "review-branch-track";
        const fill = document.createElement("i");
        fill.className = `review-branch-fill ${kind}`;
        fill.style.setProperty("--branch-width", `${(score / scale) * 100}%`);
        track.append(fill);
        const value = document.createElement("span");
        value.className = "review-branch-value";
        value.textContent = score.toLocaleString();
        line.append(nameEl, track, value);
        bars.append(line);
      },
    );
    row.append(label, bars);
    reviewBranchChartEl.append(row);
  });
}

const REPLAY_HAND_DELAY_MS = 650;

function renderReviewReplayPair(pair) {
  reviewReplayPairEl.replaceChildren();
  if (!pair) {
    reviewReplayPairEl.setAttribute("aria-label", "Replay complete");
    return;
  }
  reviewReplayPairEl.setAttribute(
    "aria-label",
    `${capitalizeColor(pair.axis)} and ${capitalizeColor(pair.child)} replay pair`,
  );
  [pair.child, pair.axis].forEach((color) => {
    const puyo = document.createElement("i");
    puyo.className = `review-replay-puyo ${color}`;
    reviewReplayPairEl.append(puyo);
  });
}

function renderReviewReplay() {
  const state = reviewReplayState;
  if (!state) return;
  const nextHand = state.replay.hands[state.handIndex] || null;
  renderReviewReplayPair(nextHand?.pair || null);
  if (!state.busy) {
    renderReviewMiniBoard(
      reviewReplayBoardEl,
      state.board,
      state.row14,
    );
  }
  const complete = state.handIndex >= state.replay.hands.length;
  reviewReplayStatusEl.textContent = complete
    ? `${state.replay.chainCount}-chain · ${state.replay.score.toLocaleString()} points`
    : `Hand ${state.handIndex + 1} of ${state.replay.hands.length}`;
  resetReviewReplayButton.disabled = state.busy || state.handIndex === 0;
  nextReviewReplayButton.disabled = state.busy || state.playing || complete;
  playReviewReplayButton.disabled = state.busy && !state.playing;
  playReviewReplayButton.textContent = state.playing ? "❚❚ Pause" : "▶ Play";
}

function resetReviewReplay() {
  if (!reviewReplayState || reviewReplayState.busy) return;
  reviewReplayRevision++;
  reviewReplayState = {
    ...reviewReplayState,
    board: clone(reviewReplayState.initialBoard),
    row14: reviewReplayState.initialRow14,
    handIndex: 0,
    playing: false,
  };
  renderReviewReplay();
}

async function advanceReviewReplay() {
  const state = reviewReplayState;
  if (!state || state.busy || state.handIndex >= state.replay.hands.length) return;
  const revision = reviewReplayRevision;
  const hand = state.replay.hands[state.handIndex];
  state.busy = true;
  renderReviewReplay();
  renderReviewMiniBoard(
    reviewReplayBoardEl,
    hand.lockedBoard,
    hand.lockedRow14,
    hand.cells,
  );
  reviewReplayStatusEl.textContent = `Hand ${state.handIndex + 1} · placed`;
  const completed = await animateChainRounds({
    lockedBoard: hand.lockedBoard,
    rounds: hand.result.rounds,
    isCancelled: () => revision !== reviewReplayRevision,
    onFrame({ board: frameBoard, chain, clearingCells }) {
      renderReviewMiniBoard(
        reviewReplayBoardEl,
        frameBoard,
        hand.lockedRow14,
        [],
        [],
        clearingCells,
      );
      reviewReplayStatusEl.textContent = `Hand ${state.handIndex + 1} · ${chain}-chain`;
    },
  });
  if (!completed || revision !== reviewReplayRevision || reviewReplayState !== state) return;
  state.board = clone(hand.afterBoard);
  state.row14 = hand.afterRow14;
  state.handIndex++;
  state.busy = false;
  renderReviewReplay();
  if (!state.playing || state.handIndex >= state.replay.hands.length) {
    state.playing = false;
    renderReviewReplay();
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, REPLAY_HAND_DELAY_MS));
  if (revision === reviewReplayRevision && state.playing) {
    void advanceReviewReplay();
  }
}

function closeReviewReplay() {
  reviewReplayRevision++;
  if (reviewReplayState) reviewReplayState.playing = false;
  reviewReplayState = null;
  reviewReplayPanelEl.hidden = true;
}

function showReviewReplayResult(source, selection, replay) {
  reviewReplayState = {
    source,
    selection,
    replay,
    initialBoard: clone(reviewReplayContext.turn.beforeBoard),
    initialRow14: reviewReplayContext.turn.beforeRow14,
    board: clone(reviewReplayContext.turn.beforeBoard),
    row14: reviewReplayContext.turn.beforeRow14,
    handIndex: 0,
    busy: false,
    playing: false,
  };
  reviewReplaySourceEl.textContent = source === "user" ? "YOUR MOVE" : "AMA'S CHOICE";
  reviewReplayMetaEl.replaceChildren();
  reviewReplayMetaEl.append(createFuturePairingIcon(selection.branch));
  const score = document.createElement("strong");
  score.textContent = `${selection.score.toLocaleString()} points`;
  const tie = document.createElement("span");
  tie.textContent = selection.tiedBranches.length > 1
    ? `Best in ${selection.tiedBranches.length} of 6 futures`
    : "Best of 6 futures";
  reviewReplayMetaEl.append(score, tie);
  reviewReplayPanelEl.hidden = false;
  renderReviewReplay();
  reviewReplayPanelEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function launchReviewReplay(source) {
  if (isSuggesting) return;
  const context = reviewReplayContext;
  const candidate = source === "user"
    ? context?.evaluation.user
    : context?.evaluation.best;
  const selection = selectBestAmaBranch(candidate);
  if (!context || !candidate || !selection || selection.score <= 0) return;
  const revision = ++reviewReplayRevision;
  reviewReplayPanelEl.hidden = false;
  reviewReplaySourceEl.textContent = source === "user" ? "YOUR MOVE" : "AMA'S CHOICE";
  reviewReplayMetaEl.textContent = "Tracing Ama's best future…";
  reviewReplayPairEl.replaceChildren();
  reviewReplayBoardEl.replaceChildren();
  reviewReplayStatusEl.textContent = "Please wait";
  resetReviewReplayButton.disabled = true;
  nextReviewReplayButton.disabled = true;
  playReviewReplayButton.disabled = true;
  const cacheKey = `${source}:${selection.branch}`;
  try {
    let replay = context.replays.get(cacheKey);
    if (!replay) {
      isSuggesting = true;
      render();
      const witness = await pressurelessAmaController.traceWitness({
        board: clone(context.turn.beforeBoard),
        row14: context.turn.beforeRow14,
        hands: [{ ...context.turn.current }, { ...context.turn.next }],
        colors: [...context.colors],
        branch: selection.branch,
        target: {
          col: candidate.col,
          orientation: candidate.orientation,
          score: selection.score,
        },
        expectedCandidates: context.allCandidates,
        ...TOKOPUYO_SUGGESTION_CONFIG,
      });
      replay = buildAmaReplay(
        context.turn.beforeBoard,
        context.turn.beforeRow14,
        witness,
      );
      context.replays.set(cacheKey, replay);
    }
    if (revision !== reviewReplayRevision || context !== reviewReplayContext) return;
    showReviewReplayResult(source, selection, replay);
  } catch (error) {
    if (revision !== reviewReplayRevision) return;
    console.error("Ama replay failed", error);
    reviewReplayMetaEl.textContent = "Replay unavailable";
    reviewReplayStatusEl.textContent = "Ama's traced path did not pass validation.";
  } finally {
    isSuggesting = false;
    render();
  }
}

function closeLastMoveReview() {
  closeReviewReplay();
  reviewReplayContext = null;
  reviewOverlay.hidden = true;
}

function displayLastMoveReview(
  evaluation,
  turn,
  diagnostics = null,
  allCandidates = [],
) {
  const summaries = {
    "top-choice": "Ama's first choice matches your move.",
    "tied-choice": "Your move tied Ama's first choice.",
    "different-choice": "Ama preferred a different placement.",
    "game-over": "Ama excluded your move because it ended at the choke point.",
    "no-surviving-choice": "Ama found no placement that survived this position.",
    unavailable: "Ama could not match this move to a scored placement.",
  };
  reviewOverlay.querySelectorAll("details").forEach((details) => {
    details.open = false;
  });
  closeReviewReplay();
  reviewReplayContext = {
    evaluation,
    turn,
    allCandidates,
    colors: [...tokopuyoSession.pattern.colors],
    replays: new Map(),
  };
  reviewTitleEl.textContent = "Last move review";
  const closeAggregate =
    evaluation.verdict === "different-choice" &&
    evaluation.aggregateRetention >= 0.9;
  reviewSummaryEl.textContent = `${summaries[evaluation.verdict]}${
    closeAggregate ? " The aggregate scores are within 10%." : ""
  }`;
  reviewOutcomeEl.textContent = `Actual result: ${
    turn.result.chains ? `${turn.result.chains}-chain` : "no chain"
  }, ${turn.result.score.toLocaleString()} points${
    turn.result.gameOver ? ", game over" : ""
  }.`;
  reviewStatsEl.replaceChildren();
  appendReviewStat(
    evaluation.rank ? `${evaluation.rank}/${evaluation.legalCount}` : "—",
    "YOUR RANK",
    "Your placement's rank among Ama's legal Current placements. Rank 1 is Ama's top choice.",
  );
  appendReviewStat(
    evaluation.aggregateRetention === null
      ? "—"
      : `${Math.round(evaluation.aggregateRetention * 100)}%`,
    "POTENTIAL RETAINED",
    "Your six-future total divided by Ama's six-future total. It is not a probability or an accuracy score.",
  );
  appendReviewStat(
    evaluation.averageGap === null
      ? "—"
      : evaluation.averageGap.toLocaleString(),
    "AVG GAP",
    "Ama's average six-future score minus your average. Smaller means the two placements were closer.",
  );
  renderReviewBranchSummary(evaluation.branches);
  reviewRangesEl.replaceChildren();
  appendReviewRange(evaluation.userStats, "YOUR FOUND RANGE");
  appendReviewRange(evaluation.bestStats, "AMA FOUND RANGE");
  renderFutureCoaching(evaluation);
  renderReviewBranchChart(evaluation.branchComparisons);
  reviewUserPlacementEl.textContent = describePlacement(turn.placement);
  reviewAmaPlacementEl.textContent = evaluation.best
    ? describePlacement(evaluation.best)
    : "No surviving placement";
  const userBestBranch = selectBestAmaBranch(evaluation.user);
  const amaBestBranch = selectBestAmaBranch(evaluation.best);
  reviewUserReplayButton.disabled = !userBestBranch || userBestBranch.score <= 0;
  reviewAmaReplayButton.disabled = !amaBestBranch || amaBestBranch.score <= 0;
  reviewUserReplayButton.title = reviewUserReplayButton.disabled
    ? "No positive-score future was found"
    : "Replay your highest-scoring tested future";
  reviewAmaReplayButton.title = reviewAmaReplayButton.disabled
    ? "No positive-score future was found"
    : "Replay Ama's highest-scoring tested future";
  const userPreview = dropTsumo(
    turn.beforeBoard,
    turn.current,
    turn.placement.col,
    turn.placement.orientation,
    turn.beforeRow14,
  );
  const amaPreview = evaluation.best
    ? dropTsumo(
      turn.beforeBoard,
      turn.current,
      evaluation.best.col,
      evaluation.best.orientation,
      turn.beforeRow14,
    )
    : null;
  const userPlacementCells = userPreview?.cells || turn.placement.cells;
  const amaPlacementCells = amaPreview?.cells || [];
  const userImmediateChains = diagnostics?.user?.signals.immediateClear.rawValue ??
    turn.result.chains;
  const amaImmediateChains = diagnostics?.ama?.signals.immediateClear.rawValue ?? 0;
  reviewUserBoardStateEl.textContent = `Before resolution${
    userImmediateChains ? ` · fires ${userImmediateChains}-chain` : ""
  }`;
  reviewAmaBoardStateEl.textContent = `Before resolution${
    amaImmediateChains ? ` · fires ${amaImmediateChains}-chain` : ""
  }`;
  reviewUserBoardEl.setAttribute(
    "aria-label",
    "Your placement preview before chain resolution",
  );
  reviewAmaBoardEl.setAttribute(
    "aria-label",
    "Ama's placement preview before chain resolution",
  );
  renderReviewMiniBoard(
    reviewUserBoardEl,
    userPreview?.board || turn.beforeBoard,
    userPreview?.row14 ?? turn.beforeRow14,
    userPlacementCells,
  );
  renderReviewMiniBoard(
    reviewAmaBoardEl,
    amaPreview?.board || turn.beforeBoard,
    amaPreview?.row14 ?? turn.beforeRow14,
    amaPlacementCells,
  );
  renderEvaluationCoaching(diagnostics?.user, diagnostics?.ama);
  reviewOverlay.hidden = false;
  closeReviewButton.focus();
}

function displayLastMoveReviewError() {
  closeReviewReplay();
  reviewReplayContext = null;
  reviewTitleEl.textContent = "Review unavailable";
  reviewSummaryEl.textContent = "Pressureless Ama could not review this move. Close this dialog and try again.";
  reviewOutcomeEl.textContent = "";
  reviewStatsEl.replaceChildren();
  reviewBranchesEl.textContent = "";
  reviewRangesEl.replaceChildren();
  reviewFutureSummaryEl.textContent = "";
  reviewFutureMetricsEl.replaceChildren();
  renderReviewBranchChart(null);
  renderEvaluationCoaching(null, null);
  reviewUserPlacementEl.textContent = "";
  reviewAmaPlacementEl.textContent = "";
  reviewUserBoardStateEl.textContent = "";
  reviewAmaBoardStateEl.textContent = "";
  reviewUserBoardEl.replaceChildren();
  reviewAmaBoardEl.replaceChildren();
  reviewOverlay.hidden = false;
  closeReviewButton.focus();
}

async function showLastMoveReview() {
  if (
    appMode !== "tokopuyo" ||
    !tokopuyoSession?.lastTurn ||
    tokopuyoSession.busy ||
    isSuggesting
  ) return;

  const turn = tokopuyoSession.lastTurn;
  const key = lastTurnReviewKey();
  let allCandidates = amaAnalysisCache.get(key);
  if (!allCandidates) {
    isSuggesting = true;
    render();
    try {
      const result = await pressurelessAmaController.solve({
        board: clone(turn.beforeBoard),
        row14: turn.beforeRow14,
        hands: [{ ...turn.current }, { ...turn.next }],
        colors: [...tokopuyoSession.pattern.colors],
        ...TOKOPUYO_SUGGESTION_CONFIG,
      });
      if (lastTurnReviewKey() !== key) return;
      allCandidates = result.allCandidates;
      cacheAmaAnalysis(key, allCandidates);
    } catch (error) {
      console.error("Last-move review failed", error);
      displayLastMoveReviewError();
      return;
    } finally {
      isSuggesting = false;
      render();
    }
  }

  if (lastTurnReviewKey() !== key) return;
  const evaluation = evaluateAmaMove(turn, allCandidates);
  let diagnostics = null;
  if (evaluation.user && evaluation.best) {
    isSuggesting = true;
    render();
    try {
      const [user, ama] = await pressurelessAmaController.inspectPlacements({
        board: clone(turn.beforeBoard),
        row14: turn.beforeRow14,
        current: { ...turn.current },
        colors: [...tokopuyoSession.pattern.colors],
      }, [
        { col: evaluation.user.col, orientation: evaluation.user.orientation },
        { col: evaluation.best.col, orientation: evaluation.best.orientation },
      ]);
      diagnostics = { user, ama };
    } catch (error) {
      console.error("Ama board diagnostics failed", error);
    } finally {
      isSuggesting = false;
      render();
    }
  }
  if (lastTurnReviewKey() !== key) return;
  displayLastMoveReview(evaluation, turn, diagnostics, allCandidates);
}

async function showTokopuyoSuggestion() {
  if (
    !tokopuyoSession ||
    tokopuyoSession.busy ||
    tokopuyoSession.gameOver ||
    isSuggesting
  ) return;

  const key = tokopuyoSuggestionKey();
  if (
    tokopuyoSuggestionSession &&
    tokopuyoSuggestionSession.key === key &&
    tokopuyoSuggestionSession.candidates.length
  ) {
    tokopuyoSuggestionSession.index =
      (tokopuyoSuggestionSession.index + 1) %
      tokopuyoSuggestionSession.candidates.length;
    displayTokopuyoSuggestion(
      tokopuyoSuggestionSession.candidates[tokopuyoSuggestionSession.index],
      tokopuyoSuggestionSession.index,
      tokopuyoSuggestionSession.candidates.length,
    );
    return;
  }

  isSuggesting = true;
  const requestRevision = suggestionRevision;
  render();
  try {
    const hands = Array.from(
      { length: TOKOPUYO_SUGGESTION_CONFIG.visibleHands },
      (_, offset) =>
        getTsumo(tokopuyoSession.pattern, tokopuyoSession.handIndex + offset),
    );
    const { candidates, allCandidates } = await pressurelessAmaController.solve({
      board: clone(tokopuyoSession.board),
      row14: tokopuyoSession.row14,
      hands,
      colors: [...tokopuyoSession.pattern.colors],
      ...TOKOPUYO_SUGGESTION_CONFIG,
    });
    if (
      suggestionRevision !== requestRevision ||
      tokopuyoSuggestionKey() !== key
    ) {
      return;
    }
    if (!candidates.length) {
      statusEl.textContent = messages.suggestionNone[locale];
      return;
    }
    cacheAmaAnalysis(key, allCandidates);
    tokopuyoSuggestionSession = { key, candidates, index: 0 };
    displayTokopuyoSuggestion(candidates[0], 0, candidates.length);
  } catch (error) {
    console.error("Tokopuyo suggestion search failed", error);
    statusEl.textContent = messages.suggestionError[locale];
  } finally {
    isSuggesting = false;
    render();
  }
}

async function showTokopuyoAttackSuggestion() {
  if (
    appMode !== "tokopuyo" ||
    !tokopuyoSession ||
    tokopuyoSession.busy ||
    tokopuyoSession.gameOver ||
    isSuggesting
  ) return;

  const key = tokopuyoAttackSuggestionKey();
  if (
    tokopuyoAttackSuggestionSession &&
    tokopuyoAttackSuggestionSession.key === key &&
    tokopuyoAttackSuggestionSession.candidates.length
  ) {
    tokopuyoAttackSuggestionSession.index =
      (tokopuyoAttackSuggestionSession.index + 1) %
      tokopuyoAttackSuggestionSession.candidates.length;
    displayTokopuyoAttackSuggestion(
      tokopuyoAttackSuggestionSession.candidates[
        tokopuyoAttackSuggestionSession.index
      ],
      tokopuyoAttackSuggestionSession.index,
      tokopuyoAttackSuggestionSession.candidates.length,
    );
    return;
  }

  isSuggesting = true;
  const requestRevision = suggestionRevision;
  render();
  try {
    const hands = Array.from(
      { length: TOKOPUYO_ATTACK_SUGGESTION_CONFIG.lookaheadHands },
      (_, offset) =>
        getTsumo(tokopuyoSession.pattern, tokopuyoSession.handIndex + offset),
    );
    const { candidates, timedOut } = await suggestionController.solve({
      kind: "tokopuyo-attack",
      board: clone(tokopuyoSession.board),
      row14: tokopuyoSession.row14,
      hands,
      ...TOKOPUYO_ATTACK_SUGGESTION_CONFIG,
    });
    if (
      suggestionRevision !== requestRevision ||
      tokopuyoAttackSuggestionKey() !== key
    ) {
      return;
    }
    if (timedOut) throw new Error("Emergency-attack search timed out");
    if (!candidates.length) {
      return;
    }
    tokopuyoAttackSuggestionSession = { key, candidates, index: 0 };
    displayTokopuyoAttackSuggestion(candidates[0], 0, candidates.length);
  } catch (error) {
    console.error("Tokopuyo emergency-attack search failed", error);
  } finally {
    isSuggesting = false;
    render();
  }
}

async function showSuggestion() {
  if (appMode === "tokopuyo") return showTokopuyoSuggestion();
  if (isSimulating || isSuggesting) return;

  if (!isSettled(board)) {
    return;
  }

  if (findClearingCells(board).length) {
    return;
  }

  const colors = activeSuggestionColors();
  const boardKey = suggestionController.key(board, colors);
  if (
    suggestionSession &&
    !suggestionSession.stale &&
    suggestionSession.boardKey === boardKey
  ) {
    suggestionSession.index =
      (suggestionSession.index + 1) % suggestionSession.candidates.length;
    displaySuggestion(
      suggestionSession.candidates[suggestionSession.index],
      suggestionSession.index,
      suggestionSession.candidates.length,
    );
    return;
  }

  isSuggesting = true;
  const requestRevision = suggestionRevision;
  render();
  try {
    const { candidates } = await suggestionController.solve({
      board: clone(board),
      colors,
      ...SUGGESTION_SEARCH_CONFIG,
    });
    if (
      suggestionRevision !== requestRevision ||
      suggestionController.key(board, colors) !== boardKey
    ) {
      return;
    }
    if (!candidates.length) {
      return;
    }
    suggestionSession = { boardKey, candidates, index: 0, stale: false };
    displaySuggestion(candidates[0], 0, candidates.length);
  } catch (error) {
    console.error("Suggestion search failed", error);
  } finally {
    isSuggesting = false;
    render();
  }
}

const CHAIN_CLEAR_DELAY_MS = 420;
const CHAIN_GRAVITY_DELAY_MS = 280;

async function animateChainRounds({
  lockedBoard,
  rounds,
  onFrame,
  isCancelled = () => false,
}) {
  let currentBoard = clone(lockedBoard);
  for (let index = 0; index < rounds.length; index++) {
    if (isCancelled()) return false;
    onFrame({
      board: currentBoard,
      chain: index + 1,
      clearingCells: findClearingCells(currentBoard).map(([row, col]) => ({
        row,
        col,
      })),
      phase: "clearing",
    });
    await new Promise((resolve) => setTimeout(resolve, CHAIN_CLEAR_DELAY_MS));
    if (isCancelled()) return false;
    currentBoard = applyGravity(rounds[index].state);
    onFrame({
      board: currentBoard,
      chain: index + 1,
      clearingCells: [],
      phase: "settled",
    });
    await new Promise((resolve) => setTimeout(resolve, CHAIN_GRAVITY_DELAY_MS));
  }
  return !isCancelled();
}

function stepResolutionBoard(resolution) {
  if (!resolution.stepIndex) return clone(resolution.lockedBoard);
  return applyGravity(resolution.result.rounds[resolution.stepIndex - 1].state);
}

function renderTokopuyoStepResolution() {
  const resolution = tokopuyoStepResolution;
  if (!resolution) return;
  tokopuyoBoardOverride = stepResolutionBoard(resolution);
  tokopuyoDisplayedChain = resolution.stepIndex;
  render();
}

function cancelTokopuyoStepResolution() {
  if (!tokopuyoStepResolution) return false;
  tokopuyoStepRevision++;
  tokopuyoStepResolution.playing = false;
  tokopuyoStepResolution = null;
  tokopuyoBoardOverride = null;
  tokopuyoDisplayedChain = null;
  if (tokopuyoSession) tokopuyoSession.busy = false;
  return true;
}

async function advanceTokopuyoStep() {
  const resolution = tokopuyoStepResolution;
  if (
    !resolution ||
    resolution.advancing ||
    resolution.stepIndex >= resolution.result.rounds.length
  ) return false;

  const revision = tokopuyoStepRevision;
  const round = resolution.result.rounds[resolution.stepIndex];
  resolution.advancing = true;
  const clearingBoard = stepResolutionBoard(resolution);
  tokopuyoBoardOverride = clearingBoard;
  tokopuyoDisplayedChain = resolution.stepIndex + 1;
  render();
  findClearingCells(clearingBoard).forEach(([row, col]) => {
    boardEl.children[row * COLS + col]?.classList.add("clearing");
  });
  await new Promise((resolve) => setTimeout(resolve, CHAIN_CLEAR_DELAY_MS));
  if (revision !== tokopuyoStepRevision || tokopuyoStepResolution !== resolution) {
    return false;
  }
  resolution.stepIndex++;
  tokopuyoBoardOverride = applyGravity(round.state);
  tokopuyoDisplayedChain = resolution.stepIndex;
  render();
  await new Promise((resolve) => setTimeout(resolve, CHAIN_GRAVITY_DELAY_MS));
  if (revision !== tokopuyoStepRevision || tokopuyoStepResolution !== resolution) {
    return false;
  }
  resolution.advancing = false;
  if (resolution.stepIndex >= resolution.result.rounds.length) {
    resolution.playing = false;
    tokopuyoSession.busy = false;
    tokopuyoStepResolution = null;
    tokopuyoBoardOverride = null;
    tokopuyoDisplayedChain = null;
  }
  render();
  return true;
}

function previousTokopuyoStep() {
  const resolution = tokopuyoStepResolution;
  if (!resolution || resolution.advancing || !resolution.stepIndex) return;
  resolution.playing = false;
  resolution.stepIndex--;
  renderTokopuyoStepResolution();
}

async function playTokopuyoSteps() {
  const resolution = tokopuyoStepResolution;
  if (
    !resolution ||
    resolution.advancing ||
    resolution.stepIndex >= resolution.result.rounds.length
  ) return;
  resolution.playing = true;
  render();
  while (resolution.playing && tokopuyoStepResolution === resolution) {
    const advanced = await advanceTokopuyoStep();
    if (!advanced) break;
  }
}

function stopTokopuyoSteps() {
  if (!tokopuyoStepResolution) return;
  tokopuyoStepResolution.playing = false;
  render();
}

async function dropTokopuyoPair() {
  if (!tokopuyoSession || tokopuyoSession.busy || isSuggesting) return;
  const committed = commitActivePair(tokopuyoSession);
  if (!committed) return;
  clearTokopuyoSuggestions();

  if (tokopuyoStepMode && committed.result.chains) {
    tokopuyoSession.busy = true;
    tokopuyoStepResolution = {
      lockedBoard: clone(committed.lockedBoard),
      result: committed.result,
      stepIndex: 0,
      playing: false,
      advancing: false,
    };
    renderTokopuyoStepResolution();
    return;
  }

  tokopuyoSession.busy = true;
  tokopuyoBoardOverride = committed.lockedBoard;
  tokopuyoDisplayedChain = 0;
  render();

  await animateChainRounds({
    lockedBoard: committed.lockedBoard,
    rounds: committed.result.rounds,
    onFrame({ board: frameBoard, chain, clearingCells }) {
      tokopuyoBoardOverride = frameBoard;
      tokopuyoDisplayedChain = chain;
      render();
      if (clearingCells.length) {
        const cells = [...boardEl.children];
        clearingCells.forEach(({ row, col }) => {
          cells[row * COLS + col]?.classList.add("clearing");
        });
      }
    },
  });

  tokopuyoBoardOverride = null;
  tokopuyoDisplayedChain = null;
  tokopuyoSession.busy = false;
  render();

  if (tokopuyoSession.gameOver) {
    showToast(messages.tokopuyoGameOver[locale], 3000);
  }
}

function performTokopuyoAction(action) {
  if (
    appMode !== "tokopuyo" ||
    !tokopuyoSession ||
    tokopuyoSession.busy ||
    tokopuyoSession.gameOver ||
    isSuggesting
  ) return;
  if (action === "drop") {
    void dropTokopuyoPair();
    return;
  }
  actOnPair(tokopuyoSession, action);
  renderActivePair();
}

function switchAppMode() {
  if (isSimulating || isSuggesting || tokopuyoSession?.busy) return;
  closeFlick();
  flick.row = -1;

  if (appMode === "drawing") {
    appMode = "tokopuyo";
    if (!tokopuyoSession) tokopuyoSession = createSession(randomSeed());
    render();
  } else {
    appMode = "drawing";
    render();
  }
}

function openFlick(row, col, event) {
  if (flick.row >= 0) return;
  if (appMode !== "drawing" || isSimulating || isSuggesting) return;

  const tools = getFlickTools();

  flick = {
    kind: "drawing",
    row,
    col,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    choice: null,
    tools,
    suppressClick: false,
    pointerId: event.pointerId,
    intent: "straight",
  };

  event.currentTarget.setPointerCapture?.(event.pointerId);

  buildFlickMenu(tools);
  flickMenu.style.left = `${event.clientX}px`;
  flickMenu.style.top = `${event.clientY}px`;
  flickMenu.hidden = false;
  setStatus("Flick to choose an option, then release to place it");
}

function flickIndex(x, y) {
  const dx = x - flick.startX;
  const dy = y - flick.startY;
  const distance = Math.hypot(dx, dy);

  if (distance < 24) return -1;

  const sector = (Math.PI * 2) / flick.tools.length;
  const index = Math.round((Math.atan2(dy, dx) + Math.PI / 2) / sector);
  return (index % flick.tools.length + flick.tools.length) % flick.tools.length;
}

function highlightFlick(index) {
  flickMenu.querySelectorAll(".flick-option").forEach((button, i) => {
    button.classList.toggle("active", i === index);
  });
}

function closeFlick() {
  flickMenu.hidden = true;
}

function buildFlickMenu(tools) {
  flickMenu.innerHTML = "";

  tools.forEach((tool, index) => {
    const button = document.createElement("button");
    button.className = "flick-option";
    button.type = "button";
    button.dataset.tool = tool;
    button.ariaLabel = `${tool} puyo`;

    if (tool === "garbage") {
      const garbage = document.createElement("i");
      garbage.className = "garbage-icon";
      button.append(garbage);
    } else {
      button.append(document.createElement("i"));
    }

    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / tools.length);
    button.style.left = `calc(50% + ${Math.cos(angle) * 62}px)`;
    button.style.top = `calc(50% + ${Math.sin(angle) * 62}px)`;
    button.addEventListener("click", () => {
      setTool(tool);
      flick.suppressClick = true;
      closeFlick();
      setStatus("Option selected. Tap a board cell to place it");
    });
    flickMenu.append(button);
  });

  const deleteIcon = document.createElement("span");
  deleteIcon.className = "flick-delete";
  deleteIcon.textContent = "⌫";
  deleteIcon.ariaLabel = "Delete without flicking";
  flickMenu.append(deleteIcon);
}

function closeHelp() {
  helpOverlay.hidden = true;
}

window.addEventListener("pointermove", (event) => {
  if (flick.row < 0) return;
  if (event.pointerId !== flick.pointerId) return;

  const index = flickIndex(event.clientX, event.clientY);
  if (index >= 0) {
    flick.moved = true;
    flick.choice = index;
    highlightFlick(index);
  }
});

window.addEventListener("pointerup", (event) => {
  if (flick.row < 0) return;
  if (event.pointerId !== flick.pointerId) return;

  if (flick.moved && flick.choice !== null) {
    selectedTool = flick.tools[flick.choice];
    editCell(flick.row, flick.col);
    flick.suppressClick = true;
    setStatus(
      selectedTool === "erase"
        ? "Erased puyo"
        : `Placed ${selectedTool} puyo`,
    );
  } else {
    selectedTool = "erase";
    editCell(flick.row, flick.col);
    flick.suppressClick = true;
  }

  closeFlick();
  flick.row = -1;
});

window.addEventListener("pointercancel", (event) => {
  if (flick.row < 0 || event.pointerId !== flick.pointerId) return;
  closeFlick();
  flick.row = -1;
});

document
  .querySelectorAll(".palette [data-tool]")
  .forEach((button) =>
    button.addEventListener("click", () => setTool(button.dataset.tool)),
  );
document.querySelector("#undo").addEventListener("click", undo);
document.querySelector("#redo").addEventListener("click", redo);
chainBadge.addEventListener("click", () => {
  if (appMode !== "drawing") return;
  showToast(localizedMessage(messages.scoreSummary, cumulativeScore, chainCount));
});
document.querySelector("#clear").addEventListener("click", () => {
  if (appMode !== "drawing" || isSimulating) return;

  const hadSuggestions = suggestionMarks.size > 0 || suggestionSession !== null;
  clearSuggestions();
  if (
    board.every((row) => row.every((value) => value === null)) &&
    chainCount === 0 &&
    cumulativeScore === 0
  ) {
    if (hadSuggestions) render();
    return;
  }

  history.push(snapshot());
  future = [];
  board = emptyBoard();
  chainCount = 0;
  cumulativeScore = 0;
  showToast(messages.cleared[locale]);
  render();
});
document.querySelector("#reset").addEventListener("click", () => {
  if (appMode === "tokopuyo") {
    if (isSuggesting) return;
    cancelTokopuyoStepResolution();
    if (tokopuyoSession?.busy) return;
    clearTokopuyoSuggestions();
    tokopuyoSession = createSession(randomSeed());
    tokopuyoBoardOverride = null;
    tokopuyoDisplayedChain = null;
    render();
    showToast(
      localizedMessage(messages.tokopuyoReset, tokopuyoSession.pattern.number),
    );
    return;
  }
  if (isSimulating) return;

  const hadSuggestions = suggestionMarks.size > 0 || suggestionSession !== null;
  clearSuggestions();
  if (
    boardsEqual(board, initialBoard) &&
    chainCount === 0 &&
    cumulativeScore === 0
  ) {
    if (hadSuggestions) render();
    return;
  }

  history.push(snapshot());
  future = [];
  board = clone(initialBoard);
  chainCount = 0;
  cumulativeScore = 0;
  showToast(messages.reset[locale]);
  render();
});
document.querySelector("#simulate").addEventListener("click", runSimulation);
document.querySelector("#suggest").addEventListener("click", showSuggestion);
attackSuggestButton.addEventListener("click", showTokopuyoAttackSuggestion);
reviewLastMoveButton.addEventListener("click", showLastMoveReview);
document.querySelector("#movePairLeft").addEventListener("click", () => performTokopuyoAction("left"));
document.querySelector("#movePairRight").addEventListener("click", () => performTokopuyoAction("right"));
document.querySelector("#rotatePairLeft").addEventListener("click", () => performTokopuyoAction("counterclockwise"));
document.querySelector("#rotatePairRight").addEventListener("click", () => performTokopuyoAction("clockwise"));
document.querySelector("#dropPair").addEventListener("click", () => performTokopuyoAction("drop"));
toggleTokopuyoStepModeButton.addEventListener("click", () => {
  if (appMode !== "tokopuyo" || tokopuyoStepResolution) return;
  tokopuyoStepMode = !tokopuyoStepMode;
  render();
});
stepChainBackButton.addEventListener("click", previousTokopuyoStep);
stepChainForwardButton.addEventListener("click", () => {
  void advanceTokopuyoStep();
});
playChainStepsButton.addEventListener("click", () => {
  void playTokopuyoSteps();
});
stopChainStepsButton.addEventListener("click", stopTokopuyoSteps);
document.querySelector("#toggleGarbage").addEventListener("click", () => {
  setGarbageMode(!garbageMode);
});
document.querySelector("#cyclePalette").addEventListener("click", cyclePalette);
toggleAppModeButton.addEventListener("click", switchAppMode);
document.querySelector("#help").addEventListener("click", () => {
  helpOverlay.hidden = false;
});
closeHelpButton.addEventListener("click", closeHelp);
closeReviewButton.addEventListener("click", closeLastMoveReview);
reviewUserReplayButton.addEventListener("click", () => {
  void launchReviewReplay("user");
});
reviewAmaReplayButton.addEventListener("click", () => {
  void launchReviewReplay("ama");
});
closeReviewReplayButton.addEventListener("click", closeReviewReplay);
resetReviewReplayButton.addEventListener("click", resetReviewReplay);
nextReviewReplayButton.addEventListener("click", () => {
  void advanceReviewReplay();
});
playReviewReplayButton.addEventListener("click", () => {
  if (!reviewReplayState) return;
  if (reviewReplayState.playing) {
    reviewReplayState.playing = false;
    renderReviewReplay();
    return;
  }
  if (reviewReplayState.handIndex >= reviewReplayState.replay.hands.length) {
    resetReviewReplay();
  }
  reviewReplayState.playing = true;
  renderReviewReplay();
  if (!reviewReplayState.busy) void advanceReviewReplay();
});
helpOverlay.addEventListener("click", (event) => {
  if (event.target === helpOverlay) closeHelp();
});
reviewOverlay.addEventListener("click", (event) => {
  const selectedHelp = event.target.closest?.(".review-help") || null;
  reviewOverlay.querySelectorAll(".review-help[open]").forEach((details) => {
    if (details !== selectedHelp) details.open = false;
  });
  if (event.target === reviewOverlay) closeLastMoveReview();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!reviewOverlay.hidden) closeLastMoveReview();
  else if (!helpOverlay.hidden) closeHelp();
});
window.addEventListener("resize", () => {
  if (appMode === "tokopuyo") renderActivePair();
});

render();
updatePaletteButton();
