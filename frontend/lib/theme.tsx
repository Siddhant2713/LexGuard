"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

export type ThemeSetting = "auto" | "light" | "dark"

const STORAGE_KEY = "lg-theme"

// Runs before hydration (see layout.tsx) so the saved theme applies without a flash.
export const themeBootScript = `try{var t=localStorage.getItem("${STORAGE_KEY}");document.documentElement.setAttribute("data-lg",t==="light"||t==="dark"?t:"auto")}catch(e){document.documentElement.setAttribute("data-lg","auto")}`

const ThemeContext = createContext<{ toggle: () => void } | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>("auto")

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-lg")
    if (attr === "light" || attr === "dark") setSetting(attr)
  }, [])

  // Same rule as the design: flip whatever is currently showing.
  const toggle = useCallback(() => {
    const showing =
      setting !== "auto" ? setting
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    const next = showing === "dark" ? "light" : "dark"
    setSetting(next)
    document.documentElement.setAttribute("data-lg", next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [setting])

  return <ThemeContext.Provider value={{ toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}
