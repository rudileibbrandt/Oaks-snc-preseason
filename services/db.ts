import { Player, WorkoutLog } from '../types';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// ---------------------------------------------------------
// 1. FIREBASE CONFIGURATION
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD7mPaCU8OVMGLJdPh7EcRSPgCepEszEWs",
  authDomain: "oaks-snc.firebaseapp.com",
  projectId: "oaks-snc",
  storageBucket: "oaks-snc.firebasestorage.app",
  messagingSenderId: "517477387458",
  appId: "1:517477387458:web:7067c6c41aaeedb9efff5b",
  measurementId: "G-KDQE66YWZS"
};

// Check if config is set
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";

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
        const player = { id: doc.id, ...doc.data() } as Player;
        console.log('[getOrCreatePlayerForUser] Found existing player:', player.id);
        return player;
      }

      // Try to find by email
      if (user.email) {
        console.log('[getOrCreatePlayerForUser] Querying by email...');
        let emailSnapshot;
        try {
          emailSnapshot = await Promise.race([
            dbInstance.collection('roster')
              .where('email', '==', user.email)
              .limit(1)
              .get(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout after 10 seconds')), 10000)
            )
          ]) as any;
        } catch (queryError: any) {
          console.error('[getOrCreatePlayerForUser] Email query error:', queryError);
          if (queryError.code === 'failed-precondition') {
            throw new Error('Database index required. Please check Firebase Console for index creation.');
          }
          throw queryError;
        }

        if (!emailSnapshot.empty) {
          const doc = emailSnapshot.docs[0];
          // Update with userId
          await dbInstance.collection('roster').doc(doc.id).update({ userId: user.uid });
          const player = { id: doc.id, ...doc.data(), userId: user.uid } as Player;
          console.log('[getOrCreatePlayerForUser] Found by email, updated:', player.id);
          return player;
        }
      }

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
  }
};