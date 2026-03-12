import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import DataMartManagement from './pages/DataMartManagement';
import AIChat from './pages/AIChat';
import ChatHistory from './pages/ChatHistory';

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('chat');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setCurrentPage(hash || 'chat');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F7F6' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#007A3D', borderTopColor: 'transparent' }}></div>
          <p className="text-lg font-medium" style={{ color: '#2E2E2E' }}>Loading CBE AI Platform...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (profile?.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F7F6' }}>
        <div className="max-w-md text-center p-8 bg-white rounded-xl shadow-lg border" style={{ borderColor: '#E5E7EB' }}>
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: '#CFAE3D' }}>
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2E2E2E' }}>
            Account Pending Approval
          </h2>
          <p className="text-gray-600 mb-6">
            Your account is awaiting administrator approval. You will receive access once an administrator reviews and approves your registration.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-lg font-medium text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: '#007A3D' }}
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  if (profile?.status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F5F7F6' }}>
        <div className="max-w-md text-center p-8 bg-white rounded-xl shadow-lg border border-red-200">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-red-100">
            <span className="text-4xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2E2E2E' }}>
            Account Suspended
          </h2>
          <p className="text-gray-600">
            Your account has been suspended. Please contact your administrator for more information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {currentPage === 'chat' && <AIChat />}
      {currentPage === 'history' && <ChatHistory />}
      {currentPage === 'dashboard' && profile?.role === 'admin' && <AdminDashboard />}
      {currentPage === 'users' && profile?.role === 'admin' && <UserManagement />}
      {currentPage === 'data-marts' && profile?.role === 'admin' && <DataMartManagement />}
    </Layout>
  );
}

export default App;
