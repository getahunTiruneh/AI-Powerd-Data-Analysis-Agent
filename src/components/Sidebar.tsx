import { Building2, MessageSquare, History, Database, Users, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  icon: typeof MessageSquare;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: MessageSquare, label: 'AI Chat', path: 'chat', adminOnly: false },
  { icon: History, label: 'Chat History', path: 'history', adminOnly: false },
  { icon: BarChart3, label: 'Admin Dashboard', path: 'dashboard', adminOnly: true },
  { icon: Users, label: 'User Management', path: 'users', adminOnly: true },
  { icon: Database, label: 'Data Marts', path: 'data-marts', adminOnly: true },
];

export default function Sidebar() {
  const { profile, isAdmin } = useAuth();
  const currentPath = window.location.hash.slice(1) || 'chat';

  const handleNavigation = (path: string) => {
    window.location.hash = path;
  };

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="w-64 flex flex-col" style={{ backgroundColor: '#007A3D' }}>
      <div className="p-6 border-b" style={{ borderColor: '#005B2E' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#CFAE3D' }}>
            <Building2 className="w-6 h-6" style={{ color: '#005B2E' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CBE AI Platform</h1>
            <p className="text-xs text-white/80">Data Insights</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;

          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t" style={{ borderColor: '#005B2E' }}>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-white">{profile?.full_name}</p>
          <p className="text-xs text-white/70">{profile?.email}</p>
          {profile?.department && (
            <p className="text-xs mt-1 text-white/70">{profile.department}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: isAdmin ? '#CFAE3D' : '#005B2E',
                color: isAdmin ? '#2E2E2E' : '#FFFFFF'
              }}
            >
              {isAdmin ? 'Administrator' : 'Business User'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
