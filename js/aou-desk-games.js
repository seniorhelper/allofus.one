/* allofus.one · the desk · games: pure rules and the Desk opponent (no DOM, no imports, no clock, no Math.random).
   Chess, Checkers (American draughts), Four in a row, Reversi and Memory match. All are classic public-domain games; every name,
   rule write-up and evaluation below is original to this file.
   Anything random takes a seeded generator from rng(seed). Functions that take a state return a NEW state; states are plain data.
   Saved text is untrusted: parseGames() rebuilds every field, checks every piece and never copies unknown keys. */

export const MATE = 100000;
export const GAMES = ['chess', 'chk', 'c4', 'rev', 'mem'];
export const GAME_NAME = { chess: 'Chess', chk: 'Checkers', c4: 'Four in a row', rev: 'Reversi', mem: 'Memory match' };

/* ---------- small helpers ---------- */
export function rng(seed) {
  let a = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
  return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}
export function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
const abs = Math.abs;
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const clampInt = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d);
const own = (o, k) => (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

/* =====================================================================================================
   CHESS. Board: 64 numbers, index = row * 8 + col, row 0 is rank 8 (top). White = +, black = -.
   Piece types 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king. Moves: { f, t, p (promotion type or 0), x (0 normal, 1 double push, 2 en passant, 3 castle short, 4 castle long) }
   ===================================================================================================== */
const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const CVAL = [0, 100, 320, 330, 500, 900, 0];
const FEN_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_CH = 'pnbrqk';

export function chessFromFen(fen) {
  if (typeof fen !== 'string' || fen.length > 100) return null;
  const f = fen.trim().split(/\s+/); if (f.length < 4 || f.length > 6) return null;
  const rows = f[0].split('/'); if (rows.length !== 8) return null;
  const b = new Array(64).fill(0); let nw = 0, nb = 0;
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') { c += +ch; continue; }
      const t = FEN_CH.indexOf(ch.toLowerCase()) + 1; if (t < 1 || ch.length !== 1 || c > 7) return null;
      const side = ch === ch.toUpperCase() ? 1 : -1; if (t === 1 && (r === 0 || r === 7)) return null;
      b[r * 8 + c] = side * t; c++; if (side > 0) nw++; else nb++;
    }
    if (c !== 8) return null;
  }
  if (nw > 16 || nb > 16) return null;
  let kw = 0, kb = 0; for (let i = 0; i < 64; i++) { if (b[i] === 6) kw++; else if (b[i] === -6) kb++; } if (kw !== 1 || kb !== 1) return null;
  if (f[1] !== 'w' && f[1] !== 'b') return null;
  if (!/^(-|[KQkq]{1,4})$/.test(f[2])) return null;
  const cast = [b[60] === 6 && b[63] === 4 && f[2].includes('K') ? 1 : 0, b[60] === 6 && b[56] === 4 && f[2].includes('Q') ? 1 : 0, b[4] === -6 && b[7] === -4 && f[2].includes('k') ? 1 : 0, b[4] === -6 && b[0] === -4 && f[2].includes('q') ? 1 : 0];
  let ep = -1;
  if (f[3] !== '-') {
    if (!/^[a-h][36]$/.test(f[3])) return null;
    const c = f[3].charCodeAt(0) - 97, r = 8 - +f[3][1];
    if (r === 2 && f[1] === 'w' && b[3 * 8 + c] === -1) ep = r * 8 + c; else if (r === 5 && f[1] === 'b' && b[4 * 8 + c] === 1) ep = r * 8 + c;
  }
  const half = f.length > 4 ? (/^\d{1,3}$/.test(f[4]) ? +f[4] : -1) : 0, full = f.length > 5 ? (/^\d{1,4}$/.test(f[5]) ? +f[5] : -1) : 1;
  if (half < 0 || half > 150 || full < 0 || full > 9999) return null;
  const s = { b, turn: f[1] === 'w' ? 1 : -1, cast, ep, half, full: Math.max(1, full) };
  if (attacked(b, kingSq(b, -s.turn), s.turn)) return null; /* the side that just moved may not leave its king attacked */
  return s;
}
export function chessToFen(s) {
  let out = '';
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let c = 0; c < 8; c++) { const p = s.b[r * 8 + c]; if (!p) { e++; continue; } if (e) { out += e; e = 0; } const ch = FEN_CH[abs(p) - 1]; out += p > 0 ? ch.toUpperCase() : ch; }
    if (e) out += e; if (r < 7) out += '/';
  }
  const cs = (s.cast[0] ? 'K' : '') + (s.cast[1] ? 'Q' : '') + (s.cast[2] ? 'k' : '') + (s.cast[3] ? 'q' : '');
  const ep = s.ep >= 0 ? String.fromCharCode(97 + (s.ep & 7)) + (8 - (s.ep >> 3)) : '-';
  return out + ' ' + (s.turn > 0 ? 'w' : 'b') + ' ' + (cs || '-') + ' ' + ep + ' ' + s.half + ' ' + s.full;
}
export const chessStart = () => chessFromFen(FEN_START);

