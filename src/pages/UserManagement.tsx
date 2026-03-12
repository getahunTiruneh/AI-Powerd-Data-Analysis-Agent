import { useEffect, useState } from 'react';
import { Check, X, UserCheck, UserX, Search } from 'lucide-react';
import { supabase, UserProfile } from '../lib/supabase';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, status: 'active' | 'suspended') => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ status })
        .eq('id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const filteredUsers = users
    .filter((user) => filter === 'all' || user.status === filter)
    .filter((user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#007A3D', borderTopColor: 'transparent' }}></div>
          <p style={{ color: '#2E2E2E' }}>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#2E2E2E' }}>User Management</h1>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>
        {pendingCount > 0 && (
          <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: '#CFAE3D' }}>
            <p className="text-sm font-medium" style={{ color: '#005B2E' }}>
              {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border mb-6" style={{ borderColor: '#E5E7EB' }}>
        <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E5E7EB' }}
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'pending', 'active', 'suspended'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filter === status
                      ? 'text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={filter === status ? { backgroundColor: '#007A3D' } : { color: '#2E2E2E' }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F5F7F6' }}>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: '#2E2E2E' }}>User</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: '#2E2E2E' }}>Department</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: '#2E2E2E' }}>Role</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: '#2E2E2E' }}>Status</th>
                <th className="text-left p-4 font-semibold text-sm" style={{ color: '#2E2E2E' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50" style={{ borderColor: '#E5E7EB' }}>
                    <td className="p-4">
                      <div>
                        <p className="font-medium" style={{ color: '#2E2E2E' }}>{user.full_name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm" style={{ color: '#2E2E2E' }}>{user.department || '-'}</p>
                    </td>
                    <td className="p-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: user.role === 'admin' ? '#CFAE3D' : '#E5E7EB',
                          color: user.role === 'admin' ? '#005B2E' : '#2E2E2E'
                        }}
                      >
                        {user.role === 'admin' ? 'Administrator' : 'Business User'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor:
                            user.status === 'active'
                              ? '#007A3D'
                              : user.status === 'pending'
                              ? '#CFAE3D'
                              : '#DC2626',
                          color: '#FFFFFF'
                        }}
                      >
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => updateUserStatus(user.id, 'active')}
                            className="p-2 rounded-lg hover:bg-green-50 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" style={{ color: '#007A3D' }} />
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            onClick={() => updateUserStatus(user.id, 'suspended')}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Suspend"
                          >
                            <UserX className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                        {user.status === 'suspended' && (
                          <button
                            onClick={() => updateUserStatus(user.id, 'active')}
                            className="p-2 rounded-lg hover:bg-green-50 transition-colors"
                            title="Activate"
                          >
                            <UserCheck className="w-4 h-4" style={{ color: '#007A3D' }} />
                          </button>
                        )}
                        <button
                          onClick={() => window.location.hash = `user-access/${user.id}`}
                          className="px-3 py-1 rounded-lg text-xs font-medium hover:opacity-80 transition-all text-white"
                          style={{ backgroundColor: '#007A3D' }}
                        >
                          Manage Access
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
