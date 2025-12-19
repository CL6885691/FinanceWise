
import { AppState, BankAccount, Transaction, User } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, DEFAULT_CATEGORIES } from '../constants';
import { db, auth } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'finance_wise_state_v2';

class DatabaseService {
  private isFormalMode: boolean = false;

  setMode(isFormal: boolean) {
    this.isFormalMode = isFormal;
  }

  async saveState(state: AppState): Promise<void> {
    // 儲存至本地作為備份或展示模式
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      accounts: state.accounts,
      transactions: state.transactions,
      currentUser: state.currentUser
    }));

    if (!this.isFormalMode || !db || !auth?.currentUser) return;

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userRef, {
        accounts: state.accounts,
        transactions: state.transactions,
        userProfile: state.currentUser,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save to Firebase Firestore:", e);
    }
  }

  async loadState(): Promise<Partial<AppState> | null> {
    if (!this.isFormalMode || !db || !auth?.currentUser) {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    }

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          accounts: data.accounts || [],
          transactions: data.transactions || [],
          currentUser: data.userProfile || null
        };
      }
    } catch (e) {
      console.error("Failed to load from Firebase Firestore:", e);
    }
    return null;
  }

  getInitialState(): AppState {
    return {
      accounts: INITIAL_ACCOUNTS,
      transactions: INITIAL_TRANSACTIONS,
      categories: DEFAULT_CATEGORIES,
      isDemoMode: true,
      isLoggedIn: false,
      currentUser: null,
    };
  }
}

export const dbService = new DatabaseService();
