import { Chess } from "./vendor/chess.js";

const $ = (selector) => document.querySelector(selector);
const importPanel = $("#import-panel");
const workspace = $("#workspace");
const pgnInput = $("#pgn-input");
const importError = $("#import-error");
const moveList = $("#move-list");
const boardElement = $("#chessboard");
const engineStatus = $("#analysis-status");
const resultElement = $("#engine-result");

const state = {
  moves: [],
  headers: {},
  selectedIndex: 0,
  results: new Map(),
  worker: null,
  initPromise: null,
  activeSearch: null,
  cancelRequested: false,
  running: false,
};

const PIECES = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

$("#load-game").addEventListener("click", loadGame);
$("#pgn-file").addEventListener("change", loadFile);
$("#change-game").addEventListener("click", showImport);
$("#previous-move").addEventListener("click", () => selectMove(state.selectedIndex - 1));
$("#next-move").addEventListener("click", () => selectMove(state.selectedIndex + 1));
$("#analyze-current").addEventListener("click", analyzeCurrent);
$("#analyze-all").addEventListener("click", analyzeAll);
$("#stop-analysis").addEventListener("click", stopAnalysis);

function loadFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  file.text().then((text) => {
    pgnInput.value = text;
    loadGame();
  }).catch(() => showImportError("Die PGN-Datei konnte nicht gelesen werden."));
  event.target.value = "";
}

function loadGame() {
  hideImportError();
  const pgn = pgnInput.value.trim();
  if (!pgn) {
    showImportError("Füge zuerst die PGN einer abgeschlossenen Partie ein.");
    return;
  }

  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const history = game.history({ verbose: true });
    if (!history.length) throw new Error("In der PGN wurden keine Züge gefunden.");

    state.headers = game.getHeaders();
    state.moves = history.map((move, index) => ({
      before: move.before,
      after: move.after,
      from: move.from,
      to: move.to,
      san: move.san,
      color: move.color,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      number: Math.floor(index / 2) + 1,
      ply: index + 1,
    }));
    state.selectedIndex = 0;
    state.results.clear();
    state.cancelRequested = false;
    importPanel.hidden = true;
    workspace.hidden = false;
    renderGameHeader();
    renderMoveList();
    renderPosition();
    setStatus("Partie geladen. Wähle einen Zug oder analysiere die ganze Partie.");
    resultElement.hidden = true;
  } catch (error) {
    showImportError(error instanceof Error ? error.message : "Die PGN konnte nicht gelesen werden.");
  }
}

function renderGameHeader() {
  const white = state.headers.White || "Weiß";
  const black = state.headers.Black || "Schwarz";
  const result = state.headers.Result;
  $("#game-title").textContent = `${white} – ${black}`;
  $("#game-subtitle").textContent = `${state.moves.length} Halbzüge${result && result !== "*" ? ` · Ergebnis ${result}` : ""}`;
}

function renderMoveList() {
  moveList.replaceChildren();
  state.moves.forEach((move, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "move-entry";
    if (index === state.selectedIndex) button.classList.add("selected");
    if (state.results.has(index) && state.results.get(index).bestUci === move.uci) button.classList.add("suggested");
    button.setAttribute("aria-label", `${move.number}${move.color === "b" ? "..." : "."} ${move.san}${state.results.has(index) ? ", analysiert" : ""}`);
    const moveNumber = document.createElement("span");
    moveNumber.className = "move-number";
    moveNumber.textContent = move.color === "w" ? `${move.number}.` : `${move.number}…`;
    const san = document.createElement("span");
    san.className = "move-san";
    san.textContent = move.san;
    button.append(moveNumber, san);
    button.addEventListener("click", () => selectMove(index));
    moveList.append(button);
  });
  $("#analyzed-count").textContent = `${state.results.size} analysiert`;
}

function selectMove(index) {
  if (!state.moves.length) return;
  state.selectedIndex = Math.max(0, Math.min(index, state.moves.length - 1));
  renderMoveList();
  renderPosition();
}

