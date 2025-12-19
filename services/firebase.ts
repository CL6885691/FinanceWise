
import { initializeApp, getApps } from "firebase/app";
// Re-exporting functions to resolve module resolution issues in App.tsx
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Use any for complex types to avoid issues with inconsistent type definitions in the environment
let app: any = null;
let auth: any = null;
let db: any = null;

/**
 * 💡 已更新為您提供的最新 Firebase 配置資料 (financewise-d3fe5)
 */
const firebaseConfigFromCode = {
  apiKey: "AIzaSyBWaQ4UbYjrM4BlDKEYnaXHULKqy0qF6QQ",
  authDomain: "financewise-d3fe5.firebaseapp.com",
  projectId: "financewise-d3fe5",
  storageBucket: "financewise-d3fe5.firebasestorage.app",
  messagingSenderId: "120581227842",
  appId: "1:120581227842:web:7ef7f7f158425ff4b874db",
  measurementId: "G-Q8BSCNM19H"
};

// 優先檢查環境變數（適用於 GitHub Actions），若無則使用上方配置
const configStr = process.env.FIREBASE_CONFIG;
let finalConfig = firebaseConfigFromCode;

if (configStr && configStr !== "undefined" && configStr !== "null" && configStr !== "") {
  try {
    finalConfig = JSON.parse(configStr);
  } catch (e) {
    console.error("解析 FIREBASE_CONFIG 失敗，使用預設配置:", e);
  }
}

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
    console.log("Firebase 成功初始化 (financewise-d3fe5)");
  } catch (e) {
    console.error("Firebase 初始化失敗:", e);
  }
} else {
  console.warn("Firebase 配置尚未填寫或無效，系統將以『展示模式』運作。");
}

export { auth, db, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile };
