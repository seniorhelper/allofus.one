/* allofus.one · the desk · app sheet: "Games" — a games table for a break: Chess, Checkers, Four in a row, Reversi and Memory match.
   All rules, move making and the Desk opponent live in aou-desk-games.js (tested on its own). This file draws the board and passes taps to it.
   Play by pointing and pinching: tap a piece, then tap a green square. The game, position, record and best memory score are saved on this device only
   (localStorage). No network. Classic public-domain games only; every piece and card is drawn here as a plain shape. */
import * as G from './aou-desk-games.js';

export default function (desk) {
  const id = 'games';
  const NAME = { chess: 'Chess', chk: 'Checkers', c4: 'Four in a row', rev: 'Reversi', mem: 'Memory match' };
  const SIDE = { chess: ['White', 'Black'], chk: ['Red', 'Cream'], c4: ['Red', 'Gold'], rev: ['Black', 'White'] };
  const RULES = {
    chess: 'Tap a piece, then a green square. Checkmate wins. Pawns on the far row promote.',
    chk: 'Tap a piece, then a green square. You must capture when you can. Reach the far row to be kinged.',
    c4: 'Tap a column to drop a disc. The first to line up four in a row, across, down or slanted, wins.',
    rev: 'Tap a green square to place a disc. Discs trapped in a line between yours turn over. Most discs at the end wins.',
    mem: 'Tap two cards. Pictures that match stay face up. Find every pair in as few moves as you can.',
  };
  const PIECE = 'PNBRQK';
  const CELL = 62, BX = 48, BY = 104; /* 8 x 8 boards: 496 px, every square 62 px */
  const C4C = 72, C4X = 44, C4Y = 128; /* four in a row: 7 x 6 cells of 72 px */
  const SHAPE_COL = ['#d6433b', '#2f6fdf', '#1f9d55', '#e08a00', '#8e44d8', '#0aa5c0', '#e0409a', '#6aa312', '#d9601a', '#7a5af8', '#b45309', '#0f766e'];

  let st = G.parseGames(desk.store.get(id));
  let sheet = null, sel = -1, prefix = [], promo = null, last = [-1, -1], aiDue = 0, hideAt = 0, confirmNew = false, cacheS = null, cacheV = null;
  const save = () => desk.store.set(id, G.serializeGames(st));
  const cur = () => st.pos[st.game];
  const isAi = () => st.mode === 'ai' && st.game !== 'mem';
  const redraw = () => desk.redraw(sheet);
  const sideIdx = (t) => (t > 0 ? 0 : 1);

  /* legal moves of the current position, worked out once per position */
  function legal() {
    const s = cur(); if (cacheS === s) return cacheV;
    cacheS = s;
    cacheV = st.game === 'chess' ? G.chessLegal(s) : st.game === 'chk' ? G.chkMoves(s) : st.game === 'rev' ? G.revMoves(s) : [];
    return cacheV;
  }
  /* { over, winner (1, -1 or 0), kind } for the current position */
  function over() {
    const s = cur();
    if (st.game === 'chess') { const o = G.chessStatus(s, legal()); return { over: o.over, winner: o.winner, kind: o.kind, check: o.check }; }
    if (st.game === 'chk') { const o = G.chkStatus(s, legal()); return { over: o.over, winner: o.winner, kind: o.kind }; }
    if (st.game === 'c4') { const o = G.c4Status(s); return { over: o.over, winner: o.winner, kind: '', line: o.line }; }
    if (st.game === 'rev') { const o = G.revStatus(s); return { over: o.over, winner: o.winner, kind: '' }; }
    const done = G.memDone(s); return { over: done, winner: done && s.sc[0] !== s.sc[1] ? (s.sc[0] > s.sc[1] ? 1 : -1) : 0, kind: '' };
  }
  const humanTurn = () => !isAi() || cur().turn === 1;

  /* ---------- after any move: highlight, save, maybe wake the Desk ---------- */
  function moved(from, to) {
    last = [from, to]; sel = -1; prefix = []; promo = null; confirmNew = false; cacheS = null;
    const o = over();
    if (o.over) {
      if (isAi()) { const t = st.tally[st.game]; t[o.winner === 1 ? 0 : o.winner === -1 ? 1 : 2] = Math.min(9999, t[o.winner === 1 ? 0 : o.winner === -1 ? 1 : 2] + 1); }
      desk.beep(o.winner === -1 && isAi() ? 220 : 660, 0.2, 0.03);
    } else {
      desk.beep(480, 0.05, 0.02);
      if (isAi() && cur().turn === -1) aiDue = Date.now() + 400;
    }
    save(); redraw();
  }
  function runAi() {
    if (!isAi() || cur().turn !== -1 || over().over) return;
    const r = G.aiMove(st.game, cur(), st.lvl, G.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0));
    if (!r) return;
    st.pos[st.game] = r.state; moved(r.from, r.to);
  }
  desk.onFrame(() => {
    if (!aiDue && !hideAt) return;
    const now = Date.now();
    if (aiDue && now >= aiDue) { aiDue = 0; runAi(); }
    if (hideAt && now >= hideAt) { hideAt = 0; if (G.memResolve(st.pos.mem)) redraw(); }
  });
  if (isAi() && cur().turn === -1 && !over().over) aiDue = Date.now() + 600;

  /* ---------- drawing helpers ---------- */
  const poly = (g, pts) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
  function tint(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function disc(g, cx, cy, r, fill, rim) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 3; g.strokeStyle = rim; g.stroke(); }
  function chessPiece(g, cx, cy, p) {
    const w = p > 0; disc(g, cx, cy, 26, w ? '#f6f1e3' : '#1b2029', w ? '#2b2f3a' : '#efe8d4');
    desk.label(g, PIECE[Math.abs(p) - 1], cx, cy + 2, 34, w ? '#1b2029' : '#f6f1e3', 'center', 800);
  }
  function chkPiece(g, cx, cy, p) {
    const red = p > 0; disc(g, cx, cy, 26, red ? '#d9473f' : '#efe4c8', red ? '#7a1f1a' : '#8a7a55');
    g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = red ? '#f08a82' : '#c9b98f'; g.stroke();
    if (Math.abs(p) === 2) { poly(g, [[cx - 13, cy + 8], [cx - 15, cy - 9], [cx - 6, cy - 1], [cx, cy - 11], [cx + 6, cy - 1], [cx + 15, cy - 9], [cx + 13, cy + 8]]); g.fillStyle = '#ffd24d'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#6b4e00'; g.stroke(); }
  }
  function drawShape(g, k, cx, cy, r, col, bg) {
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1;
    switch (k) {
      case 0: g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); break;
      case 1: g.fillRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7); break;
      case 2: poly(g, [[cx, cy - r], [cx + r, cy + r * 0.8], [cx - r, cy + r * 0.8]]); g.fill(); break;
      case 3: { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i & 1 ? r * 0.45 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } poly(g, pts); g.fill(); break; }
      case 4: poly(g, [[cx, cy - r], [cx + r * 0.75, cy], [cx, cy + r], [cx - r * 0.75, cy]]); g.fill(); break;
      case 5: g.fillRect(cx - r * 0.3, cy - r, r * 0.6, r * 2); g.fillRect(cx - r, cy - r * 0.3, r * 2, r * 0.6); break;
      case 6: { const pts = []; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(g, pts); g.fill(); break; }
      case 7: g.lineWidth = r * 0.42; g.beginPath(); g.arc(cx, cy, r * 0.78, 0, Math.PI * 2); g.stroke(); break;
      case 8: { const pts = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } poly(g, pts); g.fill(); break; }
      case 9: g.beginPath(); g.moveTo(cx, cy + r); g.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.35); g.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.5, cy - r * 0.1, cx, cy + r); g.fill(); break;
      case 10: g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx + r * 0.5, cy - r * 0.2, r * 0.82, 0, Math.PI * 2); g.fillStyle = bg; g.fill(); break;
      default: g.lineWidth = r * 0.42; g.beginPath(); g.moveTo(cx - r * 0.8, cy - r * 0.8); g.lineTo(cx + r * 0.8, cy + r * 0.8); g.moveTo(cx + r * 0.8, cy - r * 0.8); g.lineTo(cx - r * 0.8, cy + r * 0.8); g.stroke();
    }
  }

  /* ---------- boards ---------- */
  function squares(p, g, darkOf) {
    for (let i = 0; i < 64; i++) {
      const x = BX + (i & 7) * CELL, y = BY + (i >> 3) * CELL;
      tint(g, x, y, CELL, CELL, darkOf(i) ? '#8b6f47' : '#d9c9a3');
      p.regions.push({ x, y, w: CELL, h: CELL, act: id + ':tap', arg: i });
    }
  }
  function marks(g, targets, capSet) {
    targets.forEach((i) => {
      const cx = BX + (i & 7) * CELL + CELL / 2, cy = BY + (i >> 3) * CELL + CELL / 2;
      if (capSet && capSet.has(i)) { g.lineWidth = 5; g.strokeStyle = '#2fd25a'; g.beginPath(); g.arc(cx, cy, 27, 0, Math.PI * 2); g.stroke(); }
      else { g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.fillStyle = 'rgba(38,190,80,0.9)'; g.fill(); }
    });
  }
  function frame8(g) { desk.rr(g, BX - 6, BY - 6, CELL * 8 + 12, CELL * 8 + 12, 10); g.lineWidth = 4; g.strokeStyle = '#3a4456'; g.stroke(); }
  function ring(g, i, col) { const x = BX + (i & 7) * CELL, y = BY + (i >> 3) * CELL; g.lineWidth = 5; g.strokeStyle = col; g.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6); }

  function drawChess(p, g) {
    const s = cur(), lg = legal(), o = over();
    frame8(g); squares(p, g, (i) => ((i >> 3) + (i & 7)) & 1);
    last.forEach((i) => { if (i >= 0) tint(g, BX + (i & 7) * CELL, BY + (i >> 3) * CELL, CELL, CELL, 'rgba(255,225,90,0.38)'); });
    if (o.check || (o.over && o.kind === 'mate')) { const k = s.b.indexOf(s.turn * 6); if (k >= 0) tint(g, BX + (k & 7) * CELL, BY + (k >> 3) * CELL, CELL, CELL, 'rgba(230,50,60,0.55)'); }
    const tg = []; const caps = new Set();
    if (sel >= 0) lg.forEach((m) => { if (m.f === sel && tg.indexOf(m.t) < 0) { tg.push(m.t); if (s.b[m.t] || m.x === 2) caps.add(m.t); } });
    if (promo) tg.length = 0;
    if (sel >= 0) ring(g, sel, '#7dff5a');
    for (let i = 0; i < 64; i++) if (s.b[i]) chessPiece(g, BX + (i & 7) * CELL + CELL / 2, BY + (i >> 3) * CELL + CELL / 2, s.b[i]);
    marks(g, tg, caps);
  }
  function drawChk(p, g) {
    const s = cur(), lg = legal();
    frame8(g); squares(p, g, (i) => ((i >> 3) + (i & 7)) & 1);
    last.forEach((i) => { if (i >= 0) tint(g, BX + (i & 7) * CELL, BY + (i >> 3) * CELL, CELL, CELL, 'rgba(255,225,90,0.32)'); });
    const tg = [], pre = prefix.length ? prefix : null;
    if (pre) lg.forEach((m) => { if (m.path.length > pre.length && pre.every((q, k) => m.path[k] === q) && tg.indexOf(m.path[pre.length]) < 0) tg.push(m.path[pre.length]); });
    if (pre) pre.forEach((q, k) => ring(g, q, k ? '#c9f26b' : '#7dff5a'));
    for (let i = 0; i < 64; i++) if (s.b[i]) chkPiece(g, BX + (i & 7) * CELL + CELL / 2, BY + (i >> 3) * CELL + CELL / 2, s.b[i]);
    marks(g, tg, null);
  }
  function drawRev(p, g) {
    const s = cur(), o = over();
    frame8(g); squares(p, g, () => false);
    for (let i = 0; i < 64; i++) { const x = BX + (i & 7) * CELL, y = BY + (i >> 3) * CELL; tint(g, x, y, CELL, CELL, ((i >> 3) + (i & 7)) & 1 ? '#1d6a43' : '#238150'); }
    g.strokeStyle = '#0f3d27'; g.lineWidth = 2; for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(BX + k * CELL, BY); g.lineTo(BX + k * CELL, BY + 8 * CELL); g.moveTo(BX, BY + k * CELL); g.lineTo(BX + 8 * CELL, BY + k * CELL); g.stroke(); }
    for (let i = 0; i < 64; i++) if (s.b[i]) { const cx = BX + (i & 7) * CELL + CELL / 2, cy = BY + (i >> 3) * CELL + CELL / 2; disc(g, cx, cy, 25, s.b[i] > 0 ? '#14171d' : '#f4f4ef', s.b[i] > 0 ? '#6d7686' : '#8d93a0'); }
    if (last[1] >= 0) ring(g, last[1], '#ffe15a');
    if (!o.over && humanTurn()) marks(g, G.revMoves(s).map((m) => m.sq), null);
  }
  function drawC4(p, g) {
    const s = cur(), o = over();
    desk.rr(g, C4X - 8, C4Y - 8, C4C * 7 + 16, C4C * 6 + 16, 18); g.fillStyle = '#27509a'; g.fill();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
      const v = s.b[r * 7 + c], cx = C4X + c * C4C + C4C / 2, cy = C4Y + r * C4C + C4C / 2;
      g.beginPath(); g.arc(cx, cy, 29, 0, Math.PI * 2); g.fillStyle = v === 0 ? '#0e1219' : v > 0 ? '#e04b4b' : '#f2c744'; g.fill();
      if (v) { g.lineWidth = 3; g.strokeStyle = v > 0 ? '#8e1f1f' : '#9a7a10'; g.stroke(); }
    }
    if (s.last >= 0) { g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(C4X + (s.last % 7) * C4C + C4C / 2, C4Y + ((s.last / 7) | 0) * C4C + C4C / 2, 22, 0, Math.PI * 2); g.stroke(); }
    if (o.line) o.line.forEach((i) => { g.lineWidth = 6; g.strokeStyle = '#7dff5a'; g.beginPath(); g.arc(C4X + (i % 7) * C4C + C4C / 2, C4Y + ((i / 7) | 0) * C4C + C4C / 2, 31, 0, Math.PI * 2); g.stroke(); });
    for (let c = 0; c < 7; c++) {
      p.regions.push({ x: C4X + c * C4C, y: C4Y - 8, w: C4C, h: C4C * 6 + 16, act: id + ':tap', arg: c });
      if (!o.over && humanTurn() && G.c4Row(s.b, c) >= 0) { g.beginPath(); g.moveTo(C4X + c * C4C + C4C / 2 - 9, C4Y - 30); g.lineTo(C4X + c * C4C + C4C / 2 + 9, C4Y - 30); g.lineTo(C4X + c * C4C + C4C / 2, C4Y - 16); g.closePath(); g.fillStyle = 'rgba(125,255,90,0.85)'; g.fill(); }
    }
  }
  function drawMem(p, g) {
    const s = cur(), cols = s.z === 24 ? 6 : 4, cs = s.z === 24 ? 82 : 112, gap = s.z === 24 ? 8 : 10;
    const tw = cols * cs + (cols - 1) * gap, th = 4 * cs + 3 * gap, x0 = 36 + (540 - tw) / 2, y0 = 104 + (496 - th) / 2;
    for (let i = 0; i < s.z; i++) {
      const x = x0 + (i % cols) * (cs + gap), y = y0 + ((i / cols) | 0) * (cs + gap), f = s.f[i];
      desk.rr(g, x, y, cs, cs, 14);
      if (f === 0) { g.fillStyle = '#2c3e66'; g.fill(); g.lineWidth = 3; g.strokeStyle = desk.accent(); g.stroke(); desk.rr(g, x + 10, y + 10, cs - 20, cs - 20, 8); g.lineWidth = 2; g.strokeStyle = '#4a5f93'; g.stroke(); desk.label(g, '?', x + cs / 2, y + cs / 2 + 2, Math.round(cs * 0.4), '#8aa0d6', 'center', 800); }
      else { const bg = f === 2 ? '#cfe8d4' : '#f1ebdd'; g.fillStyle = bg; g.fill(); if (f === 2) { g.lineWidth = 4; g.strokeStyle = '#1f9d55'; g.stroke(); } drawShape(g, s.s[i], x + cs / 2, y + cs / 2, cs * 0.3, SHAPE_COL[s.s[i]], bg); }
      p.regions.push({ x, y, w: cs, h: cs, act: id + ':tap', arg: i });
    }
  }

  /* ---------- right panel text ---------- */
  function statusText() {
    const s = cur(), o = over(), g = st.game, nm = SIDE[g] || [];
    if (g === 'mem') {
      if (o.over) return s.sc[0] === s.sc[1] && st.mode === 'two' ? ['A tie.', 'Both found ' + s.sc[0] + ' pairs.', '#ffcf7a'] : st.mode === 'two' ? ['Player ' + (o.winner === 1 ? 1 : 2) + ' wins!', s.sc[0] + ' pairs to ' + s.sc[1] + '.', '#7dff5a'] : ['All pairs found!', 'Done in ' + s.m + ' moves.', '#7dff5a'];
      return st.mode === 'two' ? ['Player ' + (s.turn > 0 ? 1 : 2) + "'s turn", 'Match a pair to go again.', desk.accent()] : ['Find the pairs', s.pend ? 'No match. Try again.' : 'Tap two cards.', desk.accent()];
    }
    if (o.over) {
      let l2 = '';
      if (g === 'chess') l2 = o.kind === 'mate' ? 'Checkmate.' : o.kind === 'stalemate' ? 'Stalemate: no safe move.' : o.kind === 'material' ? 'Too few pieces left to mate.' : '50 moves with no capture.';
      else if (g === 'chk') l2 = o.kind === 'quiet' ? 'No progress for 40 moves each.' : 'No moves left for ' + nm[sideIdx(-o.winner)] + '.';
      else if (g === 'c4') l2 = o.winner ? 'Four in a row!' : 'The board is full.';
      else { const r = G.revStatus(s); l2 = r.black + ' to ' + r.white + ' discs.'; }
      if (!o.winner) return ['It is a draw.', l2, '#ffcf7a'];
      const you = isAi() ? (o.winner === 1 ? 'You win!' : 'The Desk wins.') : nm[sideIdx(o.winner)] + ' wins!';
      return [you, l2, isAi() && o.winner === -1 ? '#ff8a96' : '#7dff5a'];
    }
    const idx = sideIdx(s.turn);
    const l1 = isAi() ? (s.turn === 1 ? 'Your move (' + nm[0] + ')' : 'The Desk is thinking...') : nm[idx] + ' to move';
    let l2 = '', col = desk.accent();
    if (g === 'chess' && o.check) { l2 = 'Check!'; col = '#ffcf7a'; }
    else if (g === 'chk' && legal().length && legal()[0].caps.length) l2 = isAi() && s.turn === 1 ? 'You must capture.' : nm[idx] + ' must capture.';
    else if (g === 'rev' && s.passed) l2 = nm[sideIdx(s.passed)] + ' had no move and passed.';
    else if (g === 'c4') l2 = 'Tap a column.';
    else if (g === 'rev') l2 = 'Green dots are legal moves.';
    else if (g === 'chess') l2 = sel >= 0 ? 'Tap a green square.' : 'Tap a piece to move.';
    else if (g === 'chk') l2 = prefix.length ? 'Tap a green square.' : 'Tap a piece to move.';
    return [l1, l2, col];
  }
  function infoText() {
    const s = cur(), g = st.game;
    if (g === 'chess') {
      let w = 0, b = 0; for (const v of s.b) { if (v > 0) w++; else if (v < 0) b++; }
      const m = G.chessMaterial(s), d = m[0] - m[1];
      return 'Taken: White ' + Math.max(0, 16 - b) + ', Black ' + Math.max(0, 16 - w) + '  ' + (d > 0 ? 'White +' + d : d < 0 ? 'Black +' + -d : 'Level');
    }
    if (g === 'chk') { const c = G.chkCount(s); return 'Red ' + c.r + ' (' + c.rk + ' kings)  Cream ' + c.c + ' (' + c.ck + ')'; }
    if (g === 'c4') return 'Discs played: ' + s.n + ' of 42';
    if (g === 'rev') { const c = G.revCount(s.b); return 'Black ' + c.black + '   White ' + c.white; }
    const got = s.f.filter((v) => v === 2).length / 2;
    return st.mode === 'two' ? 'P1 ' + s.sc[0] + ' pairs   P2 ' + s.sc[1] + ' pairs' : 'Moves ' + s.m + '   Pairs ' + got + ' of ' + s.z / 2;
  }

  /* ---------- the sheet ---------- */
  function drawPanel(p, g) {
    const px = 600, pw = 388, memo = st.game === 'mem';
    const [l1, l2, col] = statusText();
    desk.rr(g, px, 100, pw, 76, 12); g.fillStyle = '#171d28'; g.fill();
    desk.label(g, l1, px + 14, 126, 26, col, 'left', 800, pw - 28); desk.label(g, l2, px + 14, 158, 20, '#aab3c2', 'left', 500, pw - 28);
    desk.rr(g, px, 184, pw, 56, 12); g.fillStyle = '#1d2636'; g.fill();
    desk.label(g, infoText(), px + 14, 212, 20, '#f1f4f9', 'left', 600, pw - 28);
    desk.btn(p, px, 250, 190, 52, memo ? 'Solo' : 'vs Desk', id + ':mode', memo ? 'ai' : 'ai', { on: st.mode === 'ai', size: 22 });
    desk.btn(p, px + 198, 250, 190, 52, '2 players', id + ':mode', 'two', { on: st.mode === 'two', size: 22 });
    if (memo) {
      desk.btn(p, px, 310, 190, 52, '4 x 4', id + ':size', 16, { on: st.msz === 16, size: 22 }); desk.btn(p, px + 198, 310, 190, 52, '6 x 4', id + ':size', 24, { on: st.msz === 24, size: 22 });
    } else {
      const al = st.mode === 'ai', dim = { bg: '#141a24', fg: '#7c8798' };
      desk.btn(p, px, 310, 190, 52, 'Easy', al ? id + ':lvl' : null, 0, al ? { on: st.lvl === 0, size: 22 } : Object.assign({ size: 22 }, dim)); desk.btn(p, px + 198, 310, 190, 52, 'Normal', al ? id + ':lvl' : null, 1, al ? { on: st.lvl === 1, size: 22 } : Object.assign({ size: 22 }, dim));
    }
    desk.btn(p, px, 370, pw, 56, confirmNew ? 'Tap again to start over' : 'New game', id + ':new', null, confirmNew ? { size: 24, bg: '#5a2a30', line: '#ff8a96' } : { size: 24 });
    desk.rr(g, px, 434, pw, 104, 12); g.fillStyle = '#131924'; g.fill();
    g.font = '500 20px ' + desk.FF;
    desk.L.wrap(RULES[st.game], pw - 28, (t) => g.measureText(t).width, 4).forEach((ln, k) => desk.label(g, ln, px + 14, 456 + k * 24, 20, '#aab3c2', 'left', 500, pw - 28));
    if (promo) {
      desk.label(g, 'Promote to:', px, 574, 20, '#ffffff', 'left', 700, 112);
      [[5, 'Q'], [4, 'R'], [3, 'B'], [2, 'N']].forEach(([t, ch], i) => desk.btn(p, px + 120 + i * 68, 548, 62, 52, ch, id + ':promo', t, { size: 26, on: i === 0 }));
    } else if (memo) {
      const b = st.best[st.msz === 24 ? 1 : 0];
      desk.label(g, 'Best: ' + (b ? b + ' moves' : 'none yet') + ' (' + (st.msz === 24 ? '6 x 4' : '4 x 4') + ')', px, 566, 20, '#f1f4f9', 'left', 600, pw);
      desk.label(g, 'Games finished: ' + st.tally.mem[0], px, 596, 20, '#aab3c2', 'left', 500, pw);
    } else {
      const t = st.tally[st.game];
      desk.label(g, 'Your record: ' + t[0] + ' won, ' + t[1] + ' lost, ' + t[2] + ' drawn', px, 566, 20, '#f1f4f9', 'left', 600, pw);
      desk.label(g, st.mode === 'ai' ? 'Against the Desk, you play first.' : 'Two players share this table.', px, 596, 20, '#aab3c2', 'left', 500, pw);
    }
  }

  /* ---------- taps ---------- */
  function tapChess(i) {
    const s = cur(), lg = legal();
    if (promo) { if (i === promo.t) play(lg.find((m) => m.f === promo.f && m.t === promo.t && m.p === 5)); else { promo = null; redraw(); } return; }
    if (sel >= 0) {
      const ms = lg.filter((m) => m.f === sel && m.t === i);
      if (ms.length > 1) { promo = { f: sel, t: i }; redraw(); return; }
      if (ms.length === 1) { play(ms[0]); return; }
    }
    sel = s.b[i] && Math.sign(s.b[i]) === s.turn && lg.some((m) => m.f === i) && sel !== i ? i : -1; redraw();
    function play(m) { if (!m) return; st.pos.chess = G.chessApply(s, m); moved(m.f, m.t); }
  }
  function tapChk(i) {
    const s = cur(), lg = legal();
    if (prefix.length) {
      if (i === prefix[0]) { prefix = []; sel = -1; redraw(); return; }
      const nexts = lg.filter((m) => m.path.length > prefix.length && prefix.every((q, k) => m.path[k] === q));
      if (nexts.some((m) => m.path[prefix.length] === i)) {
        prefix = prefix.concat(i);
        const done = lg.find((m) => m.path.length === prefix.length && prefix.every((q, k) => m.path[k] === q));
        if (done) { st.pos.chk = G.chkApply(s, done); moved(done.path[0], i); } else redraw();
        return;
      }
      if (prefix.length > 1) return;
    }
    if (s.b[i] && Math.sign(s.b[i]) === s.turn && lg.some((m) => m.path[0] === i)) { prefix = [i]; sel = i; } else { prefix = []; sel = -1; }
    redraw();
  }
  function tapMem(i) {
    const s = cur(), r = G.memFlip(s, i); if (!r) return;
    if (r === 'miss') hideAt = Date.now() + 900; else hideAt = 0;
    if (G.memDone(s)) {
      const k = s.z === 24 ? 1 : 0; st.tally.mem[0] = Math.min(9999, st.tally.mem[0] + 1);
      if (st.mode === 'ai' && (!st.best[k] || s.m < st.best[k])) { st.best[k] = s.m; desk.say('New best: ' + s.m + ' moves', 3000); }
      desk.beep(660, 0.2, 0.03);
    } else desk.beep(r === 'match' ? 740 : 420, 0.05, 0.02);
    save(); redraw();
  }
  function newGame() {
    const g = st.game, seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    st.pos[g] = g === 'chess' ? G.chessStart() : g === 'chk' ? G.chkNew() : g === 'c4' ? G.c4New() : g === 'rev' ? G.revNew() : G.memNew(st.msz, seed);
    sel = -1; prefix = []; promo = null; last = [-1, -1]; aiDue = 0; hideAt = 0; confirmNew = false; cacheS = null; save(); redraw();
  }

  sheet = desk.addSheet({
    id, title: 'Games', W: 1024, H: 640, w: 1.0, h: 0.625, home: { a: -0.95, e: 0.02, r: 1.6, k: 1 }, open: false,
    draw(p, g) {
      desk.base(p, 'Games');
      G.GAMES.forEach((k, i) => desk.btn(p, 246 + i * 148, 30, 144, 52, NAME[k], id + ':game', k, { on: st.game === k, size: 20 }));
      const k = st.game;
      if (k === 'chess') drawChess(p, g); else if (k === 'chk') drawChk(p, g); else if (k === 'c4') drawC4(p, g); else if (k === 'rev') drawRev(p, g); else drawMem(p, g);
      drawPanel(p, g);
    },
    act(name, arg) {
      if (name !== 'new') confirmNew = false;
      switch (name) {
        case 'game': if (G.GAMES.indexOf(arg) >= 0 && arg !== st.game) { st.game = arg; sel = -1; prefix = []; promo = null; last = [-1, -1]; aiDue = 0; cacheS = null; save(); if (isAi() && cur().turn === -1 && !over().over) aiDue = Date.now() + 500; redraw(); } return;
        case 'mode': if (arg === 'ai' || arg === 'two') { st.mode = arg; sel = -1; prefix = []; promo = null; aiDue = 0; save(); if (isAi() && cur().turn === -1 && !over().over) aiDue = Date.now() + 400; redraw(); } return;
        case 'lvl': if (arg === 0 || arg === 1) { st.lvl = arg; save(); redraw(); } return;
        case 'size': if ((arg === 16 || arg === 24) && arg !== st.msz) { st.msz = arg; hideAt = 0; st.pos.mem = G.memNew(arg, (Date.now() ^ (Math.random() * 1e9)) >>> 0); save(); redraw(); } return;
        case 'new': if (!confirmNew) { confirmNew = true; redraw(); } else newGame(); return;
        case 'promo': if (promo && [2, 3, 4, 5].indexOf(arg) >= 0) { const m = legal().find((q) => q.f === promo.f && q.t === promo.t && q.p === arg); if (m) { st.pos.chess = G.chessApply(cur(), m); moved(m.f, m.t); } } return;
        case 'tap': {
          if (!Number.isInteger(arg)) return;
          const k = st.game;
          if (k === 'mem') { if (arg >= 0 && arg < cur().z) tapMem(arg); return; }
          if (over().over || !humanTurn() || aiDue) return;
          if (k === 'c4') { const n = G.c4Drop(cur(), arg); if (!n) { desk.say('That column is full', 1500); return; } st.pos.c4 = n; moved(-1, n.last); return; }
          if (arg < 0 || arg > 63) return;
          if (k === 'rev') { const n = G.revPlay(cur(), arg); if (n) { st.pos.rev = n; moved(-1, arg); } return; }
          if (k === 'chess') tapChess(arg); else tapChk(arg);
        }
      }
    },
  });
}
