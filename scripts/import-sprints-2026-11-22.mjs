// One-off (22 Nov 2026): today's 10 m and 40 m times from the coaches' timing sheet (Rudi's paste).
//
//   node scripts/import-sprints-2026-11-22.mjs            # dry run: shows every change it would make
//   node scripts/import-sprints-2026-11-22.mjs --apply    # writes, then reads back and checks every value
//
// Same core as import-test-results.mjs: only sprint10/sprint40 are set, anything else entered for a
// player today is kept. Names confirmed with Rudi in chat: "JJ" = Julian Gomez, "Finn" = Finn Hegarty;
// Nick, Givani, Asher, Josia, Thunder, Quinten and Tanner are the only roster players with those names.
// Not entered (unknown or not on the team list): "Max (Mac Tartony?)" 1.851/5.288, "Jack T" 40 m 6.254,
// "Xon (Zahn)" 2.113/6.470, Brayden Raedler 1.804/5.483 (not on SportsEngine varsity),
// and the middle-school player (2.111?).
import fs from 'node:fs';
import os from 'node:os';

const APPLY = process.argv.includes('--apply');
const DB = 'projects/oaks-snc/databases/(default)/documents';
const API = 'https://firestore.googleapis.com/v1';
const ENTERED_BY = 'Rudi Leibbrandt';

const DAYS = [
  {
    date: '2026-11-22', newId: 'testing-2026-11-22', newName: 'Testing day',
    rows: [
      ['Tyler Leary', 1.650, 5.129], ['Nicholas Donnelly', 1.659, 5.450], ['Jack Younger', 1.662, 5.157],
      ['Givani Jimenez', 1.687, 5.195], ['Andrew Campbell', 1.691, 5.299], ['Chris Leibbrandt', 1.705, 5.268],
      ['Xerxes Irani', 1.738, 5.335], ['Brandon Levyash', 1.738, 5.359], ['Noah Ball', 1.754, 5.218],
      ['Josh Davis', 1.770, 5.108], ['Asher Ball', 1.782, 5.087], ['Julian Gomez', 1.810, 5.356],
      ['Reed Schassberger', 1.813, 5.924], ['Josiah-Tyler Brodit', 1.822, 5.221], ['Finn Hegarty', 1.827, 5.915],
      ['John Regan', 1.832, 5.794], ['Frank Tucker', 1.833, 5.596], ['Eddie Westmoreland', 1.938, 5.727],
      ['Thunder Hazen', 1.987, null], ['Quinten Snyder', 2.015, 6.404], ['Tristan Comiskey', 2.028, 5.943],
      ['Tanner Gates', null, 5.143],
      // Added to the team list from SportsEngine varsity (22 Nov).
      ['Landon Cooper', 1.836, 5.612], ['Rocco Montalvo', 2.216, 6.270],
    ].map(([name, sprint10, sprint40]) => ({ name, sprint10, sprint40 })),
  },
];

// Same as services/alumni.ts normalizeName and the GROUPS table in services/standards.ts.
const normalizeName = (n) => n.toLowerCase().trim().replace(/\s+/g, ' ');
const GROUP_OF_POSITION = { 1: 'props', 3: 'props', 2: 'hookers', 4: 'locks', 5: 'locks', 6: 'backrow', 7: 'backrow',
  8: 'backrow', 9: 'scrumhalves', 10: 'flyhalves', 12: 'centers', 13: 'centers', 11: 'backthree', 14: 'backthree', 15: 'backthree' };
const parseBronco = (s) => { const m = s.match(/^(\d{1,2}):([0-5]\d)$/); if (!m) throw new Error(`bad bronco ${s}`); return +m[1] * 60 + +m[2]; };

// Positions come from the team list file itself, so this can't drift from the app.
const rosterSrc = fs.readFileSync(new URL('../services/rosterData.ts', import.meta.url), 'utf8');
const positionOf = new Map([...rosterSrc.matchAll(/\{ name: "([^"]+)"([^}]*)\}/g)]
  .map(([, name, rest]) => [name, +(rest.match(/bestPosition: (\d+)/)?.[1] ?? 0)]));

const problems = [];
for (const day of DAYS) for (const r of day.rows) {
  if (!positionOf.has(r.name)) problems.push(`${r.name} is not on the team list`);
  if (day.rows.filter(x => x.name === r.name).length > 1) problems.push(`${r.name} twice on ${day.date}`);
}
if (problems.length) { console.error('STOP:', [...new Set(problems)].join('; ')); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const tokenJson = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: cfg.tokens.refresh_token,
    // The Firebase CLI's public OAuth client.
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  }),
})).json();
if (!tokenJson.access_token) { console.error('STOP: could not get a token. Run `firebase login`.'); process.exit(1); }
const H = { authorization: 'Bearer ' + tokenJson.access_token, 'content-type': 'application/json' };
const getJson = async (url) => {
  const res = await fetch(url, { headers: H });
  const json = await res.json();
  if (!res.ok || json.error) { console.error(`STOP: read failed (${res.status}) ${url}: ${json.error?.message ?? ''}`); process.exit(1); }
  if (json.nextPageToken) { console.error(`STOP: ${url} has more than one page; this script reads one.`); process.exit(1); }
  return json;
};
const idOf = (d) => d.name.split('/').pop();
const plain = (v) => v == null ? undefined : v.stringValue ?? (v.doubleValue !== undefined ? +v.doubleValue : v.integerValue !== undefined ? +v.integerValue : v.nullValue === null ? null : undefined);
const enc = (v) => typeof v === 'number' ? { doubleValue: v } : { stringValue: v };

