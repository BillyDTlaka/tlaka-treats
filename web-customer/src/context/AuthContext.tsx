import React, { createContext, useContext, useState, useEffect } from 'react'
import { saveAuth, getToken, getUser, clearAuth } from '../lib/auth'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/auth.store'

interface AuthContextType {
  user: any
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) => Promise<{ token: string; user: any }>
  applyAuth: (token: string, user: any) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<any>(null)
  const [token, setToken]         = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = getToken()
    const u = getUser()
    setToken(t)
    setUser(u)
    if (t && u) useAuthStore.setState({ token: t, user: u })
    setIsLoading(false)
  }, [])

  async function login(email: string, password: string) {
    const res = await authApi.login(email, password)
    saveAuth(res.token, res.user)
    setToken(res.token)
    setUser(res.user)
    useAuthStore.setState({ token: res.token, user: res.user })
  }

  async function register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
    const res = await authApi.register(data)
    saveAuth(res.token, res.user)
    return { token: res.token, user: res.user }
  }

  function applyAuth(token: string, user: any) {
    setToken(token)
    setUser(user)
    useAuthStore.setState({ token, user })
  }

  function logout() {
    clearAuth()
    setToken(null)
    setUser(null)
    useAuthStore.setState({ token: null, user: null })
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, applyAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
