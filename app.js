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
import { ORIENTATION, pairCells } from "./tokopuyo/pair-engine.js";
import {
  createTokopuyoGesture,
  tokopuyoStartColumnAt,
  updateTokopuyoGesture,
} from "./tokopuyo/gesture.js";
import { randomSeed } from "./tokopuyo/queue.js";
import {
  commitPairAtPlacement,
  createSession,
  previewPairAtPlacement,
  previewHands,
  redoSession,
  undoSession,
} from "./tokopuyo/session.js";

const boardEl = document.querySelector("#board");
const boardCard = document.querySelector(".board-card");
const boardWrap = document.querySelector(".board-wrap");
const statusEl = document.querySelector("#status");
const chainEl = document.querySelector("#chainNumber");
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
const drawingHelp = document.querySelector("#drawingHelp");
const tokopuyoHelp = document.querySelector("#tokopuyoHelp");
const tokopuyoCancelTargets = document.querySelector(
  "#tokopuyoCancelTargets",
);

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
let tokopuyoPreviewCells = null;
const suggestionController = new SuggestionController();

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
  orientation: ORIENTATION.UP,
  gesture: null,
  rotationBase: ORIENTATION.UP,
  requestedRotationSteps: 0,
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
  const displayCells =
    tokopuyoPreviewCells || pairCells(tokopuyoSession.activePair);
  for (const { row, col, color, role } of displayCells) {
    const puyo = document.createElement("span");
    puyo.className = `active-puyo ${color}`;
    puyo.ariaLabel = `${role === "axis" ? "Axis" : "Child"} ${color} puyo; drag to preview placement`;
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
}

