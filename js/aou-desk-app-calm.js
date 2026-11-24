/* allofus.one · the desk · app sheet: "Calm" — a sound mixer. Every sound is made in code (noise, filters, slow waves); nothing is downloaded.
   One audio graph is built on the first press and kept; volumes glide so nothing clicks. Bird and fire events are timed from the frame clock, not timers. */
export default function (desk) {
  const id = 'calm';
  const CH = [['rain', 'Rain'], ['wind', 'Wind'], ['brook', 'Brook'], ['fire', 'Fireplace'], ['birds', 'Birds'], ['night', 'Crickets'], ['pad', 'Soft music']];
  const PRESETS = [['Rainy night', { rain: 6, wind: 2, night: 2 }], ['Forest morning', { birds: 6, brook: 4, wind: 2 }], ['Fireside', { fire: 7, pad: 3 }], ['Deep focus', { pad: 5, rain: 2 }], ['Silence', {}]];
  const st = { master: 6, v: {} }; CH.forEach(([k]) => { st.v[k] = 0; });
  /* saved settings are numbers 0 to 10 only; anything else is ignored */
  try { const raw = JSON.parse(desk.store.get(id) || 'null'); if (raw && typeof raw === 'object') { const n = (x) => (Number.isFinite(+x) ? Math.max(0, Math.min(10, Math.round(+x))) : 0); st.master = n(raw.master === undefined ? 6 : raw.master); CH.forEach(([k]) => { st.v[k] = n(raw.v && raw.v[k]); }); } } catch (e) { }
  const save = () => desk.store.set(id, JSON.stringify(st));

  let ac = null, out = null, sheet = null; const g = {}; let seed = 12345, nextBird = 0, nextCrackle = 0, nextChord = 0, chord = 0; const padOsc = [];
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const anyOn = () => st.master > 0 && CH.some(([k]) => st.v[k] > 0);
  function noise(kind) {
    const len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = rnd() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } else d[i] = w; }
    for (let i = 0; i < 2000; i++) { const k = i / 2000; d[i] *= k; d[len - 1 - i] *= k; } /* soft ends so the loop does not tick */
    const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s;
  }
  const filt = (type, f, q) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; };
  const gain = (v) => { const n = ac.createGain(); n.gain.value = v; return n; };
  const lfo = (hz, depth, target) => { const o = ac.createOscillator(), a = gain(depth); o.frequency.value = hz; o.connect(a); a.connect(target); o.start(); };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  function build() {
    ac = desk.sound(); if (!ac) return false; if (out) return true;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; out = gain(0); out.connect(comp); const soft = filt('lowpass', 4200); comp.connect(soft); soft.connect(ac.destination);
    CH.forEach(([k]) => { g[k] = gain(0); g[k].connect(out); });
    const white = noise('white'), pink = noise('pink'), brown = noise('brown');
    /* rain: bright hiss with a slow swell */
    const rainG = gain(0.5); chain(pink, filt('highpass', 250), filt('lowpass', 3200), rainG, g.rain); lfo(0.13, 0.08, rainG.gain);
    /* wind: a band of soft noise whose pitch and strength wander */
    const wf = filt('bandpass', 420, 0.7), wg = gain(0.9); chain(pink, wf, wg, g.wind); lfo(0.07, 220, wf.frequency); lfo(0.11, 0.35, wg.gain);
    /* brook: narrow bright band that wobbles quickly, over a low rumble */
    const bf = filt('bandpass', 900, 1.2), bg = gain(0.5); chain(pink, bf, bg, g.brook); lfo(0.7, 220, bf.frequency); lfo(1.9, 90, bf.frequency); chain(brown, filt('lowpass', 300), gain(0.5), g.brook);
    /* fire: low roar; the crackles are added as tiny bursts from the frame clock */
    const fg = gain(0.8); chain(brown, filt('lowpass', 420), fg, g.fire); lfo(0.9, 0.2, fg.gain);
    g.crack = filt('bandpass', 1500, 0.8); chain(g.crack, gain(0.35), g.fire); g.white = white;
    /* crickets: a high tone chopped fast, in a slow pulse */
    const co = ac.createOscillator(), cg = gain(0), chop = ac.createOscillator(), chopG = gain(0.5), pulse = ac.createOscillator(), pg = gain(0.05); co.frequency.value = 2900; chop.type = 'sine'; chop.frequency.value = 24; pulse.frequency.value = 0.55;
    chop.connect(chopG); chopG.connect(cg.gain); pulse.connect(pg); pg.connect(cg.gain); chain(co, cg, gain(0.035), g.night); co.start(); chop.start(); pulse.start();
    /* soft music: four gentle voices through a low-pass, retuned to a new chord now and then */
    const pf = filt('lowpass', 420), pgn = gain(0.11); chain(pf, pgn, g.pad); lfo(0.05, 0.05, pgn.gain);
    for (let i = 0; i < 4; i++) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = [110, 164.81, 220, 329.63][i]; o.detune.value = (i - 1.5) * 3; o.connect(pf); o.start(); padOsc.push(o); }
    g.birdBus = gain(0.5); g.birdBus.connect(g.birds); return true;
  }
  /* open fifths and octaves only (no thirds), so nothing can clash */
  const CHORDS = [[220, 164.81, 220, 329.63], [196, 146.83, 196, 293.66], [220, 164.81, 246.94, 329.63], [174.61, 130.81, 196, 261.63]];
  function apply(fast) { if (!out) return; const t = ac.currentTime, k = fast ? 0.08 : 0.7; out.gain.setTargetAtTime(anyOn() ? (st.master / 10) ** 2 * 0.9 : 0, t, k); CH.forEach(([c]) => g[c].gain.setTargetAtTime((st.v[c] / 10) ** 1.6, t, k)); }
  function chirp(t) { /* one bird phrase: a few quick sweeps */
    const n = 2 + (rnd() * 4 | 0), base = 1500 + rnd() * 1100, pan = ac.createStereoPanner ? ac.createStereoPanner() : null; if (pan) { pan.pan.value = rnd() * 1.6 - 0.8; pan.connect(g.birdBus); }
    for (let i = 0; i < n; i++) { const o = ac.createOscillator(), a = gain(0), s = t + i * (0.09 + rnd() * 0.06); o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.25 + rnd() * 0.5), s + 0.05); o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.1); a.gain.setValueAtTime(0, s); a.gain.linearRampToValueAtTime(0.14, s + 0.03); a.gain.linearRampToValueAtTime(0, s + 0.1); o.connect(a); a.connect(pan || g.birdBus); o.start(s); o.stop(s + 0.12); }
  }
  function crackle(t) { const a = gain(0); g.white.connect(a); a.connect(g.crack); a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(0.1 + rnd() * 0.25, t + 0.004); a.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + rnd() * 0.04); const off = () => { try { g.white.disconnect(a); a.disconnect(); } catch (e) { } }; setTimeout(off, 200); }
  desk.onFrame((now) => {
    if (!out || !anyOn() || ac.state !== 'running') return; const t = ac.currentTime;
    if (st.v.birds > 0 && now > nextBird) { nextBird = now + 1500 + rnd() * 6000; chirp(t + 0.05); }
    if (st.v.fire > 0 && now > nextCrackle) { nextCrackle = now + 60 + rnd() * 420; crackle(t + 0.01); }
    if (st.v.pad > 0 && now > nextChord) { nextChord = now + 26000 + rnd() * 14000; chord = (chord + 1 + (rnd() * 2 | 0)) % CHORDS.length; padOsc.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[chord][i] / (i === 0 ? 2 : 1), t, 5)); }
  });

  function set(k, v) { if (!build()) { desk.say('Turn Sound on first (front board)'); return; } if (ac.state === 'suspended') ac.resume().catch(() => { }); if (k === 'master') st.master = v; else st.v[k] = v; apply(true); save(); desk.redraw(sheet); }
  sheet = desk.addSheet({
    id, title: 'Calm', W: 640, H: 640, w: 0.62, h: 0.62, home: { a: -0.45, e: 0.02, r: 1.3, k: 1 }, open: false,
    draw(p, c) {
      desk.base(p, 'Calm sounds'); desk.label(c, 'Made in code. Mix your own.', 604, 58, 20, '#aab3c2', 'right');
      const row = (y, name, key, val) => { desk.label(c, name, 36, y + 22, 24, '#f1f4f9'); desk.btn(p, 212, y, 56, 44, '−', id + ':vol', [key, -1], { size: 32 }); for (let i = 0; i < 10; i++) { desk.rr(c, 280 + i * 25, y + 8, 20, 28, 5); c.fillStyle = i < val ? desk.accent() : '#222a38'; c.fill(); } desk.btn(p, 540, y, 56, 44, '+', id + ':vol', [key, 1], { size: 32 }); };
      row(92, 'Volume', 'master', st.master); CH.forEach(([k, n], i) => row(150 + i * 52, n, k, st.v[k]));
      desk.label(c, 'Scenes', 36, 536, 22); const bw = 108; PRESETS.forEach(([n], i) => desk.btn(p, 36 + i * (bw + 7), 556, bw, 60, n, id + ':scene', i, { size: n.length > 11 ? 16 : 18 }));
    },
    act(name, arg) {
      if (name === 'vol') { const cur = arg[0] === 'master' ? st.master : st.v[arg[0]]; if (cur === undefined) return; set(arg[0], Math.max(0, Math.min(10, cur + arg[1]))); }
      else if (name === 'scene' && PRESETS[arg]) { if (!build()) { desk.say('Turn Sound on first (front board)'); return; } if (ac.state === 'suspended') ac.resume().catch(() => { }); CH.forEach(([k]) => { st.v[k] = PRESETS[arg][1][k] || 0; }); if (st.master === 0 && arg < PRESETS.length - 1) st.master = 6; apply(false); save(); desk.redraw(sheet); }
    },
  });
}
