import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from './services/firebase';
import { AppState, Transaction, BankAccount, TransactionType, FinancialRiskProfile } from './types';
import { getFinancialAdvice, getFortuneAdvice } from './services/geminiService';

const getZodiac = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const zodiacs = ["摩羯座", "水瓶座", "雙魚座", "牡羊座", "金牛座", "雙子座", "巨蟹座", "獅子座", "處女座", "天秤座", "天蠍座", "射手座", "摩羯座"];
  const bounds = [20, 19, 20, 20, 21, 21, 22, 23, 23, 23, 22, 21];
  return month > 0 && day > 0 ? (day < bounds[month - 1] ? zodiacs[month - 1] : zodiacs[month]) : "";
};

const getChineseZodiac = (dateStr: string) => {
  if (!dateStr) return "";
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
      setAuthError(err.message);
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
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">FinanceWise</h2>
            <p className="text-slate-400 font-bold mt-2">智慧理財，隨心所致</p>
          </div>
          <form onSubmit={handleAuthAction} className="space-y-4">
            {isRegisterMode && (
              <input type="text" required value={authName} onChange={e => setAuthName(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="您的暱稱" />
            )}
            <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="電子郵件" />
            <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="密碼" />
            {authError && <p className="text-rose-500 text-xs font-bold px-2">{authError}</p>}
            <button type="submit" disabled={isAuthLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black shadow-lg shadow-blue-200 transition-all transform active:scale-95">
              {isAuthLoading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : (isRegisterMode ? '建立帳戶' : '立即登入')}
            </button>
          </form>
          <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="w-full mt-6 text-slate-400 text-sm font-bold hover:text-blue-600 transition-colors">
            {isRegisterMode ? '已經有帳號了？點此登入' : '還沒有帳號嗎？點此註冊'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fcfdfe]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} isDemoMode={state.isDemoMode} onToggleMode={() => {}} />
      <main className="flex-1 p-8 overflow-y-auto max-h-screen">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' ? '財務儀表板' : activeTab === 'accounts' ? '帳戶資產' : activeTab === 'transactions' ? '流水記帳' : activeTab === 'fortune' ? '財運分析' : 'AI 理財助手'}
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">歡迎回來, {state.currentUser?.name} 👋</p>
          </div>
          <div className="bg-white p-2 rounded-2xl border border-slate-100 flex items-center space-x-3 shadow-sm pr-6 hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              {state.currentUser?.name?.charAt(0) || 'U'}
            </div>
            <span className="text-sm font-black text-slate-700">{state.currentUser?.name}</span>
          </div>
        </header>

        {activeTab === 'dashboard' && <Dashboard state={state} />}

        {activeTab === 'accounts' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-800 mb-6 flex items-center">
                <i className="fa-solid fa-plus-circle text-blue-600 mr-2"></i> 新增資產帳戶
              </h3>
              <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={handleAddAccount}>
                <input type="text" name="name" required placeholder="帳戶名稱 (如：薪資戶)" className="px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="text" name="bankName" required placeholder="銀行名稱" className="px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                <input type="number" name="balance" required placeholder="目前餘額" className="px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl transition-all shadow-lg active:scale-95">新增帳戶</button>
              </form>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {state.accounts.map(acc => (
                <div key={acc.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                      <i className="fa-solid fa-building-columns text-blue-600 group-hover:text-white"></i>
                    </div>
                    <span className="text-xs font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{acc.bankName}</span>
                  </div>
                  <h4 className="font-black text-xl text-slate-800">{acc.name}</h4>
                  <p className="text-3xl font-black text-slate-900 mt-4 tracking-tighter">${acc.balance.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-6 flex items-center">
                <i className="fa-solid fa-pen-to-square text-emerald-600 mr-2"></i> 快速記帳
              </h3>
              <form className="grid grid-cols-1 md:grid-cols-5 gap-4" onSubmit={(e) => {
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
                <select name="type" className="px-4 py-3 rounded-xl border border-slate-200 outline-none"><option value={TransactionType.EXPENSE}>支出 (-)</option><option value={TransactionType.INCOME}>收入 (+)</option></select>
                <select name="accountId" className="px-4 py-3 rounded-xl border border-slate-200 outline-none">{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                <input type="number" name="amount" required placeholder="金額" className="px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="px-4 py-3 rounded-xl border border-slate-200 outline-none" />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-lg active:scale-95">完成紀錄</button>
              </form>
            </div>
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">日期</th>
                    <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">項目</th>
                    <th className="px-8 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">帳戶</th>
                    <th className="px-8 py-5 text-right text-xs font-black text-slate-400 uppercase tracking-widest">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {state.transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 text-slate-500 font-medium text-sm">{t.date}</td>
                      <td className="px-8 py-5 font-bold text-slate-800">{t.note || '未分類'}</td>
                      <td className="px-8 py-5">
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">
                          {state.accounts.find(a => a.id === t.accountId)?.name}
                        </span>
                      </td>
                      <td className={`px-8 py-5 text-right font-black ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fortune' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-[#111827] p-12 rounded-[3rem] text-white flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/30 to-purple-900/30 group-hover:opacity-80 transition-opacity"></div>
              <div className="relative z-10 w-full">
                <div className="w-40 h-40 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-10 shadow-[0_0_80px_rgba(99,102,241,0.3)] animate-float">
                  <i className="fa-solid fa-crystal-ball text-7xl text-indigo-400 drop-shadow-[0_0_15px_rgba(165,180,252,0.8)]"></i>
                </div>
                <h3 className="text-4xl font-black mb-6 tracking-tighter">理財星盤占卜</h3>
                <p className="text-slate-400 mb-10 text-lg font-medium leading-relaxed max-w-sm mx-auto">
                  輸入您的出生日期，讓 AI 透過星象與大數據，為您揭示未來的財富機遇。
                </p>
                <div className="space-y-4 w-full max-w-xs mx-auto">
                  <input 
                    type="date" 
                    defaultValue={state.currentUser?.birthday} 
                    onChange={(e) => {
                      const bday = e.target.value;
                      const updatedUser = { 
                        ...state.currentUser!, 
                        birthday: bday, 
                        zodiac: getZodiac(bday), 
                        chineseZodiac: getChineseZodiac(bday) 
                      };
                      setState({ ...state, currentUser: updatedUser });
                    }}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl px-6 py-4 text-white text-center font-black outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all cursor-pointer" 
                  />
                  <button onClick={fetchFortune} disabled={isFortuneLoading || !state.currentUser?.birthday} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 py-5 rounded-2xl font-black text-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group">
                    {isFortuneLoading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-sparkles mr-2 group-hover:animate-spin"></i>}
                    開啟運勢命盤
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm min-h-[500px] overflow-y-auto">
              {fortuneAdvice ? (
                <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-black">
                  <div className="flex items-center space-x-3 text-indigo-600 font-black mb-8 border-b border-slate-100 pb-6 text-xl">
                    <i className="fa-solid fa-scroll-old"></i>
                    <span>您的專屬財運啟示</span>
                  </div>
                  {fortuneAdvice.split('\n').map((line, i) => {
                    if (line.trim().startsWith('###') || line.trim().startsWith('【')) {
                      return <h4 key={i} className="text-2xl font-black text-slate-900 mt-8 mb-4 flex items-center">{line.replace(/###|【|】/g, '')}</h4>;
                    }
                    return <p key={i} className="text-slate-600 text-lg leading-relaxed mb-4">{line}</p>;
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 text-center">
                  <div className="w-24 h-24 rounded-full border-4 border-dashed border-slate-100 flex items-center justify-center mb-6">
                    <i className="fa-solid fa-moon-stars text-5xl"></i>
                  </div>
                  <p className="font-black text-xl text-slate-300">目前星象尚未連線...<br/><span className="text-sm font-medium mt-2 block">請啟動左側占卜球</span></p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'advice' && (
          <div className="space-y-10 animate-fadeIn">
            <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 p-16 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                <i className="fa-solid fa-robot text-[20rem]"></i>
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center px-5 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></span>
                  Powered by Gemini 3.0 Pro
                </div>
                <h3 className="text-5xl font-black mb-6 tracking-tight">AI 財務全能診斷</h3>
                <p className="text-blue-100/70 mb-10 text-xl font-medium max-w-2xl leading-relaxed">
                  系統將深度解析您的收支數據，從數百個維度評估您的資產健康度，並給予精準的開源節流建議。
                </p>
                <button onClick={fetchAiAdvice} disabled={isAiLoading} className="bg-white text-blue-900 px-12 py-5 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all flex items-center">
                  {isAiLoading ? <><i className="fa-solid fa-spinner fa-spin mr-3"></i> 診斷中...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-3"></i> 立即生成報告</>}
                </button>
              </div>
            </div>
            {aiAdvice && (
              <div className="bg-white p-12 rounded-[4rem] shadow-sm border border-slate-100 animate-slideUp">
                <div className="prose prose-blue max-w-none">
                  {aiAdvice.split('\n').map((line, i) => {
                    const isTitle = line.startsWith('###') || line.startsWith('【');
                    return (
                      <p key={i} className={isTitle 
                        ? 'text-2xl font-black text-slate-900 mt-10 mb-6 flex items-center border-l-8 border-blue-600 pl-6 rounded-l' 
                        : 'text-slate-600 text-lg leading-loose mb-4'}>
                        {line.replace(/###/g, '')}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;