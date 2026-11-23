/* allofus.one · the desk · app sheet: "Your hands" — a plain card that explains every hand move. */
export default function (desk) {
  const id = 'help';
  const TIPS = [
    ['Press', 'Point at a button and pinch. With controllers, pull the trigger.'],
    ['Move the desk', 'Pinch both hands on empty space, then pull it to you or push it away.'],
    ['Lift or widen', 'Still pinching both hands: raise or lower to lift, spread apart to widen.'],
    ['Move a board', 'Pinch the bar above it and drag. Push your hand out to send it away, pull in to bring it close.'],
    ['Resize a board', 'Tap − or + on its bar.'],
    ['Bring the desk back', 'Hold a pinch on empty space for one second.'],
    ['Close a sheet', 'Tap × on its bar. Open it again from the row above the front board.'],
  ];
  desk.addSheet({
    id, title: 'Your hands', W: 640, H: 640, w: 0.62, h: 0.62, home: { a: -0.8203, e: 0.4678, r: 1.1204, k: 1 }, open: true,
    draw(p, g) {
      desk.base(p, 'Your hands'); let y = 108;
      for (const [head, text] of TIPS) {
        desk.label(g, head, 36, y, 24, desk.accent(), 'left', 700); y += 30;
        g.font = `500 21px ${desk.FF}`; const lines = desk.L.wrap(text, 568, (s) => g.measureText(s).width, 3);
        for (const ln of lines) { desk.label(g, ln, 36, y, 21, '#e6eaf1', 'left', 500); y += 26; }
        y += 10;
      }
    },
  });
}
