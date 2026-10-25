/* allofus.one · "Ask allofus" AI answers for Orbit (v26, Oct 23 2026).
   Calls the Supabase Edge Function `aou-guide` (the AI runs on the server; no key ever touches the browser).
   If the function is not deployed, the server is offline, or the visitor is rate-limited, aiAnswer() returns null
   and Orbit keeps using its scripted answers, so nothing breaks before Zach deploys the function.
   No question text is stored anywhere; the last 6 turns live in memory only for follow-up questions. */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const OK_HOSTS = /^https:\/\/(www\.)?(allofus\.one|aispeedtoleads\.com|usabusinesssearch\.com|cobusinesslist\.com|pressreleaseforbusiness\.com|distributepressreleases\.com|actionglobalnews\.com|worldvrmall\.com|eyetoad\.com|findahelpline\.com|report\.cybertip\.org)(\/|$)/i;
const OWN = /^https:\/\/(www\.)?(aispeedtoleads\.com|usabusinesssearch\.com|cobusinesslist\.com|pressreleaseforbusiness\.com|distributepressreleases\.com|actionglobalnews\.com|worldvrmall\.com|eyetoad\.com)/i;
const DOWN_KEY = 'aou_ai_down';
const history = [];

/* markdown-lite → safe HTML: escapes everything, then turns [label](url) into links for allow-listed URLs only */
export function renderAnswer(text) {
  let h = esc(text || '');
  h = h.replace(/\[([^\]]{1,80})\]\(([^)\s]{1,300})\)/g, (m, label, url) => {
    const u = url.replace(/&amp;/g, '&');
    if (/^\/(?!\/)/.test(u)) return `<a href="${esc(u)}">${label}</a>`;
    if (OK_HOSTS.test(u)) { const out = OWN.test(u) ? u + (u.includes('?') ? '&' : '?') + 'utm_source=allofus&utm_medium=referral&utm_campaign=ask_allofus' : u; return `<a href="${esc(out)}" target="_blank" rel="${OWN.test(u) ? 'sponsored noopener' : 'noopener'}">${label}</a>`; }
    return label;
  });
  h = h.replace(/\*\*([^*]{1,120})\*\*/g, '<b>$1</b>').replace(/^- /gm, '• ');
  return h;
}

const isDown = () => { try { const t = +sessionStorage.getItem(DOWN_KEY) || 0; return Date.now() - t < 10 * 60e3; } catch (e) { return false; } };
const markDown = () => { try { sessionStorage.setItem(DOWN_KEY, String(Date.now())); } catch (e) { } };

/* returns { html, chips } or null (= use the scripted Orbit answer) */
export async function aiAnswer(q, ctx = {}) {
  const sb = ctx.sb; if (!sb || !sb.functions || typeof sb.functions.invoke !== 'function' || isDown()) return null;
  const page = (location.pathname + location.search).slice(0, 80);
  let res;
  try {
    res = await Promise.race([
      sb.functions.invoke('aou-guide', { body: { q: String(q).slice(0, 600), history: history.slice(-6), page, mode: ctx.mode || 'guide' } }),
      new Promise((r) => setTimeout(() => r({ error: { message: 'timeout' } }), 15000)),
    ]);
  } catch (e) { markDown(); return null; }
  const { data, error } = res || {};
  if (error) {
    let status = 0; try { status = (error.context && error.context.status) || 0; } catch (e) { }
    if (status === 429) { let msg = 'You have asked a lot this hour. Here is the quick answer instead:'; try { const j = await error.context.json(); if (j && j.answer) return { html: renderAnswer(j.answer), chips: ['Human'], ai: true }; } catch (e) { } return { html: esc(msg), chips: [], ai: false, rate: true }; }
    markDown(); return null; /* 404 not deployed, 503 not configured, network: scripted fallback for 10 minutes */
  }
  const answer = data && typeof data.answer === 'string' ? data.answer : '';
  if (!answer) { markDown(); return null; }
  history.push({ role: 'user', content: String(q).slice(0, 600) }, { role: 'assistant', content: answer.slice(0, 1200) });
  while (history.length > 12) history.shift();
  return { html: renderAnswer(answer), chips: Array.isArray(data.chips) ? data.chips.slice(0, 4) : [], ai: true };
}

/* short, chip-like questions that a scripted Orbit intent answers well stay scripted (instant, free) */
export function preferScripted(q, matched) { return !!matched && String(q).trim().split(/\s+/).length <= 3; }
