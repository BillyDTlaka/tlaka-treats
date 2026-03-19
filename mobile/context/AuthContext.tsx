import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken, getUser, saveAuth, clearAuth } from '../lib/auth';
import { api } from '../lib/api';

interface AuthContextType {
  user: any;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<any>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, u] = await Promise.all([getToken(), getUser()]);
      setToken(t); setUser(u);
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.auth.login(email, password);
    await saveAuth(res.token, res.user);
    setToken(res.token); setUser(res.user);
  }

  async function logout() {
    await clearAuth();
    setToken(null); setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
