
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { auth } from './services/firebase';
// Fix: Removed User as FirebaseUser import which was causing errors
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { AppState, Transaction, BankAccount, TransactionType, FinancialRiskProfile } from './types';
import { getFinancialAdvice, getFortuneAdvice } from './services/geminiService';

const getZodiac = (dateStr: string) => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const zodiacs = ["摩羯座", "水瓶座", "雙魚座", "牡羊座", "金牛座", "雙子座", "巨蟹座", "獅子座", "處女座", "天秤座", "天蠍座", "射手座", "摩羯座"];
  const bounds = [20, 19, 20, 20, 21, 21, 22, 23, 23, 23, 22, 21];
  return month > 0 && day > 0 ? (day < bounds[month - 1] ? zodiacs[month - 1] : zodiacs[month]) : "";
};

const getChineseZodiac = (dateStr: string) => {
  const year = new Date(dateStr).getFullYear();
  const animals = ["鼠", "牛", "虎", "兔", "龍", "蛇", "馬", "羊", "猴", "雞", "狗", "豬"];
  return animals[(((year - 4) % 12) + 12) % 12];
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(dbService.getInitialState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [fortuneAdvice, setFortuneAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFortuneLoading, setIsFortuneLoading] = useState(false);
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const riskProfile = useMemo((): FinancialRiskProfile => {
    const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const expenses = state.transactions.filter(t => t.type === TransactionType.EXPENSE);
    const totalExpenseVal = expenses.reduce((sum, t) => sum + t.amount, 0);
    const avgMonthlyExpense = totalExpenseVal > 0 ? totalExpenseVal / (Math.max(1, state.transactions.length / 5)) : 15000;
    const emergencyFundRatio = totalBalance / (avgMonthlyExpense || 1);
    
    let status: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    if (emergencyFundRatio < 3) status = 'CRITICAL';
    else if (emergencyFundRatio < 6) status = 'WARNING';

    return {
      emergencyFundRatio,
      expenseToIncomeRatio: 0, 
      riskScore: Math.min(100, (emergencyFundRatio / 12) * 100),
      status
    };
  }, [state.accounts, state.transactions]);

  useEffect(() => {
    if (!auth) return;
    // Fix: Type firebaseUser as any to bypass the missing User export error
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
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
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '使用者',
            ...(savedData?.currentUser || {})
          },
          accounts: savedData?.accounts || prev.accounts,
          transactions: savedData?.transactions || prev.transactions
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (isRegisterMode) {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        await updateProfile(userCredential.user, { displayName: authName });
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err: any) {
      setAuthError(err.message || '認證失敗');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    auth?.signOut();
    localStorage.clear();
    setState(dbService.getInitialState());
    setActiveTab('dashboard');
  };

  const handleBirthdaySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const bday = fd.get('birthday') as string;
    if (!bday) return;
    
    const updatedUser = state.currentUser ? {
      ...state.currentUser,
      birthday: bday,
      zodiac: getZodiac(bday),
      chineseZodiac: getChineseZodiac(bday)
    } : null;

    const newState = { ...state, currentUser: updatedUser };
    setState(newState);
    await dbService.saveState(newState);
    alert('命理資訊已更新！');
  };

  const fetchAiAdvice = async () => {
    setIsAiLoading(true);
    try {
      const advice = await getFinancialAdvice(state.transactions, state.categories, state.accounts);
      setAiAdvice(advice);
    } catch (e) {
      setAiAdvice("診斷失敗，請稍後再試。");
    } finally {
      setIsAiLoading(false);
    }
  };

  const fetchFortune = async () => {
    if (!state.currentUser?.birthday) {
      alert('請先在下方輸入生日。');
      return;
    }
    setIsFortuneLoading(true);
    try {
      const total = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
      const advice = await getFortuneAdvice(state.currentUser, total);
      setFortuneAdvice(advice);
    } catch (e) {
      setFortuneAdvice("占星失敗，請稍後再試。");
    } finally {
      setIsFortuneLoading(false);
    }
  };

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: Date.now().toString() };
    const accounts = state.accounts.map(acc => {
      if (acc.id === t.accountId) {
        return { ...acc, balance: t.type === TransactionType.INCOME ? acc.balance + t.amount : acc.balance - t.amount };
      }
      return acc;
    });
    const newState = { ...state, transactions: [newTransaction, ...state.transactions], accounts };
    setState(newState);
    await dbService.saveState(newState);
  };

  const deleteTransaction = async (id: string) => {
    const target = state.transactions.find(t => t.id === id);
    if (!target) return;
    const accounts = state.accounts.map(acc => {
      if (acc.id === target.accountId) {
        return { ...acc, balance: target.type === TransactionType.INCOME ? acc.balance - target.amount : acc.balance + target.amount };
      }
      return acc;
    });
    const newState = { ...state, transactions: state.transactions.filter(t => t.id !== id), accounts };
    setState(newState);
    await dbService.saveState(newState);
  };

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newAcc: BankAccount = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      bankName: fd.get('bankName') as string,
      balance: Number(fd.get('balance')),
      color: 'bg-blue-600'
    };
    const newState = { ...state, accounts: [...state.accounts, newAcc] };
    setState(newState);
    await dbService.saveState(newState);
    e.currentTarget.reset();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('確定刪除？')) return;
    const newState = { ...state, accounts: state.accounts.filter(a => a.id !== id) };
    setState(newState);
    await dbService.saveState(newState);
  };

  if (!state.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 animate-fadeIn">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-3xl shadow-xl">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800">FinanceWise</h2>
            <p className="text-slate-400 font-bold">登入以管理您的個人財務</p>
          </div>
          
          <form onSubmit={handleAuthAction} className="space-y-4">
            {isRegisterMode && (
              <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} className="w-full px-5 py-3 rounded-xl border" placeholder="您的稱呼" />
            )}
            <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full px-5 py-3 rounded-xl border" placeholder="電子郵件" />
            <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full px-5 py-3 rounded-xl border" placeholder="密碼" />
            {authError && <p className="text-rose-500 text-xs font-bold">{authError}</p>}
            <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-700 transition-all">
              {isAuthLoading ? '處理中...' : (isRegisterMode ? '建立帳號' : '登入')}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-blue-600 text-sm font-bold">
              {isRegisterMode ? '已有帳號？登入' : '還沒有帳號？註冊'}
            </button>
            <div className="my-4 border-t border-slate-100 pt-4">
               <button onClick={() => setState(prev => ({ ...prev, isLoggedIn: true, currentUser: { id: 'demo', email: 'demo@test.com', name: '體驗用戶' } }))} className="text-slate-400 text-sm font-bold">以訪客模式繼續</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} isDemoMode={state.isDemoMode} onToggleMode={() => {}} />
      <main className="flex-1 p-10 overflow-y-auto max-h-screen">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-black text-slate-900">
              {activeTab === 'dashboard' ? '財務看板' : activeTab === 'accounts' ? '帳戶管理' : activeTab === 'transactions' ? '財務紀錄' : activeTab === 'fortune' ? '運勢與風險' : 'AI 理財建議'}
            </h2>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl border flex items-center space-x-3 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-user"></i></div>
            <span className="text-sm font-black text-slate-700">{state.currentUser?.name}</span>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard state={state} />}

        {activeTab === 'accounts' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black mb-6">新增資產帳戶</h3>
              <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleAddAccount}>
                <input type="text" name="name" required placeholder="帳戶名稱 (如: 薪資戶)" className="px-5 py-3 rounded-xl border" />
                <input type="text" name="bankName" required placeholder="銀行名稱" className="px-5 py-3 rounded-xl border" />
                <input type="number" name="balance" required placeholder="餘額" className="px-5 py-3 rounded-xl border" />
                <button type="submit" className="bg-slate-900 text-white font-black rounded-xl py-3">新增帳戶</button>
              </form>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl"><i className="fa-solid fa-building-columns"></i></div>
                    <button onClick={() => deleteAccount(acc.id)} className="text-slate-300 hover:text-rose-500"><i className="fa-solid fa-trash"></i></button>
                  </div>
                  <h4 className="font-black text-xl text-slate-800">{acc.name}</h4>
                  <p className="text-slate-400 font-bold text-sm mb-4">{acc.bankName}</p>
                  <p className="text-3xl font-black text-slate-900">${acc.balance.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black mb-6">記一筆帳</h3>
              <form className="grid grid-cols-1 md:grid-cols-6 gap-3" onSubmit={(e) => {
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
                <select name="type" className="px-4 py-3 rounded-xl border">
                  <option value={TransactionType.EXPENSE}>支出</option>
                  <option value={TransactionType.INCOME}>收入</option>
                </select>
                <select name="accountId" className="px-4 py-3 rounded-xl border">
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select name="categoryId" className="px-4 py-3 rounded-xl border">
                  {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" name="amount" required placeholder="金額" className="px-4 py-3 rounded-xl border font-black" />
                <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-3 rounded-xl border" />
                <button type="submit" className="bg-blue-600 text-white font-black rounded-xl">儲存</button>
                <div className="md:col-span-6"><input type="text" name="note" placeholder="備註..." className="w-full px-5 py-3 rounded-xl border" /></div>
              </form>
            </div>
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase">日期</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase">類別</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase">帳戶</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase text-right">金額</th>
                    <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-8 py-4 text-sm font-bold text-slate-500">{t.date}</td>
                      <td className="px-8 py-4 font-black text-slate-800">{state.categories.find(c => c.id === t.categoryId)?.name}</td>
                      <td className="px-8 py-4 text-sm font-bold text-slate-500">{state.accounts.find(a => a.id === t.accountId)?.name}</td>
                      <td className={`px-8 py-4 text-lg font-black text-right ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-4 text-center"><button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500"><i className="fa-solid fa-trash"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fortune' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="text-2xl font-black mb-6">設定命盤</h3>
                <form className="space-y-6" onSubmit={handleBirthdaySubmit}>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase">出生日期</label>
                    <input type="date" name="birthday" required defaultValue={state.currentUser?.birthday} className="w-full px-6 py-4 rounded-2xl border font-bold mt-2" />
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black">儲存生日</button>
                </form>
                {state.currentUser?.birthday && (
                  <button onClick={fetchFortune} disabled={isFortuneLoading} className="w-full mt-4 bg-purple-600 text-white py-4 rounded-2xl font-black flex items-center justify-center">
                    {isFortuneLoading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>}
                    取得命理理財建議
                  </button>
                )}
              </div>
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[300px]">
                {fortuneAdvice ? (
                  <div className="prose prose-slate max-w-none">
                    {fortuneAdvice.split('\n').map((line, i) => (
                      <p key={i} className={`mb-2 ${line.startsWith('【') ? 'text-lg font-black text-indigo-900 mt-4' : 'text-slate-600'}`}>{line}</p>
                    ))}
                  </div>
                ) : <div className="h-full flex flex-col items-center justify-center text-slate-300"><i className="fa-solid fa-moon-stars text-5xl mb-4"></i><p>尚未產生建議</p></div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="space-y-8 animate-fadeIn">
             <div className="bg-blue-600 p-12 rounded-[3rem] text-white shadow-xl">
              <h3 className="text-3xl font-black mb-4">AI 深度財務診斷</h3>
              <p className="mb-8 opacity-80">基於您當前的消費習慣與資產配置，Gemini 為您量身打造理財計畫。</p>
              <button onClick={fetchAiAdvice} disabled={isAiLoading} className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-black text-lg shadow-lg disabled:opacity-50">
                {isAiLoading ? '分析中...' : '立即診斷'}
              </button>
            </div>
            {aiAdvice && (
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border animate-slideUp">
                <div className="prose prose-slate max-w-none">
                  {aiAdvice.split('\n').map((line, i) => (
                    <p key={i} className={`mb-4 ${line.startsWith('【') ? 'text-xl font-black text-slate-900 mt-6' : 'text-slate-600 leading-relaxed'}`}>{line}</p>
                  ))}
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