function updateModeUi() {
  const isTokopuyo = appMode === "tokopuyo";
  const resetButton = document.querySelector("#reset");
  document.body.dataset.mode = appMode;
  document.querySelectorAll(".drawing-only").forEach((element) => {
    element.hidden = isTokopuyo;
  });
  tokopuyoPreview.hidden = !isTokopuyo;
  drawingHelp.hidden = isTokopuyo;
  tokopuyoHelp.hidden = !isTokopuyo;

  toggleAppModeButton.ariaLabel = isTokopuyo
    ? "Return to Drawing mode"
    : "Open Tokopuyo mode";
  toggleAppModeButton.title = toggleAppModeButton.ariaLabel;
  toggleAppModeButton.innerHTML = isTokopuyo
    ? '<span class="drawing-mode-icon" aria-hidden="true">✎</span>'
    : '<span class="mode-pair-icon" aria-hidden="true"><i></i><i></i></span>';
  resetButton.ariaLabel = isTokopuyo ? "Start a new Tokopuyo pattern" : "Reset";
  resetButton.title = resetButton.ariaLabel;

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
      cell.addEventListener("pointerdown", (event) =>
        openFlick(r, c, event),
      );
      cell.addEventListener("click", () => {
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

      const suggestion =
        appMode === "drawing" ? suggestionMarks.get(`${r},${c}`) : null;
      if (suggestion) {
        const marker = document.createElement("span");
        marker.className = `suggestion-marker ${suggestion.color}${
          suggestion.isTrigger ? " trigger" : ""
        }`;
        marker.ariaHidden = "true";
        cell.append(marker);
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
  document.querySelector("#undo").disabled = appMode === "tokopuyo"
    ? !tokopuyoSession?.history.length || tokopuyoBusy
    : !history.length || isSimulating || isSuggesting;
  document.querySelector("#redo").disabled = appMode === "tokopuyo"
    ? !tokopuyoSession?.future.length || tokopuyoBusy
    : !future.length || isSimulating || isSuggesting;
  document.querySelector("#simulate").disabled = isSimulating || isSuggesting;
  document.querySelector("#reset").disabled = appMode === "tokopuyo"
    ? tokopuyoBusy
    : isSimulating || isSuggesting;
  document.querySelector("#suggest").disabled = isSimulating || isSuggesting;
  toggleAppModeButton.disabled =
    isSimulating || isSuggesting || Boolean(tokopuyoSession?.busy);
  suggestionLoadingEl.hidden = !isSuggesting;
  boardEl.setAttribute(
    "aria-busy",
    String(isSuggesting || (appMode === "tokopuyo" && tokopuyoBusy)),
  );
  chainEl.textContent = String(
    appMode === "tokopuyo"
      ? tokopuyoDisplayedChain ?? tokopuyoSession?.chainCount ?? 0
      : chainCount,
  );
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
    if (!tokopuyoSession || !undoSession(tokopuyoSession)) return;
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
    if (!tokopuyoSession || !redoSession(tokopuyoSession)) return;
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
    showToast(
      localizedMessage(messages.chain, step, round.count, round.score, cumulativeScore),
      1100,
    );

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
  showToast(
    `${localizedMessage(messages.complete, result.chains, result.cleared)} ${localizedMessage(messages.score, result.chains, result.score)}`,
    2600,
  );
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
  showToast(
    localizedMessage(
      messages.suggestion,
      index + 1,
      total,
      candidate.chains,
      suggestionMarks.size,
      candidate.chainGain,
    ),
    2600,
  );
}

async function showSuggestion() {
  if (isSimulating || isSuggesting) return;

  if (!isSettled(board)) {
    showToast(messages.suggestionFloating[locale]);
    return;
  }

  if (findClearingCells(board).length) {
    showToast(messages.suggestionAlreadyFiring[locale]);
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
  showToast(messages.suggestionSearching[locale], 1300);
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
      showToast(messages.suggestionNone[locale]);
      return;
    }
    suggestionSession = { boardKey, candidates, index: 0, stale: false };
    displaySuggestion(candidates[0], 0, candidates.length);
  } catch (error) {
    console.error("Suggestion search failed", error);
    showToast(messages.suggestionError[locale]);
  } finally {
    isSuggesting = false;
    render();
  }
}

function openTokopuyoFlick(event, targetCol) {
  if (
    appMode !== "tokopuyo" ||
    !tokopuyoSession ||
    tokopuyoSession.busy ||
    tokopuyoSession.gameOver
  ) return;

  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  const spawnCol = tokopuyoSession.activePair.axis.col;
  const orientation = tokopuyoSession.activePair.orientation;
  const cellSize = boardEl.getBoundingClientRect().width / COLS;
  const gestureOptions = {
    cellSize,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
  const targetPreview = previewPairAtPlacement(
    tokopuyoSession,
    targetCol,
    orientation,
  );
  const col = targetPreview ? targetCol : spawnCol;
  tokopuyoPreviewCells =
    targetPreview ||
    previewPairAtPlacement(tokopuyoSession, spawnCol, orientation);
  flick = {
    kind: "tokopuyo",
    row: 0,
    col,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    choice: null,
    tools: [],
    suppressClick: true,
    pointerId: event.pointerId,
    intent: "straight",
    orientation,
    gesture: createTokopuyoGesture(
      event.clientX,
      event.clientY,
      gestureOptions,
    ),
    cellSize,
    dragBaseCol: col,
    rotationBase: orientation,
    requestedRotationSteps: 0,
  };

  flickMenu.hidden = true;
  flickMenu.classList.remove("tokopuyo-flick-menu");
  tokopuyoCancelTargets.hidden = false;
  tokopuyoCancelTargets.style.setProperty(
    "--cancel-target-size",
    `${Math.max(56, cellSize * 1.35)}px`,
  );
  renderActivePair();
}

function tryTokopuyoPreview(col, orientation) {
  const preview = previewPairAtPlacement(tokopuyoSession, col, orientation);
  if (!preview) return false;
  flick.col = col;
  flick.orientation = orientation;
  tokopuyoPreviewCells = preview;
  renderActivePair();
  return true;
}

function setTokopuyoCancelCorner(corner) {
  tokopuyoCancelTargets.querySelectorAll("[data-corner]").forEach((target) => {
    target.classList.toggle("active", target.dataset.corner === corner);
  });
  tokopuyoPreviewCells = corner
    ? pairCells(tokopuyoSession.activePair)
    : previewPairAtPlacement(tokopuyoSession, flick.col, flick.orientation);
  renderActivePair();
}

function normalizedOrientation(orientation) {
  return ((orientation % 4) + 4) % 4;
}

async function dropTokopuyoPair(targetCol, orientation) {
  if (!tokopuyoSession || tokopuyoSession.busy) return;
  const committed = commitPairAtPlacement(
    tokopuyoSession,
    targetCol,
    orientation,
  );
  if (!committed) return;

  tokopuyoSession.busy = true;
  tokopuyoBoardOverride = committed.lockedBoard;
  tokopuyoDisplayedChain = 0;
  render();

  let step = 0;
  for (const round of committed.result.rounds) {
    tokopuyoDisplayedChain = ++step;
    showToast(
      localizedMessage(
        messages.chain,
        step,
        round.count,
        round.score,
        round.cumulativeScore,
      ),
      1100,
    );
    const cells = [...boardEl.children];
    findClearingCells(tokopuyoBoardOverride).forEach(([row, col]) => {
      cells[row * COLS + col]?.classList.add("clearing");
    });
    await new Promise((resolve) => setTimeout(resolve, 420));
    tokopuyoBoardOverride = applyGravity(round.state);
    render();
    await new Promise((resolve) => setTimeout(resolve, 280));
  }

  tokopuyoBoardOverride = null;
  tokopuyoDisplayedChain = null;
  tokopuyoSession.busy = false;
  render();

  if (committed.result.chains) {
    showToast(
      `${localizedMessage(messages.complete, committed.result.chains, committed.result.cleared)} ${localizedMessage(messages.score, committed.result.chains, committed.result.score)}`,
      2600,
    );
  }
  if (tokopuyoSession.gameOver) {
    showToast(messages.tokopuyoGameOver[locale], 3000);
  }
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
  if (appMode === "tokopuyo") return;
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
  const wasTokopuyo = flick.kind === "tokopuyo";
  flickMenu.hidden = true;
  flickMenu.classList.remove("tokopuyo-flick-menu");
  flickMenu
    .querySelectorAll(".flick-option")
    .forEach((button) => button.classList.remove("active"));
  if (wasTokopuyo) {
    tokopuyoCancelTargets.hidden = true;
    tokopuyoCancelTargets
      .querySelectorAll("[data-corner]")
      .forEach((target) => target.classList.remove("active"));
    tokopuyoPreviewCells = null;
    renderActivePair();
  }
}

function buildFlickMenu(tools) {
  flickMenu.innerHTML = "";
  flickMenu.classList.remove("tokopuyo-flick-menu");

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

boardCard.addEventListener("pointerdown", (event) => {
  if (appMode !== "tokopuyo" || flick.row >= 0) return;

  const targetCol = tokopuyoStartColumnAt(
    event.clientX,
    event.clientY,
    boardEl.getBoundingClientRect(),
    COLS,
  );
  if (targetCol === null) return;

  openTokopuyoFlick(event, targetCol);
});

window.addEventListener("pointermove", (event) => {
  if (flick.row < 0) return;
  if (event.pointerId !== flick.pointerId) return;

  if (flick.kind === "tokopuyo") {
    event.preventDefault();
    const update = updateTokopuyoGesture(
      flick.gesture,
      event.clientX,
      event.clientY,
      {
        cellSize: flick.cellSize,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
    );
    flick.gesture = update.state;
    flick.moved = true;

    if (update.cancelChanged) {
      setTokopuyoCancelCorner(update.state.cancelCorner);
      return;
    }
    if (update.state.cancelCorner) return;

    if (update.columnDelta) {
      const requestedCol = Math.max(
        0,
        Math.min(COLS - 1, flick.dragBaseCol + update.state.columnSteps),
      );
      const direction = Math.sign(requestedCol - flick.col);
      while (direction && flick.col !== requestedCol) {
        const candidate = flick.col + direction;
        if (!tryTokopuyoPreview(candidate, flick.orientation)) break;
      }
    }

    if (
      update.rotationSteps !== null &&
      update.rotationSteps !== flick.requestedRotationSteps
    ) {
      flick.requestedRotationSteps = update.rotationSteps;
      tryTokopuyoPreview(
        flick.col,
        normalizedOrientation(flick.rotationBase + update.rotationSteps),
      );
    }
    return;
  }

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

  if (flick.kind === "tokopuyo") {
    const targetCol = flick.col;
    const orientation = flick.orientation;
    const cancelled = Boolean(flick.gesture.cancelCorner);
    closeFlick();
    flick.row = -1;
    if (!cancelled) dropTokopuyoPair(targetCol, orientation);
    return;
  }

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
document.querySelector("#chainBadge").addEventListener("click", () => {
  const chains =
    appMode === "tokopuyo" ? tokopuyoSession?.chainCount || 0 : chainCount;
  const score =
    appMode === "tokopuyo"
      ? tokopuyoSession?.cumulativeScore || 0
      : cumulativeScore;
  showToast(localizedMessage(messages.score, chains, score));
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
    if (tokopuyoSession?.busy) return;
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
document.querySelector("#toggleGarbage").addEventListener("click", () => {
  setGarbageMode(!garbageMode);
});
document.querySelector("#cyclePalette").addEventListener("click", cyclePalette);
toggleAppModeButton.addEventListener("click", switchAppMode);
document.querySelector("#help").addEventListener("click", () => {
  helpOverlay.hidden = false;
});
closeHelpButton.addEventListener("click", closeHelp);
helpOverlay.addEventListener("click", (event) => {
  if (event.target === helpOverlay) closeHelp();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !helpOverlay.hidden) closeHelp();
});
window.addEventListener("resize", () => {
  if (appMode === "tokopuyo") renderActivePair();
});

render();
updatePaletteButton();
