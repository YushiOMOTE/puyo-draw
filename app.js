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
  createAmaRankingRows,
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
import {
  formatNumber,
  getLocale,
  localizeDocument,
  localizedColors,
  setLocale,
  t,
} from "./i18n.js";

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
const leftModeDivider = document.querySelector("#leftModeDivider");
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
const reviewRankingStatEl = document.querySelector("#reviewRankingStat");
const reviewRankingChartEl = document.querySelector("#reviewRankingChart");
const reviewRankingBarsEl = document.querySelector("#reviewRankingBars");
const reviewRankingLastRankEl = document.querySelector("#reviewRankingLastRank");
const reviewRankingMaxScoreEl = document.querySelector("#reviewRankingMaxScore");
const reviewRankingMidScoreEl = document.querySelector("#reviewRankingMidScore");
const reviewRangesEl = document.querySelector("#reviewRanges");
const reviewBranchSectionEl = document.querySelector("#reviewBranchSection");
const reviewBranchChartEl = document.querySelector("#reviewBranchChart");
const reviewFutureSummaryEl = document.querySelector("#reviewFutureSummary");
const reviewFutureMetricsEl = document.querySelector("#reviewFutureMetrics");
const reviewUserBoardStateEl = document.querySelector("#reviewUserBoardState");
const reviewAmaBoardStateEl = document.querySelector("#reviewAmaBoardState");
const reviewUserBoardEl = document.querySelector("#reviewUserBoard");
const reviewAmaBoardEl = document.querySelector("#reviewAmaBoard");
const reviewRankingSectionEl = document.querySelector("#reviewRankingSection");
const reviewRankingBodyEl = document.querySelector("#reviewRankingBody");
const reviewRankingPreviewEl = document.querySelector("#reviewRankingPreview");
const reviewRankingPreviewSourceEl = document.querySelector("#reviewRankingPreviewSource");
const reviewRankingPreviewBoardEl = document.querySelector("#reviewRankingPreviewBoard");
const closeReviewRankingPreviewButton = document.querySelector("#closeReviewRankingPreview");
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
const languageSelect = document.querySelector("#languageSelect");

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
  leftSidebar.append(resetButton, leftModeDivider, toggleAppModeButton, helpButton);
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

  toggleAppModeButton.ariaLabel = t(isTokopuyo ? "app.returnDrawing" : "app.openTokopuyo");
  toggleAppModeButton.title = toggleAppModeButton.ariaLabel;
  toggleAppModeButton.innerHTML = isTokopuyo
    ? '<svg class="drawing-mode-icon" viewBox="0 0 28 32" aria-hidden="true"><path d="M12.1 14.3 23.1.4c.8-1 2.1-1.1 3-.2 1 .9 1.2 2.3.4 3.4l-9.1 14.3-5.3-3.6Z"/><path d="m11.4 15.1 5.3 3.5-1.6 2.5c-1 1.7-2.5 2.1-4 .9l-1.4-1.1c-1.6-1.3-1.7-2.3-.1-4.3l1.8-1.5Z"/><path fill-rule="evenodd" d="M8.1 21.1c-2.7-.2-4.7 1.8-5.5 5.3-.6 2.9-1.5 4.7-1.5 4.7 3.5 1.4 7.3-.1 9.8-2.6 2.4-2.4 1.4-5 1.4-5L9 21.2l-.9-.1Zm.9 1.1c-2 0-3.2 1.5-3.7 3.1-.2.9.5 1.4 1.2.8l1-.7c.6-.5 1.3.1.9.8l-.6.9c-.3.7.4 1.1 1 .5l.6-.6c.7-.6 1.4.1 1 1l-.6.8c-.5.8.4 1.3 1.1.7 1.5-1.2 2-3.6 1.1-5.5l-3-1.8Z"/></svg>'
    : '<span class="mode-pair-icon" aria-hidden="true"><i></i><i></i></span>';
  const suggestButton = document.querySelector("#suggest");
  suggestButton.ariaLabel = t(isTokopuyo ? "app.suggestTokopuyo" : "app.suggest");
  suggestButton.title = suggestButton.ariaLabel;
  resetButton.ariaLabel = t(isTokopuyo ? "message.tokopuyoReset" : "app.reset", tokopuyoSession?.pattern.number);
  resetButton.title = resetButton.ariaLabel;
  toggleTokopuyoStepModeButton.classList.toggle("active", tokopuyoStepMode);
  toggleTokopuyoStepModeButton.ariaPressed = String(tokopuyoStepMode);
  toggleTokopuyoStepModeButton.ariaLabel = t(tokopuyoStepMode ? "app.stepModeOff" : "app.stepModeOn");
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
      cell.ariaLabel = t("message.cell", r < HIDDEN_ROWS, ROWS - r, c + 1, t(`color.${color || "empty"}`), r === HIDDEN_ROWS && c === 2);
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
          cell.ariaLabel += ` ${t("message.activePuyo", t("color.axis"), t(`color.${suggestion.color}`))}`;
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
  tokopuyoChainScoreEl.textContent = formatNumber(displayedScore);
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
    t("message.garbageMode", enabled),
  );
  render();
}

