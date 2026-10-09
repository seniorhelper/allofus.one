/* "Go anywhere" — one grouped list of every place, world and mode, shared by the screen HUD (map button → modal)
   and the VR menu (Go tab). Items resolve against app.places at call time, so claimed homes and lazily registered
   places show up; cross-site items carry ?vr=1 + from=allofus through app.go(). Oct 2026. */
export const GO_GROUPS = [
  { key: 'home', label: 'Home', icon: '🏡', ids: ['zach', 'mansion', 'dream-room', 'plaza', 'gate'] },
  { key: 'districts', label: 'Districts', icon: '🏙️', ids: ['city', 'library', 'falls', 'desert', 'starport', 'art', 'beach', 'orbit'] },
  { key: 'play', label: 'Play', icon: '🎢', ids: ['coaster', 'skirun', 'cobes', 'coburn', 'ski', 'lake-dillon', 'lake-unity', 'skyrange', 'disco', 'truck', 'snowboard', 'party49'] },
  { key: 'family', label: 'Family & kids', icon: '💥', ids: ['comics', 'elias', 'ethan', 'zach-pool', 'jamoke'] },
  { key: 'learn', label: 'Learn', icon: '📚', ids: ['silk', 'conference', 'observatory', 'water', 'treeoflife', 'rocket', 'movie'] },
  { key: 'places', label: 'Places', icon: '📍', ids: ['balloons', 'lanterns', 'first-street', 'worlds', 'plant-cart', 'banquet'], rest: true },
  { key: 'worlds', label: 'Other worlds', icon: '🌐', urls: [
    ['World VR Mall · the island', 'https://worldvrmall.com/', '🏝️'], ['Inside the mall', 'https://worldvrmall.com/mall/', '🛍'], ['Mall directory', 'https://worldvrmall.com/directory/', '📒'],
    ['The VR Galaxy', 'https://thevrgalaxy.com/', '🪐'], ['Another Dimension', 'https://anotherdimensionvr.com/', '🌀'], ['VR Adventure', 'https://virtualrealityadventure.com/', '🧭'], ['Flying Sim', 'https://vrflyingsimulator.com/', '✈️'], ['Comics Come Alive', 'https://comicscomealive.com/', '💥'], ['Sparkle Diner', 'https://advertisingforrestaurant.com/', '🍔']] },
  { key: 'modes', label: 'Modes', icon: '🕶', urls: [
    ['Feed', '/', '📰'], ['3D world', '/world/', '🧊'], ['VR', '/world/?vr=1', '🕶'],
    ['Mall · feed', 'https://worldvrmall.com/?v=feed', '📰'], ['Mall · 3D', 'https://worldvrmall.com/mall/', '🧊'], ['Mall · VR', 'https://worldvrmall.com/mall/?vr=1', '🕶'], ['Mall · directory', 'https://worldvrmall.com/directory/', '📒']] },
];
const strip = (s) => String(s || '').replace(/[\p{Extended_Pictographic}️‍]+/gu, '').replace(/·.*$/, '').trim();
/* every place in a group once; places that belong to no group land in "Places" (claimed homes, streets, new builders) */
export function goGroups(app) {
  const places = (app.places || []).filter(p => p && (p.x !== undefined || p.fn || p.url) && p.pin !== false);
  const byId = new Map(places.map(p => [p.id, p])); const used = new Set();
  const out = GO_GROUPS.map(g => {
    const items = [];
    for (const id of (g.ids || [])) { const p = byId.get(id); if (p && !used.has(id)) { used.add(id); items.push({ label: strip(p.name) || id, icon: p.icon || (String(p.name || '').match(/^\p{Extended_Pictographic}/u) || ['📍'])[0], place: p }); } }
    for (const [label, url, icon] of (g.urls || [])) items.push({ label, url, icon });
    return { key: g.key, label: g.label, icon: g.icon, items, rest: !!g.rest };
  });
  const rest = out.find(g => g.rest);
  for (const p of places) { if (used.has(p.id) || p.url || /^path-/.test(p.id)) continue; if (/^st-\d+$/.test(p.id) && !p.top) continue; used.add(p.id); rest.items.push({ label: strip(p.name) || p.id, icon: p.icon || '📍', place: p }); }
  for (const p of places) { if (p.url && !used.has(p.id)) { used.add(p.id); out.find(g => g.key === 'worlds').items.push({ label: strip(p.name), icon: p.icon || '🌐', url: p.url }); } }
  return out.filter(g => g.items.length);
}
/* travel to an item: places keep the beloved instant "port" dash, urls hop through app.go (ends VR, carries ?vr=1 + from=) */
export function goItem(app, it, mode = 'port') {
  if (!it) return;
  if (it.url) { const u = /^https?:/i.test(it.url) ? it.url : new URL(it.url, location.href).href; if (app.go) app.go(u, it.label); else location.href = u; return; }
  if (it.place) { const pl = it.place; if (pl.fn && pl.x === undefined) { try { pl.fn(app); } catch (e) { console.error(e); } return; } app.travel(pl, mode); }
}
