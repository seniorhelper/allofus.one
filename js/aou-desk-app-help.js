/* allofus.one · the desk · app sheet: "Your hands" — a plain card that explains every hand move. */
export default function (desk) {
  const id = 'help';
  const TIPS = [
    ['Press', 'Point at a button and pinch. With controllers, pull the trigger.'],
    ['Move the desk', 'Pinch both hands on empty space, then pull, push or lift.'],
    ['Move a board', 'Point at the teal MOVE box above it, pinch and drag. Push your hand out to send it away, pull in to bring it close.'],
    ['Resize a board', 'Tap − or + on its bar.'],
    ['Write', 'Pinch the pencil on the desk to pick it up, then write on the paper. Let go and it returns to its place.'],
    ['Lost or jumbled?', 'Tap Reset all on the bar above the front board. If the desk drifts out of reach it comes back by itself.'],
    ['Open or close a sheet', 'Tap its name on the bar above the front board, or × on the sheet.'],
  ];
  desk.addSheet({
    id, title: 'Your hands', W: 640, H: 640, w: 0.62, h: 0.62, home: { a: -0.7, e: 0.28, r: 1.65, k: 1 }, open: true,
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
