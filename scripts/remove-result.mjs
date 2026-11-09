// Remove one player's result from one testing day (e.g. a time matched to the wrong player).
//
//   node scripts/remove-result.mjs 2026-11-08 "Nathan Hoge"            # dry run: shows the result
//   node scripts/remove-result.mjs 2026-11-08 "Nathan Hoge" --apply    # deletes it, then checks it's gone
//
// The testing day stays. Stops if the date has more than one testing day, or the player has no result.
import fs from 'node:fs';
import os from 'node:os';

const [DATE, NAME] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE ?? '') || !NAME) {
  console.error('Usage: node scripts/remove-result.mjs YYYY-MM-DD "Player Name" [--apply]');
  process.exit(1);
}
const NAME_KEY = NAME.toLowerCase().trim().replace(/\s+/g, ' '); // as services/alumni.ts normalizeName
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
const target = ((await getJson(`${API}/${DB}/testResults?pageSize=1000`)).documents ?? [])
  .filter(d => d.fields?.sessionId?.stringValue === dayId && d.fields?.nameKey?.stringValue === NAME_KEY);
if (target.length !== 1) { console.error(`STOP: expected one result for ${NAME} on ${DATE}, found ${target.length}.`); process.exit(1); }
const doc = target[0];
console.log(`Will delete ${NAME}'s result on ${DATE} "${days[0].fields.name?.stringValue}":`);
for (const [k, v] of Object.entries(doc.fields)) if (!['sessionId', 'nameKey'].includes(k)) console.log(`  ${k}: ${show(v)}`);

if (!APPLY) { console.log('DRY RUN: nothing written. Re-run with --apply.'); process.exit(0); }
const res = await (await fetch(`${API}/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes: [{
  delete: doc.name,
  currentDocument: { updateTime: doc.updateTime }, // unchanged since we read it
}] }) })).json();
if (res.error) { console.error('WRITE FAILED, nothing changed:', res.error.message); process.exit(1); }
const check = await fetch(`${API}/${DB}/testResults/${encodeURIComponent(idOf(doc))}`, { headers: H });
if (check.status !== 404) { console.error(`CHECK FAILED: the result is still there (${check.status}).`); process.exit(1); }
console.log(`CHECK PASSED: ${NAME}'s ${DATE} result is gone; the testing day stays.`);
