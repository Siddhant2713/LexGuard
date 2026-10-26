"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"

const linkStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  color: "var(--text-1)",
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
}

export default function AppNav() {
  const { user, logout } = useAuth()
  const router = useRouter()
  if (!user) return null

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "20px",
        padding: "16px 28px",
      }}
    >
      <Link href="/" style={linkStyle}>New analysis</Link>
      <Link href="/contracts" style={linkStyle}>My contracts</Link>
      {/* React escapes this; the server also rejects markup in names at signup. */}
      <span style={{ ...linkStyle, color: "var(--text-2)", cursor: "default" }}>{user.name}</span>
      <button
        style={linkStyle}
        onClick={async () => {
          await logout()
          router.replace("/login")
        }}
      >
        Sign out
      </button>
    </nav>
  )
}
