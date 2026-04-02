#!/usr/bin/env node

/**
 * Sync Oaks S&C data from Firestore to local JSON files for OpenClaw.
 *
 * Uses the Firebase CLI's stored refresh token to authenticate, then
 * queries the Firestore REST API to export roster, ratings, and injuries.
 *
 * Output directory: ~/.openclaw/workspace/data/oaks-snc/
 *
 * Usage:
 *   node scripts/sync-to-openclaw.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT_ID = "oaks-snc";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Firebase CLI OAuth client (public, same for all Firebase CLI users)
const CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

const OUTPUT_DIR = join(homedir(), ".openclaw", "workspace", "data", "oaks-snc");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getRefreshToken() {
  const configPath = join(
    homedir(),
    ".config",
    "configstore",
    "firebase-tools.json"
  );
  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  const token = config?.tokens?.refresh_token;
  if (!token) {
    throw new Error(
      "No refresh token found in firebase-tools.json. Run `firebase login` first."
    );
  }
  return token;
}

async function getAccessToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/** Convert a Firestore REST API Value to a plain JS value. */
function parseValue(v) {
  if (v === undefined || v === null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v)
    return (v.arrayValue.values || []).map(parseValue);
  if ("mapValue" in v) return parseFields(v.mapValue.fields || {});
  return v;
}

function parseFields(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = parseValue(val);
  }
  return obj;
}

/** Fetch all documents from a Firestore collection (handles pagination). */
async function fetchCollection(accessToken, collection) {
  const docs = [];
  let pageToken = null;

  while (true) {
    const url = new URL(`${FIRESTORE_BASE}/${collection}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Firestore fetch ${collection} failed (${res.status}): ${text}`
      );
    }

    const data = await res.json();

    if (data.documents) {
      for (const doc of data.documents) {
        const id = doc.name.split("/").pop();
        const fields = parseFields(doc.fields || {});
        docs.push({ id, ...fields });
      }
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return docs;
}

// ---------------------------------------------------------------------------
// Ratings summary
// ---------------------------------------------------------------------------

const SKILL_KEYS = [
  "passCatch",
  "attackingThreat",
  "tackleTech",
  "physicality",
  "tacticalAwareness",
  "character",
  "overallSense",
  "speedPace",
  "tacticalKicking",
  "goalKicking",
];

const SKILL_LABELS = {
  passCatch: "Pass & Catch",
  attackingThreat: "Attacking Threat",
  tackleTech: "Tackle Technique",
  physicality: "Physicality",
  tacticalAwareness: "Tactical Awareness",
  character: "Character",
  overallSense: "Overall Rugby Sense",
  speedPace: "Speed / Pace",
  tacticalKicking: "Tactical Kicking",
  goalKicking: "Goal Kicking",
};

function buildRatingsSummary(ratings) {
  // Group ratings by playerName
  const byPlayer = {};
  for (const r of ratings) {
    const name = r.playerName;
    if (!byPlayer[name]) byPlayer[name] = [];
    byPlayer[name].push(r);
  }

  const players = [];

  for (const [playerName, playerRatings] of Object.entries(byPlayer)) {
    const numRaters = playerRatings.length;
    const skills = {};
    let overallSum = 0;
    let overallCount = 0;

    for (const key of SKILL_KEYS) {
      const values = playerRatings
        .map((r) => r.ratings?.[key])
        .filter((v) => typeof v === "number");

      if (values.length === 0) {
        skills[key] = { avg: null, min: null, max: null, variance: null };
        continue;
      }

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const variance =
        values.length > 1
          ? values.reduce((sum, v) => sum + (v - avg) ** 2, 0) /
            (values.length - 1)
          : 0;

      skills[key] = {
        avg: Math.round(avg * 100) / 100,
        min,
        max,
        variance: Math.round(variance * 100) / 100,
      };

      overallSum += avg;
      overallCount++;
    }

    const overallAvg =
      overallCount > 0
        ? Math.round((overallSum / overallCount) * 100) / 100
        : null;

    players.push({
      playerName,
      numRaters,
      overallAvg,
      skills,
    });
  }

  // Sort by overall average descending
  players.sort((a, b) => (b.overallAvg ?? 0) - (a.overallAvg ?? 0));

  return {
    generatedAt: new Date().toISOString(),
    totalPlayers: players.length,
    totalRatings: ratings.length,
    scale: "1-5 (1=needs work, 2=developing, 3=competent, 4=strong, 5=elite)",
    skillKeys: SKILL_KEYS,
    skillLabels: SKILL_LABELS,
    players,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Syncing Oaks S&C data to OpenClaw...\n");

  // 1. Auth
  console.log("1. Authenticating with Firebase...");
  const refreshToken = getRefreshToken();
  const accessToken = await getAccessToken(refreshToken);
  console.log("   Authenticated.\n");

  // 2. Fetch collections in parallel
  console.log("2. Fetching Firestore collections...");
  const [roster, ratings, injuries] = await Promise.all([
    fetchCollection(accessToken, "roster"),
    fetchCollection(accessToken, "ratings"),
    fetchCollection(accessToken, "injuries"),
  ]);
  console.log(`   roster:   ${roster.length} documents`);
  console.log(`   ratings:  ${ratings.length} documents`);
  console.log(`   injuries: ${injuries.length} documents\n`);

  // 3. Build summary
  console.log("3. Building ratings summary...");
  const summary = buildRatingsSummary(ratings);
  console.log(`   ${summary.totalPlayers} players summarized.\n`);

  // 4. Write files
  console.log("4. Writing files...");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = {
    "roster.json": roster,
    "ratings.json": ratings,
    "injuries.json": injuries,
    "ratings-summary.json": summary,
  };

  for (const [filename, data] of Object.entries(files)) {
    const path = join(OUTPUT_DIR, filename);
    writeFileSync(path, JSON.stringify(data, null, 2));
    console.log(`   ${path}`);
  }

  console.log("\nSync complete.");
}

main().catch((err) => {
  console.error("Sync failed:", err.message);
  process.exit(1);
});