function renderPosition() {
  const move = state.moves[state.selectedIndex];
  if (!move) return;
  const colorName = move.color === "w" ? "Weiß" : "Schwarz";
  $("#position-title").textContent = `Zug ${move.number} · ${colorName}`;
  $("#turn-pill").textContent = `${colorName} am Zug`;
  $("#move-counter").textContent = `Halbzug ${state.selectedIndex + 1} von ${state.moves.length}`;
  $("#previous-move").disabled = state.selectedIndex === 0;
  $("#next-move").disabled = state.selectedIndex >= state.moves.length - 1;

  const result = state.results.get(state.selectedIndex);
  renderBoard(move.before, result?.bestUci);
  renderMoveSummary(move, result);
  renderEngineResult(move, result);
}

function renderBoard(fen, bestUci) {
  const position = new Chess(fen);
  const board = position.board();
  const bestFrom = bestUci?.slice(0, 2);
  const bestTo = bestUci?.slice(2, 4);
  boardElement.replaceChildren();

  for (let row = 0; row < 8; row += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = document.createElement("div");
      square.className = `square ${(row + file) % 2 === 0 ? "light" : "dark"}`;
      const squareName = `${String.fromCharCode(97 + file)}${8 - row}`;
      if (squareName === bestFrom) square.classList.add("best-from");
      if (squareName === bestTo) square.classList.add("best-to");

      const piece = board[row][file];
      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
        pieceElement.textContent = PIECES[`${piece.color}${piece.type}`];
        square.append(pieceElement);
      }
      if (file === 0) {
        const rank = document.createElement("span");
        rank.className = "coord";
        rank.textContent = String(8 - row);
        square.append(rank);
      }
      if (row === 7) {
        const fileLabel = document.createElement("span");
        fileLabel.className = "coord file-coord";
        fileLabel.textContent = String.fromCharCode(97 + file);
        square.append(fileLabel);
      }
      boardElement.append(square);
    }
  }

  if (bestFrom && bestTo) {
    const fromX = bestFrom.charCodeAt(0) - 96 + 0.5;
    const fromY = 8 - Number(bestFrom[1]) + 0.5;
    const toX = bestTo.charCodeAt(0) - 96 + 0.5;
    const toY = 8 - Number(bestTo[1]) + 0.5;
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("class", "arrow-layer");
    arrow.setAttribute("viewBox", "0 0 8 8");
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = '<defs><marker id="arrow-tip" markerWidth="3" markerHeight="3" refX="2.4" refY="1.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L3,1.5 L0,3 z" fill="#edcb37"></path></marker></defs>';
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(fromX));
    line.setAttribute("y1", String(fromY));
    line.setAttribute("x2", String(toX));
    line.setAttribute("y2", String(toY));
    line.setAttribute("marker-end", "url(#arrow-tip)");
    arrow.append(line);
    boardElement.append(arrow);
  }
}

function renderMoveSummary(move, result) {
  const summary = $("#move-summary");
  summary.replaceChildren();
  const played = document.createElement("span");
  played.className = "played-move";
  played.append("Gespielt: ");
  const strong = document.createElement("strong");
  strong.textContent = `${move.number}${move.color === "w" ? "." : "…"} ${move.san}`;
  played.append(strong);
  summary.append(played);
  if (result) {
    const badge = document.createElement("span");
    const matched = result.bestUci === move.uci;
    badge.className = `result-badge${matched ? " hit" : ""}`;
    badge.textContent = matched ? "Top-Vorschlag gespielt" : "Top-Vorschlag weicht ab";
    summary.append(badge);
  }
}

function renderEngineResult(move, result) {
  resultElement.replaceChildren();
  if (!result) {
    resultElement.hidden = true;
    return;
  }
  resultElement.hidden = false;
  const label = document.createElement("div");
  label.className = "engine-result-label";
  label.textContent = `Topzug · Tiefe ${result.depth}`;
  const best = document.createElement("div");
  best.className = "engine-best";
  best.textContent = result.bestSan || result.bestUci;
  const line = document.createElement("div");
  line.className = "engine-line";
  line.textContent = result.pvSan?.length ? `Variante: ${result.pvSan.join(" ")}` : `UCI: ${result.bestUci}`;
  resultElement.append(label, best, line);
}