function updatePaletteButton() {
  const button = document.querySelector("#cyclePalette");
  const isFiveColor = paletteIndex === fourColorPalettes.length;
  const palette = isFiveColor ? colorFlickTools : fourColorPalettes[paletteIndex];
  button.ariaLabel = isFiveColor
    ? t("app.paletteFive")
    : t("app.palette");
  button.title = isFiveColor
    ? t("app.paletteFive")
    : t("app.palette");
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
  showToast(t("message.palette", paletteIndex, fourColorPalettes.length));
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
    showToast(t("message.undo"));
    return;
  }
  if (!history.length || isSimulating) return;

  future.push(snapshot());
  restoreSnapshot(history.pop());
  clearSuggestions();
  render();
  showToast(t("message.undo"));
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
    showToast(t("message.redo"));
    return;
  }
  if (!future.length || isSimulating) return;

  history.push(snapshot());
  restoreSnapshot(future.pop());
  clearSuggestions();
  render();
  showToast(t("message.redo"));
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
    showToast(t("message.noChain"));
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
    statusEl.textContent = t("message.pressurelessAmaSuggestion",
      index + 1,
      total,
      candidate.averageScore,
      candidate.branchScores.length,
      candidate.searchElapsedMs,
    );
    return;
  }
  const mainColor = candidate.mainTrigger
    ? localizedColors()[candidate.mainTrigger.color] || candidate.mainTrigger.color
    : null;
  const targetCount = candidate.mainTrigger?.targetCells?.length || 0;
  const ignition = getLocale() === "ja"
    ? candidate.mainTrigger
      ? `現在${candidate.mainTrigger.chains}連鎖：${mainColor}${targetCount}個組が発火対象（${candidate.mainTrigger.state === "ready" ? "このツモで発火可能" : `${mainColor}1ぷよで発火`}） · 未知ツモ受け ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`
      : `未知ツモ受け ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`
    : candidate.mainTrigger
      ? `Current ${candidate.mainTrigger.chains}-chain: ${targetCount} connected ${mainColor} puyos are the ignition target (${candidate.mainTrigger.state === "ready" ? "current pair can fire" : `fires with one ${mainColor} puyo`}) · Unknown-pair coverage ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`
      : `Unknown-pair coverage ${candidate.acceptance.safeHands}/${candidate.acceptance.evaluatedHands}`;
  statusEl.textContent = t(
    "message.tokopuyoSuggestion",
    index + 1,
    total,
    candidate.mainTrigger?.chains || 0,
    candidate.connectionEfficiency,
    ignition,
    candidate.emergency,
  );
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
  statusEl.textContent = t(
    "message.tokopuyoAttack",
    index + 1,
    total,
    candidate.score,
    candidate.chains,
    candidate.timing,
  );
}

