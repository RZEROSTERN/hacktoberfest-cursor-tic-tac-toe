const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const NAMES = [
  "top left",
  "top center",
  "top right",
  "middle left",
  "center",
  "middle right",
  "bottom left",
  "bottom center",
  "bottom right",
];

const MARK = {
  X: '<path d="M28 28 L72 72 M72 28 L28 72" />',
  O: '<circle cx="50" cy="50" r="22" />',
};

function winnerOf(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { player: board[a], line };
    }
  }
  return null;
}

function isFull(board) {
  return board.every(Boolean);
}

function bestMove(board) {
  let bestScore = -Infinity;
  const moves = [];
  for (let i = 0; i < 9; i += 1) {
    if (board[i]) continue;
    board[i] = "O";
    const score = minimax(board, 0, false);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      moves.length = 0;
      moves.push(i);
    } else if (score === bestScore) {
      moves.push(i);
    }
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

function minimax(board, depth, isMachine) {
  const found = winnerOf(board);
  if (found?.player === "O") return 10 - depth;
  if (found?.player === "X") return depth - 10;
  if (isFull(board)) return 0;

  if (isMachine) {
    let best = -Infinity;
    for (let i = 0; i < 9; i += 1) {
      if (board[i]) continue;
      board[i] = "O";
      best = Math.max(best, minimax(board, depth + 1, false));
      board[i] = null;
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 9; i += 1) {
    if (board[i]) continue;
    board[i] = "X";
    best = Math.min(best, minimax(board, depth + 1, true));
    board[i] = null;
  }
  return best;
}

const api = { LINES, winnerOf, isFull, bestMove, minimax };
if (typeof module !== "undefined") module.exports = api;

function boot() {
  const boardEl = document.querySelector("#board");
  const statusEl = document.querySelector("#status");
  const scoreX = document.querySelector("#score-x");
  const scoreO = document.querySelector("#score-o");
  const scoreD = document.querySelector("#score-d");
  const labelX = document.querySelector("#label-x");
  const labelO = document.querySelector("#label-o");
  const hintEl = document.querySelector("#hint");
  const undoBtn = document.querySelector("#undo");
  const againBtn = document.querySelector("#again");
  const resetBtn = document.querySelector("#reset");
  const themeBtn = document.querySelector("#theme-toggle");
  const muteBtn = document.querySelector("#mute-toggle");
  const modeButtons = [...document.querySelectorAll(".modes button")];
  const scoreCards = {
    X: document.querySelector('.score[data-player="X"]'),
    O: document.querySelector('.score[data-player="O"]'),
  };
  const confetti = document.querySelector(".confetti");

  const emptyScores = () => ({
    local: { X: 0, O: 0, draws: 0 },
    cpu: { X: 0, O: 0, draws: 0 },
  });

  const state = {
    board: Array(9).fill(null),
    turn: "X",
    mode: "local",
    winner: null,
    line: null,
    draw: false,
    last: null,
    locked: false,
    muted: false,
    scores: emptyScores(),
    focus: 0,
  };

  const history = [];
  let cpuTimer = 0;
  let resetTimer = 0;
  let audioCtx = null;

  function load() {
    try {
      const scores = JSON.parse(localStorage.getItem("ttt-scores") || "null");
      if (scores?.local && scores?.cpu) state.scores = scores;
      state.muted = localStorage.getItem("ttt-muted") === "1";
      const mode = localStorage.getItem("ttt-mode");
      if (mode === "cpu" || mode === "local") state.mode = mode;
    } catch (error) {
      /* keep defaults when storage is blocked */
    }
  }

  function save() {
    try {
      localStorage.setItem("ttt-scores", JSON.stringify(state.scores));
      localStorage.setItem("ttt-muted", state.muted ? "1" : "0");
      localStorage.setItem("ttt-mode", state.mode);
    } catch (error) {
      /* ignore quota and private-mode failures */
    }
  }

  function currentScores() {
    return state.scores[state.mode];
  }

  function snapshot() {
    return {
      board: state.board.slice(),
      turn: state.turn,
      winner: state.winner,
      line: state.line ? state.line.slice() : null,
      draw: state.draw,
      last: state.last,
      scores: JSON.parse(JSON.stringify(state.scores)),
    };
  }

  function restore(saved) {
    state.board = saved.board.slice();
    state.turn = saved.turn;
    state.winner = saved.winner;
    state.line = saved.line ? saved.line.slice() : null;
    state.draw = saved.draw;
    state.last = saved.last;
    state.scores = saved.scores;
    state.locked = false;
  }

  function audio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, duration, type = "sine", gain = 0.035, delay = 0) {
    if (state.muted) return;
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  function playMark(player) {
    tone(player === "X" ? 540 : 360, 0.09, player === "X" ? "sine" : "triangle");
  }

  function playWin() {
    [523, 659, 784].forEach((freq, index) => tone(freq, 0.18, "triangle", 0.04, index * 0.09));
  }

  function playDraw() {
    tone(196, 0.22, "sine", 0.03);
  }

  function themeIsLight() {
    const chosen = document.documentElement.dataset.theme;
    if (chosen === "light" || chosen === "dark") return chosen === "light";
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  }

  function syncThemeButton() {
    const light = themeIsLight();
    themeBtn.setAttribute("aria-pressed", String(light));
    themeBtn.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", light ? "#f4efe6" : "#14120f");
  }

  function setTheme(next) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ttt-theme", next);
    } catch (error) {
      /* ignore */
    }
    syncThemeButton();
  }

  function playerName(player) {
    if (state.mode === "cpu") return player === "X" ? "You" : "Machine";
    return player === "X" ? "Player X" : "Player O";
  }

  function statusText() {
    if (state.winner) return `${playerName(state.winner)} wins`;
    if (state.draw) return "It's a draw";
    if (state.locked) return "Machine is thinking";
    if (state.mode === "cpu") return state.turn === "X" ? "Your move" : "Machine to move";
    return `${playerName(state.turn)} to move`;
  }

  function cellLabel(index) {
    const mark = state.board[index];
    const spot = NAMES[index];
    if (!mark) return `${spot}, empty`;
    return `${spot}, ${playerName(mark)}`;
  }

  function render() {
    const cells = [...boardEl.querySelectorAll(".cell")];
    cells.forEach((cell, index) => {
      const mark = state.board[index];
      const changed = cell.dataset.mark !== (mark || "");
      cell.dataset.mark = mark || "";
      cell.classList.toggle("x", mark === "X");
      cell.classList.toggle("o", mark === "O");
      cell.classList.toggle("last", state.last === index);
      cell.classList.toggle("win", Boolean(state.line?.includes(index)));
      cell.style.setProperty("--win", mark === "O" ? "var(--o)" : "var(--x)");
      cell.setAttribute("aria-disabled", mark || state.winner || state.draw || state.locked ? "true" : "false");
      cell.setAttribute("aria-label", cellLabel(index));
      cell.tabIndex = index === state.focus ? 0 : -1;
      if (changed) {
        cell.innerHTML = mark
          ? `<svg viewBox="0 0 100 100" aria-hidden="true">${MARK[mark]}</svg>`
          : "";
      }
    });

    drawWinLine();

    statusEl.textContent = statusText();
    statusEl.dataset.kind = state.winner ? "win" : state.draw ? "draw" : "play";
    const scores = currentScores();
    scoreX.textContent = String(scores.X);
    scoreO.textContent = String(scores.O);
    scoreD.textContent = String(scores.draws);
    labelX.textContent = state.mode === "cpu" ? "You" : "Player X";
    labelO.textContent = state.mode === "cpu" ? "Machine" : "Player O";
    hintEl.textContent =
      state.mode === "cpu"
        ? "You are X. The machine plays a perfect O and never misses a block."
        : "Tap a square. With a keyboard, move with the arrows and press Enter.";

    const active = state.winner || state.draw || state.locked ? null : state.turn;
    scoreCards.X.dataset.active = String(active === "X");
    scoreCards.O.dataset.active = String(active === "O");

    undoBtn.setAttribute("aria-disabled", history.length ? "false" : "true");
    modeButtons.forEach((button) => {
      button.setAttribute("aria-checked", String(button.dataset.mode === state.mode));
    });
    muteBtn.setAttribute("aria-pressed", String(state.muted));
    muteBtn.setAttribute("aria-label", state.muted ? "Unmute sounds" : "Mute sounds");
    boardEl.setAttribute("aria-busy", String(state.locked));
  }

  function drawWinLine() {
    let svg = boardEl.querySelector(".win-stroke");
    if (!state.line) {
      svg?.remove();
      return;
    }
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "win-stroke");
      svg.setAttribute("aria-hidden", "true");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("pathLength", "1");
      svg.appendChild(line);
      boardEl.appendChild(svg);
    }
    const line = svg.querySelector("line");
    const cells = [...boardEl.querySelectorAll(".cell")];
    const [start, , end] = state.line;
    const boardRect = boardEl.getBoundingClientRect();
    const a = cells[start].getBoundingClientRect();
    const b = cells[end].getBoundingClientRect();
    const width = boardEl.clientWidth;
    const height = boardEl.clientHeight;
    const originX = boardRect.left + boardEl.clientLeft;
    const originY = boardRect.top + boardEl.clientTop;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.color = state.winner === "O" ? "var(--o)" : "var(--x)";
    line.setAttribute("stroke-width", String(Math.max(6, width * 0.02)));
    line.setAttribute("x1", String(a.left + a.width / 2 - originX));
    line.setAttribute("y1", String(a.top + a.height / 2 - originY));
    line.setAttribute("x2", String(b.left + b.width / 2 - originX));
    line.setAttribute("y2", String(b.top + b.height / 2 - originY));
  }

  function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti.replaceChildren();
    const colors = ["var(--x)", "var(--o)", "var(--gold)", "var(--ink)"];
    for (let i = 0; i < 26; i += 1) {
      const piece = document.createElement("i");
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.15}s`;
      piece.style.transform = `rotate(${Math.random() * 80}deg)`;
      confetti.appendChild(piece);
    }
    window.setTimeout(() => confetti.replaceChildren(), 1700);
  }

  function finishIfNeeded(player) {
    const found = winnerOf(state.board);
    if (found) {
      state.winner = found.player;
      state.line = found.line;
      currentScores()[found.player] += 1;
      playWin();
      celebrate();
      return true;
    }
    if (isFull(state.board)) {
      state.draw = true;
      currentScores().draws += 1;
      playDraw();
      return true;
    }
    state.turn = player === "X" ? "O" : "X";
    return false;
  }

  function place(index, byHuman) {
    if (state.board[index] || state.winner || state.draw || state.locked) return;
    if (byHuman) history.push(snapshot());
    state.board[index] = state.turn;
    state.last = index;
    const player = state.turn;
    playMark(player);
    const over = finishIfNeeded(player);
    save();
    render();
    if (!over && state.mode === "cpu" && state.turn === "O") scheduleCpu();
  }

  function scheduleCpu() {
    state.locked = true;
    render();
    cpuTimer = window.setTimeout(() => {
      state.locked = false;
      const move = bestMove(state.board);
      if (move === undefined) {
        render();
        return;
      }
      place(move, false);
    }, 420);
  }

  function newRound() {
    window.clearTimeout(cpuTimer);
    state.board = Array(9).fill(null);
    state.turn = "X";
    state.winner = null;
    state.line = null;
    state.draw = false;
    state.last = null;
    state.locked = false;
    history.length = 0;
    render();
    boardEl.querySelector(".cell")?.focus();
  }

  function undo() {
    if (!history.length) return;
    window.clearTimeout(cpuTimer);
    restore(history.pop());
    save();
    render();
  }

  function buildBoard() {
    boardEl.replaceChildren();
    for (let index = 0; index < 9; index += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(index);
      cell.addEventListener("click", () => {
        state.focus = index;
        place(index, true);
      });
      cell.addEventListener("focus", () => {
        state.focus = index;
      });
      boardEl.appendChild(cell);
    }
  }

  function moveFocus(next) {
    state.focus = (next + 9) % 9;
    render();
    boardEl.querySelectorAll(".cell")[state.focus].focus();
  }

  boardEl.addEventListener("keydown", (event) => {
    const row = Math.floor(state.focus / 3);
    const col = state.focus % 3;
    if (event.key === "ArrowRight") moveFocus(row * 3 + ((col + 1) % 3));
    else if (event.key === "ArrowLeft") moveFocus(row * 3 + ((col + 2) % 3));
    else if (event.key === "ArrowDown") moveFocus(((row + 1) % 3) * 3 + col);
    else if (event.key === "ArrowUp") moveFocus(((row + 2) % 3) * 3 + col);
    else return;
    event.preventDefault();
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.mode === state.mode) return;
      state.mode = button.dataset.mode;
      save();
      newRound();
    });
  });

  undoBtn.addEventListener("click", undo);
  againBtn.addEventListener("click", newRound);
  resetBtn.addEventListener("click", () => {
    if (resetBtn.dataset.armed !== "true") {
      resetBtn.dataset.armed = "true";
      resetBtn.textContent = "Confirm";
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        resetBtn.dataset.armed = "false";
        resetBtn.textContent = "Reset";
      }, 2200);
      return;
    }
    window.clearTimeout(resetTimer);
    resetBtn.dataset.armed = "false";
    resetBtn.textContent = "Reset";
    state.scores[state.mode] = { X: 0, O: 0, draws: 0 };
    save();
    render();
  });

  themeBtn.addEventListener("click", () => {
    setTheme(themeIsLight() ? "dark" : "light");
  });

  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    save();
    render();
    if (!state.muted) tone(480, 0.07);
  });

  window.addEventListener("resize", () => {
    if (state.line) drawWinLine();
  });

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => {
      if (state.line) drawWinLine();
    });
    observer.observe(boardEl);
  }

  load();
  buildBoard();
  syncThemeButton();
  render();
}

if (typeof document !== "undefined") boot();
