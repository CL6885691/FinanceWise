
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

const configStr = process.env.FIREBASE_CONFIG;

if (configStr) {
  try {
    const firebaseConfig = JSON.parse(configStr);
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);
    }
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

export { auth, db };
