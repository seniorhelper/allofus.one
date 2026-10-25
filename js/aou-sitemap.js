/* ============================================================
   allofus.one · the site directory (v20, Oct 14 2026)
   ONE list of every place on allofus.one. The More sheet (phone and desktop),
   the Control panel's "Everything" section and the header on the static pages
   all draw from this list, so a page can never go missing from one of them.
   Add a new page here and it shows up everywhere.
   - flat: true  → opens in the flat site (no 3D download)
   - flat: false → opens the 3D world (the label says so)
   ============================================================ */
export const SITE_GROUPS = [
  ['social', 'Social'],
  ['talk', 'Talk'],
  ['grow', 'Grow'],
  ['biz', 'Business'],
  ['fun', 'Fun'],
  ['xr', '3D and VR'],
  ['about', 'About and help'],
];
/* [key, label, href, emoji, group, flat, short description] */
export const SITE_PAGES = [
  ['feed', 'Home feed', '/', '🏠', 'social', true, 'Everyone, newest first'],
  ['u', 'Profile', '/?v=u', '👤', 'social', true, 'Your page, your posts, the ⋯ menu'],
  ['conn', 'Connections', '/?v=conn', '🤝', 'social', true, 'Requests and your people'],
  ['notif', 'Alerts', '/?v=notif', '🔔', 'social', true, 'Tags, reactions, comments'],
  ['constellations', 'Constellations', '/constellations/', '✨', 'social', true, 'Find your people, or light a new one'],
  ['video', 'Video', '/?v=video', '🎬', 'social', true, 'Every video, one feed'],
  ['search', 'Search', '/?v=search', '🔎', 'social', true, 'People, posts, brands'],
  ['dm', 'DMs', '/?v=dm', '💬', 'talk', true, 'Private messages'],
  ['inbox', 'Inbox', '/?v=inbox', '📬', 'talk', true, 'Everything sent to you'],
  ['hub', 'Comm Hub', '/?v=hub', '📡', 'talk', true, 'Requests and your port'],
  ['room', 'Rooms', '/chat/?r=general', '💬', 'talk', true, 'Live chat: The Lobby, Help Desk and more'],
  ['rooms', 'Global Room', '/rooms/', '🌍', 'talk', true, 'Your team in one space'],
  ['meet', 'Unity Call', '/meet/', '📞', 'talk', true, 'Free video calls'],
  ['board', 'LIFEboard', '/?v=board', '🧭', 'grow', true, 'Goals, habits, money'],
  ['work', 'FLOWworks pads', '/?v=work', '⬡', 'grow', true, 'Resizable pads: notes, sketch, CRM, docs'],
  ['courses', 'Courses', '/?v=courses', '📚', 'grow', true, 'Learn and teach'],
  ['events', 'Events', '/?v=events', '📅', 'grow', true, 'What is happening'],
  ['trading', 'Trading Post', '/?g=general', '🛍️', 'grow', true, 'Buy, sell, trade and free'],
  ['brand', 'Brand pages', '/?v=brand', '💼', 'biz', true, 'Free business pages'],
  ['boost', 'searchBOOST', '/boost/', '🚀', 'biz', true, 'Marketing and ads'],
  ['badge', 'Follow badges', '/follow-badge/', '🏷️', 'biz', true, 'Buttons for your website'],
  ['moments', 'Moments', '/moments/', '📷', 'fun', true, '10-second camera clips'],
  ['games', 'Games', '/games/', '🎮', 'fun', true, 'Quick browser games'],
  ['match', 'Global Match', '/match/', '🎯', 'fun', true, 'Needs meet offers'],
  ['world', '3D world', '/world/', '🧊', 'xr', false, 'Opens 3D'],
  ['house', 'My 3D house', '/world/?home=1', '🏡', 'xr', false, 'Opens 3D'],
  ['avatar', 'My character', '/world/?customize=1', '🧍', 'xr', false, 'Opens 3D'],
  ['vr', 'VR headset', '/world/?vr=1', '🥽', 'xr', false, 'Opens VR'],
  ['panel', 'Control panel', '/?v=panel', '⚙️', 'about', true, 'Your whole account'],
  ['mission', 'Our mission', '/mission/', '✌️', 'about', true, 'Why we built this'],
  ['rules', 'Community rules', '/community-rules/', '📜', 'about', true, 'Be kind, stay safe'],
  ['privacy', 'Privacy', '/privacy/', '🔒', 'about', true, 'What we keep and why'],
  ['terms', 'Terms', '/terms/', '📄', 'about', true, 'The agreement'],
  ['a11y', 'Accessibility', '/accessibility/', '👤', 'about', true, 'Built for everyone'],
];
export const pagesIn = (g) => SITE_PAGES.filter(p => p[4] === g);
