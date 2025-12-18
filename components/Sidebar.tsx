
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
    { id: 'advice', label: 'AI 理財建議', icon: 'fa-robot' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center space-x-3">
        <div className="bg-blue-600 p-2 rounded-lg">
          <i className="fa-solid fa-wallet text-xl"></i>
        </div>
        <h1 className="text-xl font-bold tracking-tight">FinanceWise</h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
              activeTab === item.id 
              ? 'bg-blue-600 text-white' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <i className={`fa-solid ${item.icon} w-5`}></i>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {isDemoMode ? '展示模式' : '正式模式'}
          </span>
          <button 
            onClick={onToggleMode}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${isDemoMode ? 'bg-slate-700' : 'bg-emerald-500'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isDemoMode ? 'translate-x-1' : 'translate-x-6'}`} />
          </button>
        </div>

        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
        >
          <i className="fa-solid fa-right-from-bracket w-5"></i>
          <span className="font-medium">登出</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
