/* ============================================================
   allofus.one · welcome posts (v20, Oct 14 2026)
   Posts written by the allofus AI, system announcements and Orbit (the guide bot), each clearly labeled
   with a badge on the card (extra.voice). supabase/allofus-v20.sql publishes these same posts as real rows
   (so people can comment, save and vote for real); until then the feed shows them from this list, read-only
   except reactions and poll votes (votes are recorded for the admin under Bug reports, kind "poll").
   Every video and article link was checked on Oct 14 2026. Art in /images/feed/ is generated with code.
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
];
/* the seed list as feed_posts-shaped objects (id seed-<key>), newest first is up to the caller */
export function seedPosts() {
  return SEED.map(([key, voice, at, kind, text, link, media, x]) => {
    const p = { id: 'seed-' + key, _seed: true, user_id: FOUNDER, created_at: at, kind, text, link: link || null, media: media || [], public: true, group_slug: null, page_slug: null, style: { big: x.big || 'none' }, extra: { voice, seed: key } };
    if (kind === 'poll' && x.poll) p.poll = { options: x.poll, counts: x.poll.map(() => 0), voters: {} };
    return p;
  });
}
