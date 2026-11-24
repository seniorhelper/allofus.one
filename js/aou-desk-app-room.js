/* allofus.one · the desk · app sheet: "Room" — potted plants and a soft ground mist (page "Plants"), and furniture with a lamp glow (page "Furniture").
   Everything is built in code (see aou-desk-decor.js and aou-desk-furniture.js).
   Plants: four spots: desk left corner, desk right corner, floor left, floor right. Plants are built only when you change them.
   Furniture: six pieces behind and beside the seat, facing it, never between you and the desk. Each is built the first time it is turned on, then just shown or hidden. */
import { PLANTS, makePlant, makeMist, disposeGroup } from './aou-desk-decor.js';
import { FURNITURE, makeFurniture } from './aou-desk-furniture.js';

export default function (desk) {
  const id = 'room';
  const SPOTS = [{ name: 'Desk, left corner', floor: false }, { name: 'Desk, right corner', floor: false }, { name: 'Floor, left', floor: true }, { name: 'Floor, right', floor: true }];
  const KINDS = SPOTS.map((s) => ['', ...PLANTS.filter((p) => p.floor === s.floor).map((p) => p.id)]);
  const NAME = { '': 'None' }; PLANTS.forEach((p) => { NAME[p.id] = p.name; });
  const FIDS = FURNITURE.map((f) => f.id);
  /* mood = [name, plants, mist, furniture (null = leave as it is), lamp glow] */
  const MOODS = [
    ['Greenhouse', ['aloe', 'pothos', 'fiddle', 'peace'], 1, null, 2],
    ['Zen corner', ['bonsai', 'bamboo', 'palm', 'snake'], 1, ['rug', 'sidetable', 'lamp'], 1],
    ['Lounge', ['pothos', 'fern', '', 'fiddle'], 0, ['couch', 'lamp', 'rug'], 2],
    ['Bare', ['', '', '', ''], 0, [], 2],
  ];
  const MIST = ['Off', 'Low', 'High'], LEVEL = [0, 0.5, 1];
  const GLOW = ['Off', 'Low', 'Warm'], GLOW_I = [0, 0.4, 1];
  /* where each piece stands, in rig-local metres (the seat is at 0, 0 and faces -z, the desk is in front): x, z, and whether it turns to face the seat */
  const FPOS = { couch: [-1.6, 0.3, true], armchair: [1.5, 0.3, true], lamp: [-1.95, 1.55, false], rug: [0, 0.25, false], shelf: [-1.0, 1.95, true], sidetable: [1.55, 1.25, false] };
  const st = { spots: ['fern', '', 'monstera', 'snake'], mist: 1, furn: [], lamp: 2 };
  /* saved settings are untrusted: every plant must be one that fits its spot, mist and lamp must be 0, 1 or 2, furniture must be known ids (each once) */
  try {
    const raw = JSON.parse(desk.store.get(id) || 'null');
    if (raw && typeof raw === 'object' && Array.isArray(raw.spots)) {
      st.spots = SPOTS.map((s, i) => (typeof raw.spots[i] === 'string' && KINDS[i].includes(raw.spots[i]) ? raw.spots[i] : ''));
      st.mist = [0, 1, 2].includes(raw.mist) ? raw.mist : 1;
      if (Array.isArray(raw.furn)) st.furn = FIDS.filter((f) => raw.furn.includes(f));
      st.lamp = [0, 1, 2].includes(raw.lamp) ? raw.lamp : 2;
    }
  } catch (e) { }
  const save = () => desk.store.set(id, JSON.stringify({ spots: st.spots, mist: st.mist, furn: st.furn, lamp: st.lamp }));

  const T = desk.T, group = new T.Group(); group.name = 'room-decor'; desk.rig.add(group);
  const built = [null, null, null, null], fbuilt = {};
  const mist = makeMist(T, { width: 3.4, depth: 2.6, height: 0.7, color: 0xdde8f0, seed: 77 }); group.add(mist.object);
  let sheet = null, lw = -1, ld = -1, lt = -1, page = 0;

  function place() {
    const D = desk.S.desk, top = desk.seat.top, w = D.w, d = D.d, FRONT = -0.2;
    lw = w; ld = d; lt = top;
    const inX = Math.min(0.15, w / 5), inZ = Math.min(0.15, d / 4), backZ = FRONT - d + inZ;
    const pos = [[-w / 2 + inX, top, backZ], [w / 2 - inX, top, backZ], [-(w / 2 + 0.5), 0, FRONT - d * 0.7], [w / 2 + 0.5, 0, FRONT - d * 0.7]];
    for (let i = 0; i < 4; i++) if (built[i]) built[i].position.set(pos[i][0], pos[i][1], pos[i][2]);
    mist.object.position.set(0, 0.01, FRONT - d / 2 - 0.2); mist.resize(w + 2.4, d + 1.8, 0.7);
  }
  function setSpot(i) {
    const want = st.spots[i];
    if (built[i] && built[i].userData.id === want) return;
    if (built[i]) { group.remove(built[i]); disposeGroup(built[i]); built[i] = null; }
    if (!want) return;
    const g = makePlant(T, want, 11 + i * 17);
    if (!g) return;
    g.rotation.y = i * 1.9 + 0.4;
    if (typeof desk.dim === 'function') g.userData.mats.forEach((m) => { try { desk.dim(m); } catch (e) { } });
    group.add(g); built[i] = g;
  }
  /* furniture is built once, the first time it is wanted; turning it off only hides it (so the dimming list never grows) */
  function setFurn(fid) {
    const on = st.furn.includes(fid);
    if (!fbuilt[fid]) {
      if (!on) return;
      const g = makeFurniture(T, fid, 31 + FIDS.indexOf(fid) * 13), p = FPOS[fid];
      if (!g || !p) return;
      g.position.set(p[0], 0, p[1]); g.rotation.y = p[2] ? Math.atan2(-p[0], -p[1]) : 0;
      if (typeof desk.dim === 'function') g.userData.mats.forEach((m) => { if (m !== g.userData.glow) { try { desk.dim(m); } catch (e) { } } });
      group.add(g); fbuilt[fid] = g; setGlow();
    }
    fbuilt[fid].visible = on;
  }
  function setGlow() { const g = fbuilt.lamp; if (g && g.userData.glow) g.userData.glow.emissiveIntensity = GLOW_I[st.lamp]; }
  function apply() { for (let i = 0; i < 4; i++) setSpot(i); FIDS.forEach(setFurn); setGlow(); mist.setLevel(LEVEL[st.mist]); place(); }
  apply();

  /* the mist drifts with the frame clock; plants move only when the desk size or height changed (numbers compared, nothing allocated) */
  desk.onFrame((now) => {
    if (st.mist > 0) mist.update(now);
    const D = desk.S.desk;
    if (D.w !== lw || D.d !== ld || desk.seat.top !== lt) place();
  });

  const sameSet = (a, b) => a.length === b.length && a.every((k) => b.includes(k));
  const moodNow = () => MOODS.findIndex((m) => m[2] === st.mist && m[1].every((k, i) => k === st.spots[i]) && (m[3] === null || (sameSet(m[3], st.furn) && m[4] === st.lamp)));
  const cycle = (i, dir) => { const list = KINDS[i], at = Math.max(0, list.indexOf(st.spots[i])); st.spots[i] = list[(at + dir + list.length) % list.length]; };

  sheet = desk.addSheet({
    id, title: 'Room', W: 640, H: 640, w: 0.62, h: 0.62, home: { a: -1.25, e: 0.05, r: 1.5, k: 1 }, open: false,
    draw(p, c) {
      desk.base(p, 'Room');
      desk.btn(p, 300, 30, 150, 52, 'Plants', id + ':page', 0, { size: 22, on: page === 0 });
      desk.btn(p, 458, 30, 150, 52, 'Furniture', id + ':page', 1, { size: 22, on: page === 1 });
      if (page === 0) {
        SPOTS.forEach((s, i) => {
          const y = 84 + i * 80;
          desk.label(c, s.name, 36, y + 12, 20, '#aab3c2');
          desk.btn(p, 36, y + 28, 60, 48, '‹', id + ':spot', [i, -1], { size: 32 });
          desk.label(c, NAME[st.spots[i]], 320, y + 53, 26, st.spots[i] ? '#f1f4f9' : '#8a93a3', 'center', 700, 400);
          desk.btn(p, 544, y + 28, 60, 48, '›', id + ':spot', [i, 1], { size: 32 });
        });
        desk.label(c, 'Mist', 36, 424, 22, '#f1f4f9', 'left', 700);
        MIST.forEach((n, i) => desk.btn(p, 36 + i * 196, 440, 184, 48, n, id + ':mist', i, { size: 24, on: st.mist === i }));
      } else {
        desk.label(c, 'Tap a piece to show or hide it.', 36, 112, 20, '#aab3c2');
        FURNITURE.forEach((f, i) => {
          const on = st.furn.includes(f.id), x = 36 + (i % 2) * 292, y = 134 + Math.floor(i / 2) * 72;
          desk.btn(p, x, y, 276, 56, f.name + (on ? ' · On' : ' · Off'), id + ':furn', f.id, { size: 22, on });
        });
        desk.label(c, 'Lamp glow', 36, 372, 22, '#f1f4f9', 'left', 700);
        GLOW.forEach((n, i) => desk.btn(p, 36 + i * 196, 388, 184, 48, n, id + ':lamp', i, { size: 24, on: st.lamp === i }));
        desk.label(c, 'Pieces stand behind and beside your seat, facing it,', 36, 464, 18, '#8a93a3');
        desk.label(c, 'never between you and the desk.', 36, 488, 18, '#8a93a3');
      }
      desk.label(c, 'Moods (sets everything)', 36, 514, 22, '#f1f4f9', 'left', 700);
      const mn = moodNow();
      MOODS.forEach(([n], i) => desk.btn(p, 36 + i * 146, 534, 140, 60, n, id + ':mood', i, { size: 20, on: mn === i }));
    },
    act(name, arg) {
      if (name === 'page' && (arg === 0 || arg === 1)) page = arg;
      else if (page === 0 && name === 'spot' && Array.isArray(arg) && arg[0] >= 0 && arg[0] < 4 && (arg[1] === 1 || arg[1] === -1)) { cycle(arg[0], arg[1]); setSpot(arg[0]); place(); }
      else if (page === 0 && name === 'mist' && (arg === 0 || arg === 1 || arg === 2)) { st.mist = arg; mist.setLevel(LEVEL[arg]); }
      else if (page === 1 && name === 'furn' && typeof arg === 'string' && FIDS.includes(arg)) { st.furn = st.furn.includes(arg) ? st.furn.filter((k) => k !== arg) : FIDS.filter((k) => k === arg || st.furn.includes(k)); setFurn(arg); }
      else if (page === 1 && name === 'lamp' && (arg === 0 || arg === 1 || arg === 2)) { st.lamp = arg; setGlow(); }
      else if (name === 'mood' && MOODS[arg]) { const m = MOODS[arg]; st.spots = m[1].slice(); st.mist = m[2]; if (m[3]) st.furn = FIDS.filter((k) => m[3].includes(k)); st.lamp = m[4]; apply(); }
      else return;
      if (name !== 'page') save();
      desk.redraw(sheet);
    },
  });
}