function kingSq(b, side) { const k = side * 6; for (let i = 0; i < 64; i++) if (b[i] === k) return i; return -1; }
function attacked(b, sq, by) {
  const r = sq >> 3, c = sq & 7, pr = r + by;
  if (pr >= 0 && pr < 8) { if (c > 0 && b[pr * 8 + c - 1] === by) return true; if (c < 7 && b[pr * 8 + c + 1] === by) return true; }
  for (const [dr, dc] of KN) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === by * 2) return true; }
  for (const [dr, dc] of KG) { const rr = r + dr, cc = c + dc; if (inb(rr, cc) && b[rr * 8 + cc] === by * 6) return true; }
  for (const [dr, dc] of DG) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = b[rr * 8 + cc]; if (p) { if (p === by * 3 || p === by * 5) return true; break; } rr += dr; cc += dc; } }
  for (const [dr, dc] of OR) { let rr = r + dr, cc = c + dc; while (inb(rr, cc)) { const p = b[rr * 8 + cc]; if (p) { if (p === by * 4 || p === by * 5) return true; break; } rr += dr; cc += dc; } }
  return false;
}
export const chessInCheck = (s) => attacked(s.b, kingSq(s.b, s.turn), -s.turn);

function genPseudo(s, caps) {
  const b = s.b, side = s.turn, out = [];
  const addP = (f, t, last) => { if (last) { if (caps) out.push({ f, t, p: 5, x: 0 }); else for (const p of [5, 4, 3, 2]) out.push({ f, t, p, x: 0 }); } else out.push({ f, t, p: 0, x: 0 }); };
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || sgn(p) !== side) continue;
    const t = abs(p), r = i >> 3, c = i & 7;
    if (t === 1) {
      const dr = -side, nr = r + dr, last = nr === 0 || nr === 7;
      if (nr >= 0 && nr < 8) {
        if (b[nr * 8 + c] === 0 && (!caps || last)) {
          addP(i, nr * 8 + c, last);
          if (!caps && r === (side > 0 ? 6 : 1) && b[(nr + dr) * 8 + c] === 0) out.push({ f: i, t: (nr + dr) * 8 + c, p: 0, x: 1 });
        }
        for (const dc of [-1, 1]) {
          const nc = c + dc; if (nc < 0 || nc > 7) continue;
          const to = nr * 8 + nc, tp = b[to];
          if (tp && sgn(tp) === -side) addP(i, to, last); else if (!tp && to === s.ep) out.push({ f: i, t: to, p: 0, x: 2 });
        }
      }
    } else if (t === 2 || t === 6) {
      for (const [dr, dc] of t === 2 ? KN : KG) {
        const rr = r + dr, cc = c + dc; if (!inb(rr, cc)) continue;
        const to = rr * 8 + cc, tp = b[to]; if (tp && sgn(tp) === side) continue; if (caps && !tp) continue;
        out.push({ f: i, t: to, p: 0, x: 0 });
      }
      if (t === 6 && !caps) {
        const home = side > 0 ? 60 : 4, base = side > 0 ? 0 : 2;
        if (i === home && !attacked(b, i, -side)) {
          if (s.cast[base] && b[i + 1] === 0 && b[i + 2] === 0 && b[i + 3] === side * 4 && !attacked(b, i + 1, -side) && !attacked(b, i + 2, -side)) out.push({ f: i, t: i + 2, p: 0, x: 3 });
          if (s.cast[base + 1] && b[i - 1] === 0 && b[i - 2] === 0 && b[i - 3] === 0 && b[i - 4] === side * 4 && !attacked(b, i - 1, -side) && !attacked(b, i - 2, -side)) out.push({ f: i, t: i - 2, p: 0, x: 4 });
        }
      }
    } else {
      for (const [dr, dc] of t === 3 ? DG : t === 4 ? OR : KG) {
        let rr = r + dr, cc = c + dc;
        while (inb(rr, cc)) {
          const to = rr * 8 + cc, tp = b[to];
          if (tp) { if (sgn(tp) === -side) out.push({ f: i, t: to, p: 0, x: 0 }); break; }
          if (!caps) out.push({ f: i, t: to, p: 0, x: 0 });
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}
export function chessApply(s, m) {
  const b = s.b.slice(), side = s.turn, p = b[m.f], t = abs(p), cap = b[m.t] !== 0 || m.x === 2;
  b[m.f] = 0; b[m.t] = m.p ? side * m.p : p;
  if (m.x === 2) b[m.t + 8 * side] = 0;
  else if (m.x === 3) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = 0; } else if (m.x === 4) { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = 0; }
  const cast = s.cast.slice();
  if (t === 6) { if (side > 0) { cast[0] = 0; cast[1] = 0; } else { cast[2] = 0; cast[3] = 0; } }
  for (const q of [m.f, m.t]) { if (q === 63) cast[0] = 0; else if (q === 56) cast[1] = 0; else if (q === 7) cast[2] = 0; else if (q === 0) cast[3] = 0; }
  return { b, turn: -side, cast, ep: m.x === 1 ? (m.f + m.t) >> 1 : -1, half: t === 1 || cap ? 0 : s.half + 1, full: s.full + (side < 0 ? 1 : 0) };
}
export function chessLegal(s) {
  const out = [], me = s.turn;
  for (const m of genPseudo(s, false)) { const n = chessApply(s, m); if (!attacked(n.b, kingSq(n.b, me), -me)) out.push(m); }
  return out;
}
function legalCaps(s) {
  const out = [], me = s.turn;
  for (const m of genPseudo(s, true)) { const n = chessApply(s, m); if (!attacked(n.b, kingSq(n.b, me), -me)) out.push(m); }
  return out;
}
function insufficient(b) {
  const other = []; for (let i = 0; i < 64; i++) { const t = abs(b[i]); if (t && t !== 6) other.push(i); }
  if (!other.length) return true;
  if (other.length === 1) { const t = abs(b[other[0]]); return t === 2 || t === 3; }
  if (other.every((i) => abs(b[i]) === 3)) { const col = ((other[0] >> 3) + (other[0] & 7)) & 1; return other.every((i) => (((i >> 3) + (i & 7)) & 1) === col); }
  return false;
}
/* { over, kind: 'mate' | 'stalemate' | 'material' | 'fifty' | '', winner: 1 | -1 | 0, check } */
export function chessStatus(s, legal) {
  const mv = legal || chessLegal(s), chk = chessInCheck(s);
  if (!mv.length) return chk ? { over: true, kind: 'mate', winner: -s.turn, check: true } : { over: true, kind: 'stalemate', winner: 0, check: false };
  if (insufficient(s.b)) return { over: true, kind: 'material', winner: 0, check: chk };
  if (s.half >= 100) return { over: true, kind: 'fifty', winner: 0, check: chk };
  return { over: false, kind: '', winner: 0, check: chk };
}
export function chessPerft(s, d) {
  if (d <= 0) return 1;
  const ms = chessLegal(s); if (d === 1) return ms.length;
  let n = 0; for (const m of ms) n += chessPerft(chessApply(s, m), d - 1); return n;
}
/* simple evaluation, white's point of view: material plus small position bonuses worked out from formulas (centre, advance, king safety) */
export function chessEval(s) {
  const b = s.b; let sc = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p) continue;
    const side = sgn(p), t = abs(p), r = i >> 3, c = i & 7, adv = side > 0 ? 7 - r : r;
    const k = 7 - abs(r - 3.5) - abs(c - 3.5) - 0; /* 0 at the corners .. 7 at the middle */
    let v = CVAL[t];
    if (t === 1) v += adv * adv * 2 + (c === 3 || c === 4 ? adv * 4 : 0);
    else if (t === 2) v += k * 8;
    else if (t === 3) v += k * 5;
    else if (t === 4) v += adv === 6 ? 12 : 0;
    else if (t === 5) v += k * 2;
    else v += adv === 0 ? (c === 1 || c === 2 || c === 6 ? 25 : 8) : -adv * 12;
    sc += side * v;
  }
  return sc;
}
export function chessMaterial(s) { /* [white, black] material counts (pawns 1 .. queen 9) */
  const val = [0, 1, 3, 3, 5, 9, 0], o = [0, 0]; for (let i = 0; i < 64; i++) { const p = s.b[i]; if (p) o[p > 0 ? 0 : 1] += val[abs(p)]; } return o;
}
const SEED_ORDER = (b, ms) => { for (const m of ms) { const v = b[m.t]; m.k = (v ? 10 * CVAL[abs(v)] - CVAL[abs(b[m.f])] / 10 : m.x === 2 ? 1000 : 0) + (m.p ? CVAL[m.p] : 0); } ms.sort((x, y) => y.k - x.k); };
/* Desk move: iterative deepening alpha-beta. cap = hard limit on searched positions; when it is hit the best move of the last finished pass (or the best so far) is used. */
export function chessBest(s, depth, rand, cap) {
  cap = cap || 2500; rand = rand || rng(1);
  const root = chessLegal(s); if (!root.length) return null; if (root.length === 1) return root[0];
  shuffle(root, rand); SEED_ORDER(s.b, root);
  let nodes = 0, stop = false;
  const quiet = (n, alpha, beta, qd) => {
    const stand = chessEval(n) * n.turn;
    if (stand >= beta) return beta; if (stand > alpha) alpha = stand; if (qd <= 0) return alpha;
    const ms = legalCaps(n); SEED_ORDER(n.b, ms);
    for (const m of ms) {
      if (++nodes > cap) { stop = true; return 0; }
      const sc = -quiet(chessApply(n, m), -beta, -alpha, qd - 1); if (stop) return 0;
      if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
    }
    return alpha;
  };
  const nega = (n, d, alpha, beta, ply) => {
    if (++nodes > cap) { stop = true; return 0; }
    if (d <= 0) return quiet(n, alpha, beta, 2);
    const ms = chessLegal(n);
    if (!ms.length) return chessInCheck(n) ? -MATE + ply : 0;
    if (n.half >= 100) return 0;
    SEED_ORDER(n.b, ms);
    for (const m of ms) {
      const sc = -nega(chessApply(n, m), d - 1, -beta, -alpha, ply + 1); if (stop) return 0;
      if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
    }
    return alpha;
  };
  let best = root[0];
  for (let d = 1; d <= depth; d++) {
    let bm = null, bs = -Infinity;
    for (const m of root) {
      const sc = -nega(chessApply(s, m), d - 1, -Infinity, bs === -Infinity ? Infinity : -bs, 1);
      if (stop) break;
      if (sc > bs) { bs = sc; bm = m; }
    }
    if (bm) { best = bm; const i = root.indexOf(bm); root.splice(i, 1); root.unshift(bm); }
    if (stop || bs > MATE - 50) break;
  }
  return best;
}

