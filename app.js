'use strict';

/* ================= helpers ================= */

const range = n => Array.from({ length: n }, (_, i) => i);

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ================= symbol sets ================= */

const SETS = [
  { id: 'num', kind: 'number', glyphs: ['1', '2', '3', '4', '5', '6', '7', '8'],
    names: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] },

  { id: 'ltr', kind: 'letter', glyphs: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },

  { id: 'op',  kind: 'sign',   glyphs: ['+', '−', '×', '/', '=', '≠', '<', '>'],
    names: ['plus', 'minus', 'times', 'divided by', 'equals', 'not equals', 'less than', 'greater than'] },

  { id: 'shp', kind: 'shape',  glyphs: ['●', '▲', '■', '◆', '★', '⬟', '✦', '⬢'],
    names: ['circle', 'triangle', 'square', 'diamond', 'star', 'pentagon', 'four point star', 'hexagon'] },

  { id: 'grk', kind: 'letter', glyphs: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ'],
    names: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'] },

  { id: 'cur', kind: 'currency', glyphs: ['€', '$', '¥', '£', '₹', '₩', '₽', '₺'],
    names: ['euro', 'dollar', 'yen', 'pound', 'rupee', 'won', 'ruble', 'lira'] },

  { id: 'crd', kind: 'card', glyphs: ['♠', '♥', '♦', '♣', '♤', '♡', '♢', '♧'],
    names: ['spades', 'hearts', 'diamonds', 'clubs', 'spade outline', 'heart outline', 'diamond outline', 'club outline'] },
  
  { id: 'rom', kind: 'roman numeral', glyphs: ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ'],
    names: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] }
];

/* ================= hint rules ================= */

function evalHint(type, ca, cb, cc, N) {
  switch (type) {
    case 'same':    return ca === cb;
    case 'left':    return ca < cb;
    case 'right':   return ca > cb;
    case 'next':
    case 'adj':     return Math.abs(ca - cb) === 1;
    case 'dist2':   return Math.abs(ca - cb) === 2;
    case 'between': return (cb === ca - 1 && cc === ca + 1) ||
                           (cc === ca - 1 && cb === ca + 1);
    case 'notsame': return ca !== cb;
    case 'first':   return ca === 0;
    case 'last':    return ca === N - 1;
  }
  return false;
}

/* ================= solver =================
   dom[row][symbol] = list of possible columns.
   Every pruning step is sound (never removes a value present in any valid
   solution), so if propagation reaches all-singleton domains, the puzzle
   has exactly one solution and it is derivable purely by logic. */

function propagate(N, revealed, hints, initialDom = null) {
  // Deep clone the starting domain, or create a fresh one if this is the first run
  const dom = initialDom 
    ? initialDom.map(row => row.map(col => [...col])) 
    : Array.from({ length: N }, () => Array.from({ length: N }, () => range(N)));
    
  const fail = { solved: false, total: N * N * N, dom };
  let changed = true;

  const applyReveals = () => {
    for (const rv of revealed) {
      const d = dom[rv.r][rv.s];
      if (!d.includes(rv.c)) return false;
      if (d.length !== 1 || d[0] !== rv.c) { dom[rv.r][rv.s] = [rv.c]; changed = true; }
    }
    return true;
  };

  while (changed) {
    changed = false;
    if (!applyReveals()) return fail;

    for (let r = 0; r < N; r++) {
      /* naked singles: a fixed symbol removes its column from row mates */
      for (let s = 0; s < N; s++) {
        if (dom[r][s].length === 1) {
          const c = dom[r][s][0];
          for (let t = 0; t < N; t++) {
            if (t === s) continue;
            const i = dom[r][t].indexOf(c);
            if (i !== -1) { dom[r][t].splice(i, 1); changed = true; }
          }
        }
      }
      /* hidden singles: a column possible for only one symbol */
      for (let c = 0; c < N; c++) {
        let holder = -1, count = 0;
        for (let s = 0; s < N; s++) if (dom[r][s].includes(c)) { count++; holder = s; }
        if (count === 0) return fail;
        if (count === 1 && dom[r][holder].length > 1) { dom[r][holder] = [c]; changed = true; }
      }
    }

    for (const h of hints) if (pruneHint(N, dom, h)) changed = true;
  }

  let solved = true, total = 0;
  for (let r = 0; r < N; r++) for (let s = 0; s < N; s++) {
    total += dom[r][s].length;
    if (dom[r][s].length !== 1) solved = false;
  }
  return { solved, total, dom }; // <-- NOW RETURNS THE DOM FOR REUSE
}

