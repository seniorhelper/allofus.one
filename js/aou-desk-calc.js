/* allofus.one · the desk · calculators (pure maths: no DOM, no imports, no clock, no randomness).
   Every function takes one plain object and returns one plain object. Every number is coerced and clamped first,
   so the result is always finite. Unusable input gives a zero-style result with ok:false and a short why.
   Rates are typed as percent (7 = 7%). Outputs ending in Pct are percent too. Money stays unrounded; only the formatters round.
   Estimates for planning only. Nothing here is tax, legal, financial or investment advice. */

export const DISCLAIMER = 'Estimates for planning only; not tax, legal, financial or investment advice.';
const BIG = 1e12;

/* ---------- small helpers ---------- */
export function num(v, min, max, dflt) {
  let lo = typeof min === 'number' ? min : NaN, hi = typeof max === 'number' ? max : NaN;
  if (!Number.isFinite(lo)) lo = -BIG; if (!Number.isFinite(hi)) hi = BIG; if (lo > hi) { const t = lo; lo = hi; hi = t; }
  let n = NaN;
  if (typeof v === 'number') n = v; else if (typeof v === 'string' && v.trim() !== '') n = Number(v.replace(/,/g, ''));
  if (!Number.isFinite(n)) { n = typeof dflt === 'number' && Number.isFinite(dflt) ? dflt : 0; }
  return Math.min(hi, Math.max(lo, n));
}
const pos = (v, d) => num(v, 0, BIG, d === undefined ? 0 : d);
const rate = (v, d, lo, hi) => num(v, lo === undefined ? 0 : lo, hi === undefined ? 100 : hi, d);
const text = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const opt = (o, k) => { try { return o && typeof o === 'object' ? o[k] : undefined; } catch (e) { return undefined; } };
const sum = (a) => a.reduce((s, v) => s + v, 0);
const tidy = (v) => parseFloat(v.toPrecision(12));

/* money(1234.5) -> "$1,234.50". opts.digits = decimals (default 2). */
export function money(n, opts) {
  const d = Math.round(num(opt(opts, 'digits'), 0, 6, 2)), v = num(n, -1e15, 1e15, 0), s = Math.abs(v).toFixed(d);
  const parts = s.split('.'), g = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (v < 0 && Number(s) !== 0 ? '-' : '') + '$' + g + (parts[1] ? '.' + parts[1] : '');
}
/* pct(5.28) -> "5.28%". The number is already in percent points. */
export function pct(n, digits) { return num(n, -1e9, 1e9, 0).toFixed(Math.round(num(digits, 0, 6, 2))) + '%'; }

function niceNum(r, round) {
  const e = Math.floor(Math.log10(r)), f = r / Math.pow(10, e);
  const n = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
  return n * Math.pow(10, e);
}
/* round, ascending axis values that cover min..max */
export function niceTicks(min, max, count) {
  let a = num(min, -1e15, 1e15, 0), b = num(max, -1e15, 1e15, 1); const c = Math.round(num(count, 2, 12, 5));
  if (a > b) { const t = a; a = b; b = t; }
  if (a === b) { const d = Math.abs(a) * 0.1 || 1; a -= d; b += d; }
  const step = niceNum(niceNum(b - a, false) / (c - 1), true);
  const snap = (r) => (Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r);
  const lo = Math.floor(snap(a / step)), hi = Math.ceil(snap(b / step)), out = [];
  for (let k = lo; k <= hi && out.length < 60; k++) out.push(tidy(k * step));
  return out;
}

/* every calculator runs inside wrap: bad input never throws and a non-finite result is turned into zero + ok:false */
function scrub(v, st) {
  if (typeof v === 'number') { if (Number.isFinite(v)) return v; st.bad = true; return 0; }
  if (Array.isArray(v)) return v.map((e) => scrub(e, st));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = scrub(v[k], st); return o; }
  return v;
}
const fail = (why) => ({ ok: false, why, series: [], schedule: [], rows: [], order: [] });
const wrap = (fn) => (input) => {
  try {
    const st = { bad: false }, out = scrub(fn(input && typeof input === 'object' ? input : {}), st);
    if (st.bad) { out.ok = false; out.why = out.why || 'A number was too large to work with.'; }
    return out;
  } catch (e) { return fail('Those inputs could not be read.'); }
};

/* monthly payment on a loan; rate 0 is a straight split */
function payment(L, ratePct, years) {
  const N = Math.round(years * 12), i = ratePct / 1200;
  if (L <= 0 || N < 1) return 0;
  return i === 0 ? L / N : (L * i) / (1 - Math.pow(1 + i, -N));
}

/* ---------- finance ---------- */
/* Compound growth, contribution at the end of each month. */
export const growth = wrap((x) => {
  const start = pos(x.start), pm = pos(x.monthly), r = rate(x.ratePct, 7, -50, 100), yrs = num(x.years, 0, 100, 20), inf = rate(x.inflationPct, 0, -20, 100);
  const n = Math.round(yrs * 12), i = r / 1200, series = [{ year: 0, balance: start, contributed: start }];
  let b = start;
  for (let k = 1; k <= n; k++) { b = b * (1 + i) + pm; if (k % 12 === 0 || k === n) series.push({ year: k / 12, balance: b, contributed: start + pm * k }); }
  const paid = start + pm * n;
  return { ok: true, futureValue: b, totalContributed: paid, totalGrowth: b - paid, realValue: b / Math.pow(1 + inf / 100, n / 12), years: n / 12, series };
});

