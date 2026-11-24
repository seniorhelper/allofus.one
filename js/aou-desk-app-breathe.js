/* allofus.one · the desk · app sheet: "Breathe" — a guided, paced-breathing ring. Everything is drawn in code; no downloads.
   Only gentle, well-studied patterns: no breath holds beyond a few seconds, no fast or deep "power" breathing.
   Not medical advice. The sheet says so on screen.

   Sources for the "Why it works" panel (each checked at PubMed / the publisher on 2026-11-23):
   1. Zaccaro A, Piarulli A, Laurino M, Garbella E, Menicucci D, Neri B, Gemignani A. "How Breath-Control Can Change Your Life:
      A Systematic Review on Psycho-Physiological Correlates of Slow Breathing." Frontiers in Human Neuroscience, 2018, 12:353.
      https://pubmed.ncbi.nlm.nih.gov/30245619/   (doi 10.3389/fnhum.2018.00353)
      Used for: a review of 15 studies in healthy adults linked slow breathing (under 10 breaths a minute) to more relaxation and
      less anxiety; the authors say how it works is still debated.
   2. Balban MY, Neri E, Kogon MM, Weed L, Nouriani B, Jo B, Holl G, Zeitzer JM, Spiegel D, Huberman AD. "Brief structured respiration
      practices enhance mood and reduce physiological arousal." Cell Reports Medicine, 2023, 4(1):100895.
      https://pubmed.ncbi.nlm.nih.gov/36630953/   (doi 10.1016/j.xcrm.2022.100895)
      Used for: in a month-long trial, 5 minutes a day of breathing exercises improved mood and lowered breathing rate more than
      mindfulness meditation; exhale-focused cyclic sighing did best. (That trial's "cyclic hyperventilation" arm is NOT offered here.) */
