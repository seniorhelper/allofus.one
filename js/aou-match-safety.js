/* ============================================================
   allofus.one · Match Shield (v29, Oct 25 2026)
   The first of four layers that keep Global Match from turning into a black market:
     1. this file: normalize the text (leetspeak, spacing tricks, look-alike letters, emoji codes),
        then check it against the rules below while the member types. Friendly, instant.
     2. the database: supabase/_parts/v29-match.sql runs the same BLOCK rules in a trigger,
        so nothing can skip this file. Hits are logged and count as strikes (3 strikes = no posting).
     3. Claude (Edge Function match-ai): every new post is read by the AI and held if it is risky.
     4. the safety sweep (Edge Function safety-sweep): 7am + 7pm Denver, re-reads the day's posts.
   level 'block' = cannot post (and a strike); 'warn' = may post after a heads-up; 'ok' = clean.
   ============================================================ */

const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };
// Cyrillic / Greek letters that look Latin
const LOOK = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'α': 'a', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'ν': 'v', 'κ': 'k' };

export function normalize(s, leet = true) {
  let t = String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[​-‏⁠﻿]/g, '').toLowerCase();
  t = t.replace(/./gu, (c) => LOOK[c] || c);
  // keep a copy where leet digits are letters, but only inside words (so "$40" and "2 bikes" stay readable for other checks)
  if (leet) t = t.replace(/[013457@$!|+89](?=[a-z0-9@$!|+]*[a-z])|(?<=[a-z][a-z0-9@$!|+]*)[013457@$!|+89]/g, (c) => LEET[c] || c);
  t = t.replace(/[._\-*~]+(?=[a-z])/g, ''); // w.e.e.d  w-e-e-d  w*eed
  // "w e e d" → "weed": collapse runs of single letters separated by spaces
  t = t.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, (m) => m.replace(/ /g, ''));
  t = t.replace(/([a-z])\1{2,}/g, '$1$1'); // weeeeed → weed (letters only, so 303-555-1212 stays a phone number)
  return t;
}

/* Each rule: [id, label, level, regex on normalized text]. Words with innocent meanings (gas, ice, snow, coke, molly,
   bars, plug, connect, can, switch, weed) are never blocked alone; they only warn, or block in combination below. */