/* One amortization run. extra is added to the principal every month; the last payment is whatever is left. */
function amort(L, i, N, extra) {
  const M = i === 0 ? L / N : (L * i) / (1 - Math.pow(1 + i, -N)), rows = [];
  let bal = L, tot = 0;
  for (let n = 1; n <= N && bal > 0; n++) {
    const it = bal * i; let pr = M - it + extra;
    if (pr >= bal - 0.005 || n === N) pr = bal;
    bal = pr === bal ? 0 : bal - pr; tot += it;
    rows.push({ n, payment: it + pr, interest: it, principal: pr, balance: bal });
  }
  return { M, rows, interest: tot };
}
export const loan = wrap((x) => {
  const L = pos(x.principal), r = rate(x.ratePct, 6.5, 0, 100), yrs = num(x.years, 0, 50, 30), extra = pos(x.extraMonthly), N = Math.round(yrs * 12), i = r / 1200;
  if (L <= 0 || N < 1) return fail('Enter a loan amount and a term.');
  const base = amort(L, i, N, 0), use = extra > 0 ? amort(L, i, N, extra) : base, series = [{ year: 0, balance: L, interest: 0 }];
  let cum = 0;
  use.rows.forEach((w) => { cum += w.interest; if (w.n % 12 === 0 || w.n === use.rows.length) series.push({ year: tidy(w.n / 12), balance: w.balance, interest: cum }); });
  return { ok: true, payment: base.M, totalInterest: use.interest, baseInterest: base.interest, totalPaid: L + use.interest, payoffMonths: use.rows.length,
    interestSaved: base.interest - use.interest, monthsSaved: N - use.rows.length, schedule: use.rows, series };
});

function cleanDebts(a) {
  const out = [];
  (Array.isArray(a) ? a.slice(0, 20) : []).forEach((d) => {
    const bal = pos(opt(d, 'balance')); if (bal <= 0) return;
    out.push({ name: text(opt(d, 'name'), 24) || 'Debt ' + (out.length + 1), balance: bal, rate: rate(opt(d, 'ratePct'), 0) / 1200, min: pos(opt(d, 'minPayment')) });
  });
  return out;
}
/* Same monthly budget every month (all minimums + extra). Interest first, then minimums, then the rest on the target debt. */
function simulate(debts, extra, method) {
  const ds = debts.map((d) => ({ ...d, bal: d.balance })), budget = sum(ds.map((d) => d.min)) + extra, order = [], series = [{ month: 0, balance: sum(ds.map((d) => d.bal)) }];
  let months = 0, interest = 0;
  while (months < 1200 && ds.some((d) => d.bal > 0)) {
    months++;
    ds.forEach((d) => { if (d.bal > 0) { const it = d.bal * d.rate; d.bal += it; interest += it; } });
    let left = budget;
    ds.forEach((d) => { const p = Math.min(d.min, d.bal); d.bal -= p; left -= p; });
    while (left > 1e-9) {
      const live = ds.filter((d) => d.bal > 0.005); if (!live.length) break;
      const t = live.reduce((a, b) => (method === 'snowball' ? (b.bal < a.bal ? b : a) : (b.rate > a.rate || (b.rate === a.rate && b.bal < a.bal) ? b : a)));
      const p = Math.min(left, t.bal); t.bal -= p; left -= p;
    }
    ds.forEach((d) => { if (d.bal < 0.005 && !d.done) { d.bal = 0; d.done = true; order.push({ name: d.name, month: months }); } });
    series.push({ month: months, balance: sum(ds.map((d) => d.bal)) });
  }
  const done = ds.every((d) => d.bal === 0);
  return { ok: done, why: done ? '' : 'The payments do not cover the interest, so the debts are not cleared within 100 years.', method, months, totalInterest: interest, totalPaid: sum(debts.map((d) => d.balance)) + interest, monthlyBudget: budget, order, series };
}
export const debtPayoff = wrap((x) => {
  const debts = cleanDebts(x.debts), extra = pos(x.extraMonthly), method = x.method === 'snowball' ? 'snowball' : 'avalanche';
  if (!debts.length) return fail('Add at least one debt with a balance.');
  if (sum(debts.map((d) => d.min)) + extra <= 0) return fail('Enter a minimum payment or an extra amount.');
  return simulate(debts, extra, method);
});
export const compareDebt = wrap((x) => {
  const a = debtPayoff({ debts: x.debts, extraMonthly: x.extraMonthly, method: 'avalanche' }), s = debtPayoff({ debts: x.debts, extraMonthly: x.extraMonthly, method: 'snowball' });
  return { ok: a.ok && s.ok, why: a.why || s.why || '', avalanche: a, snowball: s, interestSaved: s.totalInterest - a.totalInterest, monthsSaved: s.months - a.months, series: [], schedule: [], rows: [], order: [] };
});

/* FIRE number and years to goal (monthly compounding). The withdrawal rate is a rule of thumb, not a promise. */
export const fire = wrap((x) => {
  const spend = pos(x.annualSpend), w = rate(x.withdrawalPct, 4, 0.1, 20), P = pos(x.current), pm = pos(x.monthly), r = rate(x.ratePct, 7, -50, 100);
  if (spend <= 0) return fail('Enter your yearly spending.');
  const G = spend / (w / 100), i = r / 1200, series = [{ year: 0, balance: P, target: G }];
  let months = 0;
  if (P >= G) months = 0;
  else if (i === 0) months = pm > 0 ? (G - P) / pm : Infinity;
  else { const a = P * i + pm, c = G * i + pm; months = a > 0 && c > 0 ? Math.log(c / a) / Math.log(1 + i) : Infinity; }
  const reached = Number.isFinite(months) && months <= 1200;
  let b = P; const shown = reached ? Math.min(1200, Math.ceil(months / 12) * 12 + 12) : 600;
  for (let k = 1; k <= shown; k++) { b = b * (1 + i) + pm; if (k % 12 === 0) series.push({ year: k / 12, balance: b, target: G }); }
  return { ok: true, reached, target: G, yearsToGoal: reached ? months / 12 : 0, monthsToGoal: reached ? months : 0, why: reached ? '' : 'Not reached within 100 years at these numbers.', series };
});

