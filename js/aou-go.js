/* "Go anywhere" — one grouped list of every place, page, world and mode, shared by the screen HUD (map button → modal)
   and the VR menu (Go tab). Items resolve against app.places at call time, so claimed homes and lazily registered
   places show up; cross-site items carry ?vr=1 + from=allofus through app.go(). Oct 2026.
   Nov 2026: eight All of Us groups that hold every place in the world AND every flat page (feed, messages, groups,
   creator tools, rules ...), then the sister worlds. `ids` are world places, `match` sweeps in families of places
   by id, `urls` are pages. A page that needs an account still does its own sign-in and 18+ check when it opens. */
export const GO_GROUPS = [
  { key: 'arrive', label: 'Arrive', icon: '🌍', note: 'Open to everyone. New places with no group land here too.', rest: true,
    ids: ['gate', 'plaza', 'city', 'library', 'starport', 'orbit', 'art'],
    urls: [['3D world', '/world/', '🧊'], ['VR · headset', '/world/?vr=1', '🕶']] },
  { key: 'wild', label: 'Wild places', icon: '🌿', note: 'Open to everyone.', match: /^(lake-|pond-|park-|pano-)/,
    ids: ['falls', 'desert', 'beach', 'treeoflife', 'rotunda', 'lake-dillon', 'lake-unity'] },
  { key: 'rides', label: 'Rides and sport', icon: '🎢', note: 'Open to everyone.',
    ids: ['coaster', 'skirun', 'cobes', 'ski', 'snowboard', 'truck', 'skyrange', 'balloons', 'lanterns', 'disco'] },
  { key: 'homes', label: 'Homes and building', icon: '🏡', note: 'Anyone can visit. Building and claiming land need a free account (adults 18+).', match: /^(st-\d|home-)/, cat: 'Homes', cap: 40,
    ids: ['build-house', 'my-home', 'open-land', 'directory', 'zach', 'mansion', 'banquet', 'silk', 'coburn', 'elias', 'ethan', 'first-street', 'unity-heights'] },
  { key: 'learn', label: 'Learn and make', icon: '📚', note: 'Open to look. Saving your work needs a free account (adults 18+).',
    ids: ['observatory', 'water', 'rocket', 'conference', 'worlds'],
    urls: [['LIFEboard', '/?v=board', '🏠'], ['LIFEspark', '/?v=spark', '✨'], ['Courses', '/?v=courses', '🎓'], ['FLOWworks pads', '/?v=work', '🧩'], ['World Window', '/?v=discover', '📰'], ['Video', '/?v=video', '🎬'],
      ['Creators Corner', '/creators/', '⭐'], ['Free creator tools', '/creators/tools/', '🛠️'], ['My brand page', '/?v=brand', '💼'], ['Grow my business', '/?v=grow', '🚀'], ['Marketing dash', '/?v=marketing', '📈'], ['LIFEspark Lift', '/boost/', '📣']] },
  { key: 'people', label: 'Meet people', icon: '💬', note: 'For signed-in members, adults 18+. Each page checks this when it opens.',
    ids: ['gmatch'],
    urls: [['Feed', '/', '📰'], ['My profile', '/?v=u', '🙂'], ['Connections', '/?v=conn', '🤝'], ['Circles', '/?v=circles', '⭕'], ['Constellations', '/constellations/', '🌟'], ['Events', '/?v=events', '📅'],
      ['Messages', '/?v=dm', '✉️'], ['Comm Hub', '/?v=hub', '🛰️'], ['Rooms · live chat', '/chat/?r=general', '💬'], ['Global Room', '/rooms/', '🌐'], ['Unity Call', '/meet/', '📞'], ['Global Match', '/match/', '🎯'],
      ['Alerts', '/?v=notif', '🔔'], ['Inbox', '/?v=inbox', '📥'], ['Search', '/?v=search', '🔎']] },
  { key: 'family', label: 'Family fun', icon: '🎈', note: 'Open to everyone.',
    ids: ['comics', 'dream-room', 'zach-pool', 'jamoke', 'movie', 'plant-cart'],
    urls: [['Games', '/games/', '🎮'], ['Moments', '/moments/', '📸']] },
  { key: 'help', label: 'Rules and help', icon: '🛟', note: 'Open to everyone.',
    urls: [['Community rules', '/community-rules/', '📜'], ['Terms', '/terms/', '📄'], ['Privacy', '/privacy/', '🔒'], ['Accessibility', '/accessibility/', '♿'], ['Report a bug', '/report-bug/', '🐞'], ['Our mission', '/mission/', '🚩'],
      ['Control panel', '/?v=panel', '🎛️'], ['Your data', '/?v=mydata', '🛡️'], ['Follow badges', '/follow-badge/', '🏷️']] },
  { key: 'worlds', label: 'Other worlds', icon: '🌐', note: 'These are separate websites.', urls: [
    ['World VR Mall · the island', 'https://worldvrmall.com/', '🏝️'], ['Inside the mall', 'https://worldvrmall.com/mall/', '🛍'], ['Mall directory', 'https://worldvrmall.com/directory/', '📒'], ['Mall · feed', 'https://worldvrmall.com/?v=feed', '📰'], ['Mall · VR', 'https://worldvrmall.com/mall/?vr=1', '🕶'],
    ['The VR Galaxy', 'https://thevrgalaxy.com/', '🪐'], ['Another Dimension', 'https://anotherdimensionvr.com/', '🌀'], ['VR Adventure', 'https://virtualrealityadventure.com/', '🧭'], ['Flying Sim', 'https://vrflyingsimulator.com/', '✈️'], ['Comics Come Alive', 'https://comicscomealive.com/', '💥'], ['Sparkle Diner', 'https://advertisingforrestaurant.com/', '🍔']] },
];
const bare = (s) => String(s || '').replace(/[\p{Extended_Pictographic}️‍]+/gu, '').replace(/\s+/g, ' ').trim();
const strip = (s) => bare(s).replace(/·.*$/, '').trim();
/* the page you are already on is not a destination */
const isHere = (url) => { try { const u = new URL(url, location.href); return u.origin === location.origin && u.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '') && !u.searchParams.get('v') && (u.searchParams.get('vr') === '1') === /[?&]vr=1/.test(location.search); } catch (e) { return false; } };
/* every place in a group once: named ids first, then the group's families (match / cat), then anything left lands in the `rest` group */
export function goGroups(app) {
  const places = (app.places || []).filter(p => p && (p.x !== undefined || p.fn || p.url) && p.pin !== false);
  const byId = new Map(places.map(p => [p.id, p])); const used = new Set();
  const item = (p) => ({ label: (/^pano-/.test(p.id) ? bare(p.name) : strip(p.name)) || p.id, icon: p.icon || (String(p.name || '').match(/^\p{Extended_Pictographic}/u) || ['📍'])[0], place: p });
  const out = GO_GROUPS.map(g => {
    const items = [];
    for (const id of (g.ids || [])) { const p = byId.get(id); if (p && !used.has(id)) { used.add(id); items.push(item(p)); } }
    return { key: g.key, label: g.label, icon: g.icon, note: g.note || '', items, rest: !!g.rest };
  });
  const hidden = (p) => p.url || /^path-/.test(p.id);
  GO_GROUPS.forEach((g, gi) => { if (!g.match && !g.cat) return; let n = 0; for (const p of places) { if (used.has(p.id) || hidden(p)) continue; if (!((g.match && g.match.test(p.id)) || (g.cat && p.cat === g.cat))) continue; used.add(p.id); if (g.cap && n >= g.cap) continue; n++; out[gi].items.push(item(p)); } });
  const rest = out.find(g => g.rest);
  for (const p of places) { if (used.has(p.id) || hidden(p)) continue; used.add(p.id); rest.items.push(item(p)); }
  GO_GROUPS.forEach((g, gi) => { for (const [label, url, icon] of (g.urls || [])) if (!isHere(url)) out[gi].items.push({ label, url, icon }); });
  for (const p of places) { if (p.url && !used.has(p.id)) { used.add(p.id); out.find(g => g.key === 'worlds').items.push({ label: strip(p.name), icon: p.icon || '🌐', url: p.url }); } }
  return out.filter(g => g.items.length);
}
/* travel to an item: places keep the beloved instant "port" dash, urls hop through app.go (ends VR, carries ?vr=1 + from=) */
export function goItem(app, it, mode = 'port') {
  if (!it) return;
  if (it.url) { const u = /^https?:/i.test(it.url) ? it.url : new URL(it.url, location.href).href; if (app.go) app.go(u, it.label); else location.href = u; return; }
  if (it.place) { const pl = it.place; if (pl.fn && pl.x === undefined) { try { pl.fn(app); } catch (e) { console.error(e); } return; } app.travel(pl, mode); }
}
