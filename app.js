import {
  COLS,
  ROWS,
  HIDDEN_ROWS,
  emptyBoard,
  clone,
  findGroups,
  applyGravity,
  simulate,
} from "./engine.js";

const boardEl = document.querySelector("#board");
const boardWrap = document.querySelector(".board-wrap");
const statusEl = document.querySelector("#status");
const chainEl = document.querySelector("#chainNumber");
const flickMenu = document.querySelector("#flickMenu");
const toastEl = document.querySelector("#toast");
const helpOverlay = document.querySelector("#helpOverlay");
const closeHelpButton = document.querySelector("#closeHelp");

let board = emptyBoard();
let selectedTool = "red";
let history = [];
let future = [];
let initialBoard = clone(board);
let isSimulating = false;
let fiveColorMode = false;
let garbageMode = false;
let paletteIndex = 0;

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
    en: (count, puyos) => `Chain ${count}: ${puyos} puyos clearing`,
    ja: (count, puyos) => `${count}連鎖目：${puyos}個消えます`,
  },
  complete: {
    en: (count, puyos) =>
      `${count} chain${count === 1 ? "" : "s"}! ${puyos} puyos cleared`,
    ja: (count, puyos) => `${count}連鎖！ ${puyos}個のぷよが消えました`,
  },
  fiveColorMode: {
    en: (enabled) => `Five-color mode ${enabled ? "on" : "off"}`,
    ja: (enabled) => `5色モードを${enabled ? "オン" : "オフ"}にしました`,
  },
  garbageMode: {
    en: (enabled) => `Garbage mode ${enabled ? "on" : "off"}`,
    ja: (enabled) => `お邪魔ありを${enabled ? "オン" : "オフ"}にしました`,
  },
  palette: {
    en: (index) => `Four-color palette ${index + 1} of 5`,
    ja: (index) => `4色パレット ${index + 1}/5`,
  },
};

function getFlickTools() {
  return [
    ...(fiveColorMode ? colorFlickTools : fourColorPalettes[paletteIndex]),
    ...(garbageMode ? ["garbage"] : []),
  ];
}

let flick = {
  row: -1,
  col: -1,
  startX: 0,
  startY: 0,
  moved: false,
  choice: null,
  tools: [],
  suppressClick: false,
};

function render() {
  boardEl.innerHTML = "";

  board.forEach((row, r) =>
    row.forEach((color, c) => {
      const cell = document.createElement("button");
      const areaClass = r < HIDDEN_ROWS ? " hidden-cell" : "";
      const boundaryClass = r === HIDDEN_ROWS - 1 ? " hidden-boundary" : "";

      cell.className = `cell${areaClass}${boundaryClass}`;
      cell.type = "button";
      cell.role = "gridcell";
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

  document.querySelector("#undo").disabled = !history.length;
  document.querySelector("#redo").disabled = !future.length;
}

function editCell(row, col) {
  if (isSimulating) return;

  const nextValue = selectedTool === "erase" ? null : selectedTool;
  if (board[row][col] === nextValue) return;

  history.push(clone(board));
  future = [];
  board[row][col] = nextValue;
  render();
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

function setMode(mode, enabled) {
  if (mode === "colors") fiveColorMode = enabled;
  if (mode === "garbage") garbageMode = enabled;

  const button = document.querySelector(
    mode === "colors" ? "#toggleFiveColors" : "#toggleGarbage",
  );
  button.classList.toggle("active", enabled);
  button.ariaPressed = String(enabled);

  if (flick.row >= 0) {
    closeFlick();
    flick.row = -1;
  }

  showToast(
    localizedMessage(
      mode === "colors" ? messages.fiveColorMode : messages.garbageMode,
      enabled,
    ),
  );
  updatePaletteButton();
}

function updatePaletteButton() {
  const button = document.querySelector("#cyclePalette");
  const palette = fourColorPalettes[paletteIndex];
  button.disabled = fiveColorMode;
  button.innerHTML = `<span class="palette-icon" aria-hidden="true">${palette
    .map((color) => `<i class="${color}"></i>`)
    .join("")}</span>`;
}

function cyclePalette() {
  if (fiveColorMode) return;

  paletteIndex = (paletteIndex + 1) % fourColorPalettes.length;
  updatePaletteButton();
  showToast(localizedMessage(messages.palette, paletteIndex));
}

function undo() {
  if (!history.length || isSimulating) return;

  future.push(clone(board));
  board = history.pop();
  render();
  showToast(messages.undo[locale]);
}

function redo() {
  if (!future.length || isSimulating) return;

  history.push(clone(board));
  board = future.pop();
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

  const beforeSimulation = clone(board);
  board = applyGravity(board);
  render();
  const result = simulate(board);
  if (!result.chains) {
    if (!boardsEqual(beforeSimulation, board)) {
      history.push(beforeSimulation);
      future = [];
      render();
    }
    showToast(messages.noChain[locale]);
    return;
  }

  isSimulating = true;
  document.querySelector("#simulate").disabled = true;
  history.push(beforeSimulation);
  future = [];

  let step = 0;
  for (const round of result.rounds) {
    chainEl.textContent = String(++step);
    showToast(localizedMessage(messages.chain, step, round.count), 700);

    const cells = [...boardEl.children];
    findGroups(board)
      .flat()
      .forEach(([row, col]) =>
        cells[row * COLS + col].classList.add("clearing"),
      );

    await new Promise((resolve) => setTimeout(resolve, 420));
    board = applyGravity(round.state);
    render();
    await new Promise((resolve) => setTimeout(resolve, 280));
  }

  board = result.state;
  chainEl.textContent = String(result.chains);
  showToast(localizedMessage(messages.complete, result.chains, result.cleared), 2600);
  isSimulating = false;
  document.querySelector("#simulate").disabled = false;
  render();
}

function openFlick(row, col, event) {
  if (isSimulating) return;

  const tools = getFlickTools();

  flick = {
    row,
    col,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    choice: null,
    tools,
    suppressClick: false,
  };

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
  flickMenu
    .querySelectorAll(".flick-option")
    .forEach((button) => button.classList.remove("active"));
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

  const index = flickIndex(event.clientX, event.clientY);
  if (index >= 0) {
    flick.moved = true;
    flick.choice = index;
    highlightFlick(index);
  }
});

window.addEventListener("pointerup", () => {
  if (flick.row < 0) return;

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

window.addEventListener("pointercancel", () => {
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
document.querySelector("#clear").addEventListener("click", () => {
  if (isSimulating) return;

  if (board.every((row) => row.every((value) => value === null))) return;

  history.push(clone(board));
  future = [];
  board = emptyBoard();
  chainEl.textContent = "0";
  showToast(messages.cleared[locale]);
  render();
});
document.querySelector("#reset").addEventListener("click", () => {
  if (isSimulating) return;

  if (boardsEqual(board, initialBoard)) return;

  history = [];
  future = [];
  board = clone(initialBoard);
  chainEl.textContent = "0";
  showToast(messages.reset[locale]);
  render();
});
document.querySelector("#simulate").addEventListener("click", runSimulation);
document.querySelector("#toggleFiveColors").addEventListener("click", () => {
  setMode("colors", !fiveColorMode);
});
document.querySelector("#toggleGarbage").addEventListener("click", () => {
  setMode("garbage", !garbageMode);
});
document.querySelector("#cyclePalette").addEventListener("click", cyclePalette);
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

render();
updatePaletteButton();
