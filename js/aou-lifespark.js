/* allofus.one · LIFEspark (v27, Oct 23 2026) · /?v=spark
   A daily page of small life tools: a Daily spark (one of 125 original prompts: reflection, gratitude, creative,
   business, kindness) you can post to your feed or save to your LIFEboard; three "tiny wins" for today (saved to
   public.spark_days when the v27 SQL has run, else to this device); a 2-minute breathing timer (pure CSS/JS);
   "Ask allofus" (the aou-guide Edge Function in mode 'spark', with scripted fallbacks when it is not deployed);
   and "Ideas for your business" built from the member's Brand page category. Not a therapist, not a companion:
   it says so, and it points to 988 when someone is in crisis. All copy here is original. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const dayKey = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);

/* ---------- 120 original prompts: [category, text] ---------- */
export const PROMPTS = [
  ['reflection', 'What did you do this week that your younger self would be proud of?'],
  ['gratitude', 'Name one ordinary object in the room that makes your day easier. Thank it, out loud if you dare.'],
  ['creative', 'Describe your morning as if it were the opening scene of a film. What is the first shot?'],
  ['business', 'What question do customers ask you most often? Write the answer in two sentences and post it.'],
  ['kindness', 'Who helped you last month without being asked? Send them one line today.'],
  ['reflection', 'What is one habit you kept this year, and what did keeping it teach you?'],
  ['gratitude', 'Which sound do you hear most days and never notice? Listen for it once today.'],
  ['creative', 'Invent a holiday your street would actually celebrate. What is it called and what do people do?'],
  ['business', 'If a new customer could see only one photo of your work, which one would it be and why?'],
  ['kindness', 'Hold a door, a thought or a space for someone today. Which one, and for whom?'],
  ['reflection', 'Which worry are you carrying for someone else, and did they ever ask you to?'],
  ['gratitude', 'Name three things your hands did for you today before noon.'],
  ['creative', 'Give your current mood a color, a texture and a weather report.'],
  ['business', 'What is the smallest change that would make your first-time customers feel welcome?'],
  ['kindness', 'Think of someone new in your circle. What is one thing you could show them that took you years to learn?'],
  ['reflection', 'When did you last change your mind about something important? What did it take?'],
  ['gratitude', 'Who taught you a skill you still use every week? Picture their face for ten seconds.'],
  ['creative', 'Write a six-word story about your neighborhood.'],
  ['business', 'Which part of your work would you do for free? That is a clue to your best marketing.'],
  ['kindness', 'Leave a review for a small business you actually like. Specific beats glowing.'],
  ['reflection', 'What would an honest Tuesday look like if you planned it only around energy, not obligation?'],
  ['gratitude', 'What is a problem you had five years ago that you no longer have?'],
  ['creative', 'Draw, type or describe a map of your day with three landmarks.'],
  ['business', 'Write the one-sentence promise your business makes. Could a stranger repeat it after hearing it once?'],
  ['kindness', 'Who in your family rarely gets asked how they are doing? Ask, and wait for the real answer.'],
  ['reflection', 'What is one thing you say yes to out of habit that you could pause this month?'],
  ['gratitude', 'Name a piece of advice you ignored and are now glad you followed later.'],
  ['creative', 'Pick an object within reach and write its résumé.'],
  ['business', 'What did a customer thank you for recently? Turn that into a post, with their permission or without their name.'],
  ['kindness', 'Compliment someone on something they did, not something they are.'],
  ['reflection', 'What does "enough" look like for you this season: money, time, attention?'],
  ['gratitude', 'Which meal this week deserves a quiet thank-you to whoever grew or cooked it?'],
  ['creative', 'Rename the days of the week after what you actually do on them.'],
  ['business', 'What is one task you do by hand that a checklist could do for you?'],
  ['kindness', 'Share a resource (a tool, a list, a link) with a group here that could use it.'],
  ['reflection', 'What is a boundary you held recently that felt uncomfortable and right at the same time?'],
  ['gratitude', 'Who makes you laugh most reliably? Tell them what it does for you.'],
  ['creative', 'Describe the view from your window to someone who has never seen a city, or never seen a field.'],
  ['business', 'If you had to explain your pricing to a curious ten-year-old, what would you say?'],
  ['kindness', 'Notice a worker who is rarely thanked today: a driver, a cleaner, a clerk. Thank them by name if you can.'],
  ['reflection', 'What did you learn from the last thing that did not work out?'],
  ['gratitude', 'Name one body part that worked hard for you today without complaint.'],
  ['creative', 'Write a two-line toast for a friend who just finished something hard.'],
  ['business', 'What would make a customer tell a friend about you this week, unprompted?'],
  ['kindness', 'Pick one person in your Local circle. What is a small favor you could offer before they ask?'],
  ['reflection', 'What part of your routine is a ritual, and what part is just a rut?'],
  ['gratitude', 'What is something free that you enjoyed this week?'],
  ['creative', 'Describe your favorite room using only verbs.'],
  ['business', 'Which of your services is the hardest to explain? Try explaining it with one before-and-after.'],
  ['kindness', 'Forgive one small thing today, quietly, without announcing it.'],
  ['reflection', 'When do you feel most like yourself? What is present in those moments?'],
  ['gratitude', 'Who kept a promise to you this year? Recall the moment they kept it.'],
  ['creative', 'Write the first line of a letter to the person who will live in your home fifty years from now.'],
  ['business', 'What would you tell someone starting your kind of business today that nobody told you?'],
  ['kindness', 'Invite one person to something: a walk, a call, a group here.'],
  ['reflection', 'What is a question you have been avoiding? Write it down, no answer required.'],
  ['gratitude', 'Name a tool or app that quietly saves you time. (Yes, this counts as gratitude.)'],
  ['creative', 'Build a three-song soundtrack for your week and say why each track made the cut.'],
  ['business', 'Which day of the week is your slowest? What could you offer only on that day?'],
  ['kindness', 'Write down one thing you appreciate about a coworker or client, then tell them.'],
  ['reflection', 'What is one thing you want less of in your feed, and in your life?'],
  ['gratitude', 'What is the kindest thing a stranger has done for you? Pass a version of it forward.'],
  ['creative', 'Design a flag for your household. What is on it?'],
  ['business', 'What would your business look like if it were half the size and twice as focused?'],
  ['kindness', 'Check on someone who went quiet. One sentence is enough.'],
  ['reflection', 'What are you better at than you were a year ago?'],
  ['gratitude', 'Who cheered for you when you were not sure you had it in you?'],
  ['creative', 'Describe a smell from childhood and the room it comes with.'],
  ['business', 'If you could remove one step from how a customer hires you, which step would it be?'],
  ['kindness', 'Carry something for someone today: a bag, a box, a worry.'],
  ['reflection', 'Which of your goals is really someone else\'s goal wearing your name?'],
  ['gratitude', 'Name a mistake that led to something good.'],
  ['creative', 'Write a weather forecast for your mood this week, with a chance of what?'],
  ['business', 'What is one thing you could show behind the scenes that would build trust?'],
  ['kindness', 'Teach someone one small thing today: a shortcut, a recipe, a route.'],
  ['reflection', 'What do you want to be known for in your Inner Tribe?'],
  ['gratitude', 'Which season are you grateful for right now, and what does it give you?'],
  ['creative', 'Turn today\'s to-do list into a short poem. Rhyme optional.'],
  ['business', 'Which customer would you clone if you could? Describe them in three lines.'],
  ['kindness', 'Pay a sincere compliment to a competitor. It costs nothing and says a lot.'],
  ['reflection', 'What would you do with one extra hour this evening if nobody needed anything from you?'],
  ['gratitude', 'Name a place you can go to feel calm. When were you last there?'],
  ['creative', 'Describe your week as a recipe: ingredients, method, serves how many?'],
  ['business', 'What question should every new customer be asked that you are not asking yet?'],
  ['kindness', 'Donate one thing you no longer use to someone in a free group here.'],
  ['reflection', 'What is a small win from this week that nobody else noticed?'],
  ['gratitude', 'Who was patient with you when you were learning? Say their name.'],
  ['creative', 'Write a three-sentence bedtime story for an adult who cannot sleep.'],
  ['business', 'What is one promise you could make about response time, and keep?'],
  ['kindness', 'Let someone go first today: in line, in a conversation, in traffic.'],
  ['reflection', 'What does rest look like when it is real and not just scrolling?'],
  ['gratitude', 'Name one thing about your town or neighborhood you would miss if you moved.'],
  ['creative', 'Describe your perfect ordinary day in one paragraph. Nothing fancy allowed.'],
  ['business', 'What could you stop selling so the rest of your work gets better?'],
  ['kindness', 'Write a thank-you to a teacher, coach or mentor, even one from long ago.'],
  ['reflection', 'What is one thing you believed last year that you no longer believe?'],
  ['gratitude', 'Which friend sends you the best links, songs or photos? Tell them so.'],
  ['creative', 'Give a name and a personality to the oldest thing you own.'],
  ['business', 'If your business had a front porch, who would be sitting on it and what would they talk about?'],
  ['kindness', 'Offer to listen to someone for ten minutes without fixing anything.'],
  ['reflection', 'When did you last feel truly rested? What was different about that day?'],
  ['gratitude', 'Name a book, show or song that arrived at exactly the right time.'],
  ['creative', 'Write a slogan for your street that would fit on a bumper sticker.'],
  ['business', 'What is one small, clear thing you could post every Monday for a month?'],
  ['kindness', 'Help one person find something today: a job lead, a lost item, a good contractor.'],
  ['reflection', 'What are you tolerating that you could fix in under an hour?'],
  ['gratitude', 'Who makes your mornings easier without you noticing? Notice today.'],
  ['creative', 'Describe your favorite tool, instrument or utensil as if it were a loyal animal.'],
  ['business', 'What does your best review say, in its own words? Build your next post around that sentence.'],
  ['kindness', 'Make a short list of people who could use a ride, a meal or a visit this month. Start with one.'],
  ['reflection', 'What would you tell a friend who was in your exact situation today?'],
  ['gratitude', 'Name one thing about your body, your home or your work that is working well right now.'],
  ['creative', 'Invent a small ceremony for finishing a workday. What is step one?'],
  ['business', 'What would you build if you knew ten of your customers would join a Space about it?'],
  ['kindness', 'Say something encouraging to a beginner today. Remember what you needed to hear.'],
  ['reflection', 'Which part of today are you most likely to remember in ten years?'],
  ['gratitude', 'What did you take for granted this morning that someone else would call a luxury?'],
  ['creative', 'Describe a color to someone who cannot see it, using sounds and tastes.'],
  ['business', 'Which of your customers could become your teacher? What would you ask them?'],
  ['kindness', 'Write down one kind thing you did today. You are allowed to count it.'],
  ['reflection', 'What are you looking forward to? If nothing, what could you plan that is small and soon?'],
  ['gratitude', 'Who would you call first with good news? Tell them they are that person.'],
  ['creative', 'Write a one-line review of today, as if today were a restaurant.'],
  ['business', 'What is one way to make your work visible to the next street over this month?'],
  ['kindness', 'Pick one post in your feed and leave a comment that makes the poster\'s day a little better.']
];
export const todaySpark = (d = new Date()) => { const i = dayNum(d) % PROMPTS.length; return { id: i, cat: PROMPTS[i][0], text: PROMPTS[i][1] }; };
const CAT = { reflection: ['Reflection', '#7c3aed'], gratitude: ['Gratitude', '#16a34a'], creative: ['Creative', '#ec4899'], business: ['Business', '#0369a1'], kindness: ['Kindness', '#f59e0b'] };

