// Simple script to remove all players using Firebase client SDK
// 
// NOTE: This script requires authentication. You have two options:
// 1. Temporarily update firestore.rules to allow unauthenticated access:
//    match /roster/{playerId} {
//      allow read, write: if true;
//    }
//    Then run: npm run deploy
//    Then run this script: node remove-all-players-simple.js
//    Then revert the rules back.
//
// 2. Delete manually via Firebase Console:
//    - Go to https://console.firebase.google.com/project/oaks-snc/firestore
//    - Select the 'roster' collection
//    - Select all documents and delete them

import 'dotenv/config';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

// Load from environment variables with fallback to hardcoded values
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyD7mPaCU8OVMGLJdPh7EcRSPgCepEszEWs",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "oaks-snc.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "oaks-snc",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "oaks-snc.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "517477387458",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:517477387458:web:7067c6c41aaeedb9efff5b",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KDQE66YWZS"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

async function removeAllPlayers() {
  try {
    // Try anonymous auth first
    try {
      await firebase.auth().signInAnonymously();
      console.log('✅ Authenticated anonymously');
    } catch (authError) {
      console.log('⚠️  Anonymous auth failed, trying without auth...');
    }

    console.log('Fetching all players...');
    const snapshot = await db.collection('roster').get();
    
    console.log(`Found ${snapshot.size} players to delete...`);
    
    if (snapshot.size === 0) {
      console.log('No players to delete.');
      process.exit(0);
    }
    
    // Delete in batches of 500 (Firestore limit)
    const batchSize = 500;
    let deleted = 0;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      batchDocs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deleted += batchDocs.length;
      console.log(`Deleted ${deleted}/${snapshot.size} players...`);
    }
    
    console.log('✅ All players removed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing players:', error);
    console.error('\n💡 Tip: You may need to temporarily update firestore.rules to allow deletion.');
    console.error('   Or delete manually via Firebase Console.');
    process.exit(1);
  }
}

removeAllPlayers();

