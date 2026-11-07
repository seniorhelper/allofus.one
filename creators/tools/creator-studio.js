/* Madwackd Creator Studio: free tools. 100% client-side. No network calls. */
(function (root) {
  'use strict';

  var WORDS_PER_SEC = 2.5;
  var SHOT_SECONDS = 8;
  var SHOT_WORDS = WORDS_PER_SEC * SHOT_SECONDS; // 20
  var CREDITS = { fast720: 24, fast1080: 29, top: 88 };
  var PRICE_MIN = 0.08, PRICE_MAX = 0.12;

  /* ---------- 1. Hook writer ---------- */
  var BIZ = {
    restaurant: { label: 'Restaurant or food truck', who: 'hungry locals', thing: 'our food' },
    homeservices: { label: 'Home services (plumber, painter, roofer)', who: 'homeowners', thing: 'our work' },
    dentist: { label: 'Dentist or clinic', who: 'patients', thing: 'our care' },
    fitness: { label: 'Gym or fitness coach', who: 'people who want to get fit', thing: 'our training' },
    salon: { label: 'Salon or barber', who: 'anyone who wants a fresh look', thing: 'our chair' },
    realestate: { label: 'Real estate agent', who: 'buyers and sellers', thing: 'our listings' },
    store: { label: 'Online store', who: 'shoppers', thing: 'our products' },
    auto: { label: 'Auto repair or detailing', who: 'drivers', thing: 'our shop' },
    cleaning: { label: 'Cleaning service', who: 'busy families', thing: 'our cleaning' },
    creator: { label: 'Creator or coach', who: 'my followers', thing: 'my videos' },
    other: { label: 'Something else', who: 'customers', thing: 'what we do' }
  };
  var TONES = { friendly: 'Friendly', bold: 'Bold', funny: 'Funny', urgent: 'Urgent', trusted: 'Calm and trusted' };
  var HOOKS = {
    friendly: [
      'Hey {who}, we have something for you: {offer}.',
      'Looking for {thing} you can count on? Say hi.',
      'Good news for {who}: {offer}.',
      'We made this one just for {who}.',
      'Quick hello from {biz}. Here is {offer}.',
      'Still searching? Meet {biz}.',
      'A little something for {who}: {offer}.',
      'Come see why {who} keep coming back.',
      'Want an easy win this week? {offer}.',
      'Stop by and see {thing}. {offer}.'
    ],
    bold: [
      '{who}, stop scrolling. {offer}.',
      'This is the best use of 8 seconds you will have today: {offer}.',
      'Not all {biz} are equal. See the difference.',
      'You deserve better. {offer}.',
      'We do not do average. See {thing}.',
      'Ready to switch? {offer}.',
      'One look at {thing} and you will get it.',
      'Forget the rest. {biz} is here.',
      'Big change starts now: {offer}.',
      'Watch this before you choose anyone else.'
    ],
    funny: [
      'Plot twist: {offer}.',
      'Your other {biz} will not like this video.',
      'We asked {who} what they wanted. They said: {offer}.',
      'This ad is 8 seconds long. Your excuses are longer.',
      'Warning: {thing} may cause happiness.',
      'Yes, this is an ad. Yes, {offer}.',
      'POV: you finally found {biz}.',
      'Be honest. You scrolled here for {offer}.',
      'Our mom says {thing} is great. That counts.',
      'Roses are red, ads are short, {offer}.'
    ],
    urgent: [
      '{offer}. Ends soon.',
      '{who}: do not miss this. {offer}.',
      'Last chance this week: {offer}.',
      'Only a few spots left. {offer}.',
      'Before it is gone: {offer}.',
      'Today only for {who}: {offer}.',
      'Do not wait. {offer}.',
      'Book now while you can. {offer}.',
      'Quick, {who}: {offer}.',
      'This will not last. {offer}.'
    ],
    trusted: [
      '{who} trust us for a reason.',
      'Here is what we do, plainly: {thing}.',
      'Done right, the first time. {offer}.',
      'No surprises. Just {thing} and {offer}.',
      'Meet {biz}. Straight answers, good work.',
      'Questions about {thing}? We have answers.',
      'Simple, clear, fair: {offer}.',
      'Why {who} choose {biz}.',
      'Take a quiet minute to see {thing}.',
      'We keep it simple for {who}: {offer}.'
    ]
  };

  function fill(t, v) {
    return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
  }
  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function makeHooks(bizKey, offer, toneKey) {
    var b = BIZ[bizKey] || BIZ.other;
    var list = HOOKS[toneKey] || HOOKS.friendly;
    var off = String(offer || '').trim().replace(/[.!?]+$/, '') || 'see what is new';
    var biz = bizKey === 'other' ? 'us' : b.label.split(' (')[0].toLowerCase().replace(/^(a|an) /, '');
    var v = { who: b.who, thing: b.thing, offer: off, biz: biz };
    return list.map(function (t) {
      return capFirst(fill(t, v)).replace(/\.\./g, '.').replace(/\.\s*\./g, '.');
    });
  }

  /* ---------- 2. Script fitter + credit estimate ---------- */
  function countWords(s) {
    var m = String(s || '').trim().match(/\S+/g);
    return m ? m.length : 0;
  }
  function splitSentences(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    var parts = t.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [t];
    return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  }
  function fitScript(text) {
    var sentences = splitSentences(text);
    var shots = [], cur = null;
    function push() { if (cur) { shots.push(cur); cur = null; } }
    sentences.forEach(function (s) {
      var w = countWords(s);
      if (cur && cur.words + w <= SHOT_WORDS) {
        cur.text += ' ' + s; cur.words += w;
      } else {
        push();
        cur = { text: s, words: w };
      }
    });
    push();
    shots.forEach(function (sh, i) {
      sh.n = i + 1;
      sh.seconds = Math.round(sh.words / WORDS_PER_SEC * 10) / 10;
      sh.status = sh.seconds > SHOT_SECONDS ? 'long' : (sh.seconds > 7.2 ? 'tight' : 'ok');
    });
    var words = countWords(text);
    return {
      words: words,
      seconds: Math.round(words / WORDS_PER_SEC * 10) / 10,
      shots: shots,
      longShots: shots.filter(function (s) { return s.status === 'long'; }).length
    };
  }
  function estimateCredits(shots, quality) {
    var per = CREDITS[quality] || CREDITS.fast720;
    var n = Math.max(0, Math.floor(shots) || 0);
    var credits = per * n;
    return {
      perShot: per, shots: n, credits: credits,
      low: Math.round(credits * PRICE_MIN * 100) / 100,
      high: Math.round(credits * PRICE_MAX * 100) / 100
    };
  }

  /* ---------- 3. Prompt builder ---------- */
  function buildPrompt(f) {
    f = f || {};
    function c(s) { return String(s || '').trim().replace(/[.\s]+$/, ''); }
    var parts = [];
    var subj = c(f.subject), act = c(f.action), set = c(f.setting);
    var main = [subj, act].filter(Boolean).join(' ');
    if (main) parts.push(main + (set ? ' ' + (/^(in|at|on|inside|outside|near|under|over|by)\b/i.test(set) ? set : 'in ' + set) : ''));
    else if (set) parts.push(set);
    if (c(f.camera)) parts.push('Camera: ' + c(f.camera));
    if (c(f.light)) parts.push('Lighting: ' + c(f.light));
    if (c(f.mood)) parts.push('Mood: ' + c(f.mood));
    if (c(f.sound)) parts.push('Sound: ' + c(f.sound));
    if (!parts.length) return '';
    return parts.join('. ') + '.';
  }

  /* ---------- 5. Captions ---------- */
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function stamp(sec, comma) {
    var ms = Math.round(sec * 1000);
    var h = Math.floor(ms / 3600000); ms -= h * 3600000;
    var m = Math.floor(ms / 60000); ms -= m * 60000;
    var s = Math.floor(ms / 1000); ms -= s * 1000;
    return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + (comma ? ',' : '.') + pad(ms, 3);
  }
  // each input line: "text | seconds" (seconds optional; default estimated from word count, min 1.2s)
  function parseCaptionLines(raw) {
    var out = [];
    String(raw || '').split(/\r?\n/).forEach(function (ln) {
      ln = ln.trim();
      if (!ln) return;
      var text = ln, dur = null;
      var i = ln.lastIndexOf('|');
      if (i > -1) {
        var d = parseFloat(ln.slice(i + 1));
        if (isFinite(d) && d > 0) { text = ln.slice(0, i).trim(); dur = d; }
      }
      if (!text) return;
      if (dur == null) dur = Math.max(1.2, Math.round(countWords(text) / WORDS_PER_SEC * 10) / 10);
      out.push({ text: text, dur: dur });
    });
    return out;
  }
  function buildCaptions(raw, format) {
    var cues = parseCaptionLines(raw);
    var t = 0, body = [];
    var vtt = format === 'vtt';
    cues.forEach(function (c, i) {
      var a = t, b = t + c.dur;
      t = b;
      body.push((vtt ? '' : (i + 1) + '\n') + stamp(a, !vtt) + ' --> ' + stamp(b, !vtt) + '\n' + c.text);
    });
    if (!body.length) return '';
    return (vtt ? 'WEBVTT\n\n' : '') + body.join('\n\n') + '\n';
  }

  /* ---------- 7. Beat-cut planner ---------- */
  function tapTempo(times) {
    if (!times || times.length < 2) return null;
    var t = times.slice(-8);
    var sum = 0;
    for (var i = 1; i < t.length; i++) sum += t[i] - t[i - 1];
    var avg = sum / (t.length - 1);
    if (avg <= 0) return null;
    return Math.round(60000 / avg * 10) / 10;
  }
  function cutTimes(bpm, everyBeats, duration) {
    bpm = Number(bpm); everyBeats = Math.max(1, Math.floor(everyBeats) || 1); duration = Number(duration);
    if (!(bpm > 0) || !(duration > 0)) return [];
    var step = 60 / bpm * everyBeats;
    var out = [];
    for (var t = step, k = 1; t < duration - 0.0001; k++, t = step * k) out.push(Math.round(t * 1000) / 1000);
    return out;
  }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  /* ---------- 8. Contrast ---------- */
  function hexToRgb(hex) {
    var h = String(hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function luminance(rgb) {
    var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrastRatio(h1, h2) {
    var a = hexToRgb(h1), b = hexToRgb(h2);
    if (!a || !b) return null;
    var l1 = luminance(a), l2 = luminance(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function grade(ratio) {
    if (ratio == null) return null;
    return {
      ratio: Math.round(ratio * 100) / 100,
      aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5
    };
  }

  /* ---------- 9. Embed snippet ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function buildEmbed(url, title) {
    var u;
    try { u = new URL(String(url || '').trim()); } catch (e) { return { error: 'Paste the full link, starting with https://' }; }
    if (u.protocol !== 'https:') return { error: 'The link needs to start with https://' };
    var host = u.hostname.toLowerCase();
    if (host !== 'madwackd.ai' && !/\.madwackd\.ai$/.test(host)) return { error: 'Paste a madwackd.ai link.' };
    var safe = esc(u.href);
    var name = esc(String(title || '').trim() || 'My video');
    var isFile = /\.(mp4|webm|mov)$/i.test(u.pathname);
    var credit = '<p style="font-size:14px;margin:8px 0 0">Made with <a href="https://www.madwackd.ai/" rel="noopener">Madwackd Studio</a></p>';
    var code;
    if (isFile) {
      code = '<div style="max-width:720px">\n  <video controls playsinline preload="metadata" style="width:100%;height:auto;display:block" src="' + safe + '"></video>\n  ' + credit + '\n</div>';
    } else {
      code = '<p><a href="' + safe + '" rel="noopener">Watch: ' + name + '</a></p>\n' + credit;
    }
    return { kind: isFile ? 'video' : 'link', code: code, href: u.href };
  }

  /* ---------- 4. Safe zones (fractions of the frame; general guides) ---------- */
  var SAFE = {
    '9x16': [
      { id: 'top', label: 'Top bar and search', x: 0, y: 0, w: 1, h: 0.12 },
      { id: 'right', label: 'Like, comment, share buttons', x: 0.84, y: 0.42, w: 0.16, h: 0.38 },
      { id: 'bottom', label: 'Caption, name and music', x: 0, y: 0.78, w: 0.84, h: 0.22 }
    ],
    '16x9': [
      { id: 'edge', label: 'Title-safe edge', x: 0, y: 0, w: 1, h: 0.05 },
      { id: 'bottom', label: 'Player controls and captions', x: 0, y: 0.86, w: 1, h: 0.14 },
      { id: 'corner', label: 'Channel badge corner', x: 0.88, y: 0.05, w: 0.12, h: 0.14 }
    ]
  };
  function safeZones(kind) { return SAFE[kind] || []; }

  var api = {
    BIZ: BIZ, TONES: TONES, makeHooks: makeHooks,
    countWords: countWords, fitScript: fitScript, estimateCredits: estimateCredits,
    CREDITS: CREDITS, PRICE_MIN: PRICE_MIN, PRICE_MAX: PRICE_MAX, WORDS_PER_SEC: WORDS_PER_SEC,
    buildPrompt: buildPrompt, parseCaptionLines: parseCaptionLines, buildCaptions: buildCaptions, stamp: stamp,
    tapTempo: tapTempo, cutTimes: cutTimes, fmtTime: fmtTime,
    hexToRgb: hexToRgb, contrastRatio: contrastRatio, grade: grade,
    buildEmbed: buildEmbed, safeZones: safeZones
  };
  root.MWCS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ================= DOM wiring (browser only) ================= */
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  function on(id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); }
  function money(n) { return '$' + n.toFixed(2); }
  function say(id, msg) { var e = $(id); if (e) e.textContent = msg; }
  function copy(text, statusId) {
    function ok() { say(statusId, 'Copied.'); }
    function fail() { say(statusId, 'Could not copy. Select the text and copy it.'); }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
      else { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); ok(); }
    } catch (e) { fail(); }
  }
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function init() {
    /* Hooks */
    var bizSel = $('hk-biz'), toneSel = $('hk-tone');
    Object.keys(BIZ).forEach(function (k) { bizSel.add(new Option(BIZ[k].label, k)); });
    Object.keys(TONES).forEach(function (k) { toneSel.add(new Option(TONES[k], k)); });
    function runHooks() {
      var list = makeHooks(bizSel.value, $('hk-offer').value, toneSel.value);
      var ol = $('hk-out'); ol.textContent = '';
      list.forEach(function (h) {
        var li = document.createElement('li');
        var sp = document.createElement('span'); sp.textContent = h;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'cs-btn cs-mini'; b.textContent = 'Copy';
        b.setAttribute('aria-label', 'Copy hook: ' + h);
        b.addEventListener('click', function () { copy(h, 'hk-status'); });
        li.appendChild(sp); li.appendChild(b); ol.appendChild(li);
      });
      say('hk-status', list.length + ' hooks ready.');
    }
    ['hk-biz', 'hk-tone'].forEach(function (i) { on(i, 'change', runHooks); });
    on('hk-offer', 'input', runHooks);
    on('hk-go', 'click', runHooks);
    on('hk-ex', 'click', function () { bizSel.value = 'restaurant'; toneSel.value = 'funny'; $('hk-offer').value = 'free dessert with any lunch'; runHooks(); });
    on('hk-copyall', 'click', function () {
      copy(makeHooks(bizSel.value, $('hk-offer').value, toneSel.value).join('\n'), 'hk-status');
    });

    /* Script fitter */
    function runFit() {
      var r = fitScript($('sf-text').value);
      var q = $('sf-q').value;
      var out = $('sf-out'); out.textContent = '';
      if (!r.words) { say('sf-sum', 'Paste a script to see the timing.'); say('sf-cost', ''); $('sf-warn').textContent = ''; return; }
      say('sf-sum', r.words + ' words, about ' + r.seconds + ' seconds, ' + r.shots.length + ' shot' + (r.shots.length === 1 ? '' : 's') + '.');
      r.shots.forEach(function (s) {
        var li = document.createElement('li'); li.className = 'cs-shot cs-' + s.status;
        var h = document.createElement('b'); h.textContent = 'Shot ' + s.n + '  ' + s.seconds + 's';
        var tag = document.createElement('em');
        tag.textContent = s.status === 'long' ? 'Too long: trim it' : (s.status === 'tight' ? 'Tight fit' : 'Fits');
        var p = document.createElement('span'); p.textContent = s.text;
        li.appendChild(h); li.appendChild(tag); li.appendChild(p); out.appendChild(li);
      });
      $('sf-warn').textContent = r.longShots ? r.longShots + ' shot' + (r.longShots === 1 ? ' runs' : 's run') + ' past 8 seconds. Shorten the line or split the sentence.' : '';
      var e = estimateCredits(r.shots.length, q);
      say('sf-cost', e.shots + ' shot' + (e.shots === 1 ? '' : 's') + ' x ' + e.perShot + ' credits = about ' + e.credits + ' credits, roughly ' + money(e.low) + ' to ' + money(e.high) + '.');
    }
    on('sf-text', 'input', runFit); on('sf-q', 'change', runFit);
    on('sf-ex', 'click', function () {
      $('sf-text').value = 'Tired of a leaky faucet that drips all night? Call Rivera Plumbing today. We are local, we show up on time, and we fix it right the first time. Book online in two minutes and get a free quote.';
      runFit();
    });

    /* Prompt builder */
    var pbIds = ['pb-subject', 'pb-action', 'pb-setting', 'pb-camera', 'pb-light', 'pb-mood', 'pb-sound'];
    function runPrompt() {
      var v = {};
      ['subject', 'action', 'setting', 'camera', 'light', 'mood', 'sound'].forEach(function (k) { v[k] = $('pb-' + k).value; });
      var p = buildPrompt(v);
      $('pb-out').value = p;
      say('pb-status', p ? countWords(p) + ' words.' : 'Fill in a field to build your prompt.');
    }
    pbIds.forEach(function (i) { on(i, 'input', runPrompt); });
    on('pb-ex', 'click', function () {
      var ex = { subject: 'a chef in a white apron', action: 'flips a burger and smiles at the camera', setting: 'a busy open kitchen', camera: 'slow push-in, shallow depth of field', light: 'warm golden light with steam', mood: 'cozy and energetic', sound: 'sizzling grill and soft jazz' };
      Object.keys(ex).forEach(function (k) { $('pb-' + k).value = ex[k]; }); runPrompt();
    });
    on('pb-copy', 'click', function () { copy($('pb-out').value, 'pb-status'); });

    /* Safe zones */
    var szUrl = null, szKind = '9x16', szOn = true;
    var stage = $('sz-stage'), szMedia = $('sz-media'), szVid = $('sz-vid');
    function szDraw() {
      var ov = $('sz-overlay'); ov.textContent = '';
      stage.className = 'cs-stage cs-r' + szKind;
      if (!szOn) return;
      safeZones(szKind).forEach(function (z) {
        var d = document.createElement('div'); d.className = 'cs-zone';
        d.style.left = z.x * 100 + '%'; d.style.top = z.y * 100 + '%'; d.style.width = z.w * 100 + '%'; d.style.height = z.h * 100 + '%';
        var s = document.createElement('span'); s.textContent = z.label; d.appendChild(s); ov.appendChild(d);
      });
    }
    function szClear() { if (szUrl) URL.revokeObjectURL(szUrl); szUrl = null; }
    on('sz-file', 'change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      szClear(); szUrl = URL.createObjectURL(f);
      var isVid = /^video\//.test(f.type);
      szMedia.hidden = isVid; szVid.hidden = !isVid;
      if (isVid) { szVid.src = szUrl; szVid.controls = true; szVid.muted = true; } else { szMedia.src = szUrl; }
      stage.classList.add('has-media');
      say('sz-status', 'Loaded on your device only. Nothing was uploaded.');
    });
    ['9x16', '16x9'].forEach(function (k) {
      on('sz-' + k, 'click', function () {
        szKind = k;
        $('sz-9x16').setAttribute('aria-pressed', String(k === '9x16'));
        $('sz-16x9').setAttribute('aria-pressed', String(k === '16x9'));
        szDraw();
      });
    });
    on('sz-toggle', 'click', function () { szOn = !szOn; $('sz-toggle').setAttribute('aria-pressed', String(szOn)); szDraw(); });
    on('sz-ex', 'click', function () {
      szClear(); szMedia.hidden = false; szVid.hidden = true; szVid.removeAttribute('src');
      szMedia.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B3DFF"/><stop offset="1" stop-color="#FF2E93"/></linearGradient></defs><rect width="90" height="160" fill="url(#g)"/><circle cx="45" cy="80" r="22" fill="#FFD60A"/><text x="45" y="84" font-size="9" text-anchor="middle" fill="#15121F" font-family="sans-serif">YOUR AD</text></svg>');
      stage.classList.add('has-media');
      say('sz-status', 'Example loaded. Try your own image or video.');
    });
    szDraw();

    /* Captions */
    on('cp-ex', 'click', function () {
      $('cp-text').value = 'Tired of a leaky faucet? | 2\nCall Rivera Plumbing today. | 2.5\nWe fix it right the first time. | 2.5\nBook online in two minutes. | 2';
      say('cp-status', 'Example loaded.');
    });
    function capGo(fmt) {
      var s = buildCaptions($('cp-text').value, fmt);
      if (!s) { say('cp-status', 'Add at least one line first.'); return; }
      download('captions.' + fmt, s, fmt === 'vtt' ? 'text/vtt' : 'application/x-subrip');
      say('cp-status', 'Downloaded captions.' + fmt + '.');
    }
    on('cp-srt', 'click', function () { capGo('srt'); });
    on('cp-vtt', 'click', function () { capGo('vtt'); });

    /* Teleprompter */
    var tp = $('tp-view'), tpText = $('tp-text'), tpRaf = 0, tpPos = 0, tpLast = 0, tpRun = false;
    function tpStep(ts) {
      if (!tpRun) return;
      var dt = (ts - tpLast) / 1000; tpLast = ts;
      tpPos += Number($('tp-speed').value) * dt * 12;
      tp.scrollTop = tpPos;
      if (tp.scrollTop + tp.clientHeight >= tp.scrollHeight - 1 && tpPos > 10) { tpStop(); say('tp-status', 'End of script.'); return; }
      tpRaf = requestAnimationFrame(tpStep);
    }
    function tpStart() { tpRun = true; tpLast = performance.now(); tpPos = tp.scrollTop; $('tp-play').textContent = 'Pause'; $('tp-play').setAttribute('aria-pressed', 'true'); tpRaf = requestAnimationFrame(tpStep); }
    function tpStop() { tpRun = false; cancelAnimationFrame(tpRaf); $('tp-play').textContent = 'Play'; $('tp-play').setAttribute('aria-pressed', 'false'); }
    function tpFill() { tp.textContent = ''; var p = document.createElement('p'); p.textContent = tpText.value || 'Your script shows here.'; tp.appendChild(p); }
    tpFill();
    on('tp-text', 'input', tpFill);
    on('tp-play', 'click', function () { tpRun ? tpStop() : tpStart(); });
    on('tp-reset', 'click', function () { tpStop(); tpPos = 0; tp.scrollTop = 0; say('tp-status', ''); });
    on('tp-speed', 'input', function () { $('tp-speed-v').textContent = $('tp-speed').value; });
    on('tp-size', 'input', function () { tp.style.fontSize = $('tp-size').value + 'px'; });
    on('tp-mirror', 'click', function () {
      var m = $('tp-mirror').getAttribute('aria-pressed') !== 'true';
      $('tp-mirror').setAttribute('aria-pressed', String(m)); tp.classList.toggle('mirror', m);
    });
    on('tp-full', 'click', function () {
      var box = $('tp-box');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (box.requestFullscreen) box.requestFullscreen().catch(function () { say('tp-status', 'Full screen is not available here.'); });
      else say('tp-status', 'Full screen is not available here.');
    });
    on('tp-ex', 'click', function () {
      tpText.value = 'Hi, I am Sam from Sam\'s Bakery. Every morning we bake bread from scratch. Come in before nine for a free coffee with any loaf. See you soon.\n\nKeep your eyes on the lens. Read at a calm pace. Smile at the end.';
      tpFill();
    });

    /* Beat-cut planner */
    var taps = [], beatEvery = 4, beatDur = 15;
    function runBeats() {
      var bpm = parseFloat($('bt-bpm').value);
      var out = $('bt-out'); out.textContent = '';
      if (!(bpm > 0)) { say('bt-sum', 'Tap the pad or type a BPM.'); return; }
      var cuts = cutTimes(bpm, beatEvery, beatDur);
      say('bt-sum', cuts.length + ' cuts in ' + beatDur + ' seconds (a cut every ' + beatEvery + ' beat' + (beatEvery === 1 ? '' : 's') + ', ' + (60 / bpm * beatEvery).toFixed(2) + 's apart).');
      cuts.forEach(function (t, i) {
        var li = document.createElement('li'); li.textContent = 'Cut ' + (i + 1) + ': ' + fmtTime(t); out.appendChild(li);
      });
    }
    on('bt-tap', 'click', function () {
      var now = performance.now();
      if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
      taps.push(now);
      var b = tapTempo(taps);
      if (b) { $('bt-bpm').value = Math.round(b); runBeats(); } else say('bt-sum', 'Keep tapping to the beat.');
    });
    on('bt-bpm', 'input', runBeats);
    on('bt-reset', 'click', function () { taps = []; $('bt-bpm').value = ''; runBeats(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-beats]'), function (b) {
      b.addEventListener('click', function () {
        beatEvery = Number(b.getAttribute('data-beats'));
        Array.prototype.forEach.call(document.querySelectorAll('[data-beats]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        runBeats();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-dur]'), function (b) {
      b.addEventListener('click', function () {
        beatDur = Number(b.getAttribute('data-dur'));
        Array.prototype.forEach.call(document.querySelectorAll('[data-dur]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        runBeats();
      });
    });
    on('bt-ex', 'click', function () { $('bt-bpm').value = 120; runBeats(); });

    /* Contrast */
    function runContrast() {
      var fg = $('ct-fg').value, bg = $('ct-bg').value;
      $('ct-fg-hex').value = fg; $('ct-bg-hex').value = bg;
      var g = grade(contrastRatio(fg, bg));
      var s = $('ct-sample'); s.style.color = fg; s.style.background = bg;
      if (!g) return;
      function mark(id, ok, label) { var e = $(id); e.textContent = label + ': ' + (ok ? 'Pass' : 'Fail'); e.className = ok ? 'cs-pass' : 'cs-fail'; }
      say('ct-ratio', g.ratio + ' : 1');
      mark('ct-aa', g.aaNormal, 'Normal text (AA)');
      mark('ct-aal', g.aaLarge, 'Large text (AA)');
      mark('ct-aaa', g.aaaNormal, 'Normal text (AAA)');
    }
    function hexSync(hexId, colorId) {
      on(hexId, 'input', function () {
        var v = $(hexId).value.trim(); if (v[0] !== '#') v = '#' + v;
        if (hexToRgb(v) && v.length === 7) { $(colorId).value = v; runContrast(); }
      });
    }
    on('ct-fg', 'input', runContrast); on('ct-bg', 'input', runContrast);
    hexSync('ct-fg-hex', 'ct-fg'); hexSync('ct-bg-hex', 'ct-bg');
    on('ct-swap', 'click', function () { var a = $('ct-fg').value; $('ct-fg').value = $('ct-bg').value; $('ct-bg').value = a; runContrast(); });
    on('ct-ex', 'click', function () { $('ct-fg').value = '#ff2e93'; $('ct-bg').value = '#ffffff'; runContrast(); });
    runContrast();

    /* Embed */
    function runEmbed() {
      var r = buildEmbed($('em-url').value, $('em-title').value);
      var out = $('em-out');
      if (r.error) { out.value = ''; say('em-status', r.error); return; }
      out.value = r.code;
      say('em-status', r.kind === 'video' ? 'Video embed ready. Copy it into your page.' : 'Link snippet ready. Copy it into your page.');
    }
    on('em-go', 'click', runEmbed);
    on('em-url', 'input', function () { if ($('em-url').value.length > 12) runEmbed(); });
    on('em-title', 'input', function () { if ($('em-out').value) runEmbed(); });
    on('em-copy', 'click', function () { if ($('em-out').value) copy($('em-out').value, 'em-status'); else say('em-status', 'Paste a link first.'); });
    on('em-ex', 'click', function () { $('em-url').value = 'https://www.madwackd.ai/assets/media/showcase/burger.mp4'; $('em-title').value = 'Flame-grilled burger'; runEmbed(); });

    /* Start with sensible defaults showing */
    runHooks();
    $('sf-text').value = 'Tired of a leaky faucet? Call Rivera Plumbing today. We show up on time and fix it right. Book online in two minutes.';
    runFit();
    $('bt-bpm').value = 120; runBeats();
    $('em-url').value = '';
    var y = $('year'); if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
