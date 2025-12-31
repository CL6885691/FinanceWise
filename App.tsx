import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from './services/firebase';
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

  const translateError = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential': return '電子郵件或密碼錯誤。';
      case 'auth/email-already-in-use': return '此電子郵件已被註冊。';
      case 'auth/weak-password': return '密碼至少需 6 位。';
      default: return `錯誤：${code}`;
    }
  };

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
        dbService.setMode(true);
        const savedData = await dbService.loadState();
        setState(prev => ({
          ...prev,
          isLoggedIn: true,
          currentUser: { 
            id: firebaseUser.uid, 
            email: firebaseUser.email || '', 
            name: firebaseUser.displayName || '理財達人',
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
      setAuthError(translateError(err.code));
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

  const fetchAiAdvice = async () => {
    setIsAiLoading(true);
    const advice = await getFinancialAdvice(state.transactions, state.categories, state.accounts);
    setAiAdvice(advice);
    setIsAiLoading(false);
  };

  const fetchFortune = async () => {
    setIsFortuneLoading(true);
    const total = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const advice = await getFortuneAdvice(state.currentUser!, total);
    setFortuneAdvice(advice);
    setIsFortuneLoading(false);
  };

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    const newState = { ...state, transactions: [{ ...t, id: Date.now().toString() }, ...state.transactions] };
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

  if (!state.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 animate-fadeIn">
          <div className="text-center mb-8">
            <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-3xl shadow-xl">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800">FinanceWise</h2>
            <p className="text-slate-400 font-bold mt-2">智慧理財，從這開始</p>
          </div>
          <form onSubmit={handleAuthAction} className="space-y-4">
            {isRegisterMode && (
              <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} className="w-full px-5 py-3 rounded-xl border" placeholder="顯示名稱" />
            )}
            <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full px-5 py-3 rounded-xl border" placeholder="電子郵件" />
            <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full px-5 py-3 rounded-xl border" placeholder="密碼" />
            {authError && <p className="text-rose-500 text-sm font-bold">{authError}</p>}
            <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg">
              {isAuthLoading ? '處理中...' : (isRegisterMode ? '註冊' : '登入')}
            </button>
          </form>
          <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="w-full mt-4 text-blue-600 text-sm font-bold">
            {isRegisterMode ? '已有帳號？按此登入' : '還沒有帳號？按此註冊'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} isDemoMode={state.isDemoMode} onToggleMode={() => {}} />
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <header className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-900">
            {activeTab === 'dashboard' ? '財務總覽' : activeTab === 'accounts' ? '帳戶管理' : activeTab === 'transactions' ? '記帳紀錄' : activeTab === 'fortune' ? '玄學財運' : 'AI 理財建議'}
          </h2>
          <div className="bg-white px-4 py-2 rounded-xl border flex items-center space-x-3 shadow-sm">
            <span className="text-sm font-black text-slate-700">{state.currentUser?.name}</span>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard state={state} />}

        {activeTab === 'accounts' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <h3 className="font-black mb-4">新增帳戶</h3>
              <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleAddAccount}>
                <input type="text" name="name" required placeholder="帳戶名稱" className="px-4 py-2 rounded-xl border" />
                <input type="text" name="bankName" required placeholder="銀行名稱" className="px-4 py-2 rounded-xl border" />
                <input type="number" name="balance" required placeholder="初始餘額" className="px-4 py-2 rounded-xl border" />
                <button type="submit" className="bg-slate-900 text-white font-black rounded-xl">新增</button>
              </form>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-6 rounded-2xl border shadow-sm">
                  <h4 className="font-black text-lg">{acc.name}</h4>
                  <p className="text-slate-400 text-sm">{acc.bankName}</p>
                  <p className="text-2xl font-black mt-2">${acc.balance.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl border">
              <h3 className="font-black mb-4">快速記帳</h3>
              <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={(e) => {
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
                <select name="type" className="px-3 py-2 rounded-lg border"><option value={TransactionType.EXPENSE}>支出</option><option value={TransactionType.INCOME}>收入</option></select>
                <select name="accountId" className="px-3 py-2 rounded-lg border">{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <input type="number" name="amount" required placeholder="金額" className="px-3 py-2 rounded-lg border" />
                <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="px-3 py-2 rounded-lg border" />
                <button type="submit" className="bg-blue-600 text-white font-black rounded-lg">儲存</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl border overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left">日期</th><th className="px-6 py-3 text-left">帳戶</th><th className="px-6 py-3 text-right">金額</th></tr></thead>
                <tbody>{state.transactions.map(t => (
                  <tr key={t.id} className="border-t"><td className="px-6 py-4">{t.date}</td><td className="px-6 py-4">{state.accounts.find(a => a.id === t.accountId)?.name}</td><td className={`px-6 py-4 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>${t.amount.toLocaleString()}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fortune' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/20 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(99,102,241,0.5)] animate-pulse">
                  <i className="fa-solid fa-crystal-ball text-6xl text-indigo-300"></i>
                </div>
                <h3 className="text-3xl font-black mb-4">玄學理財命盤</h3>
                <p className="text-slate-400 mb-8 max-w-xs mx-auto">結合東方星命與現代數據，窺探您的財務未來。</p>
                <div className="space-y-4 w-full">
                  <input 
                    type="date" 
                    defaultValue={state.currentUser?.birthday} 
                    onChange={(e) => {
                      const bday = e.target.value;
                      const updatedUser = { ...state.currentUser!, birthday: bday, zodiac: getZodiac(bday), chineseZodiac: getChineseZodiac(bday) };
                      setState({ ...state, currentUser: updatedUser });
                    }}
                    className="w-full bg-slate-800 border-none rounded-xl px-4 py-3 text-white text-center font-bold outline-none ring-2 ring-slate-700 focus:ring-indigo-500 transition-all" 
                  />
                  <button onClick={fetchFortune} disabled={isFortuneLoading || !state.currentUser?.birthday} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-black transition-all disabled:opacity-50 flex items-center justify-center">
                    {isFortuneLoading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>}
                    啟動占卜球
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm min-h-[400px]">
              {fortuneAdvice ? (
                <div className="prose prose-slate max-w-none prose-p:mb-3 prose-h3:mt-6 prose-h3:mb-2">
                  <div className="flex items-center space-x-2 text-indigo-600 font-black mb-6 border-b pb-4">
                    <i className="fa-solid fa-scroll"></i>
                    <span>您的專屬命理建議</span>
                  </div>
                  {fortuneAdvice.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('【') ? 'font-black text-slate-900 text-lg mt-4' : 'text-slate-600'}>{line}</p>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <i className="fa-solid fa-moon text-4xl mb-4"></i>
                  <p className="font-bold">等待啟示...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-12 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="inline-flex items-center px-4 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-black uppercase tracking-widest mb-6">
                  Gemini AI 驅動
                </div>
                <h3 className="text-4xl font-black mb-4">AI 深度財務診斷</h3>
                <p className="text-blue-100/80 mb-8 max-w-xl">分析您的收支曲線，找出潛藏的財務風險，並提供具體的增產建議。</p>
                <button onClick={fetchAiAdvice} disabled={isAiLoading} className="bg-white text-blue-700 px-10 py-4 rounded-2xl font-black text-lg shadow-2xl hover:scale-105 transition-transform">
                  {isAiLoading ? <span className="flex items-center"><i className="fa-solid fa-spinner fa-spin mr-2"></i> 分析中...</span> : '立即開始診斷'}
                </button>
              </div>
            </div>
            {aiAdvice && (
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border animate-slideUp">
                <div className="prose prose-blue max-w-none">
                  {aiAdvice.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('###') || line.startsWith('【') ? 'text-xl font-black text-slate-900 mt-6 mb-2 border-l-4 border-blue-600 pl-4' : 'text-slate-600 leading-relaxed'}>{line}</p>
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