import { useEffect, useState } from 'react';
import { Users, Database, MessageSquare, TrendingUp, Activity, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  totalDataMarts: number;
  totalConversations: number;
  totalQueries: number;
  todayQueries: number;
  avgQueryTime: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalDataMarts: 0,
    totalConversations: 0,
    totalQueries: 0,
    todayQueries: 0,
    avgQueryTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [users, dataMarts, conversations, queries] = await Promise.all([
        supabase.from('user_profiles').select('*'),
        supabase.from('data_marts').select('*'),
        supabase.from('chat_conversations').select('*'),
        supabase.from('query_logs').select('*'),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayQueries = queries.data?.filter(
        (q) => new Date(q.created_at) >= today
      ).length || 0;

      const successfulQueries = queries.data?.filter((q) => q.status === 'success') || [];
      const avgTime = successfulQueries.length > 0
        ? successfulQueries.reduce((sum, q) => sum + (q.execution_time_ms || 0), 0) / successfulQueries.length
        : 0;

      setStats({
        totalUsers: users.data?.length || 0,
        activeUsers: users.data?.filter((u) => u.status === 'active').length || 0,
        pendingUsers: users.data?.filter((u) => u.status === 'pending').length || 0,
        totalDataMarts: dataMarts.data?.length || 0,
        totalConversations: conversations.data?.length || 0,
        totalQueries: queries.data?.length || 0,
        todayQueries,
        avgQueryTime: Math.round(avgTime),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#007A3D', borderTopColor: 'transparent' }}></div>
          <p style={{ color: '#2E2E2E' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#2E2E2E' }}>Dashboard Overview</h1>
        <p className="text-gray-600">Monitor platform activity and user engagement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers}
          subtitle={`${stats.activeUsers} active, ${stats.pendingUsers} pending`}
          color="#007A3D"
        />
        <StatCard
          icon={Database}
          title="Data Marts"
          value={stats.totalDataMarts}
          subtitle="Available datasets"
          color="#005B2E"
        />
        <StatCard
          icon={MessageSquare}
          title="Conversations"
          value={stats.totalConversations}
          subtitle="Total chat sessions"
          color="#CFAE3D"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Queries"
          value={stats.totalQueries}
          subtitle={`${stats.todayQueries} today`}
          color="#007A3D"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#007A3D' }}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: '#2E2E2E' }}>Platform Activity</h3>
              <p className="text-sm text-gray-600">Real-time statistics</p>
            </div>
          </div>
          <div className="space-y-3">
            <ActivityItem label="Queries Today" value={stats.todayQueries} />
            <ActivityItem label="Active Conversations" value={stats.totalConversations} />
            <ActivityItem label="Avg Query Time" value={`${stats.avgQueryTime}ms`} />
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#CFAE3D' }}>
              <Clock className="w-5 h-5" style={{ color: '#005B2E' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: '#2E2E2E' }}>Recent Activity</h3>
              <p className="text-sm text-gray-600">Latest platform events</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Platform analytics are being tracked</p>
            <p>All queries are logged for audit purposes</p>
            <p>User activity is monitored in real-time</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: '#E5E7EB' }}>
        <h3 className="font-semibold mb-4" style={{ color: '#2E2E2E' }}>Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            title="Approve Users"
            description="Review pending registrations"
            onClick={() => window.location.hash = 'users'}
            color="#007A3D"
          />
          <QuickAction
            title="Manage Data Marts"
            description="Add or configure datasets"
            onClick={() => window.location.hash = 'data-marts'}
            color="#005B2E"
          />
          <QuickAction
            title="View Activity Logs"
            description="Monitor query history"
            onClick={() => window.location.hash = 'users'}
            color="#CFAE3D"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, subtitle, color }: {
  icon: typeof Users;
  title: string;
  value: number | string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-3xl font-bold mb-1" style={{ color: '#2E2E2E' }}>{value}</h3>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function ActivityItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#F5F7F6' }}>
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold" style={{ color: '#2E2E2E' }}>{value}</span>
    </div>
  );
}

function QuickAction({ title, description, onClick, color }: {
  title: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="p-4 rounded-lg border-2 border-dashed hover:border-solid transition-all text-left"
      style={{ borderColor: color + '40' }}
    >
      <h4 className="font-semibold mb-1" style={{ color }}>{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </button>
  );
}