/* =====================================================================================================
   CHECKERS (American draughts, 8x8). Dark squares are those with (row + col) odd. Side 1 (Red) starts at the bottom, moves first and goes
   up; side -1 (Cream) starts at the top. Pieces: 1 man, 2 king, times the side. A capture is forced; a man that is crowned stops its jump.
   Moves: { path: [squares...], caps: [captured squares...] }
   ===================================================================================================== */
export function chkNew() {
  const b = new Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) & 1) { if (r < 3) b[r * 8 + c] = -1; else if (r > 4) b[r * 8 + c] = 1; }
  return { b, turn: 1, quiet: 0 };
}
const chkDirs = (p) => (abs(p) === 2 ? DG : p > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
const chkCrown = (side, sq) => (side > 0 ? sq >> 3 === 0 : sq >> 3 === 7);
export function chkMoves(s) {
  const b = s.b, side = s.turn, jumps = [], steps = [];
  const dfs = (origin, p, at, path, caps) => {
    let more = false;
    for (const [dr, dc] of chkDirs(p)) {
      const r = (at >> 3), c = at & 7, mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
      if (!inb(lr, lc)) continue;
      const mid = mr * 8 + mc, land = lr * 8 + lc;
      if (sgn(b[mid]) !== -side || caps.indexOf(mid) >= 0) continue;
      if (b[land] !== 0 && land !== origin) continue;
      more = true; const np = path.concat(land), nc = caps.concat(mid);
      if (abs(p) === 1 && chkCrown(side, land)) jumps.push({ path: np, caps: nc }); else dfs(origin, p, land, np, nc);
    }
    if (!more && caps.length) jumps.push({ path, caps });
  };
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || sgn(p) !== side) continue;
    dfs(i, p, i, [i], []);
    if (!jumps.length) for (const [dr, dc] of chkDirs(p)) { const r = (i >> 3) + dr, c = (i & 7) + dc; if (inb(r, c) && b[r * 8 + c] === 0) steps.push({ path: [i, r * 8 + c], caps: [] }); }
  }
  return jumps.length ? jumps : steps;
}
export function chkApply(s, m) {
  const b = s.b.slice(), from = m.path[0], to = m.path[m.path.length - 1], p = b[from], side = sgn(p);
  b[from] = 0; for (const q of m.caps) b[q] = 0;
  b[to] = abs(p) === 1 && chkCrown(side, to) ? side * 2 : p;
  return { b, turn: -s.turn, quiet: m.caps.length || abs(p) === 1 ? 0 : s.quiet + 1 };
}
export function chkStatus(s, moves) {
  const mv = moves || chkMoves(s);
  if (!mv.length) return { over: true, winner: -s.turn, kind: 'blocked' };
  if (s.quiet >= 80) return { over: true, winner: 0, kind: 'quiet' };
  return { over: false, winner: 0, kind: '' };
}
export function chkCount(s) { const o = { r: 0, c: 0, rk: 0, ck: 0 }; for (const p of s.b) { if (p > 0) { o.r++; if (p === 2) o.rk++; } else if (p < 0) { o.c++; if (p === -2) o.ck++; } } return o; }
export function chkEval(s) {
  let sc = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i]; if (!p) continue;
    const side = sgn(p), r = i >> 3, c = i & 7;
    let v;
    if (abs(p) === 2) v = 175 + (c > 1 && c < 6 && r > 1 && r < 6 ? 6 : 0);
    else { const adv = side > 0 ? 7 - r : r; v = 100 + adv * 5 + (adv === 0 ? 8 : 0) + (c > 1 && c < 6 ? 3 : 0); }
    sc += side * v;
  }
  return sc;
}
export function chkBest(s, depth, rand) {
  rand = rand || rng(1);
  const root = chkMoves(s); if (!root.length) return null; if (root.length === 1) return root[0];
  shuffle(root, rand);
  const nega = (n, d, alpha, beta, ply) => {
    const ms = chkMoves(n);
    if (!ms.length) return -MATE + ply;
    if (n.quiet >= 80) return 0;
    if (d <= 0) return chkEval(n) * n.turn;
    for (const m of ms) { const sc = -nega(chkApply(n, m), d - 1, -beta, -alpha, ply + 1); if (sc >= beta) return beta; if (sc > alpha) alpha = sc; }
    return alpha;
  };
  let best = root[0], bs = -Infinity;
  for (const m of root) { const sc = -nega(chkApply(s, m), depth - 1, -Infinity, bs === -Infinity ? Infinity : -bs, 1); if (sc > bs) { bs = sc; best = m; } }
  return best;
}

