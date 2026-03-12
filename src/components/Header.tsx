import { LogOut, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { signOut, profile } = useAuth();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6" style={{ borderColor: '#E5E7EB' }}>
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#2E2E2E' }}>
          {getPageTitle(window.location.hash.slice(1) || 'chat')}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
          <Bell className="w-5 h-5" style={{ color: '#2E2E2E' }} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#007A3D' }}></span>
        </button>

        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <LogOut className="w-4 h-4" style={{ color: '#2E2E2E' }} />
          <span className="text-sm font-medium" style={{ color: '#2E2E2E' }}>Sign Out</span>
        </button>
      </div>
    </header>
  );
}

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    chat: 'AI Data Assistant',
    history: 'Chat History',
    dashboard: 'Admin Dashboard',
    users: 'User Management',
    'data-marts': 'Data Mart Management',
  };
  return titles[path] || 'Dashboard';
}
