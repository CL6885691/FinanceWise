
import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isDemoMode: boolean;
  onToggleMode: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, isDemoMode, onToggleMode }) => {
  const menuItems = [
    { id: 'dashboard', label: '總覽', icon: 'fa-chart-pie' },
    { id: 'accounts', label: '帳戶管理', icon: 'fa-building-columns' },
    { id: 'transactions', label: '財務紀錄', icon: 'fa-receipt' },
    { id: 'fortune', label: '運勢與風險', icon: 'fa-crystal-ball' },
    { id: 'advice', label: 'AI 理財建議', icon: 'fa-robot' },
  ];

  return (
    <aside className="w-72 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shadow-2xl">
      <div className="p-8 flex items-center space-x-4">
        <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <i className="fa-solid fa-wallet text-2xl"></i>
        </div>
        <h1 className="text-2xl font-black tracking-tighter">FinanceWise</h1>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-4 px-6 py-4 rounded-2xl transition-all ${
              activeTab === item.id 
              ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 translate-x-2' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className={`fa-solid ${item.icon} w-6 text-lg`}></i>
            <span className="font-black text-sm tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-6 border-t border-slate-800/50">
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 transition-all"
        >
          <i className="fa-solid fa-right-from-bracket w-6 text-lg"></i>
          <span className="font-black text-sm">安全登出</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