/* =====================================================================================================
   FOUR IN A ROW. 7 columns, 6 rows, index = row * 7 + col, row 0 is the top. Side 1 moves first.
   ===================================================================================================== */
export const C4W = 7, C4H = 6;
const C4WINS = (() => { const o = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) { const e = [], rr = r + 3 * dr, cc = c + 3 * dc; if (rr < 0 || rr > 5 || cc < 0 || cc > 6) continue; for (let k = 0; k < 4; k++) e.push((r + k * dr) * 7 + c + k * dc); o.push(e); } return o; })();
export const c4New = () => ({ b: new Array(42).fill(0), turn: 1, n: 0, last: -1 });
export function c4Row(b, col) { if (!(col >= 0 && col < 7)) return -1; for (let r = 5; r >= 0; r--) if (b[r * 7 + col] === 0) return r; return -1; }
export function c4Drop(s, col) {
  const r = c4Row(s.b, col); if (r < 0) return null;
  const b = s.b.slice(); b[r * 7 + col] = s.turn; return { b, turn: -s.turn, n: s.n + 1, last: r * 7 + col };
}
export function c4Line(b) { for (const w of C4WINS) { const v = b[w[0]]; if (v && v === b[w[1]] && v === b[w[2]] && v === b[w[3]]) return w; } return null; }
export function c4Status(s) { const l = c4Line(s.b); if (l) return { over: true, winner: s.b[l[0]], line: l }; if (s.n >= 42 || s.b.every((v) => v)) return { over: true, winner: 0, line: null }; return { over: false, winner: 0, line: null }; }
const C4ORDER = [3, 2, 4, 1, 5, 0, 6];
function c4WinAt(b, idx, v) {
  const r = (idx / 7) | 0, c = idx % 7;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let n = 1;
    for (let k = 1; k < 4; k++) { const rr = r + k * dr, cc = c + k * dc; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== v) break; n++; }
    for (let k = 1; k < 4; k++) { const rr = r - k * dr, cc = c - k * dc; if (rr < 0 || rr > 5 || cc < 0 || cc > 6 || b[rr * 7 + cc] !== v) break; n++; }
    if (n >= 4) return true;
  }
  return false;
}
function c4Eval(b, me) {
  let sc = 0;
  for (const w of C4WINS) {
    let m = 0, o = 0; for (let k = 0; k < 4; k++) { const v = b[w[k]]; if (v === me) m++; else if (v) o++; }
    if (m && o) continue;
    if (m === 3) sc += 6; else if (m === 2) sc += 2; else if (o === 3) sc -= 6; else if (o === 2) sc -= 2;
  }
  for (let r = 0; r < 6; r++) { const v = b[r * 7 + 3]; if (v === me) sc += 2; else if (v) sc -= 2; }
  return sc;
}
export function c4Best(s, depth, rand) {
  rand = rand || rng(1);
  const b = s.b.slice(), me = s.turn;
  const search = (turn, d, alpha, beta, ply) => {
    let any = false;
    for (const col of C4ORDER) {
      const r = c4Row(b, col); if (r < 0) continue; any = true;
      const idx = r * 7 + col; b[idx] = turn;
      let sc;
      if (c4WinAt(b, idx, turn)) sc = MATE - ply; else if (d <= 1) sc = c4Eval(b, turn); else sc = -search(-turn, d - 1, -beta, -alpha, ply + 1);
      b[idx] = 0;
      if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
    }
    return any ? alpha : 0;
  };
  /* at the root, equal-looking columns are collected and one is picked with the seeded random */
  let bestScore = -Infinity, pool = [];
  for (const col of C4ORDER) {
    const r = c4Row(b, col); if (r < 0) continue;
    const idx = r * 7 + col; b[idx] = me; let sc;
    if (c4WinAt(b, idx, me)) sc = MATE; else if (depth <= 1) sc = c4Eval(b, me); else sc = -search(-me, depth - 1, -Infinity, Infinity, 1);
    b[idx] = 0;
    if (sc > bestScore) { bestScore = sc; pool = [col]; } else if (sc === bestScore) pool.push(col);
  }
  return pool.length ? pool[Math.floor(rand() * pool.length)] : -1;
}

