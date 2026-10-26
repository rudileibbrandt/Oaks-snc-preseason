import { Player, WorkoutLog, InjuryRecord, PlayerRating, RatingHistoryEntry, ProgramLevel, RosterClass } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// ---------------------------------------------------------
// 1. FIREBASE CONFIGURATION
// ---------------------------------------------------------
// Load from environment variables (Vite requires VITE_ prefix)
// Falls back to hardcoded values if env vars not set (for backwards compatibility)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD7mPaCU8OVMGLJdPh7EcRSPgCepEszEWs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "oaks-snc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "oaks-snc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "oaks-snc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "517477387458",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:517477387458:web:7067c6c41aaeedb9efff5b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KDQE66YWZS"
};

// Check if config is set
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && firebaseConfig.apiKey !== "";

// Initialize Variables
let dbInstance: any = null;

if (isConfigured) {
  try {
    // V8/Compat Initialization
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    dbInstance = firebase.firestore();
    
    // Auth is now handled by OAuth providers - no anonymous sign-in
    // Users must sign in via Google, Microsoft, or Apple

  } catch (error) {
    console.error("Firebase Init Failed:", error);
  }
} else {
  console.warn("⚠️ FIREBASE NOT CONFIGURED. USING LOCAL STORAGE FALLBACK.");
}

// ---------------------------------------------------------
// LOCAL STORAGE FALLBACK
// ---------------------------------------------------------
const ROSTER_KEY = 'oaks_roster_v1';
const LOGS_KEY = 'oaks_logs_v1';
const CLASSES_KEY = 'oaks_classes_v1';
const INJURIES_KEY = 'oaks_injuries_v1';
const RATINGS_KEY = 'oaks_ratings_v1';
const RATING_HISTORY_KEY = 'oaks_rating_history_v1';

