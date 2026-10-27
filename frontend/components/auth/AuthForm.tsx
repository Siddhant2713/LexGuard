"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { nextPath, useAuth } from "@/lib/auth"
import { Logo, ThemeToggle } from "@/components/brand"

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
  font: "16px var(--sans)",
  color: "var(--t0)",
  background: "var(--bg1)",
  border: "1.5px solid transparent",
  borderRadius: 14,
  padding: "16px 18px",
  outline: "none",
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const { user, login, register } = useAuth()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isRegister = mode === "register"
  // Keeps ?next= when switching between sign in and register. Read after mount to match SSR.
  const [carry, setCarry] = useState("")
  useEffect(() => setCarry(window.location.search), [])

  useEffect(() => {
    if (user) router.replace(nextPath())
  }, [user, router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const problem = validate(mode, name, email, password)
    if (problem) return setError(problem)

    setBusy(true)
    setError(null)
    try {
      if (isRegister) await register(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 440px", background: "var(--inv)", color: "var(--oninv)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 48, padding: "clamp(28px,4vw,48px)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "flex-start", color: "var(--oninv)" }}>
          <Logo tile="var(--oninv)" cut="var(--inv)" />
        </Link>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 520 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(40px,4.4vw,64px)", lineHeight: 1, letterSpacing: "-0.035em" }}>
            Every clause,<br />in plain English<span style={{ color: "var(--acc)" }}>.</span>
          </div>
          <div style={{ position: "relative", borderRadius: 14, padding: "20px 22px", background: "color-mix(in oklch, var(--acc) 22%, transparent)" }}>
            <span style={{ position: "absolute", top: -10, left: 20, font: "500 11px/1 var(--sans)", background: "var(--acc)", color: "#0A0A0A", padding: "5px 10px", borderRadius: 999 }}>Critical</span>
            <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.4 }}>
              “…any invention conceived during employment, whether or not during working hours.”
            </p>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--oninv2)" }}>Free for 3 contracts a month</div>
      </div>

      <div style={{ flex: "1 1 480px", display: "flex", flexDirection: "column", padding: "clamp(28px,4vw,48px)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><ThemeToggle /></div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
          <form onSubmit={onSubmit} noValidate style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
            <h1 style={{ margin: "0 0 20px", fontFamily: "var(--serif)", fontWeight: 400, fontSize: 52, lineHeight: 1, letterSpacing: "-0.035em" }}>
              {isRegister ? "Create your account" : "Welcome back"}
            </h1>
            {isRegister && (
              <input className="lg-input" type="text" placeholder="Full name" aria-label="Full name" value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} style={inputStyle} />
            )}
            <input className="lg-input" type="email" placeholder="Email" aria-label="Email" value={email} maxLength={254} autoComplete="email" onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input
              className="lg-input"
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              autoComplete={isRegister ? "new-password" : "current-password"}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            {isRegister && (
              <span style={{ fontSize: 13, color: "var(--t2)", marginTop: -4, paddingLeft: 4 }}>At least 8 characters, with a letter and a number.</span>
            )}
            {error && (
              <span role="alert" style={{ fontSize: 13, color: "var(--acctx)", paddingLeft: 4 }}>{error}</span>
            )}
            <button
              type="submit"
              disabled={busy}
              style={{ marginTop: 12, font: "500 16px var(--sans)", background: "var(--t0)", color: "var(--bg0)", border: 0, padding: 17, borderRadius: 999, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}
            >
              {isRegister ? "Create account" : "Sign in"}
            </button>
            <div style={{ fontSize: 14, color: "var(--t1)", textAlign: "center", marginTop: 8 }}>
              {isRegister ? "Already have an account?" : "New to LexGuard?"}{" "}
              <Link href={(isRegister ? "/login" : "/register") + carry} style={{ color: "var(--t0)", fontWeight: 500, borderBottom: "1px solid var(--acc)" }}>
                {isRegister ? "Sign in" : "Create an account"}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
