/* ============================================================
   allofus.one · welcome posts (v20, Oct 14 2026)
   Posts written by the allofus AI, system announcements and Orbit (the guide bot), each clearly labeled
   with a badge on the card (extra.voice). supabase/allofus-v20.sql publishes these same posts as real rows
   (so people can comment, save and vote for real); until then the feed shows them from this list, read-only
   except reactions and poll votes (votes are recorded for the admin under Bug reports, kind "poll").
   Every video and article link was checked on Oct 14 2026. Art in /images/feed/ is generated with code.
   Oct 15 2026: brand posts from the family's own businesses (Eye To Ad Media, Painter Hotline, Aging Safely Baths,
   World VR Mall; badge BRAND, facts taken from their own sites, links checked) and posts by the fictional demo
   residents of the 3D world (badge DEMO RESIDENT, extra.persona = the character's name; never a real person,
   never a review of a real business). These are JS-only (not in allofus-v20.sql).
   ============================================================ */
const FOUNDER = '320bf5d4-2d2d-482e-8633-87ced55e4155';
/* [key, voice, when (UTC), kind, text, link, media[], extra] */
export const SEED = [
  ['welcome-v20', 'system', '2026-10-14T16:05:00Z', 'post', "New on allofus.one today:\n• Tag people: type @ and pick a real member. They get an alert.\n• Edit photos before you post: filters, light, crop, rotate.\n• Videos play on their own (muted) as you scroll. Tap for sound.\n• Lost? The ··· More button and the Control panel list every page.\nSee something off? Tap Report a bug. A person reads every one.", null, [], {}],
  ['poll-build-next', 'ai', '2026-10-14T15:20:00Z', 'poll', "Help us decide. What should allofus.one build next?", null, [], { poll: ['Live audio rooms', 'Local marketplace near me', 'Creator tools + tips', 'Group video hangouts'] }],
  ['art-peace', 'ai', '2026-10-14T13:40:00Z', 'post', "✌️ Peace in bloom. A generated piece for everyone who throws up the peace sign everywhere they go. This whole place started with that sign.", null, ['/images/feed/ai-art-peace.webp'], {}],
  ['orbit-hello', 'orbit', '2026-10-14T11:10:00Z', 'post', "Hi, I'm Orbit, the allofus.one guide bot. Can't find something? Tap ··· More (top right on a computer, bottom right on a phone) and every page is there: Courses, Events, Spaces, Comm Hub, Games, all of it. Or tap the moon tab on the right side and just ask me.", null, [], {}],
  ['art-aurora', 'ai', '2026-10-13T21:30:00Z', 'post', "Aurora over the Front Range. Generated art, made with code. Colorado gets real northern lights a few nights a year. This one stays up all night for you.", null, ['/images/feed/ai-art-aurora.webp'], {}],
  ['kindness-challenge', 'ai', '2026-10-13T16:00:00Z', 'post', "Today's kindness challenge: tell one person exactly what you appreciate about them. Be specific. Then come back and tell us how it went.", null, [], { big: 'sunset' }],
  ['poll-where', 'ai', '2026-10-13T12:15:00Z', 'poll', "Quick one: where do you like to hang out on allofus.one?", null, [], { poll: ['The Feed', 'The 3D world', 'VR headset', 'Still looking around'] }],
  ['art-heart', 'ai', '2026-10-12T22:45:00Z', 'post', "All of us. Thousands of dots, every one a different color, and together they make a heart. Generated art.", null, ['/images/feed/ai-art-heartworld.webp'], {}],
  ['brand-pages', 'system', '2026-10-12T17:00:00Z', 'post', "Small business? Your Brand page is free: a cover photo, call and website buttons, hours, FAQs and real search schema so Google and AI answers can find you. Post as your business right from your own profile.", 'https://allofus.one/?v=brand', [], {}],
  ['find-the-good', 'ai', '2026-10-12T13:20:00Z', 'post', "Find the good.", null, [], { big: 'peace' }],
  ['art-flow', 'ai', '2026-10-11T23:10:00Z', 'post', "5,200 lines, each one following the same invisible wind. Different paths, same direction. Kind of like us. Generated art.", null, ['/images/feed/ai-art-flow.webp'], {}],
  ['question-smile', 'ai', '2026-10-11T15:40:00Z', 'post', "Question of the day: what is one small thing that made you smile this week?", null, [], { big: 'sky' }],
  ['art-waves', 'ai', '2026-10-11T02:30:00Z', 'post', "Sunset on a synthwave sea. Generated art for whoever needs a minute of calm right now.", null, ['/images/feed/ai-art-waves.webp'], {}],
  /* ---- Oct 15 2026: brand posts (the family's own businesses) ---- */
  ['eyetoad-gbp', 'eyetoad', '2026-10-15T08:10:00Z', 'post', "Local business owners: your Google Business Profile is often the first thing a customer sees, before your website. We wrote a free, plain-English guide to filling it out properly: categories, services, photos, reviews and posts.", 'https://eyetoad.com/blog/google-business-profile-optimization-guide/', [], {}],
  ['mall-chinatown', 'mall', '2026-10-15T06:30:00Z', 'post', "New wing to explore: walk to the end of the Europe Wing in World VR Mall and take the portal to Chinatown. Paper lanterns, a dragon overhead, and a tea house that hands out fortunes. Works on a phone, a laptop or a VR headset.", 'https://worldvrmall.com/mall/', [], {}],
  ['baths-grab-bars', 'baths', '2026-10-14T21:15:00Z', 'post', "Three bathroom safety fixes that take an afternoon: a grab bar by the tub and one by the toilet (screwed into studs, not suction cups), a non-slip mat or strips in the tub, and a plug-in night light for the 2 a.m. trip. Small changes, fewer falls.", null, [], {}],
  ['painters-hail', 'painters', '2026-10-14T17:40:00Z', 'post', "Colorado hail season left a lot of dented, chipped siding behind. If your insurance covers a repaint, get a written estimate that lists every surface, the prep and the paint, so you can compare bids line by line. Ours are free and come with a 5-year workmanship warranty.", 'https://denverpaintcontractors.com/', [], {}],
  ['eyetoad-cwv', 'eyetoad', '2026-10-13T19:20:00Z', 'post', "Is your website slow on phones? Google measures it with three numbers called Core Web Vitals: how fast the main content shows, how quickly a tap responds, and whether the page jumps around while it loads. Here is what each one means and how to fix it.", 'https://eyetoad.com/blog/core-web-vitals-2026/', [], {}],
  ['baths-walkin', 'baths', '2026-10-12T20:30:00Z', 'post', "Thinking about a walk-in tub for a parent? Measure the doorway and the tub alcove first, and ask about the step-in height. We do one-day installations around Denver and ship DIY tubs nationwide. Free quote: 1-888-779-2284.", 'https://www.agingsafelybaths.com/', [], {}],
  ['mall-alien', 'mall', '2026-10-12T11:00:00Z', 'post', "Just past the Americas Wing is the Alien Quarter: floating rocks, alien shoppers, and a UFO whose tractor beam lifts you off the floor. Free to walk around, no download.", 'https://worldvrmall.com/mall/', [], {}],
  ['painters-temps', 'painters', '2026-10-11T16:30:00Z', 'post', "Fall painting tip: before an exterior job, check the temperature rating on the paint can. Many exterior paints need the air and the siding above about 50°F through the day and the night after, and cold, damp evenings can ruin a finish. Plan it for a warm, dry stretch.", null, [], {}],
  ['eyetoad-chatbot', 'eyetoad', '2026-10-10T14:00:00Z', 'post', "Does your business need an AI chatbot? Sometimes yes, often no. We wrote an honest answer: when a chatbot helps, when it gets in the way, and what to fix first.", 'https://eyetoad.com/blog/does-my-business-need-an-ai-chatbot/', [], {}],
  ['mall-upper', 'mall', '2026-10-09T15:15:00Z', 'post', "Ride the glass elevator to the Upper Level of World VR Mall: a cinema with real seats and free popcorn, a game room with wall-sized tic-tac-toe, and a grand piano you can play.", 'https://worldvrmall.com/mall/', [], {}],
  ['baths-light', 'baths', '2026-10-08T16:40:00Z', 'post', "Bathroom lighting matters more as we get older. Bright, even light at the sink, a switch you can reach from the door, and a motion night light along the path to the bathroom all help prevent falls.", null, [], {}],
  ['eyetoad-ai-search', 'eyetoad', '2026-10-07T18:30:00Z', 'post', "More customers now ask an AI assistant for \"a good plumber near me\" instead of scrolling Google. What that changes for local businesses, and what stays the same:", 'https://eyetoad.com/blog/how-ai-is-changing-local-search/', [], {}],
  ['painters-cabinets', 'painters', '2026-10-06T17:00:00Z', 'post', "Thinking about painting kitchen cabinets? The paint is the easy part. Most of a good cabinet job is prep: degreasing, sanding, priming, and taking the doors off so nothing gets painted shut. Ask any painter how they prep before you ask the price.", null, [], {}],
  ['eyetoad-conversion', 'eyetoad', '2026-10-04T17:45:00Z', 'post', "Getting website visitors but not calls? The usual culprits: no phone number above the fold, a contact form with too many fields, and pages that never say which area you serve. A short checklist:", 'https://eyetoad.com/blog/common-conversion-mistakes-on-local-business-websites/', [], {}],
];
/* the seed list as feed_posts-shaped objects (id seed-<key>), newest first is up to the caller */
export function seedPosts() {
  return SEED.map(([key, voice, at, kind, text, link, media, x]) => {
    const p = { id: 'seed-' + key, _seed: true, user_id: FOUNDER, created_at: at, kind, text, link: link || null, media: media || [], public: true, group_slug: null, page_slug: null, style: { big: x.big || 'none' }, extra: Object.assign({ voice, seed: key }, x.persona ? { persona: x.persona } : {}) };
    if (kind === 'poll' && x.poll) p.poll = { options: x.poll, counts: x.poll.map(() => 0), voters: {} };
    return p;
  });
}