/* ---------- business ideas by Brand page category ---------- */
const BIZ = [
  [/restaurant|cafe|coffee|diner|bakery|food|catering|bar|pizza|taco|grill|kitchen/i, 'Food & drink', ['Post the one dish regulars order most, with the story of how it got on the menu.', 'Share a 20-second clip of the kitchen at opening time. Quiet mornings build trust.', 'Ask your feed: what should the next seasonal special be? Make the top answer.', 'Start a Space for your regulars: first look at new items, birthday notes, a monthly table.', 'List a free listing on USA Business Search and Colorado Business List from Grow your business, then post the link.']],
  [/paint|roof|plumb|electric|hvac|handyman|remodel|contractor|landscap|clean|pest|garage|concrete|fence|window|floor|carpent|build/i, 'Home services', ['Post a before-and-after from this week. Name the problem, not the client.', 'Write the three questions every homeowner should ask before hiring your trade.', 'Share your service area as a simple list of neighborhoods; it helps local search.', 'Offer a free 10-minute phone check in a Local group; answer the rest publicly.', 'Turn on AI Speed to Leads from Grow your business so web inquiries get a reply in a minute, not a day.']],
  [/health|wellness|fitness|gym|yoga|massage|chiro|dental|dentist|clinic|therap|nutrition|spa|salon|barber|beauty|nail|hair/i, 'Health, wellness & beauty', ['Post one tiny habit a client can do at home in two minutes. Keep it general, not medical advice.', 'Share what a first visit looks like, step by step, so nervous people know what to expect.', 'Ask your feed which hours are hardest to book; adjust one slot and announce it.', 'Create a Course with five short lessons on the basics you explain most often.', 'Invite happy clients to your Brand page and ask for a specific line about what changed for them.']],
  [/shop|store|boutique|retail|gift|book|antique|thrift|market|furniture|decor|jewel|cloth|apparel|barn|wood/i, 'Retail & makers', ['Post one item with its origin story: who made it, where it came from, why you stock it.', 'Run a weekly "pick one" poll between two products. Stock the winner up front.', 'Share your restock day so people have a reason to come back on a schedule.', 'List a few items in a buy/sell/trade group with a link to your Brand page.', 'Lease a storefront in World VR Mall and post a walk-through clip of it.']],
  [/law|attorney|legal|account|tax|cpa|bookkeep|insur|financ|mortgage|loan|consult|coach|agency|marketing|design|web|real estate|realtor|broker|notary|advis/i, 'Professional services', ['Answer the question you get in every first meeting, in plain words, as a post.', 'Share a short checklist people can use before they call you. Helpful beats salesy.', 'Write one post that explains what you do NOT do, so the right people call.', 'Host a monthly 20-minute Unity Call Q&A. Post the link, keep it free.', 'Draft a press release about a milestone from the Grow page and publish it.']],
  [/photo|video|music|art|studio|creative|writer|author|print|film|band|dj|event|wedding|florist|party/i, 'Creative & events', ['Post one piece of work with the single decision that made it better.', 'Share your process in three photos: start, middle, done.', 'Ask your feed what they want to see more of this month. Deliver one.', 'Open a Space for past clients and fans: early access, behind the scenes, pre-orders.', 'Add Moments: a quick face-to-camera clip beats a polished ad for trust.']],
  [/auto|car|truck|tire|mechanic|detail|glass|body shop|towing|dealer|motor/i, 'Auto', ['Post a one-minute "what that noise might be" explainer for one common symptom.', 'Share seasonal prep tips before the season hits; people save and share those.', 'Show one honest estimate with the reasoning. Transparency is rare and it travels.', 'Offer a free check at a local event and post the schedule in a Local group.', 'Use AI Speed to Leads so after-hours quote requests get a same-minute reply.']]
];
const bizIdeas = (cat) => { const hit = BIZ.find(([rx]) => rx.test(cat || '')); return hit ? { label: hit[1], ideas: hit[2] } : { label: cat ? cat : 'Any business', ideas: ['Post one thing you learned from a customer this week.', 'Write the three questions people should ask before hiring anyone in your field.', 'Share a photo of your workspace on an ordinary day. Ordinary builds trust.', 'Pick one neighborhood to be visible in this month: a Local group, a free listing, one event.', 'Set up your free listings and a press release from Grow your business, then post the links.'] }; };