const sessions = ((await getJson(`${API}/${DB}/testSessions?pageSize=1000`)).documents ?? [])
  .map(d => ({ id: idOf(d), date: plain(d.fields?.date), name: plain(d.fields?.name) }));
const results = new Map(((await getJson(`${API}/${DB}/testResults?pageSize=1000`)).documents ?? [])
  .map(d => [idOf(d), Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, plain(v)]))]));
// Positions set in the app (coach or player) win over the team list file, as in the app.
const savedBest = new Map(((await getJson(`${API}/${DB}/rosterClasses?pageSize=1000`)).documents ?? [])
  .filter(d => d.fields?.positions?.arrayValue) // [] = cleared in the app: no position (back row)
  .map(d => [decodeURIComponent(idOf(d)), d.fields.positions.arrayValue.values?.map(v => +(v.integerValue ?? v.doubleValue))[0] ?? 0]));
console.log(`read ${sessions.length} testing days, ${results.size} results, ${savedBest.size} positions set in the app`);

const now = Date.now();
const writes = [];
const expected = []; // [docId, field, value] to check after writing
let changes = 0, replaced = 0;
for (const day of DAYS) {
  const onDate = sessions.filter(s => s.date === day.date);
  if (onDate.length > 1) { console.error(`STOP: ${onDate.length} testing days on ${day.date}: ${onDate.map(s => `${s.name} (${s.id})`).join(', ')}. Delete or move the extra one in the app first.`); process.exit(1); }
  let sessionId = onDate[0]?.id;
  if (!sessionId) {
    sessionId = day.newId;
    console.log(`\n${day.date}: no testing day yet, will create "${day.newName}"`);
    writes.push({
      update: { name: `${DB}/testSessions/${sessionId}`, fields: { name: enc(day.newName), date: enc(day.date), createdBy: enc(ENTERED_BY), createdAt: { integerValue: String(now) } } },
      currentDocument: { exists: false },
    });
  } else {
    console.log(`\n${day.date}: "${onDate[0].name}" (${sessionId})`);
  }
  for (const r of day.rows) {
    const id = `${sessionId}__${normalizeName(r.name)}`;
    const prev = results.get(id) ?? {};
    // No position on the team list = back row (Rudi, 8 Nov), as in services/positionGroups.ts.
    const key = normalizeName(r.name);
    const group = prev.group ?? GROUP_OF_POSITION[savedBest.has(key) ? savedBest.get(key) : positionOf.get(r.name)] ?? 'backrow';
    const values = {};
    if (r.bronco != null) values.bronco = parseBronco(r.bronco);
    if (r.broadJump != null) values.broadJump = r.broadJump;
    if (r.sprint40 != null) values.sprint40 = r.sprint40;
    if (r.sprint10 != null) values.sprint10 = r.sprint10;
    if (r.bodyweight != null) values.bodyweight = r.bodyweight;
    // Rudi, 22 Nov: keep any time already entered in the app; only fill empty boxes.
    for (const k of Object.keys(values)) if (prev[k] != null) { console.log(`  ${r.name}: ${k} ${prev[k]} already in, kept`); delete values[k]; }
    const diff = Object.entries(values).filter(([k, v]) => prev[k] !== v);
    if (diff.length === 0 && prev.group) { console.log(`  ${r.name}: already in, no change`); continue; }
    const notes = diff.map(([k, v]) => prev[k] == null ? `${k} ${v}` : `${k} ${prev[k]} -> ${v} (REPLACES)`);
    replaced += diff.filter(([k]) => prev[k] != null).length;
    changes++;
    console.log(`  ${r.name} [${group}]${results.has(id) ? '' : ' new'}: ${notes.join(', ') || 'group only'}`);
    const fields = { ...values, group, sessionId, nameKey: normalizeName(r.name), playerName: r.name, enteredBy: ENTERED_BY };
    writes.push({
      update: { name: `${DB}/testResults/${id}`, fields: { ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, enc(v)])), updatedAt: { integerValue: String(now) } } },
      // Only these fields; anything else entered for the player that day stays.
      updateMask: { fieldPaths: [...Object.keys(fields), 'updatedAt'] },
    });
    for (const [k, v] of Object.entries(values)) expected.push([id, k, v]);
  }
}
console.log(`\n${changes} players to write${replaced ? `, ${replaced} values REPLACED (shown above)` : ''}.`);

if (!APPLY) { console.log('DRY RUN: nothing written. Re-run with --apply.'); process.exit(0); }
if (writes.length === 0) { console.log('nothing to write'); process.exit(0); }
const res = await (await fetch(`${API}/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) })).json();
if (res.error) { console.error('WRITE FAILED, nothing changed:', res.error.message); process.exit(1); }
console.log(`wrote ${res.writeResults.length} documents at ${res.commitTime}`);

// Check: read every result back.
const after = new Map(((await getJson(`${API}/${DB}/testResults?pageSize=1000`)).documents ?? [])
  .map(d => [idOf(d), Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, plain(v)]))]));
const wrong = expected.filter(([id, k, v]) => after.get(id)?.[k] !== v);
if (wrong.length) { console.error(`CHECK FAILED: ${wrong.length} values not as written:`, wrong.slice(0, 10)); process.exit(1); }
console.log(`CHECK PASSED: all ${expected.length} values are in.`);
