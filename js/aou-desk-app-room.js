/* allofus.one · the desk · app sheet: "Room" — potted plants and a soft ground mist. Everything is built in code (see aou-desk-decor.js).
   Four spots: desk left corner, desk right corner, floor left, floor right. Plants are built only when you change them. */
import { PLANTS, makePlant, makeMist, disposeGroup } from './aou-desk-decor.js';

export default function (desk) {
  const id = 'room';
  const SPOTS = [{ name: 'Desk, left corner', floor: false }, { name: 'Desk, right corner', floor: false }, { name: 'Floor, left', floor: true }, { name: 'Floor, right', floor: true }];
  const KINDS = SPOTS.map((s) => ['', ...PLANTS.filter((p) => p.floor === s.floor).map((p) => p.id)]);
  const NAME = { '': 'None' }; PLANTS.forEach((p) => { NAME[p.id] = p.name; });
  const MOODS = [
    ['Greenhouse', ['aloe', 'pothos', 'fiddle', 'peace'], 1],
    ['Zen corner', ['bonsai', 'bamboo', 'palm', 'snake'], 1],
    ['Jungle', ['pothos', 'fern', 'monstera', 'palm'], 2],
    ['Bare', ['', '', '', ''], 0],
  ];
  const MIST = ['Off', 'Low', 'High'], LEVEL = [0, 0.5, 1];
  const st = { spots: ['fern', '', 'monstera', 'snake'], mist: 1 };
  /* saved settings are untrusted: every plant must be one that fits its spot, mist must be 0, 1 or 2 */
  try {
    const raw = JSON.parse(desk.store.get(id) || 'null');
    if (raw && typeof raw === 'object' && Array.isArray(raw.spots)) {
      st.spots = SPOTS.map((s, i) => (typeof raw.spots[i] === 'string' && KINDS[i].includes(raw.spots[i]) ? raw.spots[i] : ''));
      st.mist = [0, 1, 2].includes(raw.mist) ? raw.mist : 1;
    }
  } catch (e) { }
  const save = () => desk.store.set(id, JSON.stringify({ spots: st.spots, mist: st.mist }));

  const T = desk.T, group = new T.Group(); group.name = 'room-decor'; desk.rig.add(group);
  const built = [null, null, null, null];
  const mist = makeMist(T, { width: 3.4, depth: 2.6, height: 0.7, color: 0xdde8f0, seed: 77 }); group.add(mist.object);
  let sheet = null, lw = -1, ld = -1, lt = -1;

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
  function apply() { for (let i = 0; i < 4; i++) setSpot(i); mist.setLevel(LEVEL[st.mist]); place(); }
  apply();

  /* the mist drifts with the frame clock; plants move only when the desk size or height changed (numbers compared, nothing allocated) */
  desk.onFrame((now) => {
    if (st.mist > 0) mist.update(now);
    const D = desk.S.desk;
    if (D.w !== lw || D.d !== ld || desk.seat.top !== lt) place();
  });

  const moodNow = () => MOODS.findIndex((m) => m[2] === st.mist && m[1].every((k, i) => k === st.spots[i]));
  const cycle = (i, dir) => { const list = KINDS[i], at = Math.max(0, list.indexOf(st.spots[i])); st.spots[i] = list[(at + dir + list.length) % list.length]; };

  sheet = desk.addSheet({
    id, title: 'Room', W: 640, H: 640, w: 0.62, h: 0.62, home: { a: -1.25, e: 0.05, r: 1.5, k: 1 }, open: false,
    draw(p, c) {
      desk.base(p, 'Room');
      desk.label(c, 'Plants and mist, made in code.', 604, 58, 20, '#aab3c2', 'right');
      SPOTS.forEach((s, i) => {
        const y = 84 + i * 80;
        desk.label(c, s.name, 36, y + 12, 20, '#aab3c2');
        desk.btn(p, 36, y + 28, 60, 48, '‹', id + ':spot', [i, -1], { size: 32 });
        desk.label(c, NAME[st.spots[i]], 320, y + 53, 26, st.spots[i] ? '#f1f4f9' : '#8a93a3', 'center', 700, 400);
        desk.btn(p, 544, y + 28, 60, 48, '›', id + ':spot', [i, 1], { size: 32 });
      });
      desk.label(c, 'Mist', 36, 424, 22, '#f1f4f9', 'left', 700);
      MIST.forEach((n, i) => desk.btn(p, 36 + i * 196, 440, 184, 48, n, id + ':mist', i, { size: 24, on: st.mist === i }));
      desk.label(c, 'Moods (sets everything)', 36, 514, 22, '#f1f4f9', 'left', 700);
      const mn = moodNow();
      MOODS.forEach(([n], i) => desk.btn(p, 36 + i * 146, 534, 140, 60, n, id + ':mood', i, { size: 20, on: mn === i }));
    },
    act(name, arg) {
      if (name === 'spot' && Array.isArray(arg) && arg[0] >= 0 && arg[0] < 4 && (arg[1] === 1 || arg[1] === -1)) { cycle(arg[0], arg[1]); setSpot(arg[0]); place(); }
      else if (name === 'mist' && (arg === 0 || arg === 1 || arg === 2)) { st.mist = arg; mist.setLevel(LEVEL[arg]); }
      else if (name === 'mood' && MOODS[arg]) { st.spots = MOODS[arg][1].slice(); st.mist = MOODS[arg][2]; apply(); }
      else return;
      save(); desk.redraw(sheet);
    },
  });
}