const ls = {
  getPlayers: async (): Promise<Player[]> => {
    const data = localStorage.getItem(ROSTER_KEY);
    return data ? JSON.parse(data) : [];
  },
  addPlayer: async (name: string, role: 'Player' | 'Coach', position?: 'Forward' | 'Back'): Promise<Player> => {
    const players = await ls.getPlayers();
    const newPlayer: Player = { id: Date.now().toString(), name, role, ...(role === 'Player' && position && { position }) };
    players.push(newPlayer);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(players));
    return newPlayer;
  },
  removePlayer: async (id: string) => {
    const players = await ls.getPlayers();
    const filtered = players.filter(p => p.id !== id);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(filtered));
  },
  updatePlayerPosition: async (id: string, position: 'Forward' | 'Back') => {
    const players = await ls.getPlayers();
    const updated = players.map(p => p.id === id ? { ...p, position } : p);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(updated));
  },
  updatePlayerProgram: async (id: string, program: ProgramLevel) => {
    const players = await ls.getPlayers();
    const updated = players.map(p => p.id === id ? { ...p, program } : p);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(updated));
  },
  // Move a player to alumni (classYear) or back to the current team (null).
  setPlayerAlumni: async (id: string, classYear: number | null) => {
    const players = await ls.getPlayers();
    const updated = players.map(p => {
      if (p.id !== id) return p;
      const { alumniClass, ...rest } = p;
      return classYear === null ? rest : { ...rest, alumniClass: classYear };
    });
    localStorage.setItem(ROSTER_KEY, JSON.stringify(updated));
  },
  // Graduation and alumni years keyed by normalized roster name.
  getRosterClasses: async (): Promise<Record<string, RosterClass>> => {
    const data = localStorage.getItem(CLASSES_KEY);
    return data ? JSON.parse(data) : {};
  },
  // Merge: only the fields passed are changed.
  setRosterClass: async (key: string, _name: string, fields: RosterClass) => {
    const data = localStorage.getItem(CLASSES_KEY);
    const all = data ? JSON.parse(data) : {};
    all[key] = { ...(all[key] ?? {}), ...fields };
    localStorage.setItem(CLASSES_KEY, JSON.stringify(all));
  },
  saveLog: async (log: WorkoutLog) => {
    const data = localStorage.getItem(LOGS_KEY);
    const logs: WorkoutLog[] = data ? JSON.parse(data) : [];
    // For local storage, update log for same player/day/week combination
    const index = logs.findIndex(l => 
      l.playerId === log.playerId && 
      l.dayId === log.dayId && 
      ((l.weekYear === log.weekYear && l.week === log.week) ||
       (l.weekNumber === log.weekNumber && !log.weekYear && !log.week) ||
       (!l.weekYear && !l.week && !log.weekYear && !log.week && !l.weekNumber && !log.weekNumber))
    );
    if (index >= 0) logs[index] = log;
    else logs.push(log);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  },
  getLogs: async (): Promise<WorkoutLog[]> => {
    const data = localStorage.getItem(LOGS_KEY);
    return data ? JSON.parse(data) : [];
  },
  getPlayerLogs: async (playerId: string): Promise<WorkoutLog[]> => {
    const logs = await ls.getLogs();
    return logs.filter(l => l.playerId === playerId);
  },

  // Injury operations
  getInjuries: async (): Promise<InjuryRecord[]> => {
    const data = localStorage.getItem(INJURIES_KEY);
    return data ? JSON.parse(data) : [];
  },
  getActiveInjuries: async (): Promise<InjuryRecord[]> => {
    const injuries = await ls.getInjuries();
    return injuries.filter(i => i.currentStatus !== 'Returned to Play');
  },
  getPlayerInjuries: async (playerName: string): Promise<InjuryRecord[]> => {
    const injuries = await ls.getInjuries();
    const normalized = playerName.toLowerCase().trim();
    return injuries.filter(i => i.playerName.toLowerCase().trim() === normalized);
  },
  addInjury: async (injury: Omit<InjuryRecord, 'id'>): Promise<InjuryRecord> => {
    const injuries = await ls.getInjuries();
    const newInjury: InjuryRecord = {
      ...injury,
      id: `inj-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    injuries.push(newInjury);
    localStorage.setItem(INJURIES_KEY, JSON.stringify(injuries));
    return newInjury;
  },
  updateInjury: async (id: string, updates: Partial<InjuryRecord>): Promise<InjuryRecord | null> => {
    const injuries = await ls.getInjuries();
    const index = injuries.findIndex(i => i.id === id);
    if (index === -1) return null;
    injuries[index] = { ...injuries[index], ...updates, updatedAt: Date.now() };
    localStorage.setItem(INJURIES_KEY, JSON.stringify(injuries));
    return injuries[index];
  },
  setInjuries: async (injuries: InjuryRecord[]): Promise<void> => {
    localStorage.setItem(INJURIES_KEY, JSON.stringify(injuries));
  },

  // Rating operations
  getRatings: async (): Promise<PlayerRating[]> => {
    const data = localStorage.getItem(RATINGS_KEY);
    return data ? JSON.parse(data) : [];
  },
  getPlayerRatings: async (playerName: string): Promise<PlayerRating[]> => {
    const ratings = await ls.getRatings();
    const normalized = playerName.toLowerCase().trim();
    return ratings.filter(r => r.playerName.toLowerCase().trim() === normalized);
  },
  getMyRatingForPlayer: async (raterId: string, playerName: string): Promise<PlayerRating | null> => {
    const ratings = await ls.getRatings();
    const normalized = playerName.toLowerCase().trim();
    const found = ratings.find(r =>
      r.raterId === raterId &&
      r.playerName.toLowerCase().trim() === normalized
    );
    return found || null;
  },
  getRatingHistory: async (playerName: string, raterId?: string): Promise<RatingHistoryEntry[]> => {
    const data = localStorage.getItem(RATING_HISTORY_KEY);
    const history: RatingHistoryEntry[] = data ? JSON.parse(data) : [];
    const normalized = playerName.toLowerCase().trim();
    return history.filter(h =>
      h.playerName.toLowerCase().trim() === normalized &&
      (!raterId || h.raterId === raterId)
    ).sort((a, b) => b.timestamp - a.timestamp);
  },
  saveRating: async (rating: Omit<PlayerRating, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlayerRating> => {
    const ratings = await ls.getRatings();
    const normalized = rating.playerName.toLowerCase().trim();
    const existingIndex = ratings.findIndex(r =>
      r.raterId === rating.raterId &&
      r.playerName.toLowerCase().trim() === normalized
    );

    const now = Date.now();
    let savedRating: PlayerRating;

    if (existingIndex >= 0) {
      // Update existing rating
      savedRating = {
        ...ratings[existingIndex],
        ...rating,
        updatedAt: now,
      };
      ratings[existingIndex] = savedRating;
    } else {
      // Create new rating
      savedRating = {
        ...rating,
        id: `rating-${now}`,
        createdAt: now,
        updatedAt: now,
      };
      ratings.push(savedRating);
    }

    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));

    // Add to history
    const historyData = localStorage.getItem(RATING_HISTORY_KEY);
    const history: RatingHistoryEntry[] = historyData ? JSON.parse(historyData) : [];
    const historyEntry: RatingHistoryEntry = {
      id: `history-${now}`,
      ratingId: savedRating.id,
      playerName: savedRating.playerName,
      raterId: savedRating.raterId,
      raterName: savedRating.raterName,
      ratings: savedRating.ratings,
      timestamp: now,
    };
    history.push(historyEntry);
    localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(history));

    return savedRating;
  }
};

// ---------------------------------------------------------
// DATABASE INTERFACE
// ---------------------------------------------------------

const ensureAuth = async () => {
  if (isConfigured && dbInstance) {
    const auth = firebase.auth();
    const user = auth.currentUser;
    if (!user) {
      console.error('[ensureAuth] No user found');
      throw new Error("User must be authenticated");
    }
    console.log('[ensureAuth] User authenticated:', user.uid);
  }
};

const handleFirebaseError = (e: any, context: string) => {
  console.error(`Error in ${context}:`, e);
  if (e.code === 'permission-denied') {
    const msg = "Database Locked. Run 'npm run deploy' in terminal to update rules.";
    console.error(`🚨 ${msg}`);
    const err = new Error(msg);
    (err as any).code = 'permission-denied';
    throw err;
  }
  throw e;
};

export const db = {
  getPlayers: async (): Promise<Player[]> => {
    if (!isConfigured || !dbInstance) return ls.getPlayers();
    
    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('roster').get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Player));
    } catch (e) {
      return handleFirebaseError(e, 'getPlayers');
    }
  },

  addPlayer: async (name: string, role: 'Player' | 'Coach', position?: 'Forward' | 'Back'): Promise<Player> => {
    if (!isConfigured || !dbInstance) return ls.addPlayer(name, role, position);

    try {
      await ensureAuth();
      const auth = firebase.auth();
      const user = auth.currentUser;
      const playerData: any = { 
        name,
        role,
        ...(role === 'Player' && position && { position }),
        ...(user && { userId: user.uid, email: user.email })
      };
      const docRef = await dbInstance.collection('roster').add(playerData);
      return { id: docRef.id, ...playerData };
    } catch (e) {
      return handleFirebaseError(e, 'addPlayer');
    }
  },

  // Get or create player for authenticated user
  getOrCreatePlayerForUser: async (role?: 'Player' | 'Coach', position?: 'Forward' | 'Back', customName?: string): Promise<Player> => {
    if (!isConfigured || !dbInstance) {
      throw new Error('Database not configured');
    }

    try {
      console.log('[getOrCreatePlayerForUser] Starting...', { role, position });
      await ensureAuth();
      const auth = firebase.auth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be authenticated');
      }

      console.log('[getOrCreatePlayerForUser] User authenticated:', user.uid);

      // Try to find existing player by userId
      console.log('[getOrCreatePlayerForUser] Querying by userId...');
      const userSnapshot = await Promise.race([
        dbInstance.collection('roster')
          .where('userId', '==', user.uid)
          .limit(1)
          .get(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
        )
      ]) as any;

      console.log('[getOrCreatePlayerForUser] Query result:', userSnapshot.empty ? 'empty' : 'found');

      if (!userSnapshot.empty) {
        const doc = userSnapshot.docs[0];
        const existingData = doc.data();

        // Check if this account has been merged into another
        if (existingData.mergedInto) {
          console.log('[getOrCreatePlayerForUser] Account merged into:', existingData.mergedInto);
          try {
            const targetDoc = await dbInstance.collection('roster').doc(existingData.mergedInto).get();
            if (targetDoc.exists && !targetDoc.data().mergedInto) {
              const targetPlayer = { id: targetDoc.id, ...targetDoc.data() } as Player;
              console.log('[getOrCreatePlayerForUser] Redirecting to canonical account:', targetPlayer.id);
              return targetPlayer;
            }
            // Target gone or also merged → clear stale mergedInto, fall through
            console.log('[getOrCreatePlayerForUser] Merge target invalid, clearing mergedInto');
            await dbInstance.collection('roster').doc(doc.id).update({ mergedInto: firebase.firestore.FieldValue.delete() });
          } catch (redirectError) {
            console.error('[getOrCreatePlayerForUser] Error following merge redirect:', redirectError);
            // Clear stale mergedInto and fall through
            await dbInstance.collection('roster').doc(doc.id).update({ mergedInto: firebase.firestore.FieldValue.delete() });
          }
        }

        // Check if this is a mislinked account (linked to wrong roster player)
        // If the stored name doesn't match the Google display name and it's a roster player (not a coach account),
        // clear the link and let them create a new profile
        const googleDisplayName = user.displayName || '';
        const storedName = existingData.name || '';

        // If this looks like a roster player link (name mismatch with Google account)
        // and user has a Google display name, unlink it
        if (googleDisplayName && storedName &&
            !storedName.toLowerCase().includes(googleDisplayName.toLowerCase().split(' ')[0]) &&
            !googleDisplayName.toLowerCase().includes(storedName.toLowerCase().split(' ')[0])) {
          console.log('[getOrCreatePlayerForUser] Detected mislinked account, clearing link');
          console.log('  Google name:', googleDisplayName, '| Stored name:', storedName);
          // Clear the userId from the mislinked document
          await dbInstance.collection('roster').doc(doc.id).update({
            userId: null,
            email: null
          });
          // Fall through to create new profile
        } else {
          const player = { id: doc.id, ...doc.data() } as Player;
          console.log('[getOrCreatePlayerForUser] Found existing player:', player.id);
          return player;
        }
      }

      // Email-matching disabled - users create their own profiles
      // This prevents accidentally linking to wrong roster entries

      // No match found - if role provided, create new player from user profile
      if (role) {
        console.log('[getOrCreatePlayerForUser] Creating new player with role:', role);
        // Use custom name if provided, otherwise try to get from user profile
        let displayName = customName;
        if (!displayName) {
          displayName = user.displayName || user.email?.split('@')[0] || 'User';
        }
        const newPlayerData: any = {
          name: displayName,
          role,
          ...(role === 'Player' && position && { position }),
          userId: user.uid,
          ...(user.email && { email: user.email })
        };
        
        const docRef = await dbInstance.collection('roster').add(newPlayerData);
        const player = { id: docRef.id, ...newPlayerData } as Player;
        console.log('[getOrCreatePlayerForUser] Created new player:', player.id);
        return player;
      }

      // No role provided and no existing player - throw error
      // This is expected for new users - they need to complete registration
      console.log('[getOrCreatePlayerForUser] No player found, no role provided - user needs to register');
      const error = new Error('User profile not found. Please complete registration.');
      (error as any).code = 'PROFILE_NOT_FOUND';
      throw error;
    } catch (e: any) {
      console.error('[getOrCreatePlayerForUser] Error:', e);
      if (e.code === 'permission-denied') {
        throw new Error('Permission denied. Please check Firestore rules.');
      }
      // Re-throw the error so App.tsx can handle it
      throw e;
    }
  },

  removePlayer: async (id: string) => {
    if (!isConfigured || !dbInstance) return ls.removePlayer(id);
    
    try {
      await ensureAuth();
      await dbInstance.collection('roster').doc(id).delete();
    } catch (e) {
      return handleFirebaseError(e, 'removePlayer');
    }
  },

  updatePlayerPosition: async (id: string, position: 'Forward' | 'Back') => {
    if (!isConfigured || !dbInstance) return ls.updatePlayerPosition(id, position);

    try {
      await ensureAuth();
      await dbInstance.collection('roster').doc(id).update({ position });
    } catch (e) {
      return handleFirebaseError(e, 'updatePlayerPosition');
    }
  },

  updatePlayerProgram: async (id: string, program: ProgramLevel) => {
    if (!isConfigured || !dbInstance) return ls.updatePlayerProgram(id, program);

    try {
      await ensureAuth();
      await dbInstance.collection('roster').doc(id).update({ program });
    } catch (e) {
      return handleFirebaseError(e, 'updatePlayerProgram');
    }
  },

  setPlayerAlumni: async (id: string, classYear: number | null) => {
    if (!isConfigured || !dbInstance) return ls.setPlayerAlumni(id, classYear);

    try {
      await ensureAuth();
      await dbInstance.collection('roster').doc(id).update({
        alumniClass: classYear === null ? firebase.firestore.FieldValue.delete() : classYear,
      });
    } catch (e) {
      return handleFirebaseError(e, 'setPlayerAlumni');
    }
  },

  // Graduation and alumni years per roster player (rosterClasses/{normalized name}), shared by all
  // coaches. Works for players with no app account.
  getRosterClasses: async (): Promise<Record<string, RosterClass>> => {
    if (!isConfigured || !dbInstance) return ls.getRosterClasses();

    try {
      await ensureAuth();
      const snap = await dbInstance.collection('rosterClasses').get();
      const result: Record<string, RosterClass> = {};
      snap.forEach((doc: any) => {
        const d = doc.data();
        const entry: RosterClass = {};
        // A missing gradYear means "not set here"; null means a coach cleared it.
        if ('gradYear' in d) entry.gradYear = d.gradYear ?? null;
        if ('alumniClass' in d) entry.alumniClass = d.alumniClass ?? null;
        if ('squad' in d) entry.squad = d.squad ?? null;
        result[doc.id] = entry;
      });
      return result;
    } catch (e) {
      return handleFirebaseError(e, 'getRosterClasses');
    }
  },

  // Merge: only the fields passed are changed.
  setRosterClass: async (key: string, name: string, fields: RosterClass) => {
    if (!isConfigured || !dbInstance) return ls.setRosterClass(key, name, fields);

    try {
      await ensureAuth();
      await dbInstance.collection('rosterClasses').doc(key).set({ name, ...fields, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      return handleFirebaseError(e, 'setRosterClass');
    }
  },

  updatePlayerRole: async (id: string, role: 'Player' | 'Coach') => {
    if (!isConfigured || !dbInstance) {
      const data = localStorage.getItem('oaks_roster_v1');
      const players = data ? JSON.parse(data) : [];
      const updated = players.map((p: any) => p.id === id ? { ...p, role } : p);
      localStorage.setItem('oaks_roster_v1', JSON.stringify(updated));
      return;
    }

    try {
      await ensureAuth();
      await dbInstance.collection('roster').doc(id).update({ role });
    } catch (e) {
      return handleFirebaseError(e, 'updatePlayerRole');
    }
  },

  updatePlayerName: async (id: string, name: string) => {
    if (!isConfigured || !dbInstance) {
      // LocalStorage fallback
      const data = localStorage.getItem('oaks_roster_v1');
      const players = data ? JSON.parse(data) : [];
      const updated = players.map((p: any) => p.id === id ? { ...p, name } : p);
      localStorage.setItem('oaks_roster_v1', JSON.stringify(updated));
      return;
    }

    try {
      await ensureAuth();
      await dbInstance.collection('roster').doc(id).update({ name });
    } catch (e) {
      return handleFirebaseError(e, 'updatePlayerName');
    }
  },

  saveLog: async (log: WorkoutLog) => {
    if (!isConfigured || !dbInstance) return ls.saveLog(log);

    try {
      await ensureAuth();
      // Use playerId_dayId_weekYear_week as document ID for better querying
      // This allows multiple logs per player/day (one per ISO week)
      let logId: string;
      if (log.weekYear !== undefined && log.week !== undefined) {
        logId = `${log.playerId}_${log.dayId}_${log.weekYear}-W${log.week}`;
        console.log('[db.saveLog] Saving log with weekYear/week:', logId, { weekYear: log.weekYear, week: log.week });
      } else if (log.weekNumber !== undefined) {
        // Fallback for old logs with weekNumber
        logId = `${log.playerId}_${log.dayId}_week${log.weekNumber}`;
        console.log('[db.saveLog] Saving log with weekNumber:', logId);
      } else {
        logId = `${log.playerId}_${log.dayId}`;
        console.log('[db.saveLog] Saving log without week info:', logId);
      }
      await dbInstance.collection('logs').doc(logId).set(log);
      console.log('[db.saveLog] Successfully saved log:', logId);
    } catch (e) {
      console.error('[db.saveLog] Error saving:', e);
      return handleFirebaseError(e, 'saveLog');
    }
  },

  getLogs: async (): Promise<WorkoutLog[]> => {
    if (!isConfigured || !dbInstance) return ls.getLogs();

    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('logs').get();
      return snapshot.docs.map((doc: any) => doc.data() as WorkoutLog);
    } catch (e) {
      return handleFirebaseError(e, 'getLogs');
    }
  },

  getPlayerLogs: async (playerId: string): Promise<WorkoutLog[]> => {
    if (!isConfigured || !dbInstance) return ls.getPlayerLogs(playerId);

    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('logs').where('playerId', '==', playerId).get();
      return snapshot.docs.map((doc: any) => doc.data() as WorkoutLog);
    } catch (e) {
      return handleFirebaseError(e, 'getPlayerLogs');
    }
  },

  // ---------------------------------------------------------
  // INJURY OPERATIONS
  // ---------------------------------------------------------

  getInjuries: async (): Promise<InjuryRecord[]> => {
    if (!isConfigured || !dbInstance) {
      console.log('[db.getInjuries] Using localStorage fallback');
      return ls.getInjuries();
    }

    try {
      await ensureAuth();
      console.log('[db.getInjuries] Fetching from Firebase...');
      const snapshot = await dbInstance.collection('injuries').get();
      const injuries = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as InjuryRecord));
      console.log('[db.getInjuries] Found', injuries.length, 'injuries in Firebase');
      if (injuries.length > 0) {
        console.log('[db.getInjuries] IDs:', injuries.map((i: InjuryRecord) => i.id).join(', '));
      }
      return injuries;
    } catch (e) {
      console.error('[db.getInjuries] Error:', e);
      return handleFirebaseError(e, 'getInjuries');
    }
  },

  getActiveInjuries: async (): Promise<InjuryRecord[]> => {
    if (!isConfigured || !dbInstance) return ls.getActiveInjuries();

    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('injuries')
        .where('currentStatus', '!=', 'Returned to Play')
        .get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as InjuryRecord));
    } catch (e) {
      return handleFirebaseError(e, 'getActiveInjuries');
    }
  },

  getPlayerInjuries: async (playerName: string): Promise<InjuryRecord[]> => {
    if (!isConfigured || !dbInstance) return ls.getPlayerInjuries(playerName);

    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('injuries')
        .where('playerName', '==', playerName)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as InjuryRecord));
    } catch (e) {
      // If index not created, fall back to getting all and filtering
      console.warn('[getPlayerInjuries] Query failed, falling back to filter:', e);
      const all = await db.getInjuries();
      const normalized = playerName.toLowerCase().trim();
      return all.filter(i => i.playerName.toLowerCase().trim() === normalized);
    }
  },

  addInjury: async (injury: Omit<InjuryRecord, 'id'>): Promise<InjuryRecord> => {
    if (!isConfigured || !dbInstance) return ls.addInjury(injury);

    try {
      await ensureAuth();
      const now = Date.now();
      const injuryData = {
        ...injury,
        createdAt: injury.createdAt || now,
        updatedAt: now,
      };
      const docRef = await dbInstance.collection('injuries').add(injuryData);
      console.log('[db.addInjury] Added injury:', docRef.id);
      return { id: docRef.id, ...injuryData };
    } catch (e) {
      return handleFirebaseError(e, 'addInjury');
    }
  },

  updateInjury: async (id: string, updates: Partial<InjuryRecord>): Promise<InjuryRecord | null> => {
    console.log('[db.updateInjury] Attempting to update injury:', id);
    console.log('[db.updateInjury] Updates:', JSON.stringify(updates));

    if (!isConfigured || !dbInstance) {
      console.log('[db.updateInjury] Using localStorage fallback');
      return ls.updateInjury(id, updates);
    }

    try {
      await ensureAuth();
      const docRef = dbInstance.collection('injuries').doc(id);
      console.log('[db.updateInjury] Checking if document exists...');
      const doc = await docRef.get();
      if (!doc.exists) {
        console.error('[db.updateInjury] Document NOT FOUND in Firebase:', id);
        console.error('[db.updateInjury] This injury needs to be seeded to Firebase first');
        return null;
      }
      console.log('[db.updateInjury] Document exists, current data:', JSON.stringify(doc.data()));

      // Filter out undefined values (Firebase doesn't accept them)
      const updateData: Record<string, unknown> = { updatedAt: Date.now() };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }
      console.log('[db.updateInjury] Filtered update data:', JSON.stringify(updateData));

      await docRef.update(updateData);
      console.log('[db.updateInjury] Successfully updated injury:', id);
      return { id, ...doc.data(), ...updateData } as InjuryRecord;
    } catch (e: unknown) {
      console.error('[db.updateInjury] Error:', e);
      return handleFirebaseError(e, 'updateInjury');
    }
  },

  setInjuries: async (injuries: InjuryRecord[]): Promise<void> => {
    if (!isConfigured || !dbInstance) return ls.setInjuries(injuries);

    try {
      await ensureAuth();
      // Use batch write for efficiency
      const batch = dbInstance.batch();
      for (const injury of injuries) {
        const docRef = dbInstance.collection('injuries').doc(injury.id);
        batch.set(docRef, injury);
      }
      await batch.commit();
      console.log('[db.setInjuries] Set', injuries.length, 'injuries');
    } catch (e) {
      return handleFirebaseError(e, 'setInjuries');
    }
  },

  // ---------------------------------------------------------
  // RATING OPERATIONS (360-degree player reviews)
  // ---------------------------------------------------------

  getRatings: async (): Promise<PlayerRating[]> => {
    if (!isConfigured || !dbInstance) {
      console.log('[db.getRatings] Using localStorage fallback');
      return ls.getRatings();
    }

    try {
      await ensureAuth();
      console.log('[db.getRatings] Fetching from Firebase...');
      const snapshot = await dbInstance.collection('ratings').get();
      const ratings = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as PlayerRating));
      console.log('[db.getRatings] Found', ratings.length, 'ratings in Firebase');
      return ratings;
    } catch (e) {
      console.error('[db.getRatings] Error:', e);
      return handleFirebaseError(e, 'getRatings');
    }
  },

  getPlayerRatings: async (playerName: string): Promise<PlayerRating[]> => {
    if (!isConfigured || !dbInstance) return ls.getPlayerRatings(playerName);

    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('ratings')
        .where('playerName', '==', playerName)
        .get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as PlayerRating));
    } catch (e) {
      // Fall back to getting all and filtering if index not created
      console.warn('[getPlayerRatings] Query failed, falling back to filter:', e);
      const all = await db.getRatings();
      const normalized = playerName.toLowerCase().trim();
      return all.filter(r => r.playerName.toLowerCase().trim() === normalized);
    }
  },

  getMyRatingForPlayer: async (raterId: string, playerName: string): Promise<PlayerRating | null> => {
    if (!isConfigured || !dbInstance) return ls.getMyRatingForPlayer(raterId, playerName);

    try {
      await ensureAuth();
      const snapshot = await dbInstance.collection('ratings')
        .where('raterId', '==', raterId)
        .where('playerName', '==', playerName)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as PlayerRating;
    } catch (e) {
      // Fall back to getting all and filtering if compound index not created
      console.warn('[getMyRatingForPlayer] Query failed, falling back to filter:', e);
      const all = await db.getRatings();
      const normalized = playerName.toLowerCase().trim();
      const found = all.find(r =>
        r.raterId === raterId &&
        r.playerName.toLowerCase().trim() === normalized
      );
      return found || null;
    }
  },

  getRatingHistory: async (playerName: string, raterId?: string): Promise<RatingHistoryEntry[]> => {
    if (!isConfigured || !dbInstance) return ls.getRatingHistory(playerName, raterId);

    try {
      await ensureAuth();
      let query = dbInstance.collection('ratingHistory')
        .where('playerName', '==', playerName);

      if (raterId) {
        query = query.where('raterId', '==', raterId);
      }

      const snapshot = await query.orderBy('timestamp', 'desc').get();
      return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as RatingHistoryEntry));
    } catch (e) {
      // Fall back to getting all and filtering if index not created
      console.warn('[getRatingHistory] Query failed, falling back to filter:', e);
      const allRatings = await db.getRatings();
      const normalized = playerName.toLowerCase().trim();

      // Build history from ratings (since we may not have history collection)
      const history: RatingHistoryEntry[] = allRatings
        .filter(r =>
          r.playerName.toLowerCase().trim() === normalized &&
          (!raterId || r.raterId === raterId)
        )
        .map(r => ({
          id: `history-${r.id}`,
          ratingId: r.id,
          playerName: r.playerName,
          raterId: r.raterId,
          raterName: r.raterName,
          ratings: r.ratings,
          timestamp: r.updatedAt,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      return history;
    }
  },

  deleteRating: async (ratingId: string): Promise<boolean> => {
    if (!isConfigured || !dbInstance) {
      // LocalStorage fallback
      const data = localStorage.getItem(RATINGS_KEY);
      const ratings: PlayerRating[] = data ? JSON.parse(data) : [];
      const filtered = ratings.filter(r => r.id !== ratingId);
      if (filtered.length === ratings.length) return false;
      localStorage.setItem(RATINGS_KEY, JSON.stringify(filtered));

      // Also delete from history
      const historyData = localStorage.getItem(RATING_HISTORY_KEY);
      const history: RatingHistoryEntry[] = historyData ? JSON.parse(historyData) : [];
      const filteredHistory = history.filter(h => h.ratingId !== ratingId);
      localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(filteredHistory));

      return true;
    }

    try {
      await ensureAuth();
      console.log('[db.deleteRating] Deleting rating:', ratingId);

      const docRef = dbInstance.collection('ratings').doc(ratingId);
      const doc = await docRef.get();
      if (!doc.exists) {
        console.log('[db.deleteRating] Rating not found:', ratingId);
        return false;
      }

      await docRef.delete();
      console.log('[db.deleteRating] Deleted rating:', ratingId);

      // Also delete associated history entries
      const historySnapshot = await dbInstance.collection('ratingHistory')
        .where('ratingId', '==', ratingId)
        .get();

      if (!historySnapshot.empty) {
        const batch = dbInstance.batch();
        historySnapshot.docs.forEach((histDoc: any) => {
          batch.delete(histDoc.ref);
        });
        await batch.commit();
        console.log('[db.deleteRating] Deleted', historySnapshot.size, 'history entries');
      }

      return true;
    } catch (e) {
      console.error('[db.deleteRating] Error:', e);
      return handleFirebaseError(e, 'deleteRating');
    }
  },

  deleteRatingsByRater: async (raterId: string): Promise<number> => {
    if (!isConfigured || !dbInstance) {
      // LocalStorage fallback
      const data = localStorage.getItem(RATINGS_KEY);
      const ratings: PlayerRating[] = data ? JSON.parse(data) : [];
      const filtered = ratings.filter(r => r.raterId !== raterId);
      const deleted = ratings.length - filtered.length;
      localStorage.setItem(RATINGS_KEY, JSON.stringify(filtered));

      // Also delete from history
      const historyData = localStorage.getItem(RATING_HISTORY_KEY);
      const history: RatingHistoryEntry[] = historyData ? JSON.parse(historyData) : [];
      const filteredHistory = history.filter(h => h.raterId !== raterId);
      localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(filteredHistory));

      return deleted;
    }

    try {
      await ensureAuth();
      console.log('[db.deleteRatingsByRater] Deleting ratings by rater:', raterId);

      // Get all ratings by this rater
      const snapshot = await dbInstance.collection('ratings')
        .where('raterId', '==', raterId)
        .get();

      console.log('[db.deleteRatingsByRater] Found', snapshot.size, 'ratings to delete');

      // Delete each rating
      const batch = dbInstance.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Also delete rating history by this rater
      const historySnapshot = await dbInstance.collection('ratingHistory')
        .where('raterId', '==', raterId)
        .get();

      console.log('[db.deleteRatingsByRater] Found', historySnapshot.size, 'history entries to delete');

      const historyBatch = dbInstance.batch();
      historySnapshot.docs.forEach((doc: any) => {
        historyBatch.delete(doc.ref);
      });
      await historyBatch.commit();

      console.log('[db.deleteRatingsByRater] Done');
      return snapshot.size;
    } catch (e) {
      console.error('[db.deleteRatingsByRater] Error:', e);
      return handleFirebaseError(e, 'deleteRatingsByRater');
    }
  },

  deleteRatingsForPlayer: async (playerName: string): Promise<number> => {
    if (!isConfigured || !dbInstance) {
      // LocalStorage fallback
      const data = localStorage.getItem(RATINGS_KEY);
      const ratings: PlayerRating[] = data ? JSON.parse(data) : [];
      const normalized = playerName.toLowerCase().trim();
      const filtered = ratings.filter(r => r.playerName.toLowerCase().trim() !== normalized);
      const deleted = ratings.length - filtered.length;
      localStorage.setItem(RATINGS_KEY, JSON.stringify(filtered));
      return deleted;
    }

    try {
      await ensureAuth();
      console.log('[db.deleteRatingsForPlayer] Deleting ratings for:', playerName);

      // Get all ratings for this player
      const snapshot = await dbInstance.collection('ratings')
        .where('playerName', '==', playerName)
        .get();

      console.log('[db.deleteRatingsForPlayer] Found', snapshot.size, 'ratings to delete');

      // Delete each rating
      const batch = dbInstance.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Also delete rating history
      const historySnapshot = await dbInstance.collection('ratingHistory')
        .where('playerName', '==', playerName)
        .get();

      console.log('[db.deleteRatingsForPlayer] Found', historySnapshot.size, 'history entries to delete');

      const historyBatch = dbInstance.batch();
      historySnapshot.docs.forEach((doc: any) => {
        historyBatch.delete(doc.ref);
      });
      await historyBatch.commit();

      console.log('[db.deleteRatingsForPlayer] Done');
      return snapshot.size;
    } catch (e) {
      console.error('[db.deleteRatingsForPlayer] Error:', e);
      return handleFirebaseError(e, 'deleteRatingsForPlayer');
    }
  },

  saveRating: async (rating: Omit<PlayerRating, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlayerRating> => {
    if (!isConfigured || !dbInstance) return ls.saveRating(rating);

    try {
      await ensureAuth();
      const auth = firebase.auth();
      const user = auth.currentUser;
      const now = Date.now();

      // Include the auth UID for security rules
      const raterUserId = user?.uid || '';

      // Check for existing rating
      const existingRating = await db.getMyRatingForPlayer(rating.raterId, rating.playerName);

      let savedRating: PlayerRating;

      if (existingRating) {
        // Update existing rating
        savedRating = {
          ...existingRating,
          ...rating,
          raterUserId,
          updatedAt: now,
        };
        await dbInstance.collection('ratings').doc(existingRating.id).update({
          ratings: rating.ratings,
          raterName: rating.raterName,
          raterUserId,
          updatedAt: now,
        });
        console.log('[db.saveRating] Updated existing rating:', existingRating.id);
      } else {
        // Create new rating
        const ratingData = {
          ...rating,
          raterUserId,
          createdAt: now,
          updatedAt: now,
        };
        const docRef = await dbInstance.collection('ratings').add(ratingData);
        savedRating = { id: docRef.id, ...ratingData };
        console.log('[db.saveRating] Created new rating:', docRef.id);
      }

      // Add to history
      const historyEntry = {
        ratingId: savedRating.id,
        playerName: savedRating.playerName,
        raterId: savedRating.raterId,
        raterUserId,
        raterName: savedRating.raterName,
        ratings: savedRating.ratings,
        timestamp: now,
      };
      await dbInstance.collection('ratingHistory').add(historyEntry);
      console.log('[db.saveRating] Added history entry');

      return savedRating;
    } catch (e) {
      console.error('[db.saveRating] Error:', e);
      return handleFirebaseError(e, 'saveRating');
    }
  }
};

// ---------------------------------------------------------
// ACCOUNT MERGE (duplicate detection + consolidation)
// ---------------------------------------------------------

export interface MergeResult {
  ratingsReattributed: number;
  ratingsDeduplicated: number;
  historyReattributed: number;
  injuriesUpdated: number;
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function findDuplicatesByName(currentPlayer: Player): Promise<Player[]> {
  const allPlayers = await db.getPlayers();
  const currentNorm = normalizeName(currentPlayer.name);
  return allPlayers.filter(p =>
    p.id !== currentPlayer.id &&
    !p.mergedInto &&
    normalizeName(p.name) === currentNorm
  );
}

export async function mergeAccounts(keepPlayer: Player, removePlayer: Player): Promise<MergeResult> {
  if (keepPlayer.id === removePlayer.id) {
    throw new Error('Cannot merge an account into itself');
  }

  const result: MergeResult = {
    ratingsReattributed: 0,
    ratingsDeduplicated: 0,
    historyReattributed: 0,
    injuriesUpdated: 0,
  };

  if (!isConfigured || !dbInstance) {
    // LocalStorage path
    const ratingsData = localStorage.getItem(RATINGS_KEY);
    const ratings: PlayerRating[] = ratingsData ? JSON.parse(ratingsData) : [];

    // Build set of playerNames that keepPlayer already rated
    const keepRatedPlayers = new Set(
      ratings.filter(r => r.raterId === keepPlayer.id).map(r => r.playerName.toLowerCase().trim())
    );

    const updatedRatings: PlayerRating[] = [];
    for (const r of ratings) {
      if (r.raterId !== removePlayer.id) {
        updatedRatings.push(r);
        continue;
      }
      const playerKey = r.playerName.toLowerCase().trim();
      if (keepRatedPlayers.has(playerKey)) {
        // Duplicate — keep the keepPlayer's version, discard removePlayer's
        result.ratingsDeduplicated++;
      } else {
        // Re-attribute to keepPlayer
        updatedRatings.push({
          ...r,
          raterId: keepPlayer.id,
          raterName: keepPlayer.name,
          raterUserId: keepPlayer.userId,
        });
        result.ratingsReattributed++;
      }
    }
    localStorage.setItem(RATINGS_KEY, JSON.stringify(updatedRatings));

    // History
    const historyData = localStorage.getItem(RATING_HISTORY_KEY);
    const history: RatingHistoryEntry[] = historyData ? JSON.parse(historyData) : [];
    const updatedHistory = history.map(h => {
      if (h.raterId !== removePlayer.id) return h;
      result.historyReattributed++;
      return {
        ...h,
        raterId: keepPlayer.id,
        raterName: keepPlayer.name,
        raterUserId: keepPlayer.userId,
      };
    });
    localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(updatedHistory));

    // Injuries
    const injuriesData = localStorage.getItem(INJURIES_KEY);
    const injuries: InjuryRecord[] = injuriesData ? JSON.parse(injuriesData) : [];
    if (normalizeName(removePlayer.name) !== normalizeName(keepPlayer.name)) {
      const updatedInjuries = injuries.map(inj => {
        if (normalizeName(inj.coachSubmitting) !== normalizeName(removePlayer.name)) return inj;
        result.injuriesUpdated++;
        return { ...inj, coachSubmitting: keepPlayer.name };
      });
      localStorage.setItem(INJURIES_KEY, JSON.stringify(updatedInjuries));
    }

    // Mark removePlayer as merged
    const playersData = localStorage.getItem(ROSTER_KEY);
    const players: Player[] = playersData ? JSON.parse(playersData) : [];
    const updatedPlayers = players.map(p =>
      p.id === removePlayer.id ? { ...p, mergedInto: keepPlayer.id } : p
    );
    localStorage.setItem(ROSTER_KEY, JSON.stringify(updatedPlayers));

    return result;
  }

  // Firebase path
  await ensureAuth();

  // 1. Load ratings by removePlayer
  const removeRatingsSnap = await dbInstance.collection('ratings')
    .where('raterId', '==', removePlayer.id)
    .get();

  // Load ratings by keepPlayer to detect duplicates
  const keepRatingsSnap = await dbInstance.collection('ratings')
    .where('raterId', '==', keepPlayer.id)
    .get();

  const keepRatedPlayers = new Set(
    keepRatingsSnap.docs.map((doc: any) => (doc.data().playerName as string).toLowerCase().trim())
  );

  // Firestore batch limit is 500, use multiple batches if needed
  let batch = dbInstance.batch();
  let batchCount = 0;

  const commitBatchIfNeeded = async () => {
    if (batchCount >= 450) {
      await batch.commit();
      batch = dbInstance.batch();
      batchCount = 0;
    }
  };

  for (const doc of removeRatingsSnap.docs) {
    const data = doc.data();
    const playerKey = (data.playerName as string).toLowerCase().trim();

    if (keepRatedPlayers.has(playerKey)) {
      // Both rated same player — find keepPlayer's rating for comparison
      const keepDoc = keepRatingsSnap.docs.find((d: any) =>
        (d.data().playerName as string).toLowerCase().trim() === playerKey
      );
      if (keepDoc && data.updatedAt > keepDoc.data().updatedAt) {
        // removePlayer's is newer — update keepPlayer's doc with removePlayer's data
        batch.update(keepDoc.ref, {
          ratings: data.ratings,
          updatedAt: data.updatedAt,
        });
        batchCount++;
        await commitBatchIfNeeded();
      }
      // Delete removePlayer's rating either way
      batch.delete(doc.ref);
      batchCount++;
      result.ratingsDeduplicated++;
    } else {
      // Re-attribute to keepPlayer
      batch.update(doc.ref, {
        raterId: keepPlayer.id,
        raterName: keepPlayer.name,
        raterUserId: keepPlayer.userId || '',
      });
      batchCount++;
      result.ratingsReattributed++;
    }
    await commitBatchIfNeeded();
  }

  // 2. Re-attribute rating history
  const removeHistorySnap = await dbInstance.collection('ratingHistory')
    .where('raterId', '==', removePlayer.id)
    .get();

  for (const doc of removeHistorySnap.docs) {
    batch.update(doc.ref, {
      raterId: keepPlayer.id,
      raterName: keepPlayer.name,
      raterUserId: keepPlayer.userId || '',
    });
    batchCount++;
    result.historyReattributed++;
    await commitBatchIfNeeded();
  }

  // 3. Update injuries if names differ
  if (normalizeName(removePlayer.name) !== normalizeName(keepPlayer.name)) {
    const injuriesSnap = await dbInstance.collection('injuries')
      .where('coachSubmitting', '==', removePlayer.name)
      .get();

    for (const doc of injuriesSnap.docs) {
      batch.update(doc.ref, { coachSubmitting: keepPlayer.name });
      batchCount++;
      result.injuriesUpdated++;
      await commitBatchIfNeeded();
    }
  }

  // 4. Mark removePlayer's roster doc as merged
  const removeDocRef = dbInstance.collection('roster').doc(removePlayer.id);
  batch.update(removeDocRef, { mergedInto: keepPlayer.id });
  batchCount++;

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('[mergeAccounts] Merge complete:', result);
  return result;
}

// ---------------------------------------------------------
// RESTORE RATINGS FROM HISTORY (data recovery)
// ---------------------------------------------------------

export interface RestoreResult {
  ratingsRestored: number;
  ratingsSkipped: number;
}

export async function restoreRatingsFromHistory(playerIds: string[]): Promise<RestoreResult> {
  const result: RestoreResult = { ratingsRestored: 0, ratingsSkipped: 0 };

  if (!isConfigured || !dbInstance) {
    // LocalStorage path
    const historyData = localStorage.getItem(RATING_HISTORY_KEY);
    const history: RatingHistoryEntry[] = historyData ? JSON.parse(historyData) : [];
    const ratingsData = localStorage.getItem(RATINGS_KEY);
    const ratings: PlayerRating[] = ratingsData ? JSON.parse(ratingsData) : [];

    // Find latest history entry per (raterId, playerName)
    const latestMap = new Map<string, RatingHistoryEntry>();
    for (const h of history) {
      if (!playerIds.includes(h.raterId)) continue;
      const key = `${h.raterId}::${h.playerName.toLowerCase().trim()}`;
      const existing = latestMap.get(key);
      if (!existing || h.timestamp > existing.timestamp) {
        latestMap.set(key, h);
      }
    }

    for (const entry of latestMap.values()) {
      // Check if rating already exists
      const exists = ratings.some(r =>
        r.raterId === entry.raterId &&
        r.playerName.toLowerCase().trim() === entry.playerName.toLowerCase().trim()
      );
      if (exists) {
        result.ratingsSkipped++;
        continue;
      }
      ratings.push({
        id: `rating-restored-${Date.now()}-${result.ratingsRestored}`,
        playerName: entry.playerName,
        raterId: entry.raterId,
        raterUserId: entry.raterUserId,
        raterName: entry.raterName,
        ratings: entry.ratings,
        createdAt: entry.timestamp,
        updatedAt: entry.timestamp,
      });
      result.ratingsRestored++;
    }

    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
    return result;
  }

  // Firebase path
  await ensureAuth();
  const auth = firebase.auth();
  const user = auth.currentUser;
  if (!user) throw new Error('Must be authenticated');

  // Load all history entries for the given player IDs
  const allHistory: RatingHistoryEntry[] = [];
  for (const pid of playerIds) {
    const snap = await dbInstance.collection('ratingHistory')
      .where('raterId', '==', pid)
      .get();
    for (const doc of snap.docs) {
      allHistory.push({ id: doc.id, ...doc.data() } as RatingHistoryEntry);
    }
  }

  console.log('[restoreRatingsFromHistory] Found', allHistory.length, 'history entries for', playerIds);

  // Find latest history entry per (raterId, playerName)
  const latestMap = new Map<string, RatingHistoryEntry>();
  for (const h of allHistory) {
    const key = `${h.raterId}::${h.playerName.toLowerCase().trim()}`;
    const existing = latestMap.get(key);
    if (!existing || h.timestamp > existing.timestamp) {
      latestMap.set(key, h);
    }
  }

  console.log('[restoreRatingsFromHistory] Unique (rater, player) combos:', latestMap.size);

  // Check which ratings already exist
  const existingRatings: PlayerRating[] = [];
  for (const pid of playerIds) {
    const snap = await dbInstance.collection('ratings')
      .where('raterId', '==', pid)
      .get();
    for (const doc of snap.docs) {
      existingRatings.push({ id: doc.id, ...doc.data() } as PlayerRating);
    }
  }

  const existingKeys = new Set(
    existingRatings.map(r => `${r.raterId}::${r.playerName.toLowerCase().trim()}`)
  );

  // Recreate missing ratings
  let batch = dbInstance.batch();
  let batchCount = 0;

  for (const entry of latestMap.values()) {
    const key = `${entry.raterId}::${entry.playerName.toLowerCase().trim()}`;
    if (existingKeys.has(key)) {
      result.ratingsSkipped++;
      continue;
    }

    const newDocRef = dbInstance.collection('ratings').doc();
    batch.set(newDocRef, {
      playerName: entry.playerName,
      raterId: entry.raterId,
      raterUserId: user.uid,  // Use current auth UID so Firestore rules allow it
      raterName: entry.raterName,
      ratings: entry.ratings,
      createdAt: entry.timestamp,
      updatedAt: entry.timestamp,
    });
    batchCount++;
    result.ratingsRestored++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = dbInstance.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log('[restoreRatingsFromHistory] Restore complete:', result);
  return result;
}

// Also: clear mergedInto from a roster doc (for undo)
export async function clearMergedInto(playerId: string): Promise<void> {
  if (!isConfigured || !dbInstance) {
    const data = localStorage.getItem(ROSTER_KEY);
    const players: Player[] = data ? JSON.parse(data) : [];
    const updated = players.map(p =>
      p.id === playerId ? { ...p, mergedInto: undefined } : p
    );
    localStorage.setItem(ROSTER_KEY, JSON.stringify(updated));
    return;
  }

  await ensureAuth();
  await dbInstance.collection('roster').doc(playerId).update({
    mergedInto: firebase.firestore.FieldValue.delete(),
  });
  console.log('[clearMergedInto] Cleared mergedInto for:', playerId);
}

// ---------------------------------------------------------
// MIGRATION: 1-3 rating scale to 1-5 rating scale
// ---------------------------------------------------------
const MIGRATION_FLAG = 'oaks_ratings_migrated_v4';

function mapRatingValue(value: number): number {
  // Shift up mapping: 1→2, 2→3, 3→4
  const mapping: Record<number, number> = { 1: 2, 2: 3, 3: 4 };
  return mapping[value] ?? value;
}

function migrateRatingsObject(ratings: Record<string, number>): Record<string, number> {
  const migrated: Record<string, number> = {};
  for (const [key, value] of Object.entries(ratings)) {
    if (value >= 1 && value <= 3) {
      migrated[key] = mapRatingValue(value);
    } else {
      migrated[key] = value;
    }
  }
  return migrated;
}

function needsMigration(ratings: Record<string, number>): boolean {
  // If any value is > 3, assume already migrated
  return Object.values(ratings).every(v => v <= 3) &&
         Object.values(ratings).some(v => v >= 1);
}

export async function migrateRatingsTo5PointScale(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    console.log('[migration] Already migrated to 5-point scale, skipping');
    return;
  }

  console.log('[migration] Starting 1-3 → 1-5 rating scale migration...');

  if (isConfigured && dbInstance) {
    // Firebase migration
    try {
      await ensureAuth();

      // Migrate ratings collection
      const ratingsSnapshot = await dbInstance.collection('ratings').get();
      if (!ratingsSnapshot.empty) {
        const batch = dbInstance.batch();
        let migratedCount = 0;

        ratingsSnapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data.ratings && needsMigration(data.ratings)) {
            const migratedRatings = migrateRatingsObject(data.ratings);
            batch.update(doc.ref, { ratings: migratedRatings });
            migratedCount++;
          }
        });

        if (migratedCount > 0) {
          await batch.commit();
          console.log(`[migration] Migrated ${migratedCount} ratings in Firebase`);
        } else {
          console.log('[migration] No Firebase ratings needed migration');
        }
      }

      // Migrate ratingHistory collection
      const historySnapshot = await dbInstance.collection('ratingHistory').get();
      if (!historySnapshot.empty) {
        const batch = dbInstance.batch();
        let migratedCount = 0;

        historySnapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data.ratings && needsMigration(data.ratings)) {
            const migratedRatings = migrateRatingsObject(data.ratings);
            batch.update(doc.ref, { ratings: migratedRatings });
            migratedCount++;
          }
        });

        if (migratedCount > 0) {
          await batch.commit();
          console.log(`[migration] Migrated ${migratedCount} history entries in Firebase`);
        } else {
          console.log('[migration] No Firebase history entries needed migration');
        }
      }
    } catch (e) {
      console.error('[migration] Firebase migration error:', e);
      // Don't set the flag - allow retry on next load
      return;
    }
  } else {
    // LocalStorage migration
    const ratingsData = localStorage.getItem(RATINGS_KEY);
    if (ratingsData) {
      const ratings: PlayerRating[] = JSON.parse(ratingsData);
      let migratedCount = 0;

      const migrated = ratings.map(r => {
        if (r.ratings && needsMigration(r.ratings as unknown as Record<string, number>)) {
          migratedCount++;
          return { ...r, ratings: migrateRatingsObject(r.ratings as unknown as Record<string, number>) as unknown as typeof r.ratings };
        }
        return r;
      });

      if (migratedCount > 0) {
        localStorage.setItem(RATINGS_KEY, JSON.stringify(migrated));
        console.log(`[migration] Migrated ${migratedCount} ratings in localStorage`);
      }
    }

    const historyData = localStorage.getItem(RATING_HISTORY_KEY);
    if (historyData) {
      const history: RatingHistoryEntry[] = JSON.parse(historyData);
      let migratedCount = 0;

      const migrated = history.map(h => {
        if (h.ratings && needsMigration(h.ratings as unknown as Record<string, number>)) {
          migratedCount++;
          return { ...h, ratings: migrateRatingsObject(h.ratings as unknown as Record<string, number>) as unknown as typeof h.ratings };
        }
        return h;
      });

      if (migratedCount > 0) {
        localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(migrated));
        console.log(`[migration] Migrated ${migratedCount} history entries in localStorage`);
      }
    }
  }

  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  console.log('[migration] Migration complete, flag set');
}

// Manual migration triggered from admin panel — ignores flag, returns counts
export async function manualMigrateTo5PointScale(): Promise<{ ratingsCount: number; historyCount: number }> {
  let ratingsCount = 0;
  let historyCount = 0;

  if (isConfigured && dbInstance) {
    await ensureAuth();

    const ratingsSnapshot = await dbInstance.collection('ratings').get();
    if (!ratingsSnapshot.empty) {
      const batch = dbInstance.batch();
      ratingsSnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.ratings && needsMigration(data.ratings)) {
          batch.update(doc.ref, { ratings: migrateRatingsObject(data.ratings) });
          ratingsCount++;
        }
      });
      if (ratingsCount > 0) await batch.commit();
    }

    const historySnapshot = await dbInstance.collection('ratingHistory').get();
    if (!historySnapshot.empty) {
      const batch = dbInstance.batch();
      historySnapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        if (data.ratings && needsMigration(data.ratings)) {
          batch.update(doc.ref, { ratings: migrateRatingsObject(data.ratings) });
          historyCount++;
        }
      });
      if (historyCount > 0) await batch.commit();
    }
  } else {
    const ratingsData = localStorage.getItem(RATINGS_KEY);
    if (ratingsData) {
      const ratings: PlayerRating[] = JSON.parse(ratingsData);
      const migrated = ratings.map(r => {
        if (r.ratings && needsMigration(r.ratings as unknown as Record<string, number>)) {
          ratingsCount++;
          return { ...r, ratings: migrateRatingsObject(r.ratings as unknown as Record<string, number>) as unknown as typeof r.ratings };
        }
        return r;
      });
      if (ratingsCount > 0) localStorage.setItem(RATINGS_KEY, JSON.stringify(migrated));
    }

    const historyData = localStorage.getItem(RATING_HISTORY_KEY);
    if (historyData) {
      const history: RatingHistoryEntry[] = JSON.parse(historyData);
      const migrated = history.map(h => {
        if (h.ratings && needsMigration(h.ratings as unknown as Record<string, number>)) {
          historyCount++;
          return { ...h, ratings: migrateRatingsObject(h.ratings as unknown as Record<string, number>) as unknown as typeof h.ratings };
        }
        return h;
      });
      if (historyCount > 0) localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(migrated));
    }
  }

  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  console.log(`[migration] Manual migration complete: ${ratingsCount} feedback, ${historyCount} history`);
  return { ratingsCount, historyCount };
}