
import { AppState, BankAccount, Transaction, User } from '../types';
import { INITIAL_ACCOUNTS, INITIAL_TRANSACTIONS, DEFAULT_CATEGORIES } from '../constants';

const LOCAL_STORAGE_KEY = 'finance_wise_state';

// In a real application, you'd use Firebase SDK here
// Since we don't have the user's config, we provide the structure
class DatabaseService {
  private isFormalMode: boolean = false;

  setMode(isFormal: boolean) {
    this.isFormalMode = isFormal;
  }

  async saveState(state: AppState): Promise<void> {
    if (!this.isFormalMode) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } else {
      // Logic for Firebase Firestore would go here
      // await setDoc(doc(db, "users", state.currentUser.id), state);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state)); // Fallback
    }
  }

  async loadState(): Promise<AppState | null> {
    if (!this.isFormalMode) {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
      return null;
    } else {
      // Logic for Firebase would go here
      // const docRef = doc(db, "users", auth.currentUser.uid);
      // const docSnap = await getDoc(docRef);
      return null;
    }
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
