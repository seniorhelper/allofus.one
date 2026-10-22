/* allofus.one world · landing views (Oct 21 2026). Every Go / tour / ?to= destination was visited in the VR simulator and measured:
   where a landing faced a wall, a hillside, a pole or empty ground, the place gets a standing spot (x, z) that sees the whole place,
   the direction to face (yaw, the engine's convention) and the point it frames (look). Scan tools + contact sheets live in the hand-over notes.
   Applied to app.places as they register (places can arrive late), so the 2D/3D travel, the VR menu, the guided tour and ?to= all use them. */
export const LANDINGS = {
  "art": {"x":-150,"z":-180,"yaw":1.57,"look":[-160,-180]},
  "banquet": {"x":45.7,"z":113.1,"yaw":0.94,"look":[40,109]},
  "beach": {"x":-172,"z":212,"yaw":0},
  "city": {"x":0,"z":-170,"yaw":0},
  "coaster": {"x":-166,"z":68,"yaw":3.14},
  "coburn": {"x":330,"z":306,"yaw":3.14},
  "desert": {"x":247.7,"z":-26.7,"yaw":-0.03,"look":[248.8,-62.4]},
  "disco": {"x":41.9,"z":110.2,"yaw":-2.83,"look":[44.99843535898036,119.73453300193465]},
  "dream-room": {"x":52.4,"z":96.4,"yaw":1.57,"look":[45.4,96.4]},
  "elias": {"x":-62,"z":61,"yaw":1.96},
  "falls": {"x":-226,"z":-18,"yaw":1.57},
  "first-street": {"x":8.5,"z":123.1,"yaw":0.51,"look":[-8.7,92]},
  "home--26_218": {"x":-27.6,"z":219.4,"yaw":1.74,"look":[-46.2,222.6]},
  "jamoke": {"x":5.1,"z":130.5,"yaw":-1.1,"look":[14,126]},
  "lake-dillon": {"x":133.4,"z":198.3,"yaw":-0.65,"look":[152.6,172.9]},
  "movie": {"x":102,"z":147.4,"yaw":0.78,"look":[68.3,113.2]},
  "park-1": {"x":-195.8,"z":139.8,"yaw":2.74,"look":[-209.3,171.6]},
  "rocket": {"x":96.2,"z":98.7,"yaw":1.78,"look":[58.6,106.8]},
  "rotunda": {"x":-15.3,"z":92.2,"yaw":-2.14,"look":[25.1,118.2]},
  "skirun": {"x":337.5,"z":301.7,"yaw":1.96},
  "skyrange": {"x":96.4,"z":66.1,"yaw":2.41,"look":[64.5,101.9]},
  "starport": {"x":210,"z":198,"yaw":3.93},
  "treeoflife": {"x":45.1,"z":27.7,"yaw":3.06,"look":[41.4,75.5]},
  "truck": {"x":10,"z":145,"yaw":0},
  "unity-heights": {"x":-46.5,"z":109.3,"yaw":-1.65,"look":[1.4,113.3]},
  "water": {"x":96.1,"z":85.4,"yaw":2.01,"look":[52.6,105.7]},
  "worlds": {"x":30.5,"z":152.1,"yaw":1.26,"look":[21,149]}
};
export function applyLandings(app, table = LANDINGS) {
  const fix = () => { for (const p of (app.places || [])) { const f = p && table[p.id]; if (!f || p._landing) continue; p._landing = { x: p.x, z: p.z, yaw: p.yaw, look: p.look }; if (f.look) p.look = f.look; if (f.x !== undefined) { p.x = f.x; p.z = f.z; } if (f.yaw !== undefined) p.yaw = f.yaw; } };
  fix(); let n = 0; const iv = setInterval(() => { try { fix(); } catch (e) { } if (++n > 60) clearInterval(iv); }, 1500);
  try { if (app.travel && !app.travel._landings) { const t0 = app.travel.bind(app); app.travel = (pl, mode) => { try { fix(); } catch (e) { } return t0(pl, mode); }; app.travel._landings = true; } } catch (e) { }
  return fix;
}