async function analyzeCurrent() {
  if (state.running) return;
  const index = state.selectedIndex;
  const depth = getDepth();
  if (state.results.get(index)?.depth === depth) {
    setStatus("Dieser Zug wurde bereits mit dieser Tiefe analysiert.");
    return;
  }
  state.running = true;
  setControlsRunning(true);
  setStatus("Stockfish wird vorbereitet …", "busy");
  try {
    const result = await analyzePosition(index, depth);
    state.results.set(index, result);
    renderMoveList();
    renderPosition();
    setStatus(`Analyse abgeschlossen · Tiefe ${depth}.`, "");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Die Analyse ist fehlgeschlagen.", "error-text");
  } finally {
    state.running = false;
    setControlsRunning(false);
  }
}

async function analyzeAll() {
  if (state.running) return;
  const depth = getDepth();
  state.running = true;
  state.cancelRequested = false;
  setControlsRunning(true);
  setStatus("Stockfish wird vorbereitet …", "busy");
  try {
    await ensureEngine();
    let completed = 0;
    for (let index = 0; index < state.moves.length; index += 1) {
      if (state.cancelRequested) break;
      if (state.results.get(index)?.depth === depth) {
        completed += 1;
        continue;
      }
      state.selectedIndex = index;
      renderMoveList();
      renderPosition();
      setStatus(`Analysiere Halbzug ${index + 1} von ${state.moves.length} · Tiefe ${depth} …`, "busy");
      const result = await analyzePosition(index, depth);
      state.results.set(index, result);
      completed += 1;
      renderMoveList();
      renderPosition();
    }
    if (state.cancelRequested) {
      setStatus(`Analyse angehalten · ${state.results.size} Züge gespeichert.`);
    } else {
      setStatus(`Partieanalyse abgeschlossen · ${completed} Züge auf Tiefe ${depth}.`);
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Die Analyse ist fehlgeschlagen.", "error-text");
  } finally {
    state.running = false;
    state.cancelRequested = false;
    setControlsRunning(false);
  }
}

async function analyzePosition(index, depth) {
  await ensureEngine();
  const move = state.moves[index];
  setStatus(`Analysiere Halbzug ${index + 1} · Tiefe ${depth} …`, "busy");
  const response = await searchFen(move.before, depth);
  if (!response.bestUci || response.bestUci === "(none)") {
    throw new Error("Für diese Stellung wurde kein legaler Zug gefunden.");
  }
  return {
    bestUci: response.bestUci,
    bestSan: uciToSan(move.before, response.bestUci),
    pvSan: uciVariationToSan(move.before, response.pv),
    depth: response.depth || depth,
  };
}

function ensureEngine() {
  if (state.initPromise) return state.initPromise;
  state.worker = new Worker(chrome.runtime.getURL("vendor/stockfish-19-lite-single.js"));
  state.worker.addEventListener("message", handleEngineMessage);
  state.worker.addEventListener("error", () => {
    const error = new Error("Stockfish konnte nicht geladen werden. Prüfe, ob die Erweiterungsdateien vollständig sind.");
    state.activeSearch?.reject(error);
    state.activeSearch = null;
  });
  state.initPromise = (async () => {
    state.worker.postMessage("uci");
    await waitForEngineLine((line) => line === "uciok", 20000);
    state.worker.postMessage("isready");
    await waitForEngineLine((line) => line === "readyok", 20000);
    state.worker.postMessage("ucinewgame");
  })().catch((error) => {
    state.initPromise = null;
    throw error;
  });
  return state.initPromise;
}

const engineLineWaiters = [];
function waitForEngineLine(predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, reject, timeout: null };
    waiter.timeout = window.setTimeout(() => {
      const index = engineLineWaiters.indexOf(waiter);
      if (index >= 0) engineLineWaiters.splice(index, 1);
      reject(new Error("Stockfish antwortet nicht. Lade das Analysefenster neu und versuche es erneut."));
    }, timeoutMs);
    engineLineWaiters.push(waiter);
  });
}