/* =====================================================================================================
   REVERSI (8x8). Side 1 = Black moves first; -1 = White. State { b, turn, passed (side that had to pass last move, 0 if none) }
   ===================================================================================================== */
const ALL8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export function revNew() { const b = new Array(64).fill(0); b[27] = -1; b[28] = 1; b[35] = 1; b[36] = -1; return { b, turn: 1, passed: 0 }; }
export function revFlips(b, sq, side) {
  if (b[sq] !== 0) return [];
  const out = [], r0 = sq >> 3, c0 = sq & 7;
  for (const [dr, dc] of ALL8) {
    const line = []; let r = r0 + dr, c = c0 + dc;
    while (inb(r, c) && b[r * 8 + c] === -side) { line.push(r * 8 + c); r += dr; c += dc; }
    if (line.length && inb(r, c) && b[r * 8 + c] === side) for (const q of line) out.push(q);
  }
  return out;
}
export function revMovesFor(b, side) { const o = []; for (let i = 0; i < 64; i++) { if (b[i]) continue; const f = revFlips(b, i, side); if (f.length) o.push({ sq: i, fl: f }); } return o; }
export const revMoves = (s) => revMovesFor(s.b, s.turn);
function revHas(b, side) { for (let i = 0; i < 64; i++) if (!b[i] && revFlips(b, i, side).length) return true; return false; }
/* make the state consistent: if the side to move cannot move but the other can, the turn passes */
export function revNormal(s) {
  if (revHas(s.b, s.turn)) return s;
  if (revHas(s.b, -s.turn)) return { b: s.b, turn: -s.turn, passed: s.turn };
  return s;
}
export function revPlay(s, sq) {
  const f = revFlips(s.b, sq, s.turn); if (!f.length) return null;
  const b = s.b.slice(); b[sq] = s.turn; for (const q of f) b[q] = s.turn;
  return revNormal({ b, turn: -s.turn, passed: 0 });
}
export function revCount(b) { let x = 0, o = 0; for (let i = 0; i < 64; i++) { if (b[i] === 1) x++; else if (b[i] === -1) o++; } return { black: x, white: o }; }
export function revStatus(s) {
  const n = revCount(s.b);
  if (revHas(s.b, 1) || revHas(s.b, -1)) return { over: false, winner: 0, passed: s.passed, black: n.black, white: n.white };
  return { over: true, winner: n.black > n.white ? 1 : n.white > n.black ? -1 : 0, passed: 0, black: n.black, white: n.white };
}
const REVW = (() => { const q = [[100, -20, 10, 5], [-20, -50, -2, -2], [10, -2, 1, 1], [5, -2, 1, 0]], w = new Array(64); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) w[r * 8 + c] = q[r < 4 ? r : 7 - r][c < 4 ? c : 7 - c]; return w; })();
function revEval(b, side) {
  let sc = 0, x = 0, o = 0; for (let i = 0; i < 64; i++) { if (b[i]) { sc += REVW[i] * b[i]; if (b[i] === 1) x++; else o++; } }
  sc *= side; if (x + o > 54) sc += (side > 0 ? x - o : o - x) * 6;
  return sc + (revMovesFor(b, side).length - revMovesFor(b, -side).length) * 5;
}
export function revBest(s, depth, rand) {
  rand = rand || rng(1);
  const root = revMoves(s); if (!root.length) return -1; if (root.length === 1) return root[0].sq;
  shuffle(root, rand);
  const nega = (b, side, d, alpha, beta, passedOnce) => {
    let ms = revMovesFor(b, side);
    if (!ms.length) {
      if (passedOnce || !revMovesFor(b, -side).length) { const n = revCount(b), diff = (n.black - n.white) * side; return diff > 0 ? 5000 + diff : diff < 0 ? -5000 + diff : 0; }
      return -nega(b, -side, d, -beta, -alpha, true);
    }
    if (d <= 0) return revEval(b, side);
    ms.sort((p, q) => REVW[q.sq] - REVW[p.sq]);
    for (const m of ms) {
      const nb = b.slice(); nb[m.sq] = side; for (const q of m.fl) nb[q] = side;
      const sc = -nega(nb, -side, d - 1, -beta, -alpha, false); if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
    }
    return alpha;
  };
  let best = root[0].sq, bs = -Infinity;
  for (const m of root) {
    const nb = s.b.slice(); nb[m.sq] = s.turn; for (const q of m.fl) nb[q] = s.turn;
    const sc = -nega(nb, -s.turn, depth - 1, -Infinity, bs === -Infinity ? Infinity : -bs, false);
    if (sc > bs) { bs = sc; best = m.sq; }
  }
  return best;
}