/* ---------- scripted LIFEspark replies (used when the AI function is not deployed) ---------- */
const SPARK_FALLBACK = [
  'Let me reflect that back: what would the smallest next step look like, the one you could finish before your coffee cools?',
  'Try this: write the problem in one sentence, then write what you would tell a friend with the same sentence. The gap is the answer.',
  'Noticing counts. You noticed, which means part of you already knows what matters here. What is that part asking for?',
  'Pick one tiny win for today and put it on the list above. A finished small thing beats a flawless plan, and today beats someday.',
  'Two minutes of breathing changes the question more often than it changes the answer. The timer is right here when you want it.'
];
const CRISIS = /suicid|kill myself|end my life|self.?harm|hurt myself|want to die|overdose/i;

/* ---------- storage: spark_days with device fallback ---------- */
let tableOk = null;
async function loadDay(sb, me, day) {
  const local = () => { try { return JSON.parse(localStorage.getItem('aou_spark_' + day) || 'null'); } catch (e) { return null; } };
  if (!sb || !me || tableOk === false) return local() || { wins: [], spark_saved: false, breaths: 0 };
  try { const { data, error } = await sb.from('spark_days').select('wins,spark_saved,breaths').eq('user_id', me.id).eq('day', day).maybeSingle(); if (error) throw error; tableOk = true; return data || local() || { wins: [], spark_saved: false, breaths: 0 }; }
  catch (e) { tableOk = false; return local() || { wins: [], spark_saved: false, breaths: 0 }; }
}
async function saveDay(sb, me, day, row) {
  try { localStorage.setItem('aou_spark_' + day, JSON.stringify(row)); } catch (e) { }
  if (!sb || !me || tableOk === false) return;
  try { const { error } = await sb.from('spark_days').upsert({ user_id: me.id, day, wins: row.wins, spark_id: todaySpark().id, spark_saved: !!row.spark_saved, breaths: row.breaths || 0, updated_at: new Date().toISOString() }); if (error) throw error; } catch (e) { tableOk = false; }
}

