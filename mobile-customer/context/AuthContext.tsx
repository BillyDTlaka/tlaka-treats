import React, { createContext, useContext, useState, useEffect } from 'react';
import { saveAuth, getToken, getUser, clearAuth } from '../lib/auth';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/auth.store';

interface AuthContextType {
  user: any;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<any>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [t, u] = await Promise.all([getToken(), getUser()]);
      setToken(t); setUser(u);
      // Sync Zustand store so screens that read useAuthStore get the user too
      if (t && u) useAuthStore.setState({ token: t, user: u });
      setIsLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password);
    await saveAuth(res.token, res.user);
    setToken(res.token); setUser(res.user);
    useAuthStore.setState({ token: res.token, user: res.user });
  }

  async function register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
    const res = await authApi.register(data);
    await saveAuth(res.token, res.user);
    setToken(res.token); setUser(res.user);
    useAuthStore.setState({ token: res.token, user: res.user });
  }

  async function logout() {
    await clearAuth();
    setToken(null); setUser(null);
    useAuthStore.setState({ token: null, user: null });
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
