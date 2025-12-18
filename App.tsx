
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { AppState, Transaction, BankAccount, TransactionType, User } from './types';
import { DEFAULT_CATEGORIES } from './constants';
import { getFinancialAdvice } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(dbService.getInitialState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    const init = async () => {
      const saved = await dbService.loadState();
      if (saved) {
        setState(saved);
      }
    };
    init();
  }, []);

  // Sync state with storage
  useEffect(() => {
    dbService.saveState(state);
  }, [state]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Simulate Auth
    setTimeout(() => {
      if (state.isDemoMode) {
        if (email === 'test@example.com' && password === 'password') {
          setState(prev => ({ ...prev, isLoggedIn: true, currentUser: { id: 'u1', email, name: '測試使用者' } }));
        } else {
          setAuthError('帳號或密碼錯誤（提示：test@example.com / password）');
        }
      } else {
        // Here you would call Firebase Auth
        setAuthError('正式模式尚未連結 Firebase 實例，請先使用展示模式。');
      }
      setIsAuthLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, isLoggedIn: false, currentUser: null }));
    setActiveTab('dashboard');
  };

  const toggleMode = () => {
    setState(prev => {
      const newMode = !prev.isDemoMode;
      dbService.setMode(newMode);
      return { ...prev, isDemoMode: newMode };
    });
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: Date.now().toString() };
    setState(prev => {
      // Update account balance
      const accounts = prev.accounts.map(acc => {
        if (acc.id === t.accountId) {
          const newBalance = t.type === TransactionType.INCOME 
            ? acc.balance + t.amount 
            : acc.balance - t.amount;
          return { ...acc, balance: newBalance };
        }
        return acc;
      });

      return {
        ...prev,
        transactions: [newTransaction, ...prev.transactions],
        accounts
      };
    });
  };

  const deleteTransaction = (id: string) => {
    setState(prev => {
      const target = prev.transactions.find(t => t.id === id);
      if (!target) return prev;

      const accounts = prev.accounts.map(acc => {
        if (acc.id === target.accountId) {
          const newBalance = target.type === TransactionType.INCOME 
            ? acc.balance - target.amount 
            : acc.balance + target.amount;
          return { ...acc, balance: newBalance };
        }
        return acc;
      });

      return {
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== id),
        accounts
      };
    });
  };

  const addAccount = (name: string, bankName: string, initialBalance: number) => {
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      name,
      bankName,
      balance: initialBalance,
      color: 'bg-indigo-600'
    };
    setState(prev => ({ ...prev, accounts: [...prev.accounts, newAccount] }));
  };

  const deleteAccount = (id: string) => {
    setState(prev => ({ 
      ...prev, 
      accounts: prev.accounts.filter(a => a.id !== id),
      transactions: prev.transactions.filter(t => t.accountId !== id)
    }));
  };

  const fetchAiAdvice = async () => {
    setIsAiLoading(true);
    const advice = await getFinancialAdvice(state.transactions, state.categories, state.accounts);
    setAiAdvice(advice || "無法取得建議");
    setIsAiLoading(false);
  };

  if (!state.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="p-8">
            <div className="flex justify-center mb-8">
              <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-200">
                <i className="fa-solid fa-wallet text-3xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-800">歡迎來到 FinanceWise</h2>
            <p className="text-slate-500 text-center mt-2">請登入您的財務管理系統</p>
            
            <div className="mt-6 flex justify-center">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${state.isDemoMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {state.isDemoMode ? '展示模式正在運行' : '正式模式正在運行'}
              </span>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">電子郵件</label>
                <input 
                  type="email" 
                  name="email"
                  required
                  defaultValue={state.isDemoMode ? 'test@example.com' : ''}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
                <input 
                  type="password" 
                  name="password"
                  required
                  defaultValue={state.isDemoMode ? 'password' : ''}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {authError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center">
                  <i className="fa-solid fa-circle-exclamation mr-2"></i>
                  {authError}
                </div>
              )}

              <button 
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAuthLoading ? '登入中...' : '登入系統'}
              </button>
            </form>

            <div className="mt-6 flex flex-col space-y-3">
              <button 
                onClick={toggleMode}
                className="text-sm text-blue-600 font-medium hover:underline text-center"
              >
                切換至 {state.isDemoMode ? '正式模式' : '展示模式'}
              </button>
              <div className="text-slate-400 text-xs text-center">
                展示模式帳號：test@example.com <br/> 
                展示模式密碼：password
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        isDemoMode={state.isDemoMode}
        onToggleMode={toggleMode}
      />
      
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' && '財務總覽'}
              {activeTab === 'accounts' && '帳戶管理'}
              {activeTab === 'transactions' && '財務紀錄'}
              {activeTab === 'advice' && 'AI 理財建議'}
            </h2>
            <p className="text-slate-500">
              {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <i className="fa-solid fa-user"></i>
                </div>
                <span className="text-sm font-medium text-slate-700">{state.currentUser?.name}</span>
             </div>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard state={state} />}
        
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">您的帳戶列表</h3>
              <button 
                onClick={() => addAccount('新帳戶', '請輸入銀行名稱', 0)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all flex items-center"
              >
                <i className="fa-solid fa-plus mr-2"></i>
                新增帳戶
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group overflow-hidden">
                  <div className={`absolute top-0 right-0 w-24 h-24 ${acc.color} opacity-5 -mr-8 -mt-8 rounded-full`}></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${acc.color} text-white p-3 rounded-xl`}>
                      <i className="fa-solid fa-building-columns"></i>
                    </div>
                    <button 
                      onClick={() => deleteAccount(acc.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                  <h4 className="text-lg font-bold text-slate-800">{acc.name}</h4>
                  <p className="text-slate-400 text-sm mb-4">{acc.bankName}</p>
                  <p className="text-2xl font-bold text-slate-900">${acc.balance.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-semibold mb-6">新增交易</h3>
              <form 
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  addTransaction({
                    accountId: fd.get('accountId') as string,
                    categoryId: fd.get('categoryId') as string,
                    amount: Number(fd.get('amount')),
                    type: fd.get('type') as TransactionType,
                    date: fd.get('date') as string,
                    note: fd.get('note') as string,
                  });
                  e.currentTarget.reset();
                }}
              >
                <select name="type" required className="px-4 py-2 rounded-lg border border-slate-200 outline-none">
                  <option value={TransactionType.EXPENSE}>支出</option>
                  <option value={TransactionType.INCOME}>收入</option>
                </select>
                <select name="accountId" required className="px-4 py-2 rounded-lg border border-slate-200 outline-none">
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select name="categoryId" required className="px-4 py-2 rounded-lg border border-slate-200 outline-none">
                  {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" name="amount" required placeholder="金額" className="px-4 py-2 rounded-lg border border-slate-200 outline-none"/>
                <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-2 rounded-lg border border-slate-200 outline-none"/>
                <input type="text" name="note" placeholder="備註" className="px-4 py-2 rounded-lg border border-slate-200 outline-none md:col-span-2"/>
                <button type="submit" className="bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">確認新增</button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">日期</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">類別</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">帳戶</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">備註</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">金額</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.transactions.map(t => {
                    const category = state.categories.find(c => c.id === t.categoryId);
                    const account = state.accounts.find(a => a.id === t.accountId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${category?.color} text-white`}>
                            <i className={`fa-solid ${category?.icon} mr-1`}></i>
                            {category?.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{account?.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 italic">{t.note}</td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {state.transactions.length === 0 && (
                <div className="py-20 text-center text-slate-400">
                  <i className="fa-solid fa-box-open text-4xl mb-4"></i>
                  <p>尚無財務紀錄</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-100">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                  <i className="fa-solid fa-robot text-3xl"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-bold">AI 理財管家</h3>
                  <p className="text-blue-100">根據您的消費習慣，為您量身打造理財建議</p>
                </div>
              </div>
              <button 
                onClick={fetchAiAdvice}
                disabled={isAiLoading}
                className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center disabled:opacity-50"
              >
                {isAiLoading ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2"></i>正在分析您的財務數據...</>
                ) : (
                  <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>產生財務分析建議</>
                )}
              </button>
            </div>

            {aiAdvice && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 prose prose-slate max-w-none animate-slideUp">
                <div className="whitespace-pre-wrap leading-relaxed text-slate-700">
                  {aiAdvice.split('\n').map((line, i) => {
                    if (line.startsWith('#')) {
                      return <h3 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3">{line.replace(/^#+\s/, '')}</h3>;
                    }
                    if (line.startsWith('-')) {
                      return <li key={i} className="ml-4 mb-1">{line.replace(/^-\s/, '')}</li>;
                    }
                    return <p key={i} className="mb-2">{line}</p>;
                  })}
                </div>
              </div>
            )}
            
            {!aiAdvice && !isAiLoading && (
              <div className="py-12 flex flex-col items-center text-slate-400">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-brain text-3xl"></i>
                </div>
                <p>點擊上方按鈕，讓 AI 幫您檢視財務狀況。</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
