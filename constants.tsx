
import { TransactionType, Category, BankAccount, Transaction } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: '餐飲', icon: 'fa-utensils', color: 'bg-orange-500', type: TransactionType.EXPENSE },
  { id: '2', name: '交通', icon: 'fa-car', color: 'bg-blue-500', type: TransactionType.EXPENSE },
  { id: '3', name: '購物', icon: 'fa-bag-shopping', color: 'bg-pink-500', type: TransactionType.EXPENSE },
  { id: '4', name: '娛樂', icon: 'fa-gamepad', color: 'bg-purple-500', type: TransactionType.EXPENSE },
  { id: '5', name: '住房', icon: 'fa-house', color: 'bg-indigo-500', type: TransactionType.EXPENSE },
  { id: '6', name: '醫療', icon: 'fa-stethoscope', color: 'bg-red-500', type: TransactionType.EXPENSE },
  { id: '7', name: '薪資', icon: 'fa-money-bill-wave', color: 'bg-green-500', type: TransactionType.INCOME },
  { id: '8', name: '獎金', icon: 'fa-gift', color: 'bg-yellow-500', type: TransactionType.INCOME },
  { id: '9', name: '投資回報', icon: 'fa-chart-line', color: 'bg-teal-500', type: TransactionType.INCOME },
];

export const INITIAL_ACCOUNTS: BankAccount[] = [
  { id: 'acc1', name: '個人儲蓄', bankName: '國泰世華', balance: 50000, color: 'bg-emerald-600' },
  { id: 'acc2', name: '日常支出', bankName: '台新銀行', balance: 12000, color: 'bg-sky-600' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 't1', accountId: 'acc1', categoryId: '7', amount: 45000, type: TransactionType.INCOME, date: new Date().toISOString().split('T')[0], note: '月薪' },
  { id: 't2', accountId: 'acc2', categoryId: '1', amount: 120, type: TransactionType.EXPENSE, date: new Date().toISOString().split('T')[0], note: '午餐' },
  { id: 't3', accountId: 'acc2', categoryId: '2', amount: 50, type: TransactionType.EXPENSE, date: new Date().toISOString().split('T')[0], note: '捷運' },
  { id: 't4', accountId: 'acc1', categoryId: '9', amount: 2000, type: TransactionType.INCOME, date: new Date().toISOString().split('T')[0], note: '股票分紅' },
];
