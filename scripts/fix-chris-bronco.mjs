// One-off (8 Nov 2026): Chris Leibbrandt's 25 Oct Bronco (5:05, from the sheet) is wrong. Rudi: set it
// to his last test, i.e. the Bronco from his most recent other testing day.
//
//   node scripts/fix-chris-bronco.mjs            # dry run: lists all his Bronco times, shows the change
//   node scripts/fix-chris-bronco.mjs --apply    # writes, then reads it back
import fs from 'node:fs';
import os from 'node:os';

const APPLY = process.argv.includes('--apply');
const NAME_KEY = 'chris leibbrandt';
const FIX_DATE = '2026-10-25';
const DB = 'projects/oaks-snc/databases/(default)/documents';
const API = 'https://firestore.googleapis.com/v1';

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
  if (!res.ok || json.error) { console.error(`STOP: read failed (${res.status}): ${json.error?.message ?? ''}`); process.exit(1); }
  if (json.nextPageToken) { console.error('STOP: more than one page; this script reads one.'); process.exit(1); }
  return json;
};
const idOf = (d) => d.name.split('/').pop();
const num = (v) => v?.doubleValue !== undefined ? +v.doubleValue : v?.integerValue !== undefined ? +v.integerValue : undefined;
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const sessions = new Map(((await getJson(`${API}/${DB}/testSessions?pageSize=1000`)).documents ?? [])
  .map(d => [idOf(d), { date: d.fields?.date?.stringValue, name: d.fields?.name?.stringValue }]));
const mine = ((await getJson(`${API}/${DB}/testResults?pageSize=1000`)).documents ?? [])
  .filter(d => d.fields?.nameKey?.stringValue === NAME_KEY)
  .map(d => ({ id: idOf(d), ...sessions.get(d.fields.sessionId?.stringValue), bronco: num(d.fields.bronco), by: d.fields.enteredBy?.stringValue }))
  .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

console.log("Chris's results by testing day:");
for (const r of mine) console.log(`  ${r.date} ${r.name}: Bronco ${r.bronco == null ? '-' : clock(r.bronco)} (entered by ${r.by})`);

const target = mine.filter(r => r.date === FIX_DATE);
if (target.length !== 1) { console.error(`STOP: expected one ${FIX_DATE} result, found ${target.length}.`); process.exit(1); }
const last = mine.filter(r => r.date !== FIX_DATE && r.bronco != null).at(-1);
if (!last) { console.error(`STOP: no other Bronco for Chris to copy. Tell Claude the right time instead.`); process.exit(1); }
console.log(`\nWill set ${FIX_DATE} Bronco ${clock(target[0].bronco)} -> ${clock(last.bronco)} (from ${last.date} ${last.name}).`);

if (!APPLY) { console.log('DRY RUN: nothing written. Re-run with --apply.'); process.exit(0); }
const res = await (await fetch(`${API}/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: [{
  update: { name: `${DB}/testResults/${target[0].id}`, fields: { bronco: { doubleValue: last.bronco }, updatedAt: { integerValue: String(Date.now()) } } },
  updateMask: { fieldPaths: ['bronco', 'updatedAt'] },
  currentDocument: { exists: true },
}] }) })).json();
if (res.error) { console.error('WRITE FAILED, nothing changed:', res.error.message); process.exit(1); }
const check = num((await getJson(`${API}/${DB}/testResults/${encodeURIComponent(target[0].id)}`)).fields?.bronco);
if (check !== last.bronco) { console.error(`CHECK FAILED: Bronco is ${check}`); process.exit(1); }
console.log(`CHECK PASSED: Chris's ${FIX_DATE} Bronco is now ${clock(check)}.`);