export const cagr = wrap((x) => {
  const s = pos(x.start), e = pos(x.end), y = num(x.years, 0, 200, 0);
  if (s <= 0 || y <= 0) return fail('Enter a starting value above zero and a number of years.');
  const c = (Math.pow(e / s, 1 / y) - 1) * 100;
  return { ok: true, start: s, end: e, cagrPct: c, totalReturnPct: (e / s - 1) * 100, gain: e - s };
});

/* Cost of something later, what a future amount is worth today, and the real return after inflation. */
export const inflation = wrap((x) => {
  const a = pos(x.amount), r = rate(x.ratePct, 3, -50, 100), y = num(x.years, 0, 100, 10), nom = rate(x.nominalPct, 7, -50, 100), f = Math.pow(1 + r / 100, y);
  return { ok: true, futureCost: a * f, todayValue: a / f, realReturnPct: ((1 + nom / 100) / (1 + r / 100) - 1) * 100, lossPct: (1 - 1 / f) * 100 };
});

/* Rebalance: ARITHMETIC ONLY. It shows what moves would match the target mix. It is not advice and does not say what to buy or sell. */
export const rebalance = wrap((x) => {
  const hold = new Map(), tgt = new Map();
  (Array.isArray(x.holdings) ? x.holdings.slice(0, 30) : []).forEach((h, k) => { const n = text(opt(h, 'name'), 24) || 'Holding ' + (k + 1); hold.set(n, (hold.get(n) || 0) + pos(opt(h, 'value'))); });
  (Array.isArray(x.targets) ? x.targets.slice(0, 30) : []).forEach((t, k) => { const n = text(opt(t, 'name'), 24) || 'Holding ' + (k + 1); tgt.set(n, (tgt.get(n) || 0) + rate(opt(t, 'pct'), 0)); });
  const total = sum([...hold.values()]), tsum = sum([...tgt.values()]);
  if (total <= 0) return fail('Enter at least one holding with a value.');
  if (tsum <= 0) return fail('Enter target percentages.');
  const names = [...new Set([...hold.keys(), ...tgt.keys()])];
  const rows = names.map((n) => {
    const v = hold.get(n) || 0, tp = ((tgt.get(n) || 0) / tsum) * 100, p = (v / total) * 100;
    return { name: n, value: v, pct: p, targetPct: tp, driftPts: p - tp, targetValue: (total * tp) / 100, trade: (total * tp) / 100 - v };
  });
  return { ok: true, total, targetsSum: tsum, scaled: Math.abs(tsum - 100) > 0.005, buyTotal: sum(rows.map((r) => Math.max(0, r.trade))), sellTotal: sum(rows.map((r) => Math.max(0, -r.trade))), rows };
});

/* ---------- real estate ---------- */
export const rental = wrap((x) => {
  const price = pos(x.price), down = rate(x.downPct, 20), r = rate(x.ratePct, 7, 0, 30), yrs = num(x.years, 1, 50, 30), rent = pos(x.rentMonthly), vac = rate(x.vacancyPct, 5);
  if (price <= 0) return fail('Enter a purchase price.');
  const gross = rent * 12, vacancyLoss = (gross * vac) / 100, eff = gross - vacancyLoss;
  const opex = pos(x.taxesYear) + pos(x.insuranceYear) + (gross * rate(x.maintenancePct, 0)) / 100 + (eff * rate(x.managementPct, 0)) / 100 + pos(x.hoaMonthly) * 12 + pos(x.otherYear);
  const noi = eff - opex, L = price * (1 - down / 100), pay = payment(L, r, yrs), ds = pay * 12, cf = noi - ds;
  const cash = (price * down) / 100 + pos(x.closingCosts) + pos(x.rehab);
  return { ok: true, grossRent: gross, vacancyLoss, operatingExpenses: opex, noi, capRatePct: (noi / price) * 100, loanAmount: L, mortgagePayment: pay, debtServiceYear: ds,
    cashFlowMonthly: cf / 12, cashFlowYear: cf, cashInvested: cash, cashOnCashPct: cash > 0 ? (cf / cash) * 100 : 0, dscr: ds > 0 ? noi / ds : 0, noDebt: ds <= 0, grm: gross > 0 ? price / gross : 0,
    rule1: { rentPct: (rent / price) * 100, needed: price * 0.01, pass: rent >= price * 0.01 },
    rule50: { expenses: rent * 6, cashFlowMonthly: rent * 0.5 - pay, pass: rent * 0.5 - pay >= 0 } };
});

