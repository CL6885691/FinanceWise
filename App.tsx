
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
  
  // 編輯帳戶用的 Modal 狀態
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  useEffect(() => {
    if (!auth) return;
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
        setState(prev => ({ ...dbService.getInitialState(), isDemoMode: prev.isDemoMode }));
      }
    });
    return () => unsubscribe();
  }, []);

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
      }, 500);
      return;
    }

    if (!auth) {
      setAuthError('Firebase 未正確初始化。');
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
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (auth && !state.isDemoMode) await signOut(auth);
    setState(dbService.getInitialState());
    setActiveTab('dashboard');
  };

  const toggleMode = () => {
    setState(prev => {
      const nextDemoMode = !prev.isDemoMode;
      dbService.setMode(!nextDemoMode);
      return { ...dbService.getInitialState(), isDemoMode: nextDemoMode };
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

  const handleAddAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newAcc: BankAccount = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      bankName: fd.get('bankName') as string,
      balance: Number(fd.get('balance')),
      color: fd.get('color') as string || 'bg-blue-600'
    };
    setState(prev => ({ ...prev, accounts: [...prev.accounts, newAcc] }));
    e.currentTarget.reset();
  };

  const handleUpdateAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingAccount) return;
    const fd = new FormData(e.currentTarget);
    setState(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => acc.id === editingAccount.id ? {
        ...acc,
        name: fd.get('name') as string,
        bankName: fd.get('bankName') as string,
        balance: Number(fd.get('balance')),
      } : acc)
    }));
    setEditingAccount(null);
  };

  const deleteAccount = (id: string) => {
    if (!confirm('確定要刪除此帳戶嗎？所有相關交易也會被移除。')) return;
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
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
          <div className="p-10">
            <div className="flex justify-center mb-8">
              <div className="bg-blue-600 p-5 rounded-2xl text-white shadow-xl shadow-blue-100">
                <i className="fa-solid fa-wallet text-4xl"></i>
              </div>
            </div>
            <h2 className="text-3xl font-black text-center text-slate-800">FinanceWise</h2>
            <p className="text-slate-400 text-center mt-2 font-medium">{isRegistering ? '立即加入智慧理財行列' : '掌握您的每一分錢'}</p>
            
            <div className="mt-8 flex justify-center">
              <button 
                onClick={toggleMode}
                className={`px-6 py-2 rounded-full text-xs font-black tracking-widest transition-all shadow-sm ${state.isDemoMode ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}
              >
                模式：{state.isDemoMode ? '展示體驗' : '雲端同步'} <i className="fa-solid fa-repeat ml-2"></i>
              </button>
            </div>

            <form className="mt-10 space-y-5" onSubmit={handleAuth}>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase ml-1">電子郵件</label>
                <input type="email" name="email" required placeholder="example@mail.com" defaultValue={state.isDemoMode ? 'test@example.com' : ''} className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-500 uppercase ml-1">登入密碼</label>
                <input type="password" name="password" required placeholder="••••••••" defaultValue={state.isDemoMode ? 'password' : ''} className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium" />
              </div>
              
              {authError && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center animate-fadeIn border border-red-100">
                  <i className="fa-solid fa-triangle-exclamation mr-3 text-lg"></i>
                  {authError}
                </div>
              )}
              
              <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 hover:-translate-y-1 transition-all shadow-xl shadow-blue-200 disabled:opacity-50">
                {isAuthLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (isRegistering ? '開始我的理財生活' : '進入系統')}
              </button>
            </form>

            <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-8 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors">
              {isRegistering ? '已有帳號？返回登入' : '還沒有帳號嗎？點此快速註冊'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} isDemoMode={state.isDemoMode} onToggleMode={toggleMode} />
      
      <main className="flex-1 p-10 overflow-y-auto max-h-screen">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' ? '我的財務看板' : 
               activeTab === 'accounts' ? '銀行帳戶管理' : 
               activeTab === 'transactions' ? '收支明細紀錄' : 'AI 專家理財建議'}
            </h2>
            <p className="text-slate-400 font-bold mt-1 text-sm">{new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center space-x-4">
             <div className="bg-white pl-2 pr-5 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                <i className="fa-solid fa-user-tie"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-slate-800 leading-none">{state.currentUser?.name}</span>
                <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-tighter">{state.isDemoMode ? 'Demo Session' : 'Formal Sync'}</span>
              </div>
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard state={state} />}

        {activeTab === 'accounts' && (
          <div className="space-y-10 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center">
                <i className="fa-solid fa-plus-circle mr-3 text-blue-500 text-xl"></i>
                {editingAccount ? '編輯現有帳戶' : '新增資產帳戶'}
              </h3>
              <form className="grid grid-cols-1 md:grid-cols-4 gap-6" onSubmit={editingAccount ? handleUpdateAccount : handleAddAccount}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">帳戶名稱</label>
                  <input type="text" name="name" required placeholder="例如：生活費、投資金" defaultValue={editingAccount?.name} className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">銀行 / 機構</label>
                  <input type="text" name="bankName" required placeholder="例如：中信、台新" defaultValue={editingAccount?.bankName} className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">當前餘額</label>
                  <input type="number" name="balance" required placeholder="0" defaultValue={editingAccount?.balance} className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium font-mono" />
                </div>
                <div className="flex items-end space-x-3">
                  <button type="submit" className="flex-1 bg-slate-900 text-white font-black py-3 rounded-xl hover:bg-black transition-all shadow-lg">
                    {editingAccount ? '儲存變更' : '立即新增'}
                  </button>
                  {editingAccount && (
                    <button type="button" onClick={() => setEditingAccount(null)} className="px-5 py-3 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-all">取消</button>
                  )}
                </div>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 group relative hover:border-blue-400 transition-all hover:shadow-2xl hover:shadow-blue-100/50">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`${acc.color} text-white w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                      <i className="fa-solid fa-building-columns"></i>
                    </div>
                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setEditingAccount(acc)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-all">
                        <i className="fa-solid fa-pen-to-square text-xs"></i>
                      </button>
                      <button onClick={() => deleteAccount(acc.id)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all">
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                  <h4 className="font-black text-xl text-slate-800">{acc.name}</h4>
                  <p className="text-slate-400 font-bold text-sm mb-6">{acc.bankName}</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-slate-300 font-black text-lg">$</span>
                    <p className="text-3xl font-black text-slate-900 tracking-tight">{acc.balance.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-10 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center">
                <i className="fa-solid fa-file-invoice-dollar mr-3 text-emerald-500 text-xl"></i>
                快速記錄每一筆支出與收入
              </h4>
              <form className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4" onSubmit={(e) => {
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
                <select name="type" className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-slate-50 text-slate-700">
                  <option value={TransactionType.EXPENSE}>🔴 支出錄入</option>
                  <option value={TransactionType.INCOME}>🟢 收入錄入</option>
                </select>
                <select name="accountId" className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700">
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select name="categoryId" className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700">
                  {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" name="amount" placeholder="輸入金額" className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-black" required />
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-bold" required />
                <button type="submit" className="bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">紀錄</button>
                <div className="md:col-span-3 lg:col-span-6">
                  <input type="text" name="note" placeholder="寫點備註吧... (例如：今天午餐吃拉麵)" className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                </div>
              </form>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">日期時間</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">分類項目</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">支付帳戶</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">交易金額</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.transactions.map(t => {
                      const category = state.categories.find(c => c.id === t.categoryId);
                      const account = state.accounts.find(a => a.id === t.accountId);
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-5 text-sm font-bold text-slate-500">{t.date}</td>
                          <td className="px-8 py-5">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-lg ${category?.color} flex items-center justify-center text-white text-[10px] shadow-sm`}>
                                <i className={`fa-solid ${category?.icon}`}></i>
                              </div>
                              <span className="font-black text-slate-800">{category?.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-sm font-bold text-slate-500">{account?.name || '未知帳戶'}</td>
                          <td className={`px-8 py-5 text-lg font-black text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                          </td>
                          <td className="px-8 py-5 text-center">
                            <button onClick={() => deleteTransaction(t.id)} className="text-slate-200 hover:text-rose-500 transition-all">
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="space-y-10 max-w-5xl animate-fadeIn">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-800 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                <i className="fa-solid fa-brain text-9xl"></i>
              </div>
              <div className="relative z-10">
                <div className="flex items-center space-x-6 mb-10">
                  <div className="bg-white/20 p-6 rounded-[2rem] backdrop-blur-3xl border border-white/30 shadow-2xl">
                    <i className="fa-solid fa-wand-magic-sparkles text-5xl"></i>
                  </div>
                  <div>
                    <h3 className="text-4xl font-black tracking-tight">AI 財務專家診斷</h3>
                    <p className="text-blue-100/70 font-bold mt-2 text-lg">透過 Gemini-3-Pro 深入解析您的消費與資產結構</p>
                  </div>
                </div>
                <button 
                  onClick={fetchAiAdvice} 
                  disabled={isAiLoading} 
                  className="group bg-white text-blue-900 px-10 py-5 rounded-[1.5rem] font-black text-xl hover:scale-105 active:scale-95 transition-all flex items-center shadow-2xl disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <><i className="fa-solid fa-dna fa-spin mr-4"></i>數據挖掘與邏輯建構中...</>
                  ) : (
                    <><i className="fa-solid fa-sparkles mr-4 group-hover:rotate-45 transition-transform"></i>立即生成專業報告</>
                  )}
                </button>
              </div>
            </div>

            {aiAdvice && (
              <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 animate-slideUp relative">
                <div className="absolute top-10 right-12 text-slate-100">
                   <i className="fa-solid fa-quote-right text-8xl"></i>
                </div>
                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed relative z-10">
                  {aiAdvice.split('\n').map((line, i) => {
                    if (line.startsWith('【')) {
                      return <h4 key={i} className="text-2xl font-black text-slate-900 mt-12 mb-6 flex items-center">
                        <span className="w-2 h-8 bg-blue-600 rounded-full mr-4"></span>
                        {line}
                      </h4>;
                    }
                    if (line.startsWith('-')) {
                      return <li key={i} className="ml-8 mb-4 font-bold text-slate-600 list-none flex items-start">
                        <i className="fa-solid fa-check-circle text-emerald-500 mr-3 mt-1 text-sm"></i>
                        {line.replace(/^-\s/, '')}
                      </li>;
                    }
                    if (line.trim() === '') return <div key={i} className="h-6" />;
                    return <p key={i} className="mb-6 font-medium text-lg text-slate-600">{line}</p>;
                  })}
                </div>
                <div className="mt-16 pt-10 border-t border-slate-100 flex justify-between items-center text-xs font-black text-slate-300 uppercase tracking-widest">
                   <span>診斷完成時間: {new Date().toLocaleString('zh-TW')}</span>
                   <span>Google Gemini Pro 2025 Intelligence</span>
                </div>
              </div>
            )}
            
            {!aiAdvice && !isAiLoading && (
              <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                  <i className="fa-solid fa-robot text-5xl"></i>
                </div>
                <p className="font-black text-xl tracking-tight text-slate-400">點擊上方按鈕，啟動您的專屬理財大腦</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