function pruneHint(N, dom, h) {
  const vars = [h.a];
  if (h.b) vars.push(h.b);
  if (h.c) vars.push(h.c);
  let changed = false;
  for (let vi = 0; vi < vars.length; vi++) {
    const v = vars[vi];
    const cur = dom[v.r][v.s];
    const keep = [];
    for (const x of cur) if (supported(vars, vi, x, dom, h, N)) keep.push(x);
    if (keep.length === 0) continue;              /* defensive; cannot happen for true hints */
    if (keep.length !== cur.length) { dom[v.r][v.s] = keep; changed = true; }
  }
  return changed;
}

function supported(vars, vi, x, dom, h, N) {
  const assign = new Array(vars.length);
  assign[vi] = x;
  const others = [];
  for (let i = 0; i < vars.length; i++) if (i !== vi) others.push(i);

  const okAssign = () => {    
    const ca = assign[0], cb = assign[1], cc = assign[2];    
    return evalHint(h.type, ca, cb, cc, N);
  };

  const rec = k => {
    if (k === others.length) return okAssign();
    const i = others[k], v = vars[i];
    for (const y of dom[v.r][v.s]) {
      let bad = false;
      for (let j = 0; j < vars.length; j++) {
        if (j === i || assign[j] === undefined) continue;
        if (vars[j].r === v.r && assign[j] === y) { bad = true; break; }
      }
      if (bad) continue;
      assign[i] = y;
      if (rec(k + 1)) return true;
      assign[i] = undefined;
    }
    return false;
  };
  return rec(0);
}

/* ================= puzzle generation ================= */

function hintKey(h) {
  return h.type + '|' + [h.a, h.b, h.c].filter(Boolean).map(v => v.r * 10 + v.s).join(',');
}

/* All statements true in the given solution — the pool the generator draws from. */
function candidateHints(N, sol) {
  const out = [];
  const syms = [];
  for (let r = 0; r < N; r++) for (let s = 0; s < N; s++) syms.push({ r, s });
  const col = (r, s) => sol[r].indexOf(s);
  const push = h => { out.push(h); };

  for (let i = 0; i < syms.length; i++) {
    const a = syms[i], ca = col(a.r, a.s);
    if (ca === 0) push({ type: 'first', a });
    if (ca === N - 1) push({ type: 'last', a });
    for (let j = 0; j < syms.length; j++) {
      if (i === j) continue;
      const b = syms[j], cb = col(b.r, b.s);
      if (ca === cb) {
        if (i < j) push({ type: 'same', a, b });
      } else {
        if (ca < cb) push({ type: 'left', a, b });
        if (i < j) {
          push({ type: 'notsame', a, b });
          if (Math.abs(ca - cb) === 1) push({ type: Math.random() < 0.5 ? 'next' : 'adj', a, b });
          if (Math.abs(ca - cb) === 2) push({ type: 'dist2', a, b });
        }
      }
    }
  }
  /* 'between' triples, randomly sampled */
  for (let t = 0; t < 160; t++) {
    const a = syms[(Math.random() * syms.length) | 0];
    const b = syms[(Math.random() * syms.length) | 0];
    const c = syms[(Math.random() * syms.length) | 0];
    if (a === b || a === c || b === c) continue;
    const ca = col(a.r, a.s), cb = col(b.r, b.s), cc = col(c.r, c.s);
    if ((cb === ca - 1 && cc === ca + 1) || (cc === ca - 1 && cb === ca + 1)) {
        push({ type: 'between', a, b, c });
    }
  }
  return out;
}

const HINT_BASE = { same: 1, left: 1, next: 1, adj: 1, dist2: 0.8, between: 1.15, notsame: 0.55, first: 0.35, last: 0.35 };