export const brrrr = wrap((x) => {
  const buy = pos(x.purchase), rehab = pos(x.rehab), costs = pos(x.costs), arv = pos(x.arv), ltv = rate(x.ltvPct, 75), rent = pos(x.rentMonthly), noiPct = rate(x.noiPct, 60);
  if (buy <= 0) return fail('Enter a purchase price.');
  const allIn = buy + rehab + costs, refi = (arv * ltv) / 100, left = allIn - refi, noi = (rent * 12 * noiPct) / 100;
  const pay = payment(refi, rate(x.ratePct, 7, 0, 30), num(x.years, 1, 50, 30)), ds = pay * 12, cf = noi - ds;
  return { ok: true, allIn, refiLoan: refi, cashLeftIn: Math.max(0, left), cashBack: Math.max(0, -left), noi, mortgagePayment: pay, debtServiceYear: ds, cashFlowYear: cf, cashFlowMonthly: cf / 12,
    cashOnCashPct: left > 0 ? (cf / left) * 100 : 0, dscr: ds > 0 ? noi / ds : 0, allCashBack: left <= 0 };
});

/* Fix and flip, including the 70% rule max offer. */
export const flip = wrap((x) => {
  const arv = pos(x.arv), rehab = pos(x.rehab), buy = pos(x.purchase), close = pos(x.buyClosing), hold = pos(x.holdingCosts), sellPct = rate(x.sellingCostPct, 6);
  if (arv <= 0) return fail('Enter the after-repair value.');
  const sell = (arv * sellPct) / 100, cost = buy + rehab + close + hold + sell, profit = arv - cost, mao = Math.max(0, arv * 0.7 - rehab);
  return { ok: true, maxOffer70: mao, meets70: buy <= mao, sellingCosts: sell, totalCost: cost, profit, profitPctArv: (profit / arv) * 100, returnOnCashPct: buy + rehab + close + hold > 0 ? (profit / (buy + rehab + close + hold)) * 100 : 0 };
});

/* Rent vs buy. Year-1 model from the research notes, plus a yearly net-worth view of both paths.
   Both start with the same cash; whoever spends less each year invests the difference. Yearly steps are an approximation. */
export const rentVsBuy = wrap((x) => {
  const price = pos(x.price), dp = rate(x.downPct, 20), r = rate(x.ratePct, 6.5, 0, 30), yrs = num(x.years, 1, 50, 30), rent = pos(x.rentMonthly), g = rate(x.rentGrowthPct, 3, -20, 50), ap = rate(x.appreciationPct, 3, -20, 50);
  const holdPct = rate(x.taxPct, 1.1, 0, 20) + rate(x.insurancePct, 0.4, 0, 20) + rate(x.maintenancePct, 1, 0, 20), alt = rate(x.altReturnPct, 5, -20, 50), closePct = rate(x.closingPct, 3), sellPct = rate(x.sellingPct, 6), H = Math.round(num(x.horizonYears, 1, 40, 30));
  if (price <= 0 || rent <= 0) return fail('Enter a price and a monthly rent.');
  const down = (price * dp) / 100, L = price - down, i = r / 1200, pay = payment(L, r, yrs), N = Math.round(yrs * 12), closing = (price * closePct) / 100, selling = (price * sellPct) / 100;
  let bal = L, buyPort = 0, rentPort = down + closing, home = price, interest1 = 0, breakEven = 0; const series = [{ year: 0, buy: down - selling, rent: down + closing }];
  for (let y = 1; y <= H; y++) {
    let intr = 0;
    for (let m = (y - 1) * 12 + 1; m <= y * 12 && bal > 0; m++) { const it = bal * i, pr = m >= N ? bal : Math.min(bal, pay - it); intr += it; bal -= pr; }
    if (y === 1) interest1 = intr;
    const own = (bal > 0 || y * 12 <= N ? pay * 12 : 0) + (home * holdPct) / 100, rentOut = rent * 12 * Math.pow(1 + g / 100, y - 1);
    buyPort = buyPort * (1 + alt / 100) + Math.max(0, rentOut - own); rentPort = rentPort * (1 + alt / 100) + Math.max(0, own - rentOut);
    home *= 1 + ap / 100;
    const b = home - bal - (home * sellPct) / 100 + buyPort; if (!breakEven && b >= rentPort) breakEven = y;
    series.push({ year: y, buy: b, rent: rentPort });
  }
  const net1 = interest1 + (price * holdPct) / 100 + (down * alt) / 100 - (price * ap) / 100, adv = rent * 12 - net1, last = series[series.length - 1];
  return { ok: true, loanPayment: pay, year1Interest: interest1, netCostOwningYear1: net1, advantageYear1: adv, breakEvenYearSimple: adv > 0 ? (closing + selling) / adv : 0, breakEvenYear: breakEven, buyWins: last.buy >= last.rent, series };
});

