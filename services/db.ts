import { Player, WorkoutLog } from '../types';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// ---------------------------------------------------------
// 1. FIREBASE CONFIGURATION
// ---------------------------------------------------------
// INSTRUCTIONS:
// 1. Go to console.firebase.google.com
// 2. Create a new project
// 3. Register a Web App
// 4. Copy the config object and paste it below
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Check if config is set
export const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";

// Initialize Variables
let dbInstance: any = null;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    // Authenticate anonymously so we can write to DB without forcing user login
    signInAnonymously(auth).catch((error) => {
        console.error("Auth Error", error);
    });
    dbInstance = getFirestore(app);
  } catch (error) {
    console.error("Firebase Init Failed:", error);
  }
} else {
  console.warn("⚠️ FIREBASE NOT CONFIGURED. USING LOCAL STORAGE FALLBACK.");
  console.warn("Update services/db.ts with your Firebase credentials to enable cloud sync.");
}

// ---------------------------------------------------------
// LOCAL STORAGE FALLBACK IMPLEMENTATION
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

export const db = {
  getPlayers: async (): Promise<Player[]> => {
    if (!isConfigured || !dbInstance) return ls.getPlayers();
    
    try {
      const snapshot = await getDocs(collection(dbInstance, 'roster'));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
    } catch (e) {
      console.error("Error fetching players:", e);
      return [];
    }
  },

  addPlayer: async (name: string, position: 'Forward' | 'Back'): Promise<Player> => {
    if (!isConfigured || !dbInstance) return ls.addPlayer(name, position);

    try {
      const docRef = await addDoc(collection(dbInstance, 'roster'), { name, position });
      return { id: docRef.id, name, position };
    } catch (e) {
      console.error("Error adding player:", e);
      throw e;
    }
  },

  removePlayer: async (id: string) => {
    if (!isConfigured || !dbInstance) return ls.removePlayer(id);
    
    try {
      await deleteDoc(doc(dbInstance, 'roster', id));
    } catch (e) {
      console.error("Error removing player:", e);
    }
  },

  saveLog: async (log: WorkoutLog) => {
    if (!isConfigured || !dbInstance) return ls.saveLog(log);

    try {
      // Use composite key to ensure one log per day per player
      // This prevents duplicates and allows updating existing logs easily
      const logId = `${log.playerId}_${log.dayId}`;
      await setDoc(doc(dbInstance, 'logs', logId), log);
    } catch (e) {
      console.error("Error saving log:", e);
    }
  },

  getLogs: async (): Promise<WorkoutLog[]> => {
    if (!isConfigured || !dbInstance) return ls.getLogs();

    try {
      const snapshot = await getDocs(collection(dbInstance, 'logs'));
      return snapshot.docs.map(doc => doc.data() as WorkoutLog);
    } catch (e) {
      console.error("Error fetching logs:", e);
      return [];
    }
  },

  getPlayerLogs: async (playerId: string): Promise<WorkoutLog[]> => {
    if (!isConfigured || !dbInstance) return ls.getPlayerLogs(playerId);

    try {
      const q = query(collection(dbInstance, 'logs'), where('playerId', '==', playerId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as WorkoutLog);
    } catch (e) {
      console.error("Error fetching player logs:", e);
      return [];
    }
  }
};