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
const statusEl = document.querySelector("#status");
const chainEl = document.querySelector("#chainNumber");
const flickMenu = document.querySelector("#flickMenu");
const boardCard = document.querySelector(".board-card");

let board = emptyBoard();
let selectedTool = "red";
let history = [];
let future = [];
let initialBoard = clone(board);
let isSimulating = false;

const flickTools = ["red", "green", "blue", "yellow", "purple", "erase"];
let flick = {
  row: -1,
  col: -1,
  startX: 0,
  startY: 0,
  moved: false,
  choice: null,
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
      cell.ariaLabel = `${r < HIDDEN_ROWS ? "隠しエリア " : ""}${ROWS - r}段目 ${
        c + 1
      }列目 ${color || "空き"}${
        r === HIDDEN_ROWS && c === 2 ? " 窒息点" : ""
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

  history.push(clone(board));
  future = [];
  board[row][col] = selectedTool === "erase" ? null : selectedTool;
  render();
}

function setTool(tool) {
  selectedTool = tool;

  document.querySelectorAll("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.ariaPressed = String(active);
  });
}

function undo() {
  if (!history.length || isSimulating) return;

  future.push(clone(board));
  board = history.pop();
  render();
}

function redo() {
  if (!future.length || isSimulating) return;

  history.push(clone(board));
  board = future.pop();
  render();
}

function setStatus(message) {
  statusEl.textContent = message;
}

async function runSimulation() {
  if (isSimulating) return;

  const result = simulate(board);
  if (!result.chains) {
    setStatus("消えるグループがありません");
    return;
  }

  isSimulating = true;
  document.querySelector("#simulate").disabled = true;
  history.push(clone(board));
  future = [];

  let step = 0;
  for (const round of result.rounds) {
    chainEl.textContent = String(++step);
    setStatus(`${step}連鎖目：${round.count}個消えます`);

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
  setStatus(`${result.chains}連鎖！ ${result.cleared}個のぷよが消えました`);
  isSimulating = false;
  document.querySelector("#simulate").disabled = false;
  render();
}

function openFlick(row, col, event) {
  if (isSimulating) return;

  flick = {
    row,
    col,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    choice: null,
    suppressClick: false,
  };

  const cardRect = boardCard.getBoundingClientRect();
  flickMenu.style.left = `${event.clientX - cardRect.left - boardCard.clientLeft}px`;
  flickMenu.style.top = `${event.clientY - cardRect.top - boardCard.clientTop}px`;
  flickMenu.hidden = false;
  setStatus("指をフリックして色を選択・離すと配置");
}

function flickIndex(x, y) {
  const dx = x - flick.startX;
  const dy = y - flick.startY;
  const distance = Math.hypot(dx, dy);

  if (distance < 24) return -1;

  const index = Math.round(
    (Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 3),
  );
  return (index % 6 + 6) % 6;
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

function buildFlickMenu() {
  flickTools.forEach((tool, index) => {
    const button = document.createElement("button");
    button.className = "flick-option";
    button.type = "button";
    button.dataset.tool = tool;
    button.ariaLabel = tool === "erase" ? "消しゴム" : `${tool}ぷよ`;

    if (tool === "erase") {
      button.textContent = "⌫";
    } else {
      button.append(document.createElement("i"));
    }

    const angle = -Math.PI / 2 + index * (Math.PI / 3);
    button.style.left = `calc(50% + ${Math.cos(angle) * 62}px)`;
    button.style.top = `calc(50% + ${Math.sin(angle) * 62}px)`;
    button.addEventListener("click", () => {
      setTool(tool);
      flick.suppressClick = true;
      closeFlick();
      setStatus("色を選択しました。盤面をタップしてください");
    });
    flickMenu.append(button);
  });
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
    selectedTool = flickTools[flick.choice];
    editCell(flick.row, flick.col);
    flick.suppressClick = true;
    setStatus(
      selectedTool === "erase"
        ? "消しゴムで消去しました"
        : `${selectedTool}ぷよを配置しました`,
    );
  } else {
    setStatus("色を選択しました。盤面をタップしてください");
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

  history.push(clone(board));
  future = [];
  board = emptyBoard();
  chainEl.textContent = "0";
  setStatus("盤面をクリアしました");
  render();
});
document.querySelector("#reset").addEventListener("click", () => {
  if (isSimulating) return;

  history = [];
  future = [];
  board = clone(initialBoard);
  chainEl.textContent = "0";
  setStatus("初期盤面に戻しました");
  render();
});
document.querySelector("#simulate").addEventListener("click", runSimulation);

buildFlickMenu();
render();