/* ---------- tax: figures live in tables so each can say where it came from and whether it was checked ---------- */
const IRS = 'https://www.irs.gov/';
export const TAX_TABLES = [
  { id: 'se-core-2026', topic: 'self-employment tax', taxYear: 2026, verified: true, source: IRS + 'businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes',
    values: { ssRate: 0.124, medicareRate: 0.029, wageBase: 184500, addlMedicareThreshold: { single: 200000, mfj: 250000, mfs: 125000 } } },
  { id: 'se-schedule-2026', topic: 'self-employment tax', taxYear: 2026, verified: false, source: 'Not confirmed on irs.gov; check the 2026 Schedule SE instructions.',
    values: { seFactor: 0.9235, addlMedicareRate: 0.009, halfDeductible: 0.5 } },
  { id: 'estimates-2026', topic: 'estimated tax', taxYear: 2026, verified: true, source: IRS + 'businesses/small-businesses-self-employed/estimated-taxes',
    values: { minOwed: 1000, currentYearPct: 90, priorYearPct: 100 } },
  { id: 'estimates-higher-earner-2026', topic: 'estimated tax', taxYear: 2026, verified: false, source: 'Not confirmed; check IRS Publication 505.', values: { priorYearPctHigherEarner: 110 } },
  { id: 'mileage-2026', topic: 'business mileage', taxYear: 2026, verified: true, source: IRS + 'forms-pubs/the-standard-mileage-rates-and-maximum-automobile-fair-market-values-have-been-updated-for-2026',
    values: { businessPerMile: 0.725 } },
  { id: 'mileage-2026-midyear', topic: 'business mileage', taxYear: 2026, verified: false, source: 'Secondary outlets only; not confirmed on irs.gov.', values: { businessPerMile: 0.76, startsOn: '2026-07-01' } },
  { id: 'home-office-2026', topic: 'home office, simplified method', taxYear: 2026, verified: true, source: IRS + 'businesses/small-businesses-self-employed/simplified-option-for-home-office-deduction',
    values: { perSqFt: 5, maxSqFt: 300 } },
];
const table = (id) => TAX_TABLES.find((t) => t.id === id);
const used = (ids, overridden) => {
  const ts = ids.map((id) => table(id));
  return { tables: ts.map((t) => ({ id: t.id, taxYear: t.taxYear, source: t.source, verified: t.verified })), taxYear: ts[0].taxYear, overridden, verified: !overridden && ts.every((t) => t.verified),
    unverified: ts.filter((t) => !t.verified).map((t) => t.id), disclaimer: DISCLAIMER };
};
const FILING = ['single', 'mfj', 'mfs'];

export const selfEmploymentTax = wrap((x) => {
  const core = table('se-core-2026').values, sch = table('se-schedule-2026').values, rt = x.rates && typeof x.rates === 'object' ? x.rates : {};
  const over = ['ssRate', 'medicareRate', 'wageBase', 'seFactor'].some((k) => opt(rt, k) !== undefined);
  const ss = rate(opt(rt, 'ssRate'), core.ssRate, 0, 1), med = rate(opt(rt, 'medicareRate'), core.medicareRate, 0, 1), wb = pos(opt(rt, 'wageBase'), core.wageBase), f = rate(opt(rt, 'seFactor'), sch.seFactor, 0, 1);
  const profit = num(x.netProfit, -BIG, BIG, 0), filing = FILING.includes(x.filing) ? x.filing : 'single', base = profit > 0 ? profit * f : 0;
  const tax = Math.min(base, wb) * ss + base * med, addl = Math.max(0, base - core.addlMedicareThreshold[filing]) * sch.addlMedicareRate;
  return { ok: true, seBase: base, seTax: tax, halfDeductible: tax * sch.halfDeductible, additionalMedicare: addl, effectivePct: profit > 0 ? (tax / profit) * 100 : 0, filing, ...used(['se-core-2026', 'se-schedule-2026'], over) };
});

/* Three plain ways to size a payment. The person types the tax estimate; no income tax brackets are built in. */
export const quarterlyEstimate = wrap((x) => {
  const t = table('estimates-2026').values, rt = x.rates && typeof x.rates === 'object' ? x.rates : {};
  const over = ['minOwed', 'currentYearPct', 'priorYearPct'].some((k) => opt(rt, k) !== undefined);
  const minOwed = pos(opt(rt, 'minOwed'), t.minOwed), cur = rate(opt(rt, 'currentYearPct'), t.currentYearPct, 0, 200), prior = rate(opt(rt, 'priorYearPct'), t.priorYearPct, 0, 200);
  const expected = pos(x.expectedTax), paid = pos(x.paid), priorTax = pos(x.priorYearTax), left = Math.round(num(x.quartersLeft, 1, 4, 4)), remaining = Math.max(0, expected - paid);
  const curTarget = (expected * cur) / 100, priorTarget = (priorTax * prior) / 100;
  return { ok: true, remaining, mayNeedEstimates: remaining >= minOwed, perQuarterRemaining: remaining / left, priorYearPerQuarter: priorTarget / 4, currentYearTarget: curTarget,
    safeHarbor: priorTax > 0 ? Math.min(curTarget, priorTarget) : curTarget, setAside: (pos(x.quarterProfit) * rate(x.setAsidePct, 0)) / 100, ...used(['estimates-2026', 'estimates-higher-earner-2026'], over) };
});

export const mileage = wrap((x) => {
  const t = table('mileage-2026').values, given = x.ratePerMile !== undefined && x.ratePerMile !== null && x.ratePerMile !== '', r = num(x.ratePerMile, 0, 5, t.businessPerMile), miles = num(x.miles, 0, 1e7, 0);
  return { ok: true, deduction: miles * r, ratePerMile: r, miles, ...used(['mileage-2026', 'mileage-2026-midyear'], given && r !== t.businessPerMile) };
});
export const homeOffice = wrap((x) => {
  const t = table('home-office-2026').values, ft = num(x.sqFt, 0, 1e6, 0), c = Math.min(ft, t.maxSqFt);
  return { ok: true, deduction: c * t.perSqFt, sqFtCounted: c, capped: ft > t.maxSqFt, ...used(['home-office-2026'], false) };
});