function generatePuzzle(N) {
  const validIndices = [];
  for (let i = 0; i < SETS.length; i++) {
    if (!SETS[i].maxN || SETS[i].maxN >= N) validIndices.push(i);
  }
  const sets = shuffle(validIndices).slice(0, N);

  for (let attempt = 0; attempt < 80; attempt++) {
    const sol = Array.from({ length: N }, () => shuffle(range(N)));

    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push({ r, c });
    const nRevealed = Math.max(N - 1, Math.round((N * N) / 5));
    const revealed = shuffle(cells).slice(0, nRevealed)
      .map(p => ({ r: p.r, c: p.c, s: sol[p.r][p.c] }));

    const hints = [];
    
    // Start with a base state
    let res = { solved: false, total: N * N * N, dom: null };
    let steps = 0;
    const maxSteps = N * N;

    const allCands = candidateHints(N, sol)
      .map(h => ({ h, w: HINT_BASE[h.type] * (0.5 + Math.random()) }))
      .sort((x, y) => y.w - x.w)
      .map(o => o.h);

    const usedHintKeys = new Set();
    const isUsed = (h) => usedHintKeys.has(hintKey(h));

    while (!res.solved && steps < maxSteps) {
      steps++;
      let added = false;
      
      for (const h of allCands) {
        if (isUsed(h)) continue;

        // Pass the current best `dom` to avoid rebuilding from scratch!
        const r2 = propagate(N, revealed, hints.concat([h]), res.dom);
        
        if (r2.total < res.total) {
          hints.push(h);
          usedHintKeys.add(hintKey(h));
          res = r2; // Save the new state, including the heavily-reduced `dom`
          added = true;
          break; 
        }
      }
      if (!added) break;
    }
    
    if (!res.solved) continue;

    for (let i = hints.length - 1; i >= 0; i--) {
      const fewer = hints.filter((_, k) => k !== i);
      if (propagate(N, revealed, fewer).solved) {
        hints.splice(i, 1);
      }
    }
    
    return { v: 1, N, sets, sol, revealed, hints, placed: [], mistakes: 0, done: null };
  }

  /* Extremely rare fallback: reveal cells until the grid is forced. */
  const sol = Array.from({ length: N }, () => shuffle(range(N)));
  const pool = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) pool.push({ r, c });
  shuffle(pool);
  const revealed = [];
  for (const p of pool) {
    revealed.push({ r: p.r, c: p.c, s: sol[p.r][p.c] });
    if (propagate(N, revealed, []).solved) break;
  }
  return { v: 1, N, sets, sol, revealed, hints: [], placed: [], mistakes: 0, done: null };
}

/* ================= state & storage ================= */

const SKEY = 'einstein-pwa-v2';
const OLD_SKEYS = ['einstein-pwa-v1'];

const MKEY = 'einstein-pwa-sound';
const THEME_KEY = 'einstein-theme';
const MAX_MISTAKES = 3;

let G = null;       /* current game state */
let sel = null;     /* selected cell {r, c} */
let soundOn = true;

function save() {
  try {
    localStorage.setItem(SKEY, JSON.stringify(G));
  } catch (e) {}
}

function clearSave() {
  try {
    localStorage.removeItem(SKEY);
  } catch (e) {}
}

function clearOldSaves() {
  try {
    for (const key of OLD_SKEYS) {
      localStorage.removeItem(key);
    }
  } catch (e) {}
}

function isValidPositionVar(j, v) {
  return (
    v &&
    Number.isInteger(v.r) &&
    Number.isInteger(v.s) &&
    v.r >= 0 && v.r < j.N &&
    v.s >= 0 && v.s < j.N
  );
}

function isValidCell(j, v) {
  return (
    v &&
    Number.isInteger(v.r) &&
    Number.isInteger(v.c) &&
    Number.isInteger(v.s) &&
    v.r >= 0 && v.r < j.N &&
    v.c >= 0 && v.c < j.N &&
    v.s >= 0 && v.s < j.N
  );
}

function isValidSave(j) {
  if (!j || j.v !== 1 || j.done) return false;
  if (!Number.isInteger(j.N) || ![4, 5, 6, 7, 8].includes(j.N)) return false;

  if (!Array.isArray(j.sets) || j.sets.length !== j.N) return false;
  for (const idx of j.sets) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= SETS.length) return false;
    const set = SETS[idx];
    if (set.maxN && set.maxN < j.N) return false;
  }

  if (!Array.isArray(j.sol) || j.sol.length !== j.N) return false;
  for (const row of j.sol) {
    if (!Array.isArray(row) || row.length !== j.N) return false;
    for (const s of row) {
      if (!Number.isInteger(s) || s < 0 || s >= j.N) return false;
    }
  }

  if (!Array.isArray(j.revealed)) return false;
  if (!Array.isArray(j.placed)) return false;
  if (!Array.isArray(j.hints)) return false;

  if (!j.revealed.every(v => isValidCell(j, v))) return false;
  if (!j.placed.every(v => isValidCell(j, v))) return false;

  if (!Number.isInteger(j.mistakes) || j.mistakes < 0 || j.mistakes >= MAX_MISTAKES) {
    return false;
  }

  for (const h of j.hints) {
    if (!h || typeof h.type !== 'string') return false;
    if (!isValidPositionVar(j, h.a)) return false;
    if (h.b && !isValidPositionVar(j, h.b)) return false;
    if (h.c && !isValidPositionVar(j, h.c)) return false;
  }

  return true;
}

