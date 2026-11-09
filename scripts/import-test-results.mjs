// One-off (Nov 2026): enter the 25 Oct try-out results and the 8 Nov 40m times from the coaches'
// sheet, so they show on the testing boards.
//
//   node scripts/import-test-results.mjs            # dry run: shows every change it would make
//   node scripts/import-test-results.mjs --apply    # writes, then reads back and checks every value
//
// Uses your Firebase CLI login (firebase login). Writes the same documents the app's "Paste results"
// does. Only the fields below are set; anything else already entered for a player (e.g. a 10 m time
// or bodyweight) is kept. Safe to run again. Stops on any read error or any name it can't place.
import fs from 'node:fs';
import os from 'node:os';

const APPLY = process.argv.includes('--apply');
const DB = 'projects/oaks-snc/databases/(default)/documents';
const API = 'https://firestore.googleapis.com/v1';
const ENTERED_BY = 'Rudi Leibbrandt';

// Names as on the app's team list. Bronco in m:ss, broad jump in inches (the sheet's metres x 39.37),
// 40 m in seconds. null = not tested.
const DAYS = [
  {
    date: '2026-10-25', newId: 'tryouts-2026-10-25', newName: 'Try-out testing',
    rows: [
      ['Armando Hall', '5:02', 89, 5.586], ['Chris Leibbrandt', '5:05', 94, 5.312],
      ['Eddie Westmoreland', '5:02', 83, 5.723], ['Frank Tucker', '6:13', 96, 5.395],
      ['Jack Younger', '5:52', null, 5.314], ['Jackson Evans', '6:44', 75, 6.25],
      ['Jackson Neufeld', '6:35', 75, 5.862], ['Jaden Selha', '7:30', 83, 5.742],
      ['Madden Casson', '5:15', 83, 5.391], ['Nicholas Donnelly', '5:40', 94, 5.192],
      ['Reed Schassberger', '6:36', 77, 6.102], ['Robert Duncan Anderson', '5:20', 87, 5.357],
      ['Rohit Mareddy', '6:05', null, 6.196], ['Rudy Duggineni', '6:12', 69, 6.056],
      ['Sean Mallie-Ramos', '6:15', 79, 5.697], ['Thunder Hazen', '5:58', 79, 5.646],
      ['Tyler Leary', '5:20', 98, 5.155], ['Vincenzo Uang', '6:13', 98, 5.45],
      ['Walker French', '6:52', 75, 6.0],
    ].map(([name, bronco, broadJump, sprint40]) => ({ name, bronco, broadJump, sprint40 })),
  },
  {
    date: '2026-11-08', newId: 'testing-2026-11-08', newName: 'Testing day',
    rows: [
      ['Finn Hegarty', 6.37], ['Tyler Leary', 5.36], ['Sean Mallie-Ramos', 5.88], ['Madden Casson', 5.69],
      ['Chris Leibbrandt', 5.57], ['Nicholas Donnelly', 5.40], ['Vincenzo Uang', 5.49], ['Xerxes Irani', 5.37],
      ['Zachary Filal', 5.76], ['Nathan Hoge', 5.61], ['Josh Davis', 5.41], ['Joshua Boudreau', 5.98],
      ['Finn Little', 5.40], ['Andrew Born', 5.33], ['Christian Sisneroz', 5.94], ['Luc Purcell', 6.80],
      ['Duke Chiosso', 5.39], ['Rudy Duggineni', 6.39], ['Frank Tucker', 5.68], ['Julian Gomez', 5.48],
      ['Christopher Castro', 5.59], ['Tristan Comiskey', 6.27], ['Zachary Taylor', 6.37],
    ].map(([name, sprint40]) => ({ name, sprint40 })),
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
console.log(`read ${sessions.length} testing days, ${results.size} results`);

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
    const group = prev.group ?? GROUP_OF_POSITION[positionOf.get(r.name)];
    if (!group) { console.error(`STOP: ${r.name} has no position on the team list and no group on ${day.date}.`); process.exit(1); }
    const values = {};
    if (r.bronco != null) values.bronco = parseBronco(r.bronco);
    if (r.broadJump != null) values.broadJump = r.broadJump;
    if (r.sprint40 != null) values.sprint40 = r.sprint40;
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
