
import { AppState, BankAccount, Transaction, User } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, DEFAULT_CATEGORIES } from '../constants';
import { db, auth } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'finance_wise_v3_storage';

class DatabaseService {
  private isFormalMode: boolean = false;

  setMode(isFormal: boolean) {
    this.isFormalMode = isFormal;
  }

  async saveState(state: AppState): Promise<void> {
    // 同步到 LocalStorage
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
        currentUser: state.currentUser,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Firebase Save Error:", e);
    }
  }

  async loadState(): Promise<Partial<AppState> | null> {
    // 優先嘗試從 LocalStorage 加載以提升速度
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let initialData = localData ? JSON.parse(localData) : null;

    if (this.isFormalMode && db && auth?.currentUser) {
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          return {
            accounts: remoteData.accounts || [],
            transactions: remoteData.transactions || [],
            currentUser: remoteData.currentUser || null
          };
        }
      } catch (e) {
        console.error("Firebase Load Error:", e);
      }
    }
    return initialData;
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