function loadSave() {
  try {
    const j = JSON.parse(localStorage.getItem(SKEY));

    if (!j) return null;

    if (isValidSave(j)) {
      return j;
    }

    /* Corrupt/incompatible save: discard it */
    localStorage.removeItem(SKEY);
  } catch (e) {
    try {
      localStorage.removeItem(SKEY);
    } catch (_) {}
  }

  return null;
}

/* ================= DOM refs ================= */

const boardEl   = document.getElementById('board');
const trayEl    = document.getElementById('tray');
const hintsEl   = document.getElementById('hints');
const menuEl    = document.getElementById('menu');
const gameEl    = document.getElementById('game');
const overlayEl = document.getElementById('overlay');
const ovTitle   = document.getElementById('ovTitle');
const ovSub     = document.getElementById('ovSub');
const ovBtn     = document.getElementById('ovBtn');
const strikesEl = document.getElementById('strikes');
const soundBtn  = document.getElementById('soundBtn');
const themeBtn  = document.getElementById('themeBtn');
const newBtn    = document.getElementById('newBtn');
const toggleHintsBtn = document.getElementById('toggleHints');

/* ================= sounds (synthesized, no assets) ================= */

const sounds = (() => {
  let ctx = null;
  function ac() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
    return ctx;
  }
  function note(f, { at = 0, dur = 0.18, type = 'sine', vol = 0.045 } = {}) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    tick() { if (soundOn) note(1320, { dur: 0.04, vol: 0.015 }); },
    ok()   { if (!soundOn) return; note(660, { dur: 0.12 }); note(990, { at: 0.08, dur: 0.16, vol: 0.035 }); },
    bad()  { if (!soundOn) return; note(233, { dur: 0.16, type: 'triangle' }); note(174, { at: 0.1, dur: 0.22, type: 'triangle', vol: 0.05 }); },
    win()  { if (!soundOn) return; [523, 659, 784, 1046].forEach((f, i) => note(f, { at: i * 0.09, dur: 0.22, vol: 0.04 })); },
    lose() { if (!soundOn) return; [392, 311, 262].forEach((f, i) => note(f, { at: i * 0.12, dur: 0.26, type: 'triangle', vol: 0.045 })); },
  };
})();

/* ================= rendering ================= */

function symName(setIdx, s) { const set = SETS[setIdx]; return set.kind + ' ' + set.names[s]; }

function makeChip(setIdx, s) {
  const set = SETS[setIdx];
  const chip = document.createElement('span');
  chip.className = 'chip set-' + set.id;
  if (set.colors) {
    const i = document.createElement('i');
    i.className = 'swatch';
    i.style.background = set.colors[s];
    chip.appendChild(i);
  } else {
    chip.textContent = set.glyphs[s];
  }
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', symName(setIdx, s));
  return chip;
}

function hintParts(h) {
  const A = () => makeChip(G.sets[h.a.r], h.a.s);
  const B = () => makeChip(G.sets[h.b.r], h.b.s);
  const C = () => makeChip(G.sets[h.c.r], h.c.s);
  switch (h.type) {
    case 'same':    return [A(), ' is in the same column as ', B(), '.'];
    case 'left':    return [A(), ' is to the left of ', B(), '.'];
    case 'right':   return [A(), ' is to the right of ', B(), '.'];
    case 'next':    return [A(), ' is next to ', B(), '.'];
    case 'adj':     return [A(), ' is adjacent to ', B(), '.'];
    case 'dist2':   return [A(), ' is separated by one column from ', B(), '.'];
    case 'between': return [A(), ' is between ', B(), ' and ', C(), '.'];
    case 'notsame': return [A(), ' is not in the same column as ', B(), '.'];
    case 'first':   return [A(), ' is in the first column.'];
    case 'last':    return [A(), ' is in the last column.'];
  }
  return [];
}