/* =====================================================================================================
   MEMORY MATCH. z = 16 (4x4) or 24 (6x4) cards, z/2 pairs. 12 symbols exist (the sheet draws them).
   State { s: symbols, f: faces (0 down, 1 up, 2 matched), a, b: the two turned-up cards (-1 none), pend: two turned-up cards do not match,
   m: moves, turn: 1 | -1 (two players), sc: [pairs of player 1, pairs of player 2], z }
   ===================================================================================================== */
export const MEM_SYMBOLS = 12;
export function memNew(z, seed) {
  z = z === 24 ? 24 : 16; const s = [];
  for (let i = 0; i < z / 2; i++) { s.push(i, i); }
  shuffle(s, rng(seed));
  return { s, f: new Array(z).fill(0), a: -1, b: -1, pend: false, m: 0, turn: 1, sc: [0, 0], z };
}
export function memResolve(st) {
  if (!st.pend) return false;
  st.f[st.a] = 0; st.f[st.b] = 0; st.a = -1; st.b = -1; st.pend = false; st.turn = -st.turn; return true;
}
/* returns '' (ignored), 'first', 'match' or 'miss'. Changes st in place. */
export function memFlip(st, i) {
  if (!Number.isInteger(i) || i < 0 || i >= st.z) return '';
  if (st.pend) memResolve(st);
  if (st.f[i] !== 0 || memDone(st)) return '';
  st.f[i] = 1;
  if (st.a < 0) { st.a = i; return 'first'; }
  st.b = i; st.m++;
  if (st.s[st.a] === st.s[i]) { st.f[st.a] = 2; st.f[i] = 2; st.sc[st.turn > 0 ? 0 : 1]++; st.a = -1; st.b = -1; return 'match'; }
  st.pend = true; return 'miss';
}
export const memDone = (st) => st.f.every((v) => v === 2);

