
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  bankName: string;
  color: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  date: string;
  note: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AppState {
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
  isDemoMode: boolean;
  isLoggedIn: boolean;
  currentUser: User | null;
}