function hintAria(h) {
  const n = v => symName(G.sets[v.r], v.s);
  switch (h.type) {
    case 'same':    return `${n(h.a)} is in the same column as ${n(h.b)}`;
    case 'left':    return `${n(h.a)} is to the left of ${n(h.b)}`;
    case 'right':   return `${n(h.a)} is to the right of ${n(h.b)}`;
    case 'next':    return `${n(h.a)} is next to ${n(h.b)}`;
    case 'adj':     return `${n(h.a)} is adjacent to ${n(h.b)}`;
    case 'dist2':   return `${n(h.a)} is separated by one column from ${n(h.b)}`;
    case 'between': return `${n(h.a)} is between ${n(h.b)} and ${n(h.c)}`;
    case 'notsame': return `${n(h.a)} is not in the same column as ${n(h.b)}`;
    case 'first':   return `${n(h.a)} is in the first column`;
    case 'last':    return `${n(h.a)} is in the last column`;
  }
  return '';
}

function fillCell(cell, r, s) {
  cell.textContent = '';
  const set = SETS[G.sets[r]];
  if (set.colors) {
    const i = document.createElement('i');
    i.className = 'swatch';
    i.style.background = set.colors[s];
    cell.appendChild(i);
  } else {
    const sp = document.createElement('span');
    sp.className = 'glyph';
    sp.textContent = set.glyphs[s];
    cell.appendChild(sp);
  }
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${G.N}, 1fr)`;
  for (let r = 0; r < G.N; r++) {
    for (let c = 0; c < G.N; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      const given = G.revealed.find(v => v.r === r && v.c === c);
      const placed = G.placed.find(v => v.r === r && v.c === c);
      if (given) { cell.classList.add('given', 'filled'); fillCell(cell, r, given.s); }
      else if (placed) { cell.classList.add('filled'); fillCell(cell, r, placed.s); }
      cell.setAttribute('aria-label',
        `row ${r + 1}, column ${c + 1}, ${cell.classList.contains('filled') ? 'filled' : 'empty'}`);
      cell.addEventListener('click', () => onCell(r, c));
      boardEl.appendChild(cell);
    }
  }
  fitBoard();
}

function renderStrikes() {
  strikesEl.innerHTML = '';
  const m = G ? G.mistakes : 0;
  for (let i = 0; i < MAX_MISTAKES; i++) {
    const d = document.createElement('span');
    d.className = 'strike' + (i < m ? ' hit' : '');
    strikesEl.appendChild(d);
  }
  strikesEl.setAttribute('aria-label', `${MAX_MISTAKES - m} tries left`);
}

function renderHints() {
  hintsEl.innerHTML = '';
  G.hints.forEach((h, i) => {
    const li = document.createElement('li');

    li.dataset.hintIndex = i; 
    
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `Hide hint ${i + 1}: ${hintAria(h)}`);

    const content = document.createElement('span');
    content.className = 'hint-content';
    for (const part of hintParts(h)) {
      content.appendChild(typeof part === 'string' ? document.createTextNode(part) : part);
    }
    li.appendChild(content);

    const hide = () => li.classList.add('hint-hidden');
    li.addEventListener('click', hide);
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hide(); }
    });

    hintsEl.appendChild(li);
  });
}

function renderTray() {
  trayEl.innerHTML = '';
  if (!G || G.done) return;
  if (!sel) {
    const p = document.createElement('span');
    p.className = 'hint-text';
    p.textContent = 'tap an empty cell, then choose its symbol';
    trayEl.appendChild(p);
    return;
  }
  const r = sel.r, c = sel.c;
  const setIdx = G.sets[r];
  const used = new Set();
  for (const v of G.revealed) if (v.r === r) used.add(v.s);
  for (const v of G.placed) if (v.r === r) used.add(v.s);
  const wrongHere = (G.wrongGuesses || []).filter(v => v.r === r && v.c === c).map(v => v.s);
  for (let s = 0; s < G.N; s++) {
    const chip = makeChip(setIdx, s);
    chip.classList.add('tray-chip');
    chip.setAttribute('role', 'button');
    if (used.has(s)) {
      chip.classList.add('used');
      chip.setAttribute('aria-disabled', 'true');
    } else if (wrongHere.includes(s)) {
      chip.classList.add('wrong-guess');
      chip.setAttribute('aria-disabled', 'true');
    } else {
      chip.addEventListener('click', () => attempt(r, c, s));
    }
    trayEl.appendChild(chip);
  }
}

function updateSel() {
  for (const el of boardEl.children) el.classList.remove('sel');
  if (sel) cellAt(sel.r, sel.c).classList.add('sel');
  renderTray();
}

function fitBoard() {
  const cell = boardEl.querySelector('.cell');
  if (!cell) return;
  const w = cell.getBoundingClientRect().width;
  boardEl.style.setProperty('--sym', Math.round(w * 0.42) + 'px');
  boardEl.style.setProperty('--cellsw', Math.round(w * 0.5) + 'px');
}

function restoreHintOpacities() {
  if (!G || !hintsEl.children.length) return;
  
  const lis = Array.from(hintsEl.querySelectorAll('li'));
  const active = [];
  const dimmed = [];

  for (const li of lis) {
    const i = parseInt(li.dataset.hintIndex, 10);
    const h = G.hints[i];
    if (!h) continue;

    const symsInHint = [h.a, h.b, h.c].filter(Boolean);
    const allOnBoard = symsInHint.every(sym => 
      G.revealed.some(v => v.r === sym.r && v.s === sym.s) || 
      G.placed.some(v => v.r === sym.r && v.s === sym.s)
    );

    if (allOnBoard) {
      li.style.opacity = '0.5';
      dimmed.push(li);
    } else {
      li.style.opacity = ''; // Reset in case it was somehow altered
      active.push(li);
    }
  }

  // Re-append existing nodes in the correct order (highly efficient, no innerHTML rebuild)
  for (const li of active) hintsEl.appendChild(li);
  for (const li of dimmed) hintsEl.appendChild(li);
}

/* ================= interaction ================= */

function cellAt(r, c) { return boardEl.children[r * G.N + c]; }

function onCell(r, c) {
  if (!G || G.done) return;
  if (cellAt(r, c).classList.contains('filled')) return;   /* no undo, no re-opening */
  sounds.tick();
  sel = (sel && sel.r === r && sel.c === c) ? null : { r, c };
  updateSel();
}

function autoFillLastCell(r) {
  const filled = G.revealed.concat(G.placed).filter(v => v.r === r);
  if (filled.length === G.N - 1) {
    const used = new Set(filled.map(v => v.s));
    let missingS = -1;
    for (let i = 0; i < G.N; i++) if (!used.has(i)) { missingS = i; break; }
      
    let emptyC = -1;
    for (let i = 0; i < G.N; i++) {
      if (!filled.find(v => v.c === i)) { emptyC = i; break; }
    }
      
    // Place the missing symbol automatically
    if (missingS !== -1 && emptyC !== -1) {
      G.placed.push({ r, c: emptyC, s: missingS });
      const autoCell = cellAt(r, emptyC);
      autoCell.classList.add('filled', 'pop');
      fillCell(autoCell, r, missingS);
      sounds.ok();
    }
  }
}

function attempt(r, c, s) {
  if (!G || G.done) return;
  if (G.sol[r][c] === s) {
    G.placed.push({ r, c, s });
    sel = null;
    const cell = cellAt(r, c);
    cell.classList.add('filled', 'pop');
    fillCell(cell, r, s);
    sounds.ok();
    autoFillLastCell(r);
    updateSel();
    save();

    G.hints.forEach((h, i) => {
      const symsInHint = [h.a, h.b, h.c].filter(Boolean);
      
      // Check if this hint contains the exact symbol (row r, symbol index s) just placed
      const containsTarget = symsInHint.some(sym => sym.r === r && sym.s === s);
      
      if (containsTarget) {
        // Check if ALL symbols in this hint are now on the board
        const allOnBoard = symsInHint.every(sym => 
          G.revealed.some(v => v.r === sym.r && v.s === sym.s) || 
          G.placed.some(v => v.r === sym.r && v.s === sym.s)
        );
        
        if (allOnBoard) {
          // Find the exact DOM element using the data attribute
          const li = hintsEl.querySelector(`li[data-hint-index="${i}"]`);
          
          // Only update and move if it hasn't been processed already
          if (li && li.style.opacity !== '0.5') {
            li.style.opacity = '0.5';
            hintsEl.appendChild(li);
          }
        }
      }
    });
    
    if (G.placed.length + G.revealed.length === G.N * G.N) win();
  } else {
    G.mistakes++;
    if (!G.wrongGuesses) G.wrongGuesses = [];
    G.wrongGuesses.push({ r, c, s });
    sounds.bad();
    const cell = cellAt(r, c);
    cell.classList.remove('shake');
    void cell.offsetWidth;
    cell.classList.add('shake');
    renderStrikes();
    updateSel();
    save();
    if (G.mistakes >= MAX_MISTAKES) lose();
  }
}

function win() {
  G.done = 'win'; save();
  sounds.win();
  sel = null; updateSel();
  showOverlay('Solved.',
    G.mistakes === 0 ? 'Flawless — not a single miss.'
                     : `With ${G.mistakes} miss${G.mistakes > 1 ? 'es' : ''}.`);
}

function lose() {
  G.done = 'lose'; save();
  sounds.lose();
  for (let r = 0; r < G.N; r++) for (let c = 0; c < G.N; c++) {
    const cell = cellAt(r, c);
    if (!cell.classList.contains('filled')) {
      cell.classList.add('filled', 'ghost');
      fillCell(cell, r, G.sol[r][c]);
    }
  }
  sel = null; updateSel();
  showOverlay('Out of tries.', 'The full solution is shown on the board.');
}

function showOverlay(title, sub) {
  ovTitle.textContent = title;
  ovSub.textContent = sub;
  overlayEl.removeAttribute('hidden');
}

/* ================= flow ================= */

function startGame(state) {
  G = state; sel = null;
  menuEl.setAttribute('hidden', '');
  overlayEl.setAttribute('hidden', '');
  gameEl.removeAttribute('hidden');
  renderBoard(); renderStrikes(); renderHints(); renderTray();
}

function showMenu() {
  G = null; sel = null;
  gameEl.setAttribute('hidden', '');
  overlayEl.setAttribute('hidden', '');
  menuEl.removeAttribute('hidden');
  renderStrikes();
}

function newPuzzle(N) {
  startGame(generatePuzzle(N));
  save();
}

/* ================= theme ================= */

const themeIcons = {
  auto: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>`,
  light: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>`
};
const themeCycle = ['auto', 'light', 'dark'];

function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  
  themeBtn.innerHTML = themeIcons[theme];
  themeBtn.setAttribute('aria-label', `Theme: ${theme} mode`);
  
  const activeBg = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg')
    .trim();
    
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor && activeBg) {
    metaThemeColor.content = activeBg;
  }
  
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}
}

function cycleTheme() {
  const currentTheme = localStorage.getItem(THEME_KEY) || 'auto';
  const currentIndex = themeCycle.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themeCycle.length;
  applyTheme(themeCycle[nextIndex]);
}

/* ================= wiring ================= */

document.querySelectorAll('.menu-btn').forEach(b => {
  b.addEventListener('click', () => newPuzzle(parseInt(b.dataset.n, 10)));
});

newBtn.addEventListener('click', () => {
  if (G && !G.done && !confirm('Start a new puzzle? Current progress will be lost.')) return;
  clearSave();
  showMenu();
});

ovBtn.addEventListener('click', () => { clearSave(); showMenu(); });

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  try { localStorage.setItem(MKEY, soundOn ? '1' : '0'); } catch (e) {}
  soundBtn.classList.toggle('muted', !soundOn);
  soundBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
  if (soundOn) sounds.tick();
});

themeBtn.addEventListener('click', cycleTheme);

toggleHintsBtn.addEventListener('click', () => {
  const lis = hintsEl.querySelectorAll('li');
  // Toggles all previously visible hints to hidden, and all previously hidden hints to visible
  for (const li of lis) {
    const btn = li.querySelector('.hint-toggle');
    const isHidden = li.classList.toggle('hint-hidden');
  }
});

/* ================= init ================= */

function init() {
  clearOldSaves();

  soundBtn.classList.toggle('muted', !soundOn);
  soundBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');

  const savedTheme = localStorage.getItem(THEME_KEY) || 'auto';
  applyTheme(savedTheme);

  if ('ResizeObserver' in window) {
    new ResizeObserver(fitBoard).observe(boardEl);
  }

  window.addEventListener('resize', fitBoard);

  let saved = null;

  try {
    saved = loadSave();
  } catch (e) {
    saved = null;
    clearSave();
  }

  if (saved) {
    try {
      startGame(saved);
      restoreHintOpacities();
    } catch (err) {
      console.error('Discarding corrupted saved game:', err);
      clearSave();
      showMenu();
    }
  } else {
    showMenu();
  }

  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
