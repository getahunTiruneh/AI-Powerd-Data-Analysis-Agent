import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2 } from 'lucide-react';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-20 xl:px-24 bg-white">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#007A3D' }}>
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#2E2E2E' }}>CBE AI Platform</h1>
              <p className="text-sm" style={{ color: '#005B2E' }}>Data Analysis & Insights</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#2E2E2E' }}>
              {showRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-gray-600">
              {showRegister
                ? 'Register for access to the AI data platform'
                : 'Sign in to access your data insights'}
            </p>
          </div>

          {showRegister ? (
            <RegisterForm onBack={() => setShowRegister(false)} />
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: '#E5E7EB',
                      focusRing: '#007A3D'
                    }}
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: '#E5E7EB'
                    }}
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#007A3D' }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => setShowRegister(true)}
                    className="font-medium hover:underline"
                    style={{ color: '#007A3D' }}
                  >
                    Request Access
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12"
        style={{
          background: 'linear-gradient(135deg, #007A3D 0%, #005B2E 100%)'
        }}
      >
        <div className="max-w-md text-white">
          <h2 className="text-4xl font-bold mb-6">Enterprise AI Data Platform</h2>
          <p className="text-lg mb-8 text-white/90">
            Unlock powerful insights from your data using natural language queries powered by AI.
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#CFAE3D' }}>
                <span className="text-sm font-bold" style={{ color: '#005B2E' }}>✓</span>
              </div>
              <span>Query multiple data marts with natural language</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#CFAE3D' }}>
                <span className="text-sm font-bold" style={{ color: '#005B2E' }}>✓</span>
              </div>
              <span>Enterprise-grade security and access control</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#CFAE3D' }}>
                <span className="text-sm font-bold" style={{ color: '#005B2E' }}>✓</span>
              </div>
              <span>Real-time analytics and insights</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function RegisterForm({ onBack }: { onBack: () => void }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signUp(email, password, fullName, department);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#007A3D' }}>
          <span className="text-3xl text-white">✓</span>
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: '#2E2E2E' }}>
          Registration Submitted
        </h3>
        <p className="text-gray-600 mb-6">
          Your account is pending approval. An administrator will review your request and grant access to the platform.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#007A3D' }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
          style={{ borderColor: '#E5E7EB' }}
          placeholder="Enter your full name"
          required
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
          style={{ borderColor: '#E5E7EB' }}
          placeholder="your.email@cbe.com.et"
          required
        />
      </div>

      <div>
        <label htmlFor="department" className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
          Department
        </label>
        <input
          id="department"
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
          style={{ borderColor: '#E5E7EB' }}
          placeholder="e.g., Retail Banking, Digital Banking"
          required
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: '#2E2E2E' }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
          style={{ borderColor: '#E5E7EB' }}
          placeholder="Create a strong password"
          required
          minLength={6}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 px-4 rounded-lg font-medium border transition-all hover:bg-gray-50"
          style={{ borderColor: '#E5E7EB', color: '#2E2E2E' }}
        >
          Back
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 px-4 rounded-lg font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#007A3D' }}
        >
          {loading ? 'Submitting...' : 'Request Access'}
        </button>
      </div>
    </form>
  );
}
