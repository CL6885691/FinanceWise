
import { AppState, BankAccount, Transaction } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, DEFAULT_CATEGORIES } from '../constants';
import { db, auth } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'finance_wise_state_demo';

class DatabaseService {
  private isFormalMode: boolean = false;

  setMode(isFormal: boolean) {
    this.isFormalMode = isFormal;
  }

  async saveState(state: AppState): Promise<void> {
    if (!this.isFormalMode || !db || !auth?.currentUser) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
      return;
    }

    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userRef, {
        accounts: state.accounts,
        transactions: state.transactions,
        lastUpdated: new Date().toISOString()
      });
    } catch (e) {
      console.error("Failed to save to Firebase:", e);
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
        return docSnap.data() as Partial<AppState>;
      }
    } catch (e) {
      console.error("Failed to load from Firebase:", e);
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
