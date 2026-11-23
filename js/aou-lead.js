/* allofus.one · business lead forms -> Lead Net (our own lead server, clients.eyetoad.com).
   The server saves the lead first, then emails the alert. Replaces the retired FormSubmit service (Nov 2026).
   Guards: honeypot _honey (a filled one is dropped silently), at least 3 seconds after the form was shown,
   one retry on a network blip. Success only when the server answers HTTP ok with JSON { ok: true }. */
const LEAD = 'https://clients.eyetoad.com/lead/send.php';
const SHOWN = Date.now();

/* fields: plain object of strings. opts.shownAt: when the form appeared (ms). Resolves true / false. */
export async function sendLead(fields, subject, opts = {}) {
  const shownAt = opts.shownAt || SHOWN;
  if (fields._honey) return true;                       // bot: pretend success, send nothing
  if (Date.now() - shownAt < 3000) return false;        // filled faster than a person can
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v != null && v !== '' && k !== '_honey') fd.append(k, String(v).slice(0, 2000));
  fd.append('site', location.hostname.replace(/^www\./, ''));
  fd.append('page', location.pathname.slice(0, 300));
  fd.append('_t', String(shownAt));
  fd.append('_subject', subject || 'New lead - allofus.one');
  fd.append('lead_device', innerWidth < 760 ? 'phone' : 'desktop');
  const post = async () => {
    const r = await fetch(LEAD, { method: 'POST', body: fd, headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'strict-origin-when-cross-origin' });
    const j = await r.json().catch(() => ({}));
    return !!(r.ok && j && j.ok === true);
  };
  try { if (await post()) return true; } catch (e) { }
  await new Promise((res) => setTimeout(res, 1200));
  try { return await post(); } catch (e) { return false; }
}
