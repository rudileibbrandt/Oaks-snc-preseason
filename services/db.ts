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
let authPromise: Promise<any> = Promise.resolve();

if (isConfigured) {
  try {
    // V8/Compat Initialization
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    // const app = firebase.app(); // Removed unused variable
    const auth = firebase.auth();
    dbInstance = firebase.firestore();
    
    // Initiate Auth immediately
    authPromise = auth.signInAnonymously()
      .then(() => console.log("✅ Firebase Auth: Signed in anonymously"))
      .catch((error) => {
        console.error("❌ Auth Failed: Enable Anonymous Auth in Firebase Console -> Authentication", error);
        throw error;
      });

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
  addPlayer: async (name: string, position: 'Forward' | 'Back'): Promise<Player> => {
    const players = await ls.getPlayers();
    const newPlayer: Player = { id: Date.now().toString(), name, position };
    players.push(newPlayer);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(players));
    return newPlayer;
  },
  removePlayer: async (id: string) => {
    const players = await ls.getPlayers();
    const filtered = players.filter(p => p.id !== id);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(filtered));
  },
  saveLog: async (log: WorkoutLog) => {
    const data = localStorage.getItem(LOGS_KEY);
    const logs: WorkoutLog[] = data ? JSON.parse(data) : [];
    const index = logs.findIndex(l => l.playerId === log.playerId && l.dayId === log.dayId);
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
    try {
      await authPromise;
    } catch (e) {
      console.warn("Proceeding without auth (might fail if rules require it)");
    }
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

  addPlayer: async (name: string, position: 'Forward' | 'Back'): Promise<Player> => {
    if (!isConfigured || !dbInstance) return ls.addPlayer(name, position);

    try {
      await ensureAuth();
      const docRef = await dbInstance.collection('roster').add({ name, position });
      return { id: docRef.id, name, position };
    } catch (e) {
      return handleFirebaseError(e, 'addPlayer');
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

  saveLog: async (log: WorkoutLog) => {
    if (!isConfigured || !dbInstance) return ls.saveLog(log);

    try {
      await ensureAuth();
      const logId = `${log.playerId}_${log.dayId}`;
      await dbInstance.collection('logs').doc(logId).set(log);
    } catch (e) {
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