function describePlacement({ col, orientation }) {
  return t("review.placement", col + 1, t("review.directions")[orientation]);
}

function createPlacementLabel(candidate, pair) {
  const label = document.createElement("span");
  const axis = document.createElement("i");
  const axisColumn = document.createElement("span");
  const separator = document.createElement("span");
  const child = document.createElement("i");
  const direction = document.createElement("span");
  label.className = "review-placement-label";
  label.setAttribute("role", "img");
  label.setAttribute("aria-label", describePlacement(candidate));
  axis.className = `review-color-dot ${pair.axis}`;
  axisColumn.textContent = t("review.axisColumn", candidate.col + 1);
  separator.className = "review-placement-separator";
  separator.textContent = t("review.placementSeparator");
  child.className = `review-color-dot ${pair.child}`;
  direction.textContent = t("review.directions")[candidate.orientation];
  label.append(axis, axisColumn, separator, child, direction);
  return label;
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

const AMA_SIGNAL_IDS = [
  "potentialChain", "triggerHeight", "requiredPuyos", "extensionSpace",
  "quietLink2", "quietLink3", "formMatch", "shapeDeviation", "wells", "bumps",
  "boardLink2", "boardLink3", "row14Blockage", "sideBias", "garbageCount",
  "pairSplit", "immediateClear",
];

function amaSignalPresentation() {
  return Object.fromEntries(AMA_SIGNAL_IDS.map((id) => [id, t(`review.signal.${id}`)]));
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatSignalCalculation(signal) {
  return `${formatNumber(signal.rawValue)} × ${formatNumber(signal.weight)} = ${formatSigned(signal.contribution)}`;
}

function capitalizeColor(color) {
  return color ? t(`color.${color}`) : "—";
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
  reviewUserBoardStateEl.textContent = t("review.resolvedEvidence");
  reviewAmaBoardStateEl.textContent = t("review.resolvedEvidence");
  reviewUserBoardEl.setAttribute(
    "aria-label",
    `${t("review.yourMove")}・${t("review.resolvedEvidence")}`,
  );
  reviewAmaBoardEl.setAttribute(
    "aria-label",
    `${t("review.amaChoice")}・${t("review.resolvedEvidence")}`,
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
  summary.setAttribute("aria-label", `${t("app.help")}：${label}`);
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
  [[t("review.you"), "user", userValue], [t("review.ama"), "ama", amaValue]].forEach(
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
    reviewFutureSummaryEl.textContent = t("review.potentialUnavailable");
    return;
  }
  const comparison = compareAmaFutureProfiles(
    evaluation.userStats,
    evaluation.bestStats,
  );
  const potentialText = comparison.potentialLeader === "tied"
    ? t("review.potentialTied")
    : comparison.potentialLeader === "user"
      ? t("review.potentialYou")
      : t("review.potentialAma");
  const stabilityText = comparison.stabilityLeader === "similar"
    ? t("review.stabilitySimilar")
    : comparison.stabilityLeader === "user"
      ? t("review.stabilityYou")
      : comparison.stabilityLeader === "ama"
        ? t("review.stabilityAma")
        : t("review.stabilityUnavailable");
  reviewFutureSummaryEl.textContent = `${potentialText} · ${stabilityText}`;
  appendComparisonMetric({
    container: reviewFutureMetricsEl,
    label: t("review.potential"),
    help: t("review.signal.potentialChain")[1],
    userValue: evaluation.userStats.mean,
    amaValue: evaluation.bestStats.mean,
    format: (value) => new Intl.NumberFormat(getLocale() === "ja" ? "ja-JP" : "en-US", { maximumFractionDigits: 1 }).format(value),
  });
  appendComparisonMetric({
    container: reviewFutureMetricsEl,
    label: t("review.variation"),
    help: t("review.future"),
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
      ? t("review.probe", probe.chainCount, probe.requiredPuyos, t(`color.${probe.color}`), probe.column + 1)
      : t("review.probeNone");
    insights.push({
      title: t("review.probeTitle"),
      body: t("review.probeComparison", describe(userProbe), describe(amaProbe)),
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
  const differences = Object.entries(amaSignalPresentation())
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
  title.textContent = t("review.largestGaps");
  legend.replaceChildren();
  legend.append(Object.assign(document.createElement("i"), { className: "review-legend-user" }), document.createTextNode(t("review.you")), Object.assign(document.createElement("i"), { className: "review-legend-ama" }), document.createTextNode(t("review.ama")));
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
      action.textContent = t("review.evidence");
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
      t("review.probeComparison", `${meaning} ${formatSignalCalculation(user)}`, formatSignalCalculation(ama)),
      action,
    ));
    track.className = "review-contribution-track";
    fill.className = `review-contribution-fill ${edge > 0 ? "user" : "ama"}`;
    fill.style.setProperty("--edge-width", `${Math.abs(edge) / scale * 50}%`);
    value.className = "review-contribution-value";
    value.textContent = formatNumber(Math.abs(edge));
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
      label: t("review.immediatePriority"),
      help: t("review.evaluation"),
      userValue: userPriority,
      amaValue: amaPriority,
      format: formatNumber,
    });
    renderContributionChart(
      userDiagnostic,
      amaDiagnostic,
    );
  } else {
    reviewEvaluationSummaryEl.textContent = t("review.excluded");
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
  [t("review.feature"), t("review.you"), t("review.ama")].forEach((text) => {
    const cell = document.createElement("span");
    cell.textContent = text;
    header.append(cell);
  });
  reviewSignalTableEl.append(header);
  Object.entries(amaSignalPresentation()).forEach(([id, [label, meaning]]) => {
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
      show.textContent = t("review.evidence");
      show.addEventListener("click", () =>
        renderDiagnosticEvidence(
          userDiagnostic,
          amaDiagnostic,
          id,
        ));
    }
    description.append(name, createReviewHelp(
      label,
      t("review.probeComparison", `${meaning} ${formatSignalCalculation(user)}`, formatSignalCalculation(ama)),
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

function appendReviewStat(container, value, label, { inline = false } = {}) {
  const stat = document.createElement("article");
  stat.className = `review-stat${inline ? " review-stat-inline" : ""}`;
  const strong = document.createElement("strong");
  strong.textContent = value;
  const labelGroup = document.createElement("span");
  const small = document.createElement("small");
  small.textContent = label;
  labelGroup.className = "review-stat-label";
  labelGroup.append(small);
  stat.append(...(inline ? [labelGroup, strong] : [strong, labelGroup]));
  container.append(stat);
}

function appendReviewRange(stats, label) {
  const range = document.createElement("span");
  range.className = "review-range";
  range.textContent = label;
  const value = document.createElement("strong");
  value.textContent = stats
    ? `${formatNumber(stats.minimum)}–${formatNumber(stats.maximum)}`
    : "—";
  range.append(value);
  reviewRangesEl.append(range);
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
    [[t("review.you"), "user", userScore], [t("review.ama"), "ama", amaScore]].forEach(
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
        value.textContent = formatNumber(score);
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
    reviewReplayPairEl.setAttribute("aria-label", t("review.replayComplete"));
    return;
  }
  reviewReplayPairEl.setAttribute(
    "aria-label",
    t("review.replayPair", capitalizeColor(pair.axis), capitalizeColor(pair.child)),
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
    ? t("review.replayResult", state.replay.chainCount, state.replay.score)
    : t("review.replayHand", state.handIndex + 1, state.replay.hands.length);
  resetReviewReplayButton.disabled = state.busy || state.handIndex === 0;
  nextReviewReplayButton.disabled = state.busy || state.playing || complete;
  playReviewReplayButton.disabled = state.busy && !state.playing;
  playReviewReplayButton.textContent = state.playing ? t("review.pause") : t("review.play");
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
  reviewReplayStatusEl.textContent = t("review.replayPlaced", state.handIndex + 1);
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
      reviewReplayStatusEl.textContent = t("review.replayChain", state.handIndex + 1, chain);
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

function closeReviewRankingPreview() {
  reviewRankingPreviewEl.hidden = true;
  reviewRankingPreviewSourceEl.textContent = "";
  reviewRankingPreviewBoardEl.replaceChildren();
  reviewRankingBodyEl.querySelectorAll("button").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
}

function showReviewRankingPreview(row, turn, button) {
  const preview = dropTsumo(
    turn.beforeBoard,
    turn.current,
    row.candidate.col,
    row.candidate.orientation,
    turn.beforeRow14,
  );
  if (!preview) return;
  reviewRankingBodyEl.querySelectorAll("button").forEach((candidateButton) => {
    candidateButton.setAttribute(
      "aria-pressed",
      candidateButton === button ? "true" : "false",
    );
  });
  reviewRankingPreviewSourceEl.replaceChildren(
    document.createTextNode(`${t("review.rank").toUpperCase()} ${row.rank} · `),
    createPlacementLabel(row.candidate, turn.current),
  );
  renderReviewMiniBoard(
    reviewRankingPreviewBoardEl,
    preview.board,
    preview.row14,
    preview.cells,
  );
  reviewRankingPreviewEl.hidden = false;
  reviewRankingPreviewEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderReviewRanking(candidates, turn) {
  closeReviewRankingPreview();
  reviewRankingBodyEl.replaceChildren();
  const rows = createAmaRankingRows(candidates);
  reviewRankingSectionEl.hidden = rows.length === 0;
  for (const row of rows) {
    const tableRow = document.createElement("tr");
    const rank = document.createElement("th");
    rank.scope = "row";
    rank.textContent = String(row.rank);
    const move = document.createElement("td");
    const moveContent = document.createElement("div");
    moveContent.className = "review-ranking-move";
    const label = createPlacementLabel(row.candidate, turn.current);
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.textContent = t("review.preview");
    previewButton.setAttribute("aria-pressed", "false");
    previewButton.setAttribute(
      "aria-label",
      `${t("review.preview")} ${t("review.rank")} ${row.rank}: ${label.textContent}`,
    );
    previewButton.addEventListener("click", () => {
      showReviewRankingPreview(row, turn, previewButton);
    });
    moveContent.append(label, previewButton);
    move.append(moveContent);
    const averageScore = document.createElement("td");
    averageScore.textContent = formatNumber(Math.round(row.averageScore));
    tableRow.append(rank, move, averageScore);
    reviewRankingBodyEl.append(tableRow);
  }
}

function renderReviewRankingChart(candidates, userRank) {
  reviewRankingBarsEl.replaceChildren();
  reviewRankingChartEl.hidden = candidates.length === 0;
  reviewRankingLastRankEl.textContent = candidates.length
    ? String(candidates.length)
    : "";
  if (!candidates.length) {
    reviewRankingMaxScoreEl.textContent = "";
    reviewRankingMidScoreEl.textContent = "";
    reviewRankingBarsEl.removeAttribute("aria-label");
    return;
  }

  const scores = candidates.map((candidate) => candidate.averageScore);
  const highestScore = Math.max(...scores, 1);
  reviewRankingMaxScoreEl.textContent = formatNumber(highestScore);
  reviewRankingMidScoreEl.textContent = formatNumber(highestScore / 2);
  reviewRankingBarsEl.style.setProperty("--ranking-count", candidates.length);
  reviewRankingBarsEl.setAttribute(
    "aria-label",
    `${t("review.score")} (${t("review.rank")} 1–${candidates.length}). ` +
      `${t("review.yourMove")}：${userRank ?? "—"}. ` +
      scores.map((score, index) => `${t("review.rank")} ${index + 1}: ${formatNumber(score)}.`).join(" "),
  );
  scores.forEach((score, index) => {
    const bar = document.createElement("span");
    const rank = index + 1;
    bar.className = "review-ranking-bar";
    if (rank === userRank) bar.classList.add("user");
    bar.style.setProperty("--bar-height", `${Math.max((score / highestScore) * 100, 2)}%`);
    bar.title = `${t("review.rank")} ${rank}: ${formatNumber(score)} ${t("review.score")}${rank === userRank ? ` (${t("review.yourMove")})` : ""}`;
    bar.setAttribute("aria-hidden", "true");
    reviewRankingBarsEl.append(bar);
  });
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
  reviewReplaySourceEl.textContent = source === "user" ? t("review.yourSource") : t("review.amaSource");
  reviewReplayMetaEl.replaceChildren();
  reviewReplayMetaEl.append(createFuturePairingIcon(selection.branch));
  const score = document.createElement("strong");
  score.textContent = t("review.replayResult", 0, selection.score).replace(/^0(?:-chain|連鎖)[・ ·]*/, "");
  const tie = document.createElement("span");
  tie.textContent = selection.tiedBranches.length > 1
    ? t("review.bestIn", selection.tiedBranches.length)
    : t("review.bestOf");
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
  reviewReplaySourceEl.textContent = source === "user" ? t("review.yourSource") : t("review.amaSource");
  reviewReplayMetaEl.textContent = t("review.tracing");
  reviewReplayPairEl.replaceChildren();
  reviewReplayBoardEl.replaceChildren();
  reviewReplayStatusEl.textContent = t("review.wait");
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
    reviewReplayMetaEl.textContent = t("review.replayUnavailable");
    reviewReplayStatusEl.textContent = t("review.replayInvalid");
  } finally {
    isSuggesting = false;
    render();
  }
}

function closeLastMoveReview() {
  closeReviewReplay();
  closeReviewRankingPreview();
  reviewReplayContext = null;
  reviewOverlay.hidden = true;
}

function displayLastMoveReview(
  evaluation,
  turn,
  diagnostics = null,
  allCandidates = [],
) {
  reviewOverlay.querySelectorAll("details").forEach((details) => {
    details.open = false;
  });
  closeReviewReplay();
  reviewReplayContext = {
    evaluation,
    turn,
    diagnostics,
    allCandidates,
    colors: [...tokopuyoSession.pattern.colors],
    replays: new Map(),
  };
  reviewTitleEl.textContent = t("review.title");
  const closeAggregate =
    evaluation.verdict === "different-choice" &&
    evaluation.aggregateRetention >= 0.9;
  reviewSummaryEl.textContent = `${t(`review.summary.${evaluation.verdict}`)}${
    closeAggregate ? ` ${t("review.withinTen")}` : ""
  }`;
  reviewSummaryEl.hidden = !reviewSummaryEl.textContent;
  reviewRankingStatEl.replaceChildren();
  appendReviewStat(
    reviewRankingStatEl,
    evaluation.rank ? `${evaluation.rank}/${evaluation.legalCount}` : "—",
    t("review.yourRank"),
    { inline: true },
  );
  appendReviewStat(
    reviewRankingStatEl,
    evaluation.userStats ? formatNumber(evaluation.userStats.mean) : "—",
    t("review.yourScore"),
    { inline: true },
  );
  renderReviewRankingChart(allCandidates, evaluation.rank);
  reviewRangesEl.replaceChildren();
  appendReviewRange(evaluation.userStats, t("review.foundRange"));
  appendReviewRange(evaluation.bestStats, t("review.amaRange"));
  renderFutureCoaching(evaluation);
  renderReviewBranchChart(evaluation.branchComparisons);
  const userBestBranch = selectBestAmaBranch(evaluation.user);
  const amaBestBranch = selectBestAmaBranch(evaluation.best);
  reviewUserReplayButton.disabled = !userBestBranch || userBestBranch.score <= 0;
  reviewAmaReplayButton.disabled = !amaBestBranch || amaBestBranch.score <= 0;
  reviewUserReplayButton.title = reviewUserReplayButton.disabled
    ? t("review.potentialUnavailable")
    : t("review.replay");
  reviewAmaReplayButton.title = reviewAmaReplayButton.disabled
    ? t("review.potentialUnavailable")
    : t("review.replay");
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
  reviewUserBoardStateEl.textContent = "";
  reviewAmaBoardStateEl.textContent = "";
  reviewUserBoardEl.setAttribute(
    "aria-label",
    `${t("review.yourMove")}・${t("review.preview")}`,
  );
  reviewAmaBoardEl.setAttribute(
    "aria-label",
    `${t("review.amaChoice")}・${t("review.preview")}`,
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
  renderReviewRanking(allCandidates, turn);
  renderEvaluationCoaching(diagnostics?.user, diagnostics?.ama);
  reviewOverlay.hidden = false;
  closeReviewButton.focus();
}

function displayLastMoveReviewError() {
  closeReviewReplay();
  closeReviewRankingPreview();
  reviewReplayContext = null;
  reviewTitleEl.textContent = t("review.unavailable");
  reviewSummaryEl.textContent = t("review.summary.unavailable");
  reviewSummaryEl.hidden = false;
  reviewRankingStatEl.replaceChildren();
  renderReviewRankingChart([], null);
  reviewRangesEl.replaceChildren();
  reviewFutureSummaryEl.textContent = "";
  reviewFutureMetricsEl.replaceChildren();
  renderReviewBranchChart(null);
  renderEvaluationCoaching(null, null);
  reviewUserBoardStateEl.textContent = "";
  reviewAmaBoardStateEl.textContent = "";
  reviewUserBoardEl.replaceChildren();
  reviewAmaBoardEl.replaceChildren();
  reviewRankingBodyEl.replaceChildren();
  reviewRankingSectionEl.hidden = true;
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
      statusEl.textContent = t("message.tokopuyoSuggestionNone");
      return;
    }
    cacheAmaAnalysis(key, allCandidates);
    tokopuyoSuggestionSession = { key, candidates, index: 0 };
    displayTokopuyoSuggestion(candidates[0], 0, candidates.length);
  } catch (error) {
    console.error("Tokopuyo suggestion search failed", error);
    statusEl.textContent = t("message.suggestionError");
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
    showToast(t("message.tokopuyoGameOver"), 3000);
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
  setStatus(t("message.flickChoose"));
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
    button.ariaLabel = t("message.placed", t(`color.${tool}`));

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
      setStatus(t("message.optionSelected"));
    });
    flickMenu.append(button);
  });

  const deleteIcon = document.createElement("span");
  deleteIcon.className = "flick-delete";
  deleteIcon.textContent = "⌫";
  deleteIcon.ariaLabel = t("message.deleteWithoutFlicking");
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
        ? t("message.erased")
        : t("message.placed", t(`color.${selectedTool}`)),
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
  showToast(t("message.scoreSummary", cumulativeScore, chainCount));
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
  showToast(t("message.cleared"));
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
      t("message.tokopuyoReset", tokopuyoSession.pattern.number),
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
  showToast(t("message.reset"));
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
languageSelect.value = getLocale();
languageSelect.addEventListener("change", () => {
  setLocale(languageSelect.value);
  localizeDocument();
  if (reviewReplayContext && !reviewOverlay.hidden) {
    displayLastMoveReview(
      reviewReplayContext.evaluation,
      reviewReplayContext.turn,
      reviewReplayContext.diagnostics,
      reviewReplayContext.allCandidates,
    );
  }
  render();
});
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
closeReviewRankingPreviewButton.addEventListener("click", closeReviewRankingPreview);
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

setLocale(getLocale());
localizeDocument();
render();
updatePaletteButton();
