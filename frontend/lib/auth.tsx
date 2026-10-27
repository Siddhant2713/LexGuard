"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import * as api from "./api"
import type { User } from "./types"

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Replaces the user, e.g. with the one returned after a payment. Re-fetches when omitted. */
  refresh: (next?: User) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Ask the API who we are; the httpOnly cookie is the only credential.
  useEffect(() => {
    api.getMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password))
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    setUser(await api.register(name, email, password))
  }, [])

  const logout = useCallback(async () => {
    await api.logout().catch(() => {})
    setUser(null)
  }, [])

  const refresh = useCallback(async (next?: User) => {
    setUser(next ?? (await api.getMe()))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

/** For protected pages: redirects to /login when signed out, and back here after signing in. */
export function useRequireAuth() {
  const auth = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      const here = window.location.pathname + window.location.search
      router.replace(`/login?next=${encodeURIComponent(here)}`)
    }
  }, [auth.loading, auth.user, router])
  return auth
}

/**
 * Where to go after signing in: the `?next=` path when it's a same-site path, else /new.
 * Rejects `//host` and `/\host`, which browsers treat as another origin.
 */
export function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? ""
  return /^\/(?![\/\\])/.test(next) ? next : "/new"
}
