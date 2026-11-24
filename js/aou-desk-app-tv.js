/* allofus.one · the desk · app sheet: "TV" — a big screen for your own video files (up to 3 in a row), flat or side-by-side 3D.
   The files never leave this device: they are opened straight from the device as local blob links and nothing is uploaded.
   Web pages and streaming sites cannot be shown inside a headset session, so this plays files only.
   Videos are chosen on the flat page (before Enter VR), because a file picker cannot open inside VR. */
export default function (desk) {
  const id = 'tv', T = desk.T, W = 1024, H = 640, VH = 576, MAX = 3;
  const list = []; let cur = -1, sbs = false, sheet = null, lastSec = -1, vol = 0.7;
  const video = document.createElement('video'); video.playsInline = true; video.preload = 'metadata'; video.volume = vol;
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'video/*'; input.multiple = true; input.hidden = true; input.setAttribute('aria-label', 'Choose video files for the desk TV'); document.body.appendChild(input);
  const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 60);
  const fmt = (t) => { if (!Number.isFinite(t) || t < 0) t = 0; const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []).filter((f) => f && /^video\//.test(f.type)).slice(0, MAX); if (!files.length) { desk.say('No video file was chosen'); return; }
    list.forEach((x) => URL.revokeObjectURL(x.url)); list.length = 0; files.forEach((f) => list.push({ name: clean(f.name), url: URL.createObjectURL(f) })); input.value = ''; load(0, false); desk.say(list.length + (list.length === 1 ? ' video ready' : ' videos ready')); desk.redraw(sheet);
  });
  function load(i, play) { if (!list[i]) return; cur = i; video.src = list[i].url; video.load(); if (play) video.play().catch(() => desk.say('Press Play to start the video')); desk.redraw(sheet); }
  video.addEventListener('ended', () => { if (list[cur + 1]) load(cur + 1, true); else desk.redraw(sheet); });
  video.addEventListener('error', () => { if (cur >= 0) desk.say('This video type cannot be played here. MP4 works best.'); });
  ['play', 'pause', 'loadedmetadata'].forEach((e) => video.addEventListener(e, () => { fit(); desk.redraw(sheet); }));

  /* the picture: one flat plane for 2D; for side-by-side 3D each eye gets its own half of the frame */
  const tex = new T.VideoTexture(video); tex.colorSpace = T.SRGBColorSpace; const mat = new T.MeshBasicMaterial({ map: tex, toneMapped: false });
  const half = (u0) => { const g = new T.PlaneGeometry(1, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5); return g; };
  const full = new T.Mesh(new T.PlaneGeometry(1, 1), mat), flatL = new T.Mesh(half(0), mat), eyeL = new T.Mesh(half(0), mat), eyeR = new T.Mesh(half(0.5), mat); eyeL.layers.set(1); eyeR.layers.set(2);
  const screen = new T.Group(); screen.add(full, flatL, eyeL, eyeR); screen.visible = false;
  function fit() { /* keep the picture's shape inside the 16:9 screen area */
    const vw = (video.videoWidth || 16) * (sbs ? 0.5 : 1), vh = video.videoHeight || 9, ar = vw / vh, areaH = VH / H, shape = sheet ? sheet.w / sheet.h : 1.6; /* sheet units: x 0..1 is the sheet's width, y 0..1 its height */
    let sx = 1, sy = shape / ar; if (sy > areaH) { sy = areaH; sx = areaH * ar / shape; }
    screen.scale.set(sx, sy, 1); screen.position.set(0, 0.5 - areaH / 2, 0.004);
    const on = cur >= 0 && video.readyState >= 1; screen.visible = on; full.visible = !sbs; flatL.visible = sbs && !desk.presenting; eyeL.visible = eyeR.visible = sbs && desk.presenting;
  }
  desk.onFrame(() => {
    if (!sheet || cur < 0) return; const open = desk.S.sheets[id] && desk.S.sheets[id].open; if (!open) { if (!video.paused) video.pause(); return; }
    if (sbs) { flatL.visible = !desk.presenting; eyeL.visible = eyeR.visible = desk.presenting; }
    const s = Math.floor(video.currentTime); if (s !== lastSec) { lastSec = s; desk.redraw(sheet); }
  });

  sheet = desk.addSheet({
    id, title: 'TV', W, H, w: 1.28, h: 0.8, home: { a: 0, e: 0.95, r: 2.1, k: 1.3 }, open: false,
    draw(p, g) {
      g.clearRect(0, 0, W, H); p.regions.length = 0; desk.rr(g, 0, 0, W, H, 24); g.fillStyle = '#05070a'; g.fill();
      if (cur < 0) { desk.label(g, 'Your own videos on a big screen', W / 2, 220, 34, '#ffffff', 'center', 700); desk.label(g, desk.presenting ? 'Leave VR, tap Choose videos on the flat page, then come back in.' : 'Tap Choose videos and pick up to 3 files from this device.', W / 2, 276, 24, '#aab3c2', 'center', 500, 940); desk.label(g, 'Files stay on this device. Websites and streaming apps cannot play inside VR.', W / 2, 318, 22, '#7c8798', 'center', 500, 940); }
      const b = (x, w, label, act, arg, on) => desk.btn(p, x, VH + 8, w, 50, label, id + ':' + act, arg, { size: 20, on });
      b(8, 150, 'Choose videos', 'pick'); b(164, 60, '‹‹', 'skip', -1); b(230, 110, video.paused ? 'Play' : 'Pause', 'play', null, !video.paused && cur >= 0); b(346, 60, '››', 'skip', 1); b(412, 74, '−10 s', 'seek', -10); b(492, 74, '+10 s', 'seek', 10);
      b(572, 64, 'Vol −', 'vol', -1); b(642, 64, 'Vol +', 'vol', 1); b(712, 92, sbs ? '3D: on' : '3D: off', 'sbs', null, sbs);
      if (cur >= 0) { desk.label(g, (cur + 1) + '/' + list.length + '  ' + fmt(video.currentTime) + ' / ' + fmt(video.duration), 1014, VH + 22, 20, '#ffffff', 'right', 700, 200); desk.label(g, list[cur].name, 1014, VH + 46, 20, '#aab3c2', 'right', 500, 200); }
      if (screen.parent !== p.mesh) p.mesh.add(screen);
    },
    act(name, arg) {
      if (name === 'pick') { if (desk.presenting) { desk.say('Leave VR to choose videos: a file picker cannot open inside VR', 6000); return; } input.click(); return; }
      if (cur < 0) { desk.say('Choose videos first'); return; }
      if (name === 'play') { if (video.paused) video.play().catch(() => desk.say('The video could not start')); else video.pause(); }
      else if (name === 'skip') { const n = cur + (arg < 0 ? -1 : 1); if (list[n]) load(n, !video.paused); else desk.say(arg < 0 ? 'This is the first video' : 'This is the last video'); }
      else if (name === 'seek') { if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration - 0.2, video.currentTime + (arg < 0 ? -10 : 10))); }
      else if (name === 'vol') { vol = Math.max(0, Math.min(1, Math.round((vol + (arg < 0 ? -0.1 : 0.1)) * 10) / 10)); video.volume = vol; desk.say('Volume ' + Math.round(vol * 100) + '%', 1500); }
      else if (name === 'sbs') { sbs = !sbs; fit(); desk.say(sbs ? 'Side-by-side 3D: each eye sees its half' : 'Flat picture'); }
      desk.redraw(sheet);
    },
  });
}