/* ---------- TOOLS: everything the screen needs to build forms and charts from data ---------- */
const I = (key, label, min, max, step, dflt, unit) => ({ key, label, min, max, step, dflt, unit });
const H = (label, value) => ({ label, value });
const m0 = { digits: 0 };
const ok = (o, fn) => (o && o.ok ? fn(o) : null);
const heads = (fn) => (o) => (o && o.ok ? fn(o) : [H('Check your numbers', (o && o.why) || 'Nothing to show yet')]);
const yearsOf = (s) => s.map((p) => p.year);
const bars = (x, vals, name) => ({ type: 'bar', x, series: [{ name: name || 'Amount', values: vals }] });
const verifiedLine = (o) => H(o.verified ? 'Figures checked against irs.gov' : 'Some figures not yet confirmed', o.taxYear + (o.overridden ? ' (your own rates)' : ''));
const DEBT_IN = [1, 2, 3].flatMap((k, j) => [I('bal' + k, 'Debt ' + k + ' balance', 0, 1e7, 100, [5000, 2000, 8000][j], '$'), I('rate' + k, 'Debt ' + k + ' rate', 0, 60, 0.1, [24, 12, 6][j], '%'), I('min' + k, 'Debt ' + k + ' minimum', 0, 1e5, 5, [150, 60, 160][j], '$')]);
const debtsOf = (v) => [1, 2, 3].map((k) => ({ name: 'Debt ' + k, balance: v['bal' + k], ratePct: v['rate' + k], minPayment: v['min' + k] }));
const REB_IN = [1, 2, 3].flatMap((k, j) => [I('val' + k, ['Stocks', 'Bonds', 'Cash'][j] + ' value', 0, 1e9, 100, [70000, 20000, 10000][j], '$'), I('tgt' + k, ['Stocks', 'Bonds', 'Cash'][j] + ' target', 0, 100, 1, [60, 30, 10][j], '%')]);
const RENT_IN = [I('price', 'Price', 0, 2e7, 5000, 250000, '$'), I('downPct', 'Down payment', 0, 100, 1, 20, '%'), I('ratePct', 'Loan rate', 0, 15, 0.125, 7, '%'), I('years', 'Loan term', 1, 50, 1, 30, 'years'),
  I('rentMonthly', 'Rent per month', 0, 1e5, 50, 2000, '$'), I('vacancyPct', 'Vacancy', 0, 100, 1, 5, '%'), I('taxesYear', 'Property tax per year', 0, 1e6, 100, 3600, '$'), I('insuranceYear', 'Insurance per year', 0, 1e6, 50, 1200, '$'),
  I('maintenancePct', 'Maintenance of rent', 0, 50, 1, 8, '%'), I('managementPct', 'Management of rent', 0, 30, 1, 0, '%'), I('hoaMonthly', 'HOA per month', 0, 5000, 10, 0, '$'), I('otherYear', 'Other costs per year', 0, 1e6, 100, 0, '$'),
  I('closingCosts', 'Closing costs', 0, 1e6, 500, 5000, '$'), I('rehab', 'Rehab at purchase', 0, 1e7, 500, 0, '$')];