export const SPARK_CSS = `.mu-wrap{max-width:900px;margin:14px auto;padding:0 12px;display:grid;gap:14px;font-family:Poppins,Arial,sans-serif}
.mu-hero{background:linear-gradient(135deg,#0b1a3a,#312e81 60%,#7c3aed);color:#fff;border-radius:20px;padding:20px 22px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.mu-hero h2{margin:0;font:800 22px/1.2 Poppins,Arial}.mu-hero p{margin:4px 0 0;color:#dbeafe;font:500 13.5px/1.45 Poppins,Arial}
.mu-tabs{display:flex;gap:6px;flex-wrap:wrap}.mu-tabs button{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;min-height:38px;padding:0 14px;font:700 13px Poppins,Arial;color:#0f172a;cursor:pointer}.mu-tabs button.on{background:#0b1a3a;color:#fff;border-color:#0b1a3a}
.mu-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px 18px}.mu-card h3{margin:0 0 6px;font:800 16px Poppins,Arial;color:#0b1a3a;display:flex;align-items:center;gap:8px}.mu-card p{margin:0 0 8px;color:#475569;font:500 13.5px/1.5 Poppins,Arial}
.mu-cat{font:800 10.5px/1 Poppins,Arial;letter-spacing:.09em;text-transform:uppercase;color:#fff;border-radius:999px;padding:5px 9px;background:var(--c,#0369a1)}
.mu-spark{font:700 19px/1.4 Poppins,Arial;color:#0b1a3a;margin:8px 0 12px}
.mu-row{display:flex;gap:8px;flex-wrap:wrap}.mu-row .fl-btn{min-height:40px}
.mu-wins{display:grid;gap:8px;margin-top:6px}.mu-win{display:flex;gap:10px;align-items:center;border:1.5px solid #e2e8f0;border-radius:12px;padding:6px 8px 6px 12px}.mu-win input[type=checkbox]{width:22px;height:22px;flex:none;accent-color:#16a34a}.mu-win input[type=text]{flex:1;border:0;outline:0;font:600 14px Poppins,Arial;color:#0f172a;min-width:0;background:transparent}.mu-win.done input[type=text]{text-decoration:line-through;color:#64748b}
.mu-br{display:grid;place-items:center;gap:10px;padding:10px 0}.mu-ball{width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c7d2fe,#4f46e5);box-shadow:0 20px 50px rgba(79,70,229,.35);transform:scale(.7);transition:transform 4s ease-in-out;display:grid;place-items:center;color:#fff;font:800 15px Poppins,Arial}.mu-ball.in{transform:scale(1);transition-duration:4s}.mu-ball.hold{transition-duration:0s}.mu-ball.out{transform:scale(.7);transition-duration:6s}
.mu-time{font:800 28px Poppins,Arial;color:#0b1a3a}
.mu-chat{display:flex;flex-direction:column;gap:8px;max-height:360px;overflow:auto;padding:4px 0}.mu-m{max-width:88%;padding:10px 12px;border-radius:14px;font:500 13.5px/1.5 Poppins,Arial}.mu-m.u{align-self:flex-end;background:#0b1a3a;color:#fff}.mu-m.b{align-self:flex-start;background:#f1f5f9;color:#0f172a}.mu-m small{display:block;margin-top:6px;color:#64748b;font-size:11px}
.mu-form{display:flex;gap:8px;margin-top:8px}.mu-form input{flex:1;border:1.5px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:500 14px Poppins,Arial;min-width:0}
.mu-ideas{display:grid;gap:8px;padding:0;margin:8px 0 0;list-style:none}.mu-ideas li{display:flex;gap:10px;align-items:flex-start;background:#f8fafc;border-radius:12px;padding:10px 12px;font:500 13.5px/1.5 Poppins,Arial;color:#0f172a}.mu-ideas li b{color:#0369a1;flex:none}.mu-ideas li a{margin-left:auto;flex:none;font:700 12px Poppins,Arial;color:#0369a1;white-space:nowrap}
@media(max-width:560px){.mu-hero{padding:16px}.mu-spark{font-size:17px}}`;
const css = () => { if ($('#aou-spark-css')) return; const s = document.createElement('style'); s.id = 'aou-spark-css'; s.textContent = SPARK_CSS; document.head.appendChild(s); };