export const RULES = [
  // drugs
  ['drugs', 'Drugs or controlled substances', 'block', /\b(kush|zaza|mdma|ecstasy|xanax|xans|percocets?|percs|oxycodone|oxycontin|oxys?|roxys?|fentanyl|fent|m30s?|cocaine|crack rock|meth|methamphetamine|heroin|shrooms|psilocybin|lsd|dmt|ketamine|ket|thc carts?|dab pens?|wax pens?|adderall|vicodin|hydrocodone|codeine|lean|promethazine|tramadol|suboxone|steroids|tren|anavar|clenbuterol|kratom|pressies|blues pills?)\b/],
  ['drugs-sale', 'Selling drugs or prescriptions', 'block', /\b(no (rx|script|prescription)|without (a )?prescription|rx (meds|pills) for sale|pills? for sale|420 friendly|weed (for sale|delivery)|(sell|selling|got|have) (weed|bud|flower|pot|grass|edibles|carts))\b|\b(oz|ozs|qp|zip|8th|eighth|grams?|g) (of )?(weed|bud|flower|loud|gas|za)\b/],
  // weapons
  ['weapons', 'Guns, ammo or weapons', 'block', /\b(guns?|firearms?|handguns?|pistols?|rifles?|shotguns?|revolvers?|ammo|ammunition|rounds of|glock|ar ?15|ak ?47|9mm|ghost guns?|80 ?% lower|lower receivers?|suppressors?|silencers?|auto sears?|glock switch|bump stocks?|drum mags?|high capacity mags?|3d printed guns?|tasers?|brass knuckles|switchblades?|grenades?|explosives?|pipe bombs?|detonators?|tannerite|thermite)\b/],
  // sex, trafficking, minors
  ['sex', 'Sexual services or adult content', 'block', /\b(escorts?|escorting|gfe|pse|incall|outcall|happy ending|full service|sugar (daddy|baby|mama)|onlyfans|only fans|nudes?|sexting|hook ?ups?|nsfw|fetish|bdsm|porn|xxx|cam ?girls?|strip(per|tease)|erotic massage|body rubs?|qv|hhr|roses for)\b/],
  ['minors', 'Anything sexual involving minors', 'block', /\b(underage|barely legal|young (girls?|boys?)|teen (girls?|boys?|pics|nudes)|jailbait|loli|cp|minors? (for|wanted|available)|kids? (for sale|available))\b/],
  ['trafficking', 'People for sale or trafficking signs', 'block', /\b(new in town|fresh (girls?|faces?)|(girls?|women|workers?) available|visa (work|sponsor) (no|without) papers|passport (held|kept)|human (organs?|remains)|kidneys? (for sale|wanted)|organs? for sale|buy a (baby|child|kid)|babies? for sale|surrogacy cash)\b/],
  // fraud
  ['fraud', 'Fraud, stolen data or fake documents', 'block', /\b(fullz|cvv|dumps|carding|cash ?out (method|service)|bank (logs?|logins?)|fake (ids?|passports?|licen[cs]es?|diplomas?|degrees?|documents?|checks?|money|bills)|scannable|novelty (ids?|licen[cs]es?)|counterfeit|ssns? for sale|social security numbers?|stolen|no serial|hacked accounts?|account takeover|ddos|phishing kits?|ransomware|malware|botnet|keyloggers?|essay (writing )?service|take (my|your) exam)\b/],
  ['knockoff', 'Replicas and knock-offs', 'block', /\b(replicas?|reps|1 ?: ?1 (quality|copy)|aaa (quality|grade)|mirror quality|super ?fake|knock ?offs?|dupes? of (rolex|gucci|lv|louis))\b/],
  // violence + hate
  ['violence', 'Violence or threats', 'block', /\b(hitman|hit man|kill (him|her|them|someone|you)|murder for hire|beat (him|her|them|someone) up|(hurt|harm) (him|her|them|someone)|revenge (on|for)|swatting|dox(x)?(ing)?)\b/],
  ['hate', 'Hate or slurs', 'block', /\b(n[i]gg(a|er|ers|as)|f[a]gg?ots?|k[i]kes?|sp[i]cs?|ch[i]nks?|tr[a]nn(y|ies)|wetbacks?|g[o]oks?|raghead|towelhead|white power|heil hitler|14 ?88)\b/],
  // animals + regulated goods (members may ask, but no sales)
  ['wildlife', 'Endangered animal parts', 'block', /\b(ivory|rhino horn|tiger (skin|bone|parts)|pangolin|shark fin|bear bile)\b/],
  // warnings: allowed, but the member sees a heads-up first
  ['offsite', 'Moving the deal off allofus (common scam start)', 'warn', /\b(whats ?app|telegram|t\.me|wa\.me|signal me|kik|snap(chat)? me|text me at|dm me on)\b/],
  ['payment', 'Payment method that scammers love', 'warn', /\b(gift ?cards?|western union|moneygram|zelle only|cash ?app only|wire (me|transfer)|bitcoin|btc|usdt|crypto|ethereum|eth wallet|verification code|send (me )?(the|a) code|pay (a |the )?deposit first|advance fee)\b/],
  ['contact', 'Phone numbers or e-mails in the post (use allofus messages instead)', 'warn', /(\b\d{3}[ .\-)]*\d{3}[ .\-]*\d{4}\b|[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/],
  ['regulated', 'Alcohol, tobacco, vapes, CBD or live animals: give or ask is fine, no selling', 'warn', /\b(alcohol|liquor|vodka|whiskey|beer for sale|cigarettes?|tobacco|vapes?|nicotine|juul|cbd|hemp|delta ?8|puppies for sale|kittens for sale|weed|marijuana|cannabis|edibles)\b/],
  ['profanity', 'Rough language (keep it kind)', 'warn', /\b(fuck\w*|shit\w*|cunt\w*|bitch\w*|asshole\w*|dick ?head|motherf\w*|bastard)\b/],
];

// drug / sex emoji only count in combination (one 🍁 alone is a maple leaf)
const DRUG_EMO = /[🍁🌲🌳🍀❄️🎱⛷💎💙🔮🐉🍄🍫💊🔌🅿️🍃💨]/gu, MONEY_EMO = /[💰💵💸🤑]|\$\s?\d/u, SEX_EMO = /[🍑🍆💦👅🌹]/gu;

/** screen(text) → { level: 'ok'|'warn'|'block', hits: [{ id, label, level }] } */
export function screen(text) {
  const raw = String(text || ''), plain = normalize(raw, false), t = normalize(raw), hits = [];
  // check the plain text (keeps codes like m30, ar15, 9mm) and the decoded text (w33d → weed)
  for (const [id, label, level, rx] of RULES) if (rx.test(plain) || rx.test(t)) hits.push({ id, label, level });
  const drugE = (raw.match(DRUG_EMO) || []).length, sexE = (raw.match(SEX_EMO) || []).length, money = MONEY_EMO.test(raw);
  if (drugE >= 3 || (drugE >= 2 && money) || (/🔌/u.test(raw) && drugE >= 2)) hits.push({ id: 'drug-emoji', label: 'Drug code emoji', level: 'block' });
  if (sexE >= 3 || (sexE >= 2 && money)) hits.push({ id: 'sex-emoji', label: 'Adult-service code emoji', level: 'block' });
  const level = hits.some((h) => h.level === 'block') ? 'block' : hits.length ? 'warn' : 'ok';
  return { level, hits };
}

export const STRIKE_TEXT = 'Accounts that trip the safety shield are banned. Please do not post or search topics like that again.';
