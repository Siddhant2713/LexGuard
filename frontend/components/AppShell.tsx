"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useRequireAuth } from "@/lib/auth"
import { formatDate, initials } from "@/lib/utils"
import { Logo, ProTag, ThemeToggle } from "@/components/brand"

interface AppShellProps {
  children: React.ReactNode
  /** Dashboard only: shown as a breadcrumb after the nav. */
  filename?: string
  /** Header buttons before the theme toggle (the dashboard's Export and Share). */
  actions?: React.ReactNode
}

const pill = (active: boolean): React.CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 999,
  color: active ? "var(--bg0)" : "var(--t1)",
  background: active ? "var(--t0)" : "transparent",
})

/** Header + full-height body for every signed-in page. Renders nothing until the session is known. */
export default function AppShell({ children, filename, actions }: AppShellProps) {
  const { user, logout } = useRequireAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  if (!user) return null

  const signOut = async () => {
    await logout()
    router.replace("/")
  }

  return (
    <div className="lg-shell" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header
        className="lg-no-print"
        style={{ flex: "none", height: 60, borderBottom: "1px solid var(--bd0)", background: "var(--bg0)", display: "flex", alignItems: "center", gap: "clamp(12px,2vw,28px)", padding: "0 20px", position: "relative", zIndex: 10 }}
      >
        <Link href="/new" style={{ display: "flex", alignItems: "center", gap: 10, flex: "none", color: "var(--t0)" }}>
          <Logo size={24} fontSize={18} />
        </Link>
        <nav style={{ display: "flex", gap: 2, fontSize: 14, flex: "none", whiteSpace: "nowrap" }}>
          <Link href="/new" style={pill(pathname === "/new")}>New analysis</Link>
          <Link href="/contracts" style={pill(pathname === "/contracts")}>Contracts</Link>
          <Link href="/compare" style={pill(pathname.startsWith("/compare"))}>Compare</Link>
        </nav>
        {filename && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <span style={{ color: "var(--bd1)" }}>/</span>
            <span style={{ font: "400 13px var(--mono)", color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: "0 1 auto" }}>
              {filename}
            </span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {actions}
        <ThemeToggle size={34} />
        <div ref={menuRef} style={{ position: "relative", flex: "none" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            style={{ width: 34, height: 34, border: 0, borderRadius: "50%", background: "var(--t0)", color: "var(--bg0)", display: "grid", placeItems: "center", font: "500 12px var(--sans)", cursor: "pointer" }}
          >
            {initials(user.name)}
          </button>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: 44, width: 230, background: "var(--bg0)", borderRadius: 14, boxShadow: "var(--sh)", padding: 6, zIndex: 30 }}>
              <div style={{ padding: 12, marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                  {user.plan === "pro" && <ProTag />}
                </div>
                <div style={{ fontSize: 12, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
              </div>
              <Link href="/contracts" className="lg-menuitem" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "9px 12px", fontSize: 14, borderRadius: 9, color: "var(--t0)" }}>
                Contracts
              </Link>
              <Link href="/billing" className="lg-menuitem" onClick={() => setMenuOpen(false)} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "9px 12px", fontSize: 14, borderRadius: 9, color: "var(--t0)" }}>
                <span>Plan &amp; billing</span>
                <span style={{ fontSize: 12, color: "var(--t2)", whiteSpace: "nowrap" }}>
                  {user.plan === "pro" && user.pro_until ? `Pro to ${formatDate(user.pro_until).replace(/, \d{4}$/, "")}` : "Free"}
                </span>
              </Link>
              <button type="button" className="lg-menuitem" onClick={signOut} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 14, borderRadius: 9, border: 0, background: "transparent", color: "var(--t0)", cursor: "pointer" }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      {children}
    </div>
  )
}
