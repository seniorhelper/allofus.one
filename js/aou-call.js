/* Unity Call (Oct 2026) · the allofus.one video room brand. The page still lives at /meet/ so every old link works.
   Shared helpers for anything that starts, links or schedules a Unity Call: room codes, links, calendar files. */
export const CALL_NAME = 'Unity Call';
export const CALL_PATH = '/meet/';
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
/* a short, unguessable-enough room code: letters + digits, no look-alikes */
export function newCallCode(n = 8) { let s = ''; const a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); } for (let i = 0; i < n; i++) s += ALPHA[a[i] % ALPHA.length]; return s; }
export const cleanCode = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24);
export function callUrl(code, abs = true) { const p = CALL_PATH + '?r=' + encodeURIComponent(cleanCode(code)); return abs ? (typeof location !== 'undefined' ? location.origin : 'https://allofus.one') + p : p; }
/* iCalendar text for one meeting (UTC times, RFC 5545 line folding kept simple: lines stay short) */
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
export function icsFor({ id, title, start, minutes = 30, code, note, organizer }) {
  const s = new Date(start); const e = new Date(s.getTime() + Math.max(5, +minutes || 30) * 60000); const url = code ? callUrl(code) : 'https://allofus.one/';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//allofus.one//Unity Call//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    'UID:unity-' + (id || code || Date.now()) + '@allofus.one', 'DTSTAMP:' + icsDate(Date.now()), 'DTSTART:' + icsDate(s), 'DTEND:' + icsDate(e),
    'SUMMARY:' + icsEsc(title || CALL_NAME), 'DESCRIPTION:' + icsEsc((note ? note + '\n\n' : '') + CALL_NAME + ' link: ' + url + (organizer ? '\nWith ' + organizer : '')),
    'LOCATION:' + icsEsc(url), 'URL:' + url, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
export function downloadIcs(meeting) { const blob = new Blob([icsFor(meeting)], { type: 'text/calendar;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (String(meeting.title || 'unity-call').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'unity-call') + '.ics'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
export function googleCalUrl({ title, start, minutes = 30, code, note }) { const s = new Date(start), e = new Date(s.getTime() + (+minutes || 30) * 60000); const f = (d) => icsDate(d); return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title || CALL_NAME) + '&dates=' + f(s) + '/' + f(e) + '&details=' + encodeURIComponent((note ? note + '\n\n' : '') + CALL_NAME + ': ' + callUrl(code)) + '&location=' + encodeURIComponent(callUrl(code)); }