/* =====================================================================================================
   THE DESK MOVE, one entry point for the sheet. Returns { state, from, to } (from/to are squares for the highlight, -1 if none) or null.
   lvl 0 = Easy, 1 = Normal.
   ===================================================================================================== */
export const DEPTH = { chess: [1, 3], chk: [2, 5], c4: [2, 6], rev: [1, 4] };
export function aiMove(game, state, lvl, rand) {
  const d = (DEPTH[game] || [1, 1])[lvl ? 1 : 0];
  if (game === 'chess') { const m = chessBest(state, d, rand, 2500); return m ? { state: chessApply(state, m), from: m.f, to: m.t } : null; }
  if (game === 'chk') { const m = chkBest(state, d, rand); return m ? { state: chkApply(state, m), from: m.path[0], to: m.path[m.path.length - 1] } : null; }
  if (game === 'c4') { const c = c4Best(state, d, rand); const n = c >= 0 ? c4Drop(state, c) : null; return n ? { state: n, from: -1, to: n.last } : null; }
  if (game === 'rev') { const q = revBest(state, d, rand); const n = q >= 0 ? revPlay(state, q) : null; return n ? { state: n, from: -1, to: q } : null; }
  return null;
}

/* =====================================================================================================
   SAVED STATE. parseGames() always returns a complete, valid object; anything unreadable falls back to a fresh game.
   ===================================================================================================== */
