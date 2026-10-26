"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"

type Mode = "login" | "register"

// Built via RegExp() because the project's TS target predates the literal `u` flag.
const NAME_RE = new RegExp("^[\\p{L}\\p{M}0-9][\\p{L}\\p{M}0-9 .'-]*$", "u")
const LETTER_RE = new RegExp("\\p{L}", "u")

// Mirrors the server rules for fast feedback. The server is the real gatekeeper.
function validate(mode: Mode, name: string, email: string, password: string): string | null {
  if (mode === "register") {
    if (!name.trim()) return "Name is required"
    if (!NAME_RE.test(name.trim()))
      return "Name may only contain letters, numbers, spaces, . ' -"
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address"
  if (mode === "register") {
    if (password.length < 8) return "Password must be at least 8 characters"
    if (!LETTER_RE.test(password) || !/\d/.test(password)) return "Password must contain a letter and a number"
    if (new TextEncoder().encode(password).length > 72) return "Password must be at most 72 bytes"
  } else if (!password) return "Password is required"
  return null
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  background: "var(--bg-1)",
  border: "1px solid var(--border-1)",
  color: "var(--text-0)",
  fontFamily: "var(--font-sans)",
  fontSize: "14px",
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-2)",
  marginBottom: "6px",
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const { login, register } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isRegister = mode === "register"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const problem = validate(mode, name, email, password)
    if (problem) return setError(problem)

    setBusy(true)
    setError(null)
    try {
      if (isRegister) await register(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
      router.replace("/")
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <form onSubmit={onSubmit} noValidate style={{ width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "18px" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "34px", color: "var(--text-0)", fontWeight: 400 }}>
          {isRegister ? "Create your account" : "Sign in"}
        </h1>

        {isRegister && (
          <div>
            <label style={labelStyle} htmlFor="name">Name</label>
            <input id="name" style={inputStyle} value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label style={labelStyle} htmlFor="email">Email</label>
          <input id="email" type="email" style={inputStyle} value={email} maxLength={254} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            style={inputStyle}
            value={password}
            autoComplete={isRegister ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isRegister && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--text-2)", marginTop: "6px" }}>
              At least 8 characters, with a letter and a number.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--sev-critical-text)", background: "var(--sev-critical-bg)", border: "1px solid var(--sev-critical-border)", padding: "10px 12px" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ padding: "12px", background: "var(--text-0)", color: "var(--bg-0)", border: "none", cursor: busy ? "wait" : "pointer", fontFamily: "var(--font-sans)", fontSize: "14px", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>

        <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--text-1)" }}>
          {isRegister ? "Already have an account? " : "New to LexGuard? "}
          <Link href={isRegister ? "/login" : "/register"} style={{ color: "var(--text-0)" }}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </form>
    </main>
  )
}