/* ---------- the view ---------- */
export async function sparkView(body, F3) {
  css(); const sb = F3.live ? F3.sb : null, me = F3.getMe && F3.getMe(), toast = F3.toast || (() => { });
  const spark = todaySpark(); const [catName, catColor] = CAT[spark.cat]; const day = dayKey();
  const tab = (new URLSearchParams(location.search).get('tab') || 'today');
  body.innerHTML = `<div class="mu-wrap"><div class="mu-hero"><div style="flex:1;min-width:200px"><h2>LIFEspark</h2><p>Small tools for a better day: one spark, three tiny wins, two minutes of breath. A companion for your creativity, not a replacement for people.</p></div><div class="mu-tabs" role="tablist">${[['today', 'Today'], ['ask', 'Ask allofus'], ['biz', 'Ideas for your business']].map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}">${n}</button>`).join('')}</div></div><div id="mu-body"></div></div>`;
  const host = $('#mu-body', body);
  $$('[data-tab]', body).forEach(b => b.onclick = () => { $$('[data-tab]', body).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); }); try { const u = new URL(location.href); u.searchParams.set('tab', b.dataset.tab); history.replaceState(null, '', u); } catch (e) { } draw(b.dataset.tab); });
  const share = (text, link) => { if (!me) { location.href = '/?auth=join'; return; } const u = new URL('/', location.origin); u.searchParams.set('share', link || 'https://allofus.one/?v=spark'); u.searchParams.set('text', text); location.href = u.toString(); };

  const drawToday = async () => {
    const row = await loadDay(sb, me, day); row.wins = Array.isArray(row.wins) ? row.wins.slice(0, 3) : []; while (row.wins.length < 3) row.wins.push({ t: '', done: false });
    host.innerHTML = `<div class="mu-card"><h3><span class="mu-cat" style="--c:${catColor}">${catName}</span> Daily spark</h3><div class="mu-spark">${esc(spark.text)}</div><div class="mu-row"><button class="fl-btn p" type="button" data-post>Post this to my feed</button><button class="fl-btn" type="button" data-save ${row.spark_saved ? 'disabled' : ''}>${row.spark_saved ? 'Saved to LIFEboard' : 'Save to LIFEboard'}</button><a class="fl-btn" href="/?v=spark&tab=ask">Talk it through</a></div><p class="muted" style="margin:10px 0 0;font-size:12px">A new spark every day. ${PROMPTS.length} in the rotation, all written for allofus.</p></div>
    <div class="mu-card"><h3>Three tiny wins for today</h3><p>Small enough to finish, real enough to matter. Check them off as you go.${me ? '' : ' Sign in to keep them on your account.'}</p><div class="mu-wins">${row.wins.map((w, i) => `<label class="mu-win ${w.done ? 'done' : ''}"><input type="checkbox" data-wd="${i}" ${w.done ? 'checked' : ''} aria-label="Done"><input type="text" data-wt="${i}" maxlength="80" placeholder="${['Drink a glass of water before coffee', 'Send one kind message', 'Ten minutes on the thing you keep postponing'][i]}" value="${esc(w.t)}"></label>`).join('')}</div><p class="muted" style="margin:8px 0 0;font-size:12px">${row.wins.filter(w => w.done).length} of 3 done · ${tableOk === false || !me ? 'saved on this device' : 'saved to your account'}</p></div>
    <div class="mu-card"><h3>Two minutes of breath</h3><p>In for 4, hold for 2, out for 6. Twelve rounds. Eyes open or closed, your call.</p><div class="mu-br"><div class="mu-ball" id="mu-ball">Ready</div><div class="mu-time" id="mu-time">2:00</div><div class="mu-row"><button class="fl-btn p" type="button" data-br>Start</button><button class="fl-btn" type="button" data-brx hidden>Stop</button></div></div><p class="muted" style="font-size:12px;margin:0">Finished today: <b id="mu-brn">${row.breaths || 0}</b>. This is a focus tool, not medical advice.</p></div>`;
    $('[data-post]', host).onclick = () => share(`Daily spark from LIFEspark: "${spark.text}"\n\nMy answer: `);
    $('[data-save]', host).onclick = async (e) => { if (!me) { location.href = '/?auth=join'; return; } const b = e.currentTarget; b.disabled = true; try { const B = await import('./aou-board.js'); const ok = await B.lbAdd(sb, me, 'gratitude', `Spark: ${spark.text}`); if (!ok) throw new Error('save'); row.spark_saved = true; await saveDay(sb, me, day, row); b.textContent = 'Saved to LIFEboard'; toast('Saved to your LIFEboard journal'); } catch (err) { b.disabled = false; toast('Could not save. Open LIFEboard once, then try again.'); } };
    const persist = () => { row.wins = [0, 1, 2].map(i => ({ t: ($(`[data-wt="${i}"]`, host).value || '').trim().slice(0, 80), done: $(`[data-wd="${i}"]`, host).checked })); $$('.mu-win', host).forEach((el, i) => el.classList.toggle('done', row.wins[i].done)); saveDay(sb, me, day, row); const n = row.wins.filter(w => w.done && w.t).length; const p = $('.mu-wins', host).nextElementSibling; if (p) p.firstChild.textContent = `${n} of 3 done · `; if (n === 3) toast('Three for three. That is a good day.'); };
    $$('[data-wd],[data-wt]', host).forEach(el => { el.onchange = persist; if (el.type === 'text') el.onblur = persist; });
    /* breathing timer */
    let timer = 0, t0 = 0; const ball = $('#mu-ball', host), time = $('#mu-time', host), go = $('[data-br]', host), stop = $('[data-brx]', host);
    const PH = [['in', 'Breathe in', 4], ['hold', 'Hold', 2], ['out', 'Breathe out', 6]]; const TOTAL = 120;
    const stopIt = (done) => { clearInterval(timer); timer = 0; ball.className = 'mu-ball'; ball.textContent = done ? 'Done' : 'Ready'; time.textContent = '2:00'; go.hidden = false; stop.hidden = true; if (done) { row.breaths = (row.breaths || 0) + 1; $('#mu-brn', host).textContent = row.breaths; saveDay(sb, me, day, row); toast('Two minutes. Well done.'); } };
    go.onclick = () => { if (timer) return; t0 = Date.now(); go.hidden = true; stop.hidden = false; let lastPh = -1; timer = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const left = TOTAL - s; if (left <= 0) return stopIt(true); time.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; const c = s % 12; const ph = c < 4 ? 0 : c < 6 ? 1 : 2; if (ph !== lastPh) { lastPh = ph; ball.className = 'mu-ball ' + PH[ph][0]; ball.textContent = PH[ph][1]; } }, 250); ball.className = 'mu-ball in'; ball.textContent = 'Breathe in'; };
    stop.onclick = () => stopIt(false);
  };

  const drawAsk = () => {
    host.innerHTML = `<div class="mu-card"><h3>Ask allofus</h3><p>A warm thinking partner for ideas, plans and sticky days. It is an AI (when the server is on) or a set of gentle prompts (when it is not). Not a therapist and not a companion. If you are in crisis in the US, call or text <b>988</b>, or 911 in an emergency.</p><div class="mu-chat" id="mu-chat" aria-live="polite"><div class="mu-m b">Hi. What is on your mind today? A plan, a worry, a blank page, a business idea: all fair game.</div></div><form class="mu-form" id="mu-form"><input id="mu-q" maxlength="500" placeholder="Type here…" autocomplete="off" aria-label="Your message"><button class="fl-btn p" type="submit">Send</button></form><div class="mu-row" style="margin-top:8px">${['Help me plan tomorrow', 'I am stuck on a project', 'Give me a creative warm-up', 'An idea for my business'].map(c => `<button class="fl-btn sm" type="button" data-chip>${c}</button>`).join('')}</div></div>`;
    const log = $('#mu-chat', host), input = $('#mu-q', host); let n = 0;
    const say = (html, who) => { const d = document.createElement('div'); d.className = 'mu-m ' + who; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    const ask = async (q) => { q = q.trim(); if (!q) return; say(esc(q), 'u'); input.value = '';
      if (CRISIS.test(q)) { say('I am an AI tool, and this sounds heavier than I should hold alone with you. Please call or text <b>988</b> (US Suicide and Crisis Lifeline) right now, or 911 if you are in danger. Outside the US: <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>. You matter, and a person is better than a page for this.', 'b'); return; }
      const dots = say('…', 'b'); let r = null;
      try { if (sb) { const AI = await import('./aou-ai-guide.js'); r = await AI.aiAnswer(q, { sb, mode: 'spark' }); } } catch (e) { }
      dots.remove();
      if (r && r.html) { say(r.html + '<small>AI, can be wrong. Not medical or legal advice.</small>', 'b'); return; }
      const extra = PROMPTS[(todaySpark().id + 7 * (++n)) % PROMPTS.length][1];
      say(esc(SPARK_FALLBACK[n % SPARK_FALLBACK.length]) + `<br><br>A prompt to sit with: <i>${esc(extra)}</i><small>Scripted reply. The AI guide turns on when the guide function is deployed.</small>`, 'b');
    };
    $('#mu-form', host).onsubmit = (e) => { e.preventDefault(); ask(input.value); };
    $$('[data-chip]', host).forEach(b => b.onclick = () => ask(b.textContent));
    input.focus();
  };

  const drawBiz = async () => {
    let cat = '', pageName = '';
    try { if (sb && me) { const { data } = await sb.from('pages').select('name,extra').eq('owner_id', me.id).order('created_at').limit(1); if (data && data[0]) { pageName = data[0].name || ''; cat = (data[0].extra && data[0].extra.cat) || ''; } } } catch (e) { }
    const { label, ideas } = bizIdeas(cat);
    host.innerHTML = `<div class="mu-card"><h3>Ideas for your business</h3><p>${pageName ? `For <b>${esc(pageName)}</b>${cat ? ` (${esc(cat)})` : ''}: five things worth posting or doing this week.` : me ? 'You have no Brand page yet, so these are general. <a href="/?v=brand">Create a free Brand page</a> with a category and the ideas get specific.' : 'Sign in and add a Brand page with a category, and these get specific to your trade.'}</p><p class="muted" style="font-size:12px">Category group: <b>${esc(label)}</b></p><ol class="mu-ideas">${ideas.map((t, i) => `<li><b>${i + 1}.</b><span>${esc(t)}</span><a href="#" data-share="${esc(t)}">Post it</a></li>`).join('')}</ol><div class="mu-row" style="margin-top:12px"><a class="fl-btn p" href="/?v=grow">Open Grow your business</a><a class="fl-btn" href="/?v=brand">My Brand page</a></div></div>`;
    $$('[data-share]', host).forEach(a => a.onclick = (e) => { e.preventDefault(); share(a.dataset.share + '\n\n', pageName ? 'https://allofus.one/?v=brand' : 'https://allofus.one/?v=grow'); });
  };
  const draw = (k) => { host.innerHTML = '<div class="mu-card">Loading…</div>'; return (k === 'ask' ? drawAsk() : k === 'biz' ? drawBiz() : drawToday()); };
  await draw(tab);
}
