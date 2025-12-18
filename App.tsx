
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { auth } from './services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { AppState, Transaction, BankAccount, TransactionType } from './types';
import { getFinancialAdvice } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(dbService.getInitialState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Monitor Firebase Authentication state
  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth instance is not available. App is in Demo Mode.");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        dbService.setMode(true);
        const savedData = await dbService.loadState();
        
        setState(prev => ({
          ...prev,
          isLoggedIn: true,
          isDemoMode: false,
          currentUser: { 
            id: firebaseUser.uid, 
            email: firebaseUser.email || '', 
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '使用者' 
          },
          accounts: savedData?.accounts || prev.accounts,
          transactions: savedData?.transactions || prev.transactions
        }));
      } else {
        // If logged out, reset to initial state (but keep demo flag if it was toggled)
        setState(prev => ({ 
          ...dbService.getInitialState(), 
          isDemoMode: prev.isDemoMode 
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync data to persistence layer
  useEffect(() => {
    if (state.isLoggedIn) {
      dbService.saveState(state);
    }
  }, [state.accounts, state.transactions, state.isLoggedIn]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Demo Mode Logic
    if (state.isDemoMode) {
      setTimeout(() => {
        if (email === 'test@example.com' && password === 'password') {
          setState(prev => ({ 
            ...prev, 
            isLoggedIn: true, 
            currentUser: { id: 'demo-user', email, name: '測試體驗官' } 
          }));
        } else {
          setAuthError('展示模式帳號或密碼錯誤（提示：test@example.com / password）');
        }
        setIsAuthLoading(false);
      }, 800);
      return;
    }

    // Formal Mode Logic (Firebase)
    if (!auth) {
      setAuthError('系統偵測到未設定 Firebase。請切換至展示模式或檢查環境變數配置。');
      setIsAuthLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = '認證失敗。';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') message = '帳號或密碼錯誤。';
      if (err.code === 'auth/email-already-in-use') message = '此電子郵件已被註冊。';
      if (err.code === 'auth/weak-password') message = '密碼強度不足（至少 6 位）。';
      setAuthError(message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth && !state.isDemoMode) {
      await signOut(auth);
    }
    setState(dbService.getInitialState());
    setActiveTab('dashboard');
  };

  const toggleMode = () => {
    setState(prev => {
      const nextDemoMode = !prev.isDemoMode;
      dbService.setMode(!nextDemoMode);
      return { 
        ...dbService.getInitialState(),
        isDemoMode: nextDemoMode 
      };
    });
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: Date.now().toString() };
    setState(prev => {
      const accounts = prev.accounts.map(acc => {
        if (acc.id === t.accountId) {
          const newBalance = t.type === TransactionType.INCOME ? acc.balance + t.amount : acc.balance - t.amount;
          return { ...acc, balance: newBalance };
        }
        return acc;
      });
      return { ...prev, transactions: [newTransaction, ...prev.transactions], accounts };
    });
  };

  const deleteTransaction = (id: string) => {
    setState(prev => {
      const target = prev.transactions.find(t => t.id === id);
      if (!target) return prev;
      const accounts = prev.accounts.map(acc => {
        if (acc.id === target.accountId) {
          const newBalance = target.type === TransactionType.INCOME ? acc.balance - target.amount : acc.balance + target.amount;
          return { ...acc, balance: newBalance };
        }
        return acc;
      });
      return { ...prev, transactions: prev.transactions.filter(t => t.id !== id), accounts };
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
    setAiAdvice(advice);
    setIsAiLoading(false);
  };

  if (!state.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-200">
                <i className="fa-solid fa-wallet text-3xl"></i>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-slate-800">FinanceWise</h2>
            <p className="text-slate-500 text-center mt-2">{isRegistering ? '立即註冊新帳戶' : '管理您的個人財富'}</p>
            
            <div className="mt-6 flex justify-center">
              <button 
                onClick={toggleMode}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${state.isDemoMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
              >
                模式：{state.isDemoMode ? '展示體驗中' : '正式雲端同步'} (點此切換)
              </button>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleAuth}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">電子郵件</label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  placeholder="name@example.com" 
                  defaultValue={state.isDemoMode ? 'test@example.com' : ''}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密碼</label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  placeholder="••••••••" 
                  defaultValue={state.isDemoMode ? 'password' : ''}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                />
              </div>
              
              {authError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center animate-fadeIn">
                  <i className="fa-solid fa-circle-exclamation mr-2"></i>
                  {authError}
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isAuthLoading} 
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
              >
                {isAuthLoading ? (
                  <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i>處理中...</>
                ) : (
                  isRegistering ? '完成註冊' : '登入系統'
                )}
              </button>
            </form>

            <button 
              onClick={() => setIsRegistering(!isRegistering)} 
              className="w-full mt-6 text-sm text-slate-500 hover:text-blue-600 transition-colors"
            >
              {isRegistering ? '已經有帳號？返回登入' : '還沒有帳號？立即免費註冊'}
            </button>

            {state.isDemoMode && (
              <div className="mt-6 p-3 bg-amber-50 rounded-xl text-[10px] text-amber-800 text-center">
                展示帳號：test@example.com | 密碼：password
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} isDemoMode={state.isDemoMode} onToggleMode={toggleMode} />
      
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' ? '財務總覽' : 
               activeTab === 'accounts' ? '帳戶管理' : 
               activeTab === 'transactions' ? '財務紀錄' : 'AI 理財專家建議'}
            </h2>
            <p className="text-slate-500">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <i className="fa-solid fa-user"></i>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-700 leading-none">{state.currentUser?.name}</span>
              <span className="text-[10px] text-slate-400">{state.isDemoMode ? '展示模式' : '正式模式'}</span>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard state={state} />}

        {activeTab === 'accounts' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-800">您的資產帳戶</h3>
              <button 
                onClick={() => addAccount('新銀行帳戶', '請輸入銀行', 0)} 
                className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all flex items-center text-sm"
              >
                <i className="fa-solid fa-plus mr-2"></i>新增帳戶
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group relative hover:border-blue-200 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${acc.color} text-white p-3 rounded-xl shadow-inner`}>
                      <i className="fa-solid fa-building-columns"></i>
                    </div>
                    <button 
                      onClick={() => deleteAccount(acc.id)} 
                      className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-800">{acc.name}</h4>
                  <p className="text-slate-400 text-sm mb-4">{acc.bankName}</p>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-slate-400 text-sm font-medium">$</span>
                    <p className="text-2xl font-black text-slate-900">{acc.balance.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {state.accounts.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl">
                   <p className="text-slate-400">目前沒有帳戶，請點擊右上角新增。</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h4 className="text-sm font-bold text-slate-800 mb-4">記一筆新交易</h4>
              <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const amount = Number(fd.get('amount'));
                if (amount <= 0) return alert('金額必須大於 0');
                
                addTransaction({
                  accountId: fd.get('accountId') as string,
                  categoryId: fd.get('categoryId') as string,
                  amount: amount,
                  type: fd.get('type') as TransactionType,
                  date: fd.get('date') as string,
                  note: fd.get('note') as string,
                });
                e.currentTarget.reset();
              }}>
                <select name="type" className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={TransactionType.EXPENSE}>支出 (-)</option>
                  <option value={TransactionType.INCOME}>收入 (+)</option>
                </select>
                <select name="accountId" className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select name="categoryId" className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500">
                  {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" name="amount" placeholder="金額" className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" required />
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" required />
                <input type="text" name="note" placeholder="備註（如：午餐、薪水...）" className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2" />
                <button type="submit" className="bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100">新增紀錄</button>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">日期</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">類別</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">帳戶</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">金額</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">操作</th>
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
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black text-white ${category?.color} shadow-sm`}>
                              {category?.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{account?.name || '未知帳戶'}</td>
                          <td className={`px-6 py-4 text-sm font-black text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 transition-all">
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {state.transactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">暫無任何交易紀錄</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="space-y-6 max-w-4xl animate-fadeIn">
            <div className="bg-gradient-to-br from-blue-700 to-indigo-900 p-10 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <i className="fa-solid fa-brain text-9xl"></i>
              </div>
              <div className="relative z-10">
                <div className="flex items-center space-x-5 mb-8">
                  <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-xl border border-white/20">
                    <i className="fa-solid fa-wand-magic-sparkles text-4xl"></i>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black">AI 頂級理財諮詢</h3>
                    <p className="text-blue-100/80 font-medium">由 Gemini-3-Pro 提供深度的財務結構分析</p>
                  </div>
                </div>
                <button 
                  onClick={fetchAiAdvice} 
                  disabled={isAiLoading} 
                  className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-black hover:scale-105 active:scale-95 transition-all flex items-center shadow-xl disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <><i className="fa-solid fa-spinner fa-spin mr-3"></i>正在進行深度邏輯運算...</>
                  ) : (
                    <><i className="fa-solid fa-bolt mr-3"></i>立即生成專業報告</>
                  )}
                </button>
              </div>
            </div>

            {aiAdvice && (
              <div className="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100 animate-slideUp">
                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
                  {aiAdvice.split('\n').map((line, i) => {
                    if (line.startsWith('【')) {
                      return <h4 key={i} className="text-xl font-black text-slate-900 mt-8 mb-4 border-l-4 border-blue-600 pl-4">{line}</h4>;
                    }
                    if (line.startsWith('-')) {
                      return <li key={i} className="ml-6 mb-2 font-medium">{line.replace(/^-\s/, '')}</li>;
                    }
                    if (line.trim() === '') return <div key={i} className="h-4" />;
                    return <p key={i} className="mb-4">{line}</p>;
                  })}
                </div>
                <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-300">
                   <span>報告生成時間: {new Date().toLocaleString()}</span>
                   <span>Powered by Google Gemini-3-Pro-Preview</span>
                </div>
              </div>
            )}
            
            {!aiAdvice && !isAiLoading && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-300">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                  <i className="fa-solid fa-robot text-4xl"></i>
                </div>
                <p className="font-medium">您的財務數據已準備就緒，點擊上方按鈕開始 AI 診斷。</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
