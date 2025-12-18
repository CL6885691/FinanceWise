
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { auth } from './services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
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

  // Monitor Firebase Auth changes
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        dbService.setMode(true);
        const savedData = await dbService.loadState();
        setState(prev => ({
          ...prev,
          isLoggedIn: true,
          isDemoMode: false,
          currentUser: { id: user.uid, email: user.email || '', name: user.displayName || user.email?.split('@')[0] || '使用者' },
          accounts: savedData?.accounts || prev.accounts,
          transactions: savedData?.transactions || prev.transactions
        }));
      } else {
        setState(prev => ({ ...prev, isLoggedIn: false, currentUser: null }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync state (Demo mode)
  useEffect(() => {
    if (state.isLoggedIn) {
      dbService.saveState(state);
    }
  }, [state.accounts, state.transactions]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (state.isDemoMode) {
      if (email === 'test@example.com' && password === 'password') {
        setState(prev => ({ ...prev, isLoggedIn: true, currentUser: { id: 'demo', email, name: '測試使用者' } }));
      } else {
        setAuthError('展示模式帳號或密碼錯誤。');
      }
      setIsAuthLoading(false);
      return;
    }

    if (!auth) {
      setAuthError('Firebase 未配置，請使用展示模式。');
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
      setAuthError(err.message || '認證失敗，請檢查輸入內容。');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
    setState(dbService.getInitialState());
    setActiveTab('dashboard');
  };

  const toggleMode = () => {
    setState(prev => {
      const nextMode = !prev.isDemoMode;
      dbService.setMode(!nextMode);
      return { ...prev, isDemoMode: nextMode };
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
    const newAccount: BankAccount = { id: Date.now().toString(), name, bankName, balance: initialBalance, color: 'bg-indigo-600' };
    setState(prev => ({ ...prev, accounts: [...prev.accounts, newAccount] }));
  };

  const deleteAccount = (id: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id), transactions: prev.transactions.filter(t => t.accountId !== id) }));
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
            <p className="text-slate-500 text-center mt-2">{isRegistering ? '註冊新帳戶' : '歡迎回來'}</p>
            
            <div className="mt-6 flex justify-center">
              <button 
                onClick={toggleMode}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${state.isDemoMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
              >
                模式：{state.isDemoMode ? '展示中' : '正式環境'} (點擊切換)
              </button>
            </div>

            <form className="mt-8 space-y-4" onSubmit={handleAuth}>
              <input type="email" name="email" required placeholder="電子郵件" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="password" name="password" required placeholder="密碼" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
              
              {authError && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs">{authError}</div>}
              
              <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                {isAuthLoading ? '處理中...' : (isRegistering ? '立即註冊' : '登入系統')}
              </button>
            </form>

            <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-sm text-slate-500 hover:text-blue-600 transition-colors">
              {isRegistering ? '已有帳號？返回登入' : '還沒有帳號？點此註冊'}
            </button>
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
            <h2 className="text-2xl font-bold text-slate-800">{activeTab === 'dashboard' ? '財務總覽' : activeTab === 'accounts' ? '帳戶管理' : activeTab === 'transactions' ? '財務紀錄' : 'AI 理財建議'}</h2>
            <p className="text-slate-500">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><i className="fa-solid fa-user"></i></div>
            <span className="text-sm font-medium">{state.currentUser?.name}</span>
          </div>
        </header>
        {activeTab === 'dashboard' && <Dashboard state={state} />}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">您的帳戶列表</h3>
              <button onClick={() => addAccount('新帳戶', '請輸入銀行', 0)} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 flex items-center"><i className="fa-solid fa-plus mr-2"></i>新增</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${acc.color} text-white p-3 rounded-xl`}><i className="fa-solid fa-building-columns"></i></div>
                    <button onClick={() => deleteAccount(acc.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                  <h4 className="font-bold">{acc.name}</h4>
                  <p className="text-slate-400 text-sm mb-2">{acc.bankName}</p>
                  <p className="text-xl font-bold">${acc.balance.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={(e) => {
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
              }}>
                <select name="type" className="px-4 py-2 rounded-lg border border-slate-200"><option value={TransactionType.EXPENSE}>支出</option><option value={TransactionType.INCOME}>收入</option></select>
                <select name="accountId" className="px-4 py-2 rounded-lg border border-slate-200">{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <select name="categoryId" className="px-4 py-2 rounded-lg border border-slate-200">{state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <input type="number" name="amount" placeholder="金額" className="px-4 py-2 rounded-lg border border-slate-200" required />
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-2 rounded-lg border border-slate-200" required />
                <input type="text" name="note" placeholder="備註" className="px-4 py-2 rounded-lg border border-slate-200 md:col-span-2" />
                <button type="submit" className="bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">新增交易</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr><th className="px-6 py-4 text-xs font-semibold text-slate-500">日期</th><th className="px-6 py-4 text-xs font-semibold text-slate-500">類別</th><th className="px-6 py-4 text-xs font-semibold text-slate-500">帳戶</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 text-right">金額</th><th className="px-6 py-4 text-xs font-semibold text-slate-500 text-center">操作</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.transactions.map(t => {
                    const category = state.categories.find(c => c.id === t.categoryId);
                    const account = state.accounts.find(a => a.id === t.accountId);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm">{t.date}</td>
                        <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-xs text-white ${category?.color}`}>{category?.name}</span></td>
                        <td className="px-6 py-4 text-sm">{account?.name}</td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center"><button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-red-500 transition-all"><i className="fa-solid fa-trash-can"></i></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'advice' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl">
              <div className="flex items-center space-x-4 mb-6">
                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md"><i className="fa-solid fa-robot text-3xl"></i></div>
                <div><h3 className="text-2xl font-bold">AI 高級財務報告</h3><p className="text-blue-100">由 Gemini-3-Pro 提供深度的邏輯分析與建議</p></div>
              </div>
              <button onClick={fetchAiAdvice} disabled={isAiLoading} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 flex items-center disabled:opacity-50">
                {isAiLoading ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>分析中...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>立即生成專業建議</>}
              </button>
            </div>
            {aiAdvice && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 prose prose-slate max-w-none animate-slideUp">
                <div className="whitespace-pre-wrap leading-relaxed text-slate-700">
                  {aiAdvice.split('\n').map((line, i) => {
                    if (line.startsWith('【')) return <h3 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3 border-l-4 border-blue-500 pl-3">{line}</h3>;
                    if (line.startsWith('-')) return <li key={i} className="ml-4 mb-1">{line.replace(/^-\s/, '')}</li>;
                    return <p key={i} className="mb-2">{line}</p>;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