export default function (desk) {
  const id = 'breathe';
  /* in / hold / out / hold, in seconds; zero means the step is skipped */
  const PATS = [
    { name: 'Slow and steady', p: [5.5, 0, 5.5, 0] },
    { name: 'Box  4-4-4-4', p: [4, 4, 4, 4] },
    { name: 'Long exhale  4-6', p: [4, 0, 6, 0] },
    { name: '4-7-8', p: [4, 7, 8, 0] },
  ];
  const MINS = [1, 3, 5, 10];
  const WORD = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
  const FREQ = [440, 392, 330, 392];
  const st = { pat: 0, mins: 3, tick: true };
  /* saved settings are untrusted: keep only a known pattern number, a known length and a true/false */
  try {
    const raw = JSON.parse(desk.store.get(id) || 'null');
    if (raw && typeof raw === 'object') {
      if (Number.isInteger(raw.pat) && raw.pat >= 0 && raw.pat < PATS.length) st.pat = raw.pat;
      if (MINS.indexOf(raw.mins) >= 0) st.mins = raw.mins;
      if (typeof raw.tick === 'boolean') st.tick = raw.tick;
    }
  } catch (e) { }
  const save = () => desk.store.set(id, JSON.stringify(st));

  let sheet = null, running = false, startAt = 0, lastDraw = 0, lastStep = -1, done = false, why = false;
  const isOpen = () => !!(desk.S.sheets[id] && desk.S.sheets[id].open);
  const FACTS = [
    ['A review of 15 studies in healthy adults linked slow breathing (under 10 breaths a minute) to more relaxation and less anxiety.', 'Zaccaro et al., Frontiers in Human Neuroscience, 2018'],
    ['In a one-month trial, 5 minutes a day of breathing exercises lifted mood more than mindfulness meditation did.', 'Balban et al., Cell Reports Medicine, 2023'],
  ];

  /* where are we in the session? returns { step, left (s), frac (0..1 ring size), cycle } or null when finished */
  function where(elapsedMs) {
    const p = PATS[st.pat].p, total = p.reduce((a, b) => a + b, 0), e = elapsedMs / 1000;
    if (e >= st.mins * 60) return null;
    const c = Math.floor(e / total); let t = e - c * total;
    for (let i = 0; i < 4; i++) {
      if (!p[i]) continue;
      if (t < p[i]) {
        const f = t / p[i], s = 0.5 - 0.5 * Math.cos(Math.PI * f);
        return { step: i, left: p[i] - t, frac: i === 0 ? s : i === 2 ? 1 - s : (i === 1 ? 1 : 0), cycle: c, key: c * 4 + i };
      }
      t -= p[i];
    }
    return { step: 0, left: 0, frac: 0, cycle: c, key: c * 4 };
  }
  const clock = (s) => { const n = Math.max(0, Math.ceil(s)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

  function stop(finished) { running = false; done = !!finished; lastStep = -1; if (isOpen()) desk.redraw(sheet); }
  function start() {
    running = true; done = false; why = false; startAt = performance.now(); lastStep = -1; lastDraw = 0;
    try { desk.sound(); } catch (e) { }
    desk.redraw(sheet);
  }

  /* one frame hook: redraw about ten times a second while a session runs and the sheet is open; do nothing otherwise */
  desk.onFrame((now) => {
    if (!running) return;
    if (!isOpen()) { running = false; lastStep = -1; return; }
    const n = typeof now === 'number' ? now : performance.now();
    const w = where(performance.now() - startAt);
    if (!w) { stop(true); desk.beep(520, 0.25, 0.02); return; }
    if (w.key !== lastStep) { lastStep = w.key; if (st.tick) desk.beep(FREQ[w.step], 0.12, 0.02); }
    if (n - lastDraw >= 100) { lastDraw = n; desk.redraw(sheet); }
  });

  sheet = desk.addSheet({
    id, title: 'Breathe', W: 640, H: 640, w: 0.62, h: 0.62, home: { a: 0.45, e: 0.3, r: 1.5, k: 1 }, open: false,
    draw(p, g) {
      desk.base(p, 'Breathe');
      /* rows: 100-148 pattern 1, 156-204 pattern 2 */
      PATS.forEach((x, i) => desk.btn(p, 36 + (i % 2) * 290, 100 + Math.floor(i / 2) * 56, 278, 48, x.name, running ? null : id + ':pat', i, { on: st.pat === i, size: 22, fg: running && st.pat !== i ? '#7c8798' : undefined }));
      if (why) {
        /* panel 214-452 */
        desk.rr(g, 36, 214, 568, 238, 14); g.fillStyle = '#131924'; g.fill();
        desk.label(g, 'Why it works', 52, 236, 24, '#ffffff', 'left', 700);
        let y = 270;
        FACTS.forEach(([t, src]) => {
          g.font = `500 20px ${desk.FF}`; const ls = desk.L.wrap(t, 536, (s) => g.measureText(s).width, 3);
          ls.forEach((ln, k) => desk.label(g, ln, 52, y + k * 24, 20, '#f1f4f9', 'left', 500, 540)); y += ls.length * 24 + 4;
          desk.label(g, src, 52, y, 20, desk.accent(), 'left', 500, 540); y += 36;
        });
      } else {
        /* ring 214-394 (centre 304, radius 60..90), word 412, count 440 */
        const w = running ? where(performance.now() - startAt) : null, f = w ? w.frac : 0, r = 60 + 30 * f, cx = 320, cy = 304;
        g.beginPath(); g.arc(cx, cy, 90, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = '#2a3342'; g.stroke();
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = 'rgba(143,196,255,0.16)'; g.fill(); g.lineWidth = 8; g.strokeStyle = desk.accent(); g.stroke();
        const word = w ? WORD[w.step] : done ? 'Well done' : 'Ready';
        desk.label(g, word, cx, 412, 32, '#ffffff', 'center', 700, 560);
        const sub = w ? Math.max(1, Math.ceil(w.left)) + ' s   ·   ' + clock(st.mins * 60 - (performance.now() - startAt) / 1000) + ' left' : done ? 'Session finished' : 'Pick a pattern and a length, then press Start';
        desk.label(g, sub, cx, 440, 20, '#aab3c2', 'center', 500, 580);
      }
      /* 462-506 length row */
      MINS.forEach((m, i) => desk.btn(p, 36 + i * 108, 462, 100, 44, m + ' min', running ? null : id + ':len', m, { on: st.mins === m, size: 22, fg: running && st.mins !== m ? '#7c8798' : undefined }));
      desk.btn(p, 468, 462, 136, 44, st.tick ? 'Tick: on' : 'Tick: off', id + ':tick', null, { size: 22, on: st.tick });
      /* 514-566 start / why */
      desk.btn(p, 36, 514, 380, 52, running ? 'Stop' : 'Start', id + ':go', null, { size: 30, bg: running ? '#5a2a30' : '#1f4d2e', line: running ? '#ff8a96' : '#7dff5a' });
      desk.btn(p, 428, 514, 176, 52, why ? 'Back' : 'Why it works', id + ':why', null, { size: 22 });
      /* 588-608 safety */
      desk.label(g, 'Stop if you feel dizzy. Not medical advice.', 320, 598, 20, '#ffcf7a', 'center', 500, 580);
    },
    act(name, arg) {
      if (name === 'pat') { if (!running && Number.isInteger(arg) && arg >= 0 && arg < PATS.length) { st.pat = arg; save(); } else return; }
      else if (name === 'len') { if (!running && MINS.indexOf(arg) >= 0) { st.mins = arg; save(); } else return; }
      else if (name === 'tick') { st.tick = !st.tick; save(); }
      else if (name === 'go') { if (running) stop(false); else start(); return; }
      else if (name === 'why') why = !why;
      else return;
      desk.redraw(sheet);
    },
  });
}
