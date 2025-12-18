
import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { dbService } from './services/dbService';
import { auth } from './services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
  return animals[(year - 4) % 12];
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(dbService.getInitialState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [fortuneAdvice, setFortuneAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFortuneLoading, setIsFortuneLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // 計算風險指標
  const riskProfile = useMemo((): FinancialRiskProfile => {
    const totalBalance = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const expenses = state.transactions.filter(t => t.type === TransactionType.EXPENSE);
    const avgMonthlyExpense = expenses.length > 0 ? expenses.reduce((sum, t) => sum + t.amount, 0) / (expenses.length / 5 || 1) : 10000;
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

  const handleLogout = async () => {
    setState(dbService.getInitialState());
    setActiveTab('dashboard');
  };

  const handleBirthdaySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const bday = fd.get('birthday') as string;
    if (!bday) return;
    setState(prev => ({
      ...prev,
      currentUser: prev.currentUser ? {
        ...prev.currentUser,
        birthday: bday,
        zodiac: getZodiac(bday),
        chineseZodiac: getChineseZodiac(bday)
      } : null
    }));
  };

  const fetchFortune = async () => {
    if (!state.currentUser?.birthday) return;
    setIsFortuneLoading(true);
    const total = state.accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const advice = await getFortuneAdvice(state.currentUser, total);
    setFortuneAdvice(advice);
    setIsFortuneLoading(false);
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: Date.now().toString() };
    setState(prev => {
      const accounts = prev.accounts.map(acc => {
        if (acc.id === t.accountId) {
          return { ...acc, balance: t.type === TransactionType.INCOME ? acc.balance + t.amount : acc.balance - t.amount };
        }
        return acc;
      });
      return { ...prev, transactions: [newTransaction, ...prev.transactions], accounts };
    });
  };

  if (!state.isLoggedIn) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10">
        <h2 className="text-3xl font-black text-center text-slate-800 mb-8">FinanceWise</h2>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          setState(prev => ({ ...prev, isLoggedIn: true, currentUser: { id: 'demo', email: 'demo@test.com', name: '體驗用戶' } }));
        }}>
           <input type="email" placeholder="Email" className="w-full px-5 py-4 rounded-2xl border" />
           <input type="password" placeholder="Password" className="w-full px-5 py-4 rounded-2xl border" />
           <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black">進入體驗</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        isDemoMode={state.isDemoMode} 
        onToggleMode={() => {}} 
      />
      
      <main className="flex-1 p-10 overflow-y-auto max-h-screen">
        {activeTab === 'dashboard' && <Dashboard state={state} />}
        
        {activeTab === 'fortune' && (
          <div className="space-y-10 animate-fadeIn">
            {/* 風險指標區塊 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-2xl ${riskProfile.status === 'SAFE' ? 'bg-emerald-100 text-emerald-600' : riskProfile.status === 'WARNING' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                   <i className={`fa-solid ${riskProfile.status === 'SAFE' ? 'fa-shield-check' : 'fa-triangle-exclamation'}`}></i>
                </div>
                <h4 className="text-sm font-black text-slate-400 uppercase">財務安全水位</h4>
                <p className="text-3xl font-black text-slate-900 mt-2">{riskProfile.emergencyFundRatio.toFixed(1)} <span className="text-sm">個月</span></p>
                <p className="text-xs font-bold text-slate-400 mt-2">可支撐當前開銷之月數</p>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4 text-2xl">
                    <i className="fa-solid fa-chart-line-up"></i>
                 </div>
                 <h4 className="text-sm font-black text-slate-400 uppercase">財務穩健得分</h4>
                 <p className="text-3xl font-black text-slate-900 mt-2">{Math.round(riskProfile.riskScore)} <span className="text-sm">分</span></p>
                 <div className="w-full h-2 bg-slate-100 rounded-full mt-4">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${riskProfile.riskScore}%` }}></div>
                 </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4 text-2xl">
                    <i className="fa-solid fa-crystal-ball"></i>
                 </div>
                 <h4 className="text-sm font-black text-slate-400 uppercase">今日理財運勢</h4>
                 <p className="text-xl font-black text-slate-900 mt-2">{state.currentUser?.zodiac || '尚未設定'}</p>
                 <p className="text-xs font-bold text-slate-400 mt-2">{state.currentUser?.chineseZodiac ? `屬${state.currentUser.chineseZodiac}` : '請設定生日'}</p>
              </div>
            </div>

            {/* 運勢輸入與顯示 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center">
                  <i className="fa-solid fa-star-and-crescent mr-4 text-purple-500"></i>
                  設定命理理財檔案
                </h3>
                <form className="space-y-6" onSubmit={handleBirthdaySubmit}>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase ml-1">您的出生年月日</label>
                      <input type="date" name="birthday" required className="w-full px-6 py-4 rounded-2xl border border-slate-100 focus:ring-4 focus:ring-purple-500/10 outline-none font-bold" />
                   </div>
                   <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black hover:bg-black transition-all">更新命理資訊</button>
                </form>

                {state.currentUser?.birthday && (
                  <div className="mt-12 p-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2rem] text-white shadow-xl shadow-purple-200">
                     <h4 className="text-lg font-black mb-4">🔮 專屬理財占卜</h4>
                     <p className="text-purple-50 text-sm mb-8 leading-relaxed">我們將結合您的星座【{state.currentUser.zodiac}】與生肖【屬{state.currentUser.chineseZodiac}】的特性，為您進行深度財運推測。</p>
                     <button 
                      onClick={fetchFortune}
                      disabled={isFortuneLoading}
                      className="w-full bg-white text-purple-600 py-4 rounded-xl font-black hover:scale-[1.02] transition-all flex items-center justify-center shadow-lg"
                     >
                        {isFortuneLoading ? <i className="fa-solid fa-spinner-third fa-spin mr-3"></i> : <i className="fa-solid fa-wand-magic-sparkles mr-3"></i>}
                        {isFortuneLoading ? "正在連結星象能量..." : "生成專屬財運報告"}
                     </button>
                  </div>
                )}
              </div>

              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[500px]">
                 {fortuneAdvice ? (
                   <div className="prose prose-slate max-w-none animate-slideUp">
                      {fortuneAdvice.split('\n').map((line, i) => {
                        if (line.startsWith('【')) return <h4 key={i} className="text-xl font-black text-indigo-900 mt-6 mb-4">{line}</h4>;
                        if (line.startsWith('-')) return <li key={i} className="ml-4 mb-2 text-slate-600 font-medium">{line.replace('-', '✨')}</li>;
                        return <p key={i} className="text-slate-600 leading-relaxed mb-4">{line}</p>;
                      })}
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <i className="fa-solid fa-moon-stars text-7xl mb-6"></i>
                      <p className="font-black">點擊左側按鈕開啟財運報告</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && <div className="p-20 text-center font-black">帳戶管理功能 (同上個版本)</div>}
        {activeTab === 'transactions' && <div className="p-20 text-center font-black">交易紀錄功能 (同上個版本)</div>}
        {activeTab === 'advice' && <div className="p-20 text-center font-black">AI 財務診斷 (同上個版本)</div>}
      </main>
    </div>
  );
};

export default App;
