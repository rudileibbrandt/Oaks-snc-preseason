// One-off (8 Nov 2026): remove Chris Leibbrandt's result on the 20 Dec testing day. That day hasn't
// happened; the result was a test entry (Rudi). The testing day itself stays.
//
//   node scripts/clear-chris-dec20.mjs            # dry run: shows what's on it and who else has 20 Dec results
//   node scripts/clear-chris-dec20.mjs --apply    # deletes it, then checks it's gone
import fs from 'node:fs';
import os from 'node:os';

const APPLY = process.argv.includes('--apply');
const NAME_KEY = 'chris leibbrandt';
const DATE = '2026-12-20';
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
const show = (v) => v.stringValue ?? v.doubleValue ?? v.integerValue ?? JSON.stringify(v);

const days = ((await getJson(`${API}/${DB}/testSessions?pageSize=1000`)).documents ?? [])
  .filter(d => d.fields?.date?.stringValue === DATE);
if (days.length !== 1) { console.error(`STOP: expected one testing day on ${DATE}, found ${days.length}.`); process.exit(1); }
const dayId = idOf(days[0]);
console.log(`${DATE}: "${days[0].fields.name?.stringValue}" (${dayId})`);

const onDay = ((await getJson(`${API}/${DB}/testResults?pageSize=1000`)).documents ?? [])
  .filter(d => d.fields?.sessionId?.stringValue === dayId);
console.log(`results on that day: ${onDay.map(d => d.fields.playerName?.stringValue).join(', ') || 'none'}`);
const target = onDay.filter(d => d.fields?.nameKey?.stringValue === NAME_KEY);
if (target.length !== 1) { console.error(`STOP: expected one result for Chris on ${DATE}, found ${target.length}.`); process.exit(1); }
const doc = target[0];
console.log(`\nWill delete Chris's ${DATE} result:`);
for (const [k, v] of Object.entries(doc.fields)) console.log(`  ${k}: ${show(v)}`);

if (!APPLY) { console.log('DRY RUN: nothing written. Re-run with --apply.'); process.exit(0); }
const res = await (await fetch(`${API}/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: [{
  delete: doc.name,
  currentDocument: { updateTime: doc.updateTime }, // unchanged since we read it
}] }) })).json();
if (res.error) { console.error('WRITE FAILED, nothing changed:', res.error.message); process.exit(1); }
const check = await fetch(`${API}/${DB}/testResults/${encodeURIComponent(idOf(doc))}`, { headers: H });
if (check.status !== 404) { console.error(`CHECK FAILED: the result is still there (${check.status}).`); process.exit(1); }
console.log(`CHECK PASSED: Chris's ${DATE} result is gone; the testing day stays.`);