const RAW_MAX = 20000;
export function gamesDefault() {
  return { game: 'chess', mode: 'ai', lvl: 0, msz: 16, tally: { chess: [0, 0, 0], chk: [0, 0, 0], c4: [0, 0, 0], rev: [0, 0, 0], mem: [0, 0, 0] }, best: [0, 0], pos: { chess: chessStart(), chk: chkNew(), c4: c4New(), rev: revNew(), mem: memNew(16, 1) } };
}
const CH_MAP = { '.': 0, r: 1, R: 2, c: -1, C: -2 };
function chkParse(o) {
  const str = own(o, 'b'), t = own(o, 't'); if (typeof str !== 'string' || str.length !== 64 || (t !== 'r' && t !== 'c')) return null;
  const b = []; let nr = 0, nc = 0;
  for (let i = 0; i < 64; i++) {
    const v = own(CH_MAP, str[i]); if (v === undefined) return null;
    if (v && !(((i >> 3) + (i & 7)) & 1)) return null;
    if (v === 1 && i >> 3 === 0) return null; if (v === -1 && i >> 3 === 7) return null;
    if (v > 0) nr++; else if (v < 0) nc++; b.push(v);
  }
  if (nr > 12 || nc > 12) return null;
  return { b, turn: t === 'r' ? 1 : -1, quiet: clampInt(own(o, 'q'), 0, 200, 0) };
}
const chkSer = (s) => ({ b: s.b.map((v) => (v === 0 ? '.' : v === 1 ? 'r' : v === 2 ? 'R' : v === -1 ? 'c' : 'C')).join(''), t: s.turn > 0 ? 'r' : 'c', q: s.quiet });
function c4Parse(o) {
  const str = own(o, 'b'); if (typeof str !== 'string' || str.length !== 42) return null;
  const b = []; let nx = 0, no = 0;
  for (const ch of str) { if (ch === '.') b.push(0); else if (ch === 'x') { b.push(1); nx++; } else if (ch === 'o') { b.push(-1); no++; } else return null; }
  if (nx - no !== 0 && nx - no !== 1) return null;
  for (let c = 0; c < 7; c++) { let seen = false; for (let r = 0; r < 6; r++) { if (b[r * 7 + c]) seen = true; else if (seen) return null; } }
  return { b, turn: nx === no ? 1 : -1, n: nx + no, last: -1 };
}
const c4Ser = (s) => ({ b: s.b.map((v) => (v === 0 ? '.' : v === 1 ? 'x' : 'o')).join('') });
function revParse(o) {
  const str = own(o, 'b'), t = own(o, 't'); if (typeof str !== 'string' || str.length !== 64 || (t !== 'x' && t !== 'o')) return null;
  const b = []; let n = 0;
  for (const ch of str) { if (ch === '.') b.push(0); else if (ch === 'x') { b.push(1); n++; } else if (ch === 'o') { b.push(-1); n++; } else return null; }
  if (n < 4) return null;
  return revNormal({ b, turn: t === 'x' ? 1 : -1, passed: 0 });
}
const revSer = (s) => ({ b: s.b.map((v) => (v === 0 ? '.' : v === 1 ? 'x' : 'o')).join(''), t: s.turn > 0 ? 'x' : 'o' });
function memParse(o) {
  const sy = own(o, 's'), fs = own(o, 'f'); if (!Array.isArray(sy) || (sy.length !== 16 && sy.length !== 24) || typeof fs !== 'string' || fs.length !== sy.length) return null;
  const z = sy.length, cnt = new Array(MEM_SYMBOLS).fill(0), s = [];
  for (const v of sy) { if (!Number.isInteger(v) || v < 0 || v >= z / 2) return null; cnt[v]++; s.push(v); }
  for (let i = 0; i < z / 2; i++) if (cnt[i] !== 2) return null;
  const f = []; for (const ch of fs) { if (ch !== '0' && ch !== '2') return null; f.push(ch === '2' ? 2 : 0); }
  for (let i = 0; i < z; i++) if (f[i] === 2) { const j = s.findIndex((v, k) => v === s[i] && k !== i); if (f[j] !== 2) return null; }
  const sc = own(o, 'sc'), p1 = Array.isArray(sc) ? clampInt(sc[0], 0, 12, 0) : 0, p2 = Array.isArray(sc) ? clampInt(sc[1], 0, 12, 0) : 0;
  return { s, f, a: -1, b: -1, pend: false, m: clampInt(own(o, 'm'), 0, 9999, 0), turn: own(o, 't') === -1 ? -1 : 1, sc: [p1, p2], z };
}
const memSer = (st) => ({ s: st.s, f: st.f.map((v) => (v === 2 ? '2' : '0')).join(''), m: st.m, t: st.turn, sc: st.sc });
export function parseGames(text) {
  const d = gamesDefault();
  if (typeof text !== 'string' || text.length > RAW_MAX) return d;
  let o; try { o = JSON.parse(text); } catch (e) { return d; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return d;
  const g = own(o, 'game'); if (GAMES.indexOf(g) >= 0) d.game = g;
  d.mode = own(o, 'mode') === 'two' ? 'two' : 'ai'; d.lvl = own(o, 'lvl') === 1 ? 1 : 0; d.msz = own(o, 'msz') === 24 ? 24 : 16;
  const tl = own(o, 'tally'); if (tl && typeof tl === 'object') for (const k of GAMES) { const a = own(tl, k); if (Array.isArray(a)) d.tally[k] = [clampInt(a[0], 0, 9999, 0), clampInt(a[1], 0, 9999, 0), clampInt(a[2], 0, 9999, 0)]; }
  const bs = own(o, 'best'); if (Array.isArray(bs)) d.best = [clampInt(bs[0], 0, 9999, 0), clampInt(bs[1], 0, 9999, 0)];
  const ps = own(o, 'pos');
  if (ps && typeof ps === 'object') {
    const ch = chessFromFen(own(ps, 'chess')); if (ch) d.pos.chess = ch;
    const ck = chkParse(own(ps, 'chk')); if (ck) d.pos.chk = ck;
    const c4 = c4Parse(own(ps, 'c4')); if (c4) d.pos.c4 = c4;
    const rv = revParse(own(ps, 'rev')); if (rv) d.pos.rev = rv;
    const mm = memParse(own(ps, 'mem')); if (mm) d.pos.mem = mm;
  }
  if (d.pos.mem.z !== d.msz) d.msz = d.pos.mem.z;
  return d;
}
export function serializeGames(st) {
  return JSON.stringify({ v: 1, game: st.game, mode: st.mode, lvl: st.lvl, msz: st.msz, tally: st.tally, best: st.best, pos: { chess: chessToFen(st.pos.chess), chk: chkSer(st.pos.chk), c4: c4Ser(st.pos.c4), rev: revSer(st.pos.rev), mem: memSer(st.pos.mem) } });
}