function handleEngineMessage(event) {
  const data = typeof event.data === "string" ? event.data : String(event.data ?? "");
  for (const rawLine of data.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    for (let i = engineLineWaiters.length - 1; i >= 0; i -= 1) {
      const waiter = engineLineWaiters[i];
      if (waiter.predicate(line)) {
        engineLineWaiters.splice(i, 1);
        window.clearTimeout(waiter.timeout);
        waiter.resolve(line);
      }
    }
    if (line.startsWith("info ") && state.activeSearch) {
      const depthMatch = line.match(/\bdepth (\d+)/);
      const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
      const pvMatch = line.match(/\bpv (.+)$/);
      if (pvMatch && (!depthMatch || !state.activeSearch.depth || Number(depthMatch[1]) >= state.activeSearch.depth)) {
        state.activeSearch.pv = pvMatch[1].trim().split(/\s+/);
      }
      if (depthMatch) state.activeSearch.depth = Number(depthMatch[1]);
      if (scoreMatch) state.activeSearch.score = { type: scoreMatch[1], value: Number(scoreMatch[2]) };
    }
    if (line.startsWith("bestmove ") && state.activeSearch) {
      const active = state.activeSearch;
      state.activeSearch = null;
      window.clearTimeout(active.timeout);
      const bestUci = line.split(/\s+/)[1];
      active.resolve({ bestUci, pv: active.pv || [bestUci], depth: active.depth });
    }
  }
}

function searchFen(fen, depth) {
  return new Promise((resolve, reject) => {
    if (!state.worker) {
      reject(new Error("Stockfish wurde nicht gestartet."));
      return;
    }
    const active = { resolve, reject, depth: 0, pv: [], timeout: null };
    active.timeout = window.setTimeout(() => {
      if (state.activeSearch !== active) return;
      state.activeSearch = null;
      state.worker.postMessage("stop");
      reject(new Error("Die Engine-Analyse hat zu lange gedauert. Versuche eine geringere Tiefe."));
    }, 120000);
    state.activeSearch = active;
    state.worker.postMessage(`position fen ${fen}`);
    state.worker.postMessage(`go depth ${depth}`);
  });
}

function uciToSan(fen, uci) {
  const board = new Chess(fen);
  const move = playUci(board, uci);
  return move?.san || uci;
}

function uciVariationToSan(fen, variation) {
  if (!variation?.length) return [];
  const board = new Chess(fen);
  const sans = [];
  for (const uci of variation.slice(0, 8)) {
    try {
      const move = playUci(board, uci);
      if (!move) break;
      sans.push(move.san);
    } catch {
      break;
    }
  }
  return sans;
}

function playUci(board, uci) {
  const request = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  if (uci.length > 4) request.promotion = uci[4];
  return board.move(request);
}

function stopAnalysis() {
  if (!state.running) return;
  state.cancelRequested = true;
  if (state.activeSearch && state.worker) state.worker.postMessage("stop");
  setStatus("Breche die Analyse nach der aktuellen Engine-Antwort ab …", "busy");
}

function setControlsRunning(running) {
  $("#analyze-current").disabled = running;
  $("#analyze-all").disabled = running;
  $("#depth-select").disabled = running;
  $("#stop-analysis").hidden = !running;
  moveList.querySelectorAll("button").forEach((button) => { button.disabled = running; });
  $("#previous-move").disabled = running || state.selectedIndex === 0;
  $("#next-move").disabled = running || state.selectedIndex >= state.moves.length - 1;
}

function setStatus(message, kind = "") {
  engineStatus.textContent = message;
  engineStatus.className = `status-line${kind ? ` ${kind}` : ""}`;
}

function getDepth() {
  return Number($("#depth-select").value);
}

function showImport() {
  workspace.hidden = true;
  importPanel.hidden = false;
  hideImportError();
}

function showImportError(message) {
  importError.textContent = message;
  importError.hidden = false;
}

function hideImportError() {
  importError.textContent = "";
  importError.hidden = true;
}

window.addEventListener("beforeunload", () => state.worker?.terminate());
