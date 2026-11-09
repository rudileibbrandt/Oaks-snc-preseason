// One-off (8 Nov 2026): remove impossible Bronco times (under 3:00 or over 15:00) from every
// player's results. "5.05" typed for 5:05 was saved as 5 seconds and became Chris's best. The app
// now refuses these (services/parseScores.ts); this clears the ones already saved.
//
//   node scripts/clear-bad-bronco.mjs            # dry run: lists what it would clear
//   node scripts/clear-bad-bronco.mjs --apply    # clears them, then reads back
//
// Only the Bronco is removed (= not tested); every other score on that result stays.
import fs from 'node:fs';
import os from 'node:os';

const APPLY = process.argv.includes('--apply');
const MIN = 180, MAX = 900; // same bounds as services/parseScores.ts
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
const isBad = (b) => b !== undefined && (b < MIN || b > MAX);

const sessions = new Map(((await getJson(`${API}/${DB}/testSessions?pageSize=1000`)).documents ?? [])
  .map(d => [idOf(d), `${d.fields?.date?.stringValue} ${d.fields?.name?.stringValue}`]));
const readAll = async () => ((await getJson(`${API}/${DB}/testResults?pageSize=1000`)).documents ?? []);
const all = await readAll();
const bad = all.filter(d => isBad(num(d.fields?.bronco)));
console.log(`read ${all.length} results; ${bad.length} impossible Bronco times:`);
for (const d of bad) console.log(`  ${d.fields.playerName?.stringValue} · ${sessions.get(d.fields.sessionId?.stringValue) ?? '?'}: ${clock(num(d.fields.bronco))} (entered by ${d.fields.enteredBy?.stringValue})`);

if (!APPLY) { console.log('DRY RUN: nothing written. Re-run with --apply.'); process.exit(0); }
if (!bad.length) { console.log('nothing to clear'); process.exit(0); }
const now = String(Date.now());
const writes = bad.map(d => ({
  // bronco is in the mask but not in fields, so it is removed.
  update: { name: d.name, fields: { updatedAt: { integerValue: now } } },
  updateMask: { fieldPaths: ['bronco', 'updatedAt'] },
  currentDocument: { updateTime: d.updateTime }, // unchanged since we read it
}));
const res = await (await fetch(`${API}/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) })).json();
if (res.error) { console.error('WRITE FAILED, nothing changed:', res.error.message); process.exit(1); }
const left = (await readAll()).filter(d => isBad(num(d.fields?.bronco)));
if (left.length) { console.error(`CHECK FAILED: ${left.length} impossible Bronco times still there.`); process.exit(1); }
console.log(`CHECK PASSED: cleared ${bad.length}; no impossible Bronco times left.`);
