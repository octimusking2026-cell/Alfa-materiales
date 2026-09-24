// Firebase initialization and utilities for Alfa Materiales
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { 
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { 
  getStorage 
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js';

export const firebaseConfig = {
  projectId: "orbital-virtue-bds98",
  appId: "1:1085784784323:web:7a8939c2caf92ee1cc5176",
  apiKey: "AIzaSyB8AWJJ4dIO8RR3V2H9_CdDCIU_0HXz2yw",
  authDomain: "orbital-virtue-bds98.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-alfamateriales-e68260a3-a595-4e76-af5a-11b12512991b",
  storageBucket: "orbital-virtue-bds98.firebasestorage.app",
  messagingSenderId: "1085784784323",
  measurementId: "",
  oAuthClientId: "1085784784323-ter0qa41q3fgdbk7580smkfqhkj7bepc.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

export const ADMIN_EMAIL = "octimusking2026@gmail.com";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to Firestore
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: client is offline.");
    }
  }
}

testConnection();
