import { useState } from 'react';
import axios from 'axios';

interface AuthGateProps {
  onAuthenticated: (email: string, token: string, status: string) => void;
}

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const authClient = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const handleAuth = async (path: 'login' | 'register', successStatus: string) => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      const payload: Record<string, string> = {
        email: loginEmail,
        password: loginPassword,
      };

      const res = await authClient.post(`/api/auth/${path}`, payload);

      if (res.data && res.data.token) {
        onAuthenticated(loginEmail, res.data.token, successStatus);
      } else {
        setLoginError(path === 'login' ? 'Login failed' : 'Create account failed');
      }
    } catch (error: unknown) {
      setLoginError(error?.response?.data?.message || `${path === 'login' ? 'Login' : 'Create account'} request failed`);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#121212', fontFamily: 'system-ui, sans-serif', padding: 24, boxSizing: 'border-box' }}>
        <div style={{ width: 'min(560px, 100%)', textAlign: 'center', padding: '40px 32px', backgroundColor: '#1e1e1e', borderRadius: '16px', boxShadow: '0 18px 50px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', color: '#fff' }}>SNOD: Sync Notes on Documents</h1>
          <p style={{ color: '#cbd5e1', marginBottom: '28px', lineHeight: 1.5 }}>
            Sign in to use your synced library.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#0b1220', color: '#fff' }} />
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Password" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: '#0b1220', color: '#fff' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 6 }}>
                <button onClick={() => void handleAuth('login', 'Signed in')} style={{ padding: '10px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {loginLoading ? 'Signing...' : 'Sign in'}
                </button>
                <button onClick={() => void handleAuth('register', 'Account created')} style={{ padding: '10px 16px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {loginLoading ? 'Working...' : 'Create account'}
                </button>
              </div>
              {loginError && <div style={{ color: '#f87171', marginTop: 6 }}>{loginError}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
