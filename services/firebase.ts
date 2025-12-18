
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/**
 * 💡 已填入您的 Firebase 配置資料
 */
const firebaseConfigFromCode = {
  apiKey: "AIzaSyD5RAzIF5t16lShgtfQ53L3SoKcO4QsKxY",
  authDomain: "smartwealth-ai-d7ac4.firebaseapp.com",
  projectId: "smartwealth-ai-d7ac4",
  storageBucket: "smartwealth-ai-d7ac4.firebasestorage.app",
  messagingSenderId: "646783215976",
  appId: "1:646783215976:web:00e2d7ea9e900004300edd",
  measurementId: "G-SHY324MD68"
};

// 優先檢查環境變數（適用於 GitHub Actions），若無則使用上方配置
const configStr = process.env.FIREBASE_CONFIG;
const finalConfig = configStr ? JSON.parse(configStr) : firebaseConfigFromCode;

// 檢查是否已填寫必要的 apiKey
const isConfigValid = finalConfig && finalConfig.apiKey && finalConfig.apiKey !== "";

if (isConfigValid) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(finalConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase 成功初始化");
  } catch (e) {
    console.error("Firebase 初始化失敗:", e);
  }
} else {
  console.warn("Firebase 配置尚未填寫或無效，系統將以『展示模式』運作。");
}

export { auth, db };
