import { createContext, useContext, useState, useEffect } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Wire 401 → logout so the API client can trigger it
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
  }, []);

  // Restore session on page load
  useEffect(() => {
    const token = localStorage.getItem('splito_token');
    if (token) {
      api.get('/auth/me')
        .then(u => setUser(u))
        .catch(() => {
          localStorage.removeItem('splito_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { token, user: u } = await api.post('/auth/login', { email, password });
    localStorage.setItem('splito_token', token);
    setUser(u);
    return u;
  };

  const register = async (name, email, password) => {
    const { token, user: u } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('splito_token', token);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('splito_token');
    setUser(null);
  };

  // Refresh user profile (e.g. after XP changes)
  const refreshUser = async () => {
    try {
      const u = await api.get('/auth/me');
      setUser(u);
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