export const TOOLS = [
  { id: 'growth', mode: 'finance', title: 'Savings growth',
    inputs: [I('start', 'Starting amount', 0, 1e8, 500, 10000, '$'), I('monthly', 'Added each month', 0, 1e6, 25, 500, '$'), I('ratePct', 'Yearly growth', -10, 30, 0.1, 7, '%'), I('years', 'Years', 0, 60, 1, 20, 'years'), I('inflationPct', 'Inflation', 0, 20, 0.1, 3, '%')],
    run: (v) => growth(v),
    headline: heads((o) => [H('Future value', money(o.futureValue, m0)), H('You paid in', money(o.totalContributed, m0)), H('Growth', money(o.totalGrowth, m0)), H('In today\'s money', money(o.realValue, m0))]),
    chart: (o) => ok(o, (r) => ({ type: 'line', x: yearsOf(r.series), series: [{ name: 'Balance', values: r.series.map((p) => p.balance) }, { name: 'Paid in', values: r.series.map((p) => p.contributed) }] })) },
  { id: 'loan', mode: 'finance', title: 'Loan and mortgage',
    inputs: [I('principal', 'Loan amount', 0, 1e8, 1000, 300000, '$'), I('ratePct', 'Yearly rate', 0, 20, 0.125, 6.5, '%'), I('years', 'Term', 1, 50, 1, 30, 'years'), I('extraMonthly', 'Extra each month', 0, 1e5, 25, 0, '$')],
    run: (v) => loan(v),
    headline: heads((o) => [H('Monthly payment', money(o.payment)), H('Total interest', money(o.totalInterest, m0)), H('Paid off in', Math.floor(o.payoffMonths / 12) + ' yrs ' + (o.payoffMonths % 12) + ' mo'), H('Interest saved by extra', money(o.interestSaved, m0))]),
    chart: (o) => ok(o, (r) => ({ type: 'line', x: yearsOf(r.series), series: [{ name: 'Balance left', values: r.series.map((p) => p.balance) }, { name: 'Interest paid so far', values: r.series.map((p) => p.interest) }] })) },
  { id: 'debt', mode: 'finance', title: 'Debt payoff',
    inputs: [...DEBT_IN, I('extraMonthly', 'Extra each month', 0, 1e5, 25, 200, '$')],
    run: (v) => compareDebt({ debts: debtsOf(v), extraMonthly: v.extraMonthly }),
    headline: heads((o) => [H('Avalanche', o.avalanche.months + ' months'), H('Avalanche interest', money(o.avalanche.totalInterest, m0)), H('Snowball', o.snowball.months + ' months'), H('Snowball interest', money(o.snowball.totalInterest, m0)), H('Avalanche saves', money(o.interestSaved, m0))]),
    chart: (o) => ok(o, (r) => { const n = Math.max(r.avalanche.series.length, r.snowball.series.length), at = (s, k) => (k < s.length ? s[k].balance : 0); const ks = Array.from({ length: n }, (e, k) => k); return { type: 'line', x: ks, series: [{ name: 'Avalanche', values: ks.map((k) => at(r.avalanche.series, k)) }, { name: 'Snowball', values: ks.map((k) => at(r.snowball.series, k)) }] }; }) },
  { id: 'fire', mode: 'finance', title: 'Financial independence number',
    inputs: [I('annualSpend', 'Yearly spending', 0, 1e7, 500, 40000, '$'), I('withdrawalPct', 'Withdrawal rate', 0.5, 10, 0.1, 4, '%'), I('current', 'Saved so far', 0, 1e8, 1000, 100000, '$'), I('monthly', 'Added each month', 0, 1e6, 50, 2000, '$'), I('ratePct', 'Yearly growth', 0, 20, 0.1, 7, '%')],
    run: (v) => fire(v),
    headline: heads((o) => [H('Target number', money(o.target, m0)), H('Years to goal', o.reached ? o.yearsToGoal.toFixed(1) + ' years' : 'Not in 100 years'), H('Illustration only', 'a rule of thumb, not a promise')]),
    chart: (o) => ok(o, (r) => ({ type: 'line', x: yearsOf(r.series), series: [{ name: 'Balance', values: r.series.map((p) => p.balance) }, { name: 'Target', values: r.series.map((p) => p.target) }] })) },
  { id: 'cagr', mode: 'finance', title: 'Growth rate (CAGR)',
    inputs: [I('start', 'Start value', 0, 1e9, 100, 10000, '$'), I('end', 'End value', 0, 1e9, 100, 18000, '$'), I('years', 'Years', 0, 100, 0.5, 4, 'years')],
    run: (v) => cagr(v),
    headline: heads((o) => [H('Yearly growth rate', pct(o.cagrPct)), H('Total return', pct(o.totalReturnPct, 1)), H('Gain', money(o.gain, m0))]),
    chart: (o) => ok(o, (r) => bars(['Start', 'End'], [r.start, r.end])) },
  { id: 'inflation', mode: 'finance', title: 'Inflation',
    inputs: [I('amount', 'Amount today', 0, 1e9, 10, 100, '$'), I('ratePct', 'Inflation', 0, 30, 0.1, 3, '%'), I('years', 'Years', 0, 60, 1, 10, 'years'), I('nominalPct', 'Investment return', 0, 30, 0.1, 7, '%')],
    run: (v) => inflation(v),
    headline: heads((o) => [H('Same thing costs later', money(o.futureCost)), H('Future amount worth today', money(o.todayValue)), H('Real return', pct(o.realReturnPct)), H('Buying power lost', pct(o.lossPct, 1))]),
    chart: (o) => ok(o, (r) => bars(['Cost later', 'Worth today'], [r.futureCost, r.todayValue])) },
  { id: 'rebalance', mode: 'finance', title: 'Mix check (arithmetic only)',
    inputs: REB_IN,
    run: (v) => rebalance({ holdings: [1, 2, 3].map((k) => ({ name: ['Stocks', 'Bonds', 'Cash'][k - 1], value: v['val' + k] })), targets: [1, 2, 3].map((k) => ({ name: ['Stocks', 'Bonds', 'Cash'][k - 1], pct: v['tgt' + k] })) }),
    headline: heads((o) => [H('Total', money(o.total, m0)), H('Moves to match targets', money(o.buyTotal, m0)), ...o.rows.slice(0, 3).map((r) => H(r.name + ' change', money(r.trade, m0)))]),
    chart: (o) => ok(o, (r) => ({ type: 'bar', x: r.rows.map((w) => w.name), series: [{ name: 'Now %', values: r.rows.map((w) => w.pct) }, { name: 'Target %', values: r.rows.map((w) => w.targetPct) }] })) },
  { id: 'rental', mode: 'realestate', title: 'Rental property', inputs: RENT_IN,
    run: (v) => rental(v),
    headline: heads((o) => [H('Cash flow per month', money(o.cashFlowMonthly)), H('Cap rate', pct(o.capRatePct)), H('Cash on cash', pct(o.cashOnCashPct)), H('Loan cover (DSCR)', o.noDebt ? 'No loan' : o.dscr.toFixed(2)), H('1% rule', o.rule1.pass ? 'Pass' : 'Fail')]),
    chart: (o) => ok(o, (r) => bars(['Rent', 'Vacancy', 'Costs', 'NOI', 'Loan', 'Cash flow'], [r.grossRent, -r.vacancyLoss, -r.operatingExpenses, r.noi, -r.debtServiceYear, r.cashFlowYear], 'Per year')) },
  { id: 'brrrr', mode: 'realestate', title: 'Buy, rehab, rent, refinance',
    inputs: [I('purchase', 'Purchase price', 0, 1e7, 1000, 100000, '$'), I('rehab', 'Rehab cost', 0, 1e7, 500, 30000, '$'), I('costs', 'Closing and holding', 0, 1e6, 500, 5000, '$'), I('arv', 'Value after repair', 0, 2e7, 1000, 160000, '$'), I('ltvPct', 'Refinance loan to value', 0, 100, 1, 75, '%'),
      I('rentMonthly', 'Rent per month', 0, 1e5, 50, 2000, '$'), I('noiPct', 'Share of rent kept after costs', 0, 100, 1, 60, '%'), I('ratePct', 'New loan rate', 0, 15, 0.125, 7, '%'), I('years', 'Loan term', 1, 50, 1, 30, 'years')],
    run: (v) => brrrr(v),
    headline: heads((o) => [H('All-in cost', money(o.allIn, m0)), H('New loan', money(o.refiLoan, m0)), o.allCashBack ? H('Cash back out', money(o.cashBack, m0)) : H('Cash left in', money(o.cashLeftIn, m0)), H('Cash flow per year', money(o.cashFlowYear, m0)), H('Cash on cash', o.allCashBack ? 'All cash back' : pct(o.cashOnCashPct))]),
    chart: (o) => ok(o, (r) => bars(['All-in', 'New loan', 'Cash left in'], [r.allIn, r.refiLoan, r.cashLeftIn])) },
  { id: 'flip', mode: 'realestate', title: 'Fix and flip',
    inputs: [I('arv', 'Value after repair', 0, 2e7, 1000, 200000, '$'), I('rehab', 'Rehab cost', 0, 1e7, 500, 30000, '$'), I('purchase', 'Purchase price', 0, 1e7, 1000, 110000, '$'), I('buyClosing', 'Closing on purchase', 0, 1e6, 500, 3000, '$'), I('holdingCosts', 'Holding costs', 0, 1e6, 500, 6000, '$'), I('sellingCostPct', 'Selling costs', 0, 20, 0.5, 6, '%')],
    run: (v) => flip(v),
    headline: heads((o) => [H('70% rule max offer', money(o.maxOffer70, m0)), H('Profit', money(o.profit, m0)), H('Profit of value', pct(o.profitPctArv, 1)), H('Within 70% rule', o.meets70 ? 'Yes' : 'No')]),
    chart: (o) => ok(o, (r) => bars(['Total cost', 'Selling', 'Profit'], [r.totalCost - r.sellingCosts, r.sellingCosts, r.profit])) },
  { id: 'rentbuy', mode: 'realestate', title: 'Rent or buy',
    inputs: [I('price', 'Home price', 0, 2e7, 5000, 400000, '$'), I('downPct', 'Down payment', 0, 100, 1, 20, '%'), I('ratePct', 'Loan rate', 0, 15, 0.125, 6.5, '%'), I('years', 'Loan term', 1, 50, 1, 30, 'years'), I('rentMonthly', 'Rent per month', 0, 1e5, 50, 2400, '$'),
      I('rentGrowthPct', 'Rent rise per year', 0, 15, 0.5, 3, '%'), I('appreciationPct', 'Home value rise per year', -5, 15, 0.5, 3, '%'), I('altReturnPct', 'Return on spare cash', 0, 15, 0.5, 5, '%'), I('horizonYears', 'Years to look at', 1, 40, 1, 30, 'years')],
    run: (v) => rentVsBuy(v),
    headline: heads((o) => [H('Buying breaks even', o.breakEvenYear ? 'year ' + o.breakEvenYear : 'not in range'), H('Simple year-1 estimate', o.breakEvenYearSimple > 0 ? o.breakEvenYearSimple.toFixed(1) + ' years' : 'never'), H('Year-1 edge for buying', money(o.advantageYear1, m0)), H('Buying ahead at the end', o.buyWins ? 'Yes' : 'No')]),
    chart: (o) => ok(o, (r) => ({ type: 'line', x: yearsOf(r.series), series: [{ name: 'Buy', values: r.series.map((p) => p.buy) }, { name: 'Rent', values: r.series.map((p) => p.rent) }] })) },
  { id: 'setax', mode: 'tax', title: 'Self-employment tax',
    inputs: [I('netProfit', 'Net profit for the year', 0, 1e7, 500, 80000, '$')],
    run: (v) => selfEmploymentTax(v),
    headline: heads((o) => [H('Self-employment tax', money(o.seTax)), H('Half you may deduct', money(o.halfDeductible)), H('Share of profit', pct(o.effectivePct, 1)), verifiedLine(o)]),
    chart: (o) => ok(o, (r) => bars(['Taxed base', 'SE tax', 'Half deductible'], [r.seBase, r.seTax, r.halfDeductible])) },
  { id: 'quarterly', mode: 'tax', title: 'Quarterly payment helper',
    inputs: [I('expectedTax', 'Tax you expect this year', 0, 1e7, 500, 20000, '$'), I('paid', 'Paid or withheld so far', 0, 1e7, 500, 0, '$'), I('priorYearTax', 'Last year\'s total tax', 0, 1e7, 500, 12000, '$'), I('quartersLeft', 'Payments left', 1, 4, 1, 4, '')],
    run: (v) => quarterlyEstimate(v),
    headline: heads((o) => [H('Still to pay', money(o.remaining, m0)), H('Per payment left', money(o.perQuarterRemaining, m0)), H('Last year x100% / 4', money(o.priorYearPerQuarter, m0)), verifiedLine(o)]),
    chart: (o) => ok(o, (r) => bars(['Still to pay', 'Per payment', 'Last-year method'], [r.remaining, r.perQuarterRemaining, r.priorYearPerQuarter])) },
  { id: 'mileage', mode: 'tax', title: 'Business mileage',
    inputs: [I('miles', 'Business miles', 0, 1e6, 10, 6400, 'miles')],
    run: (v) => mileage(v),
    headline: heads((o) => [H('Mileage amount', money(o.deduction)), H('Rate used', money(o.ratePerMile, { digits: 3 }) + ' per mile'), verifiedLine(o)]),
    chart: () => null },
];
/* the screen may pass anything; make every tool's run safe too */
TOOLS.forEach((t) => { const f = t.run; t.run = (v) => { try { return f(v && typeof v === 'object' ? v : {}); } catch (e) { return fail('Those inputs could not be read.'); } }; });
