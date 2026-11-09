// One-off (Nov 2026): make every existing user a team member before the join-code rules go live,
// and store the team join code. Without this, existing users are locked out by firestore.rules.
//
//   node scripts/backfill-members.mjs            # dry run: shows what it would write
//   node scripts/backfill-members.mjs --apply    # writes, then checks every login is covered
//
// Uses your Firebase CLI login (firebase login). Only adds what's missing (memberships, and the
// join code if none is set), so it's safe to run again, e.g. after the deploy to catch anyone who
// signed up in between. Stops on any read error rather than writing from partial data.
import fs from 'node:fs';
import os from 'node:os';

const JOIN_CODE = 'OAKS-CG3G';
const APPLY = process.argv.includes('--apply');
const DB = 'projects/oaks-snc/databases/(default)/documents';
const API = 'https://firestore.googleapis.com/v1';

const cfg = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: cfg.tokens.refresh_token,
    // The Firebase CLI's public OAuth client.
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  }),
});
const tokenJson = await tokenRes.json();
if (!tokenJson.access_token) { console.error('STOP: could not get a token. Run `firebase login`.'); process.exit(1); }
const H = { authorization: 'Bearer ' + tokenJson.access_token, 'content-type': 'application/json' };
const getJson = async (url, { allowMissing = false } = {}) => {
  const res = await fetch(url, { headers: H });
  const json = await res.json();
  if (allowMissing && res.status === 404) return null;
  if (!res.ok || json.error) { console.error(`STOP: read failed (${res.status}) ${url}: ${json.error?.message ?? ''}`); process.exit(1); }
  if (json.nextPageToken) { console.error(`STOP: ${url} has more than one page; this script reads one.`); process.exit(1); }
  return json;
};
const MIN_EXPECTED = 60; // 72 logins on 2026-11-08; far fewer means a bad read
const idOf = (d) => d.name.split('/').pop();

// Every login linked to a roster profile -> the profile it uses (a merged-away profile's login
// uses the profile it was merged into).
const roster = (await getJson(`${API}/${DB}/roster?pageSize=1000`)).documents ?? [];
const members = new Map();
const conflicts = [];
const add = (uid, profileId) => {
  if (members.has(uid) && members.get(uid) !== profileId) conflicts.push(uid);
  else members.set(uid, profileId);
};
for (const d of roster) {
  const f = d.fields ?? {};
  if (f.userId?.stringValue) add(f.userId.stringValue, f.mergedInto?.stringValue ?? idOf(d));
  for (const v of f.linkedUserIds?.arrayValue?.values ?? []) add(v.stringValue, idOf(d));
}
const coaches = roster.filter(d => d.fields?.role?.stringValue === 'Coach').length;
console.log(`roster profiles: ${roster.length} (coaches ${coaches}) | logins on the roster: ${members.size} | conflicts: ${conflicts.length}`);
if (conflicts.length) { console.error('STOP: a login points at two different profiles:', conflicts); process.exit(1); }
if (members.size < MIN_EXPECTED) { console.error(`STOP: only ${members.size} logins found; expected at least ${MIN_EXPECTED}.`); process.exit(1); }

const existing = new Set(((await getJson(`${API}/${DB}/members?pageSize=1000`)).documents ?? []).map(idOf));
const team = await getJson(`${API}/${DB}/config/team`, { allowMissing: true });
const toAdd = [...members].filter(([uid]) => !existing.has(uid));
const needCode = !team?.fields?.joinCode;
console.log(`members already: ${existing.size} | to add: ${toAdd.length} | join code: ${needCode ? `not set, will set ${JOIN_CODE}` : team.fields.joinCode.stringValue}`);

if (!APPLY) {
  console.log('DRY RUN: nothing written. Re-run with --apply.');
  process.exit(0);
}

const now = String(Date.now());
const writes = toAdd.map(([uid, profileId]) => ({
  update: { name: `${DB}/members/${uid}`, fields: { profileId: { stringValue: profileId }, joinedAt: { integerValue: now }, backfilled: { booleanValue: true } } },
  currentDocument: { exists: false },
}));
if (needCode) writes.push({
  update: { name: `${DB}/config/team`, fields: { joinCode: { stringValue: JOIN_CODE }, updatedAt: { integerValue: now }, updatedBy: { stringValue: 'backfill' } } },
  currentDocument: { exists: false },
});
if (writes.length) {
  const res = await (await fetch(`${API}/${DB}:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) })).json();
  if (res.error) { console.error('WRITE FAILED, nothing changed:', res.error.message); process.exit(1); }
  console.log(`wrote ${res.writeResults.length} documents at ${res.commitTime}`);
} else {
  console.log('nothing to write');
}

// Check: every login on the roster now has a membership.
const after = new Set(((await getJson(`${API}/${DB}/members?pageSize=1000`)).documents ?? []).map(idOf));
const missing = [...members.keys()].filter(uid => !after.has(uid));
const code = (await getJson(`${API}/${DB}/config/team`)).fields?.joinCode?.stringValue;
if (missing.length || !code) {
  console.error(`CHECK FAILED: ${missing.length} logins without membership; join code is ${code}`);
  process.exit(1);
}
console.log(`CHECK PASSED: all ${members.size} logins are members; join code is ${code}. Safe to deploy.`);
