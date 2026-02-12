import { useState } from 'react';
import { login, logout, formatApiErrorMessage, getApiDebugReport } from '../../api';
import type { AuthUser } from '../../types';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const allowedRoles = new Set(['SCHOOL_ADMIN', 'TEACHER']);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [debugCopyState, setDebugCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const [loading, setLoading] = useState(false);

  const handleCopyDebug = async () => {
    try {
      await navigator.clipboard.writeText(getApiDebugReport(80));
      setDebugCopyState('done');
    } catch (error: unknown) {
      void error;
      setDebugCopyState('failed');
    } finally {
      window.setTimeout(() => setDebugCopyState('idle'), 1800);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const result = await login(email, password);
      if (!allowedRoles.has(result.user.role)) {
        logout();
        setError("Bu desktop ilovaga faqat SCHOOL_ADMIN yoki TEACHER kira oladi.");
        return;
      }
      onLogin(result.user);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Student Registrator</h1>
          <p>Tizimga kirish</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <div>{error}</div>
              <button
                type="button"
                onClick={handleCopyDebug}
                style={{
                  marginTop: 8,
                  border: 0,
                  background: 'transparent',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontSize: '12px',
                }}
              >
                {debugCopyState === 'done'
                  ? "Diagnostika nusxalandi"
                  : debugCopyState === 'failed'
                    ? "Nusxalashda xato"
                    : "Diagnostikani nusxalash"}
              </button>
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Parol</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button type="submit" className="button" disabled={loading}>
            {loading ? "Kirish..." : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
