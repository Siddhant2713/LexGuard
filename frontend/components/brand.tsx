"use client"

import { useTheme } from "@/lib/theme"

interface MarkProps {
  size: number
  /** Tile colour; the shield is cut out in `cut`. */
  tile?: string
  cut?: string
  /** The compact mark (chat avatar, window bar) drops the pen stroke. */
  compact?: boolean
  style?: React.CSSProperties
}

export function LogoMark({ size, tile = "var(--t0)", cut = "var(--bg0)", compact, style }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none", ...style }} aria-hidden="true">
      <rect width="24" height="24" rx="6" style={{ fill: tile }} />
      <path d="M7.5 4.5 H16.5 V10 L12 19.5 L7.5 10 Z" style={{ fill: cut }} />
      {compact ? (
        <circle cx="12" cy="10.4" r="1.6" style={{ fill: "var(--acc)" }} />
      ) : (
        <>
          <rect x="11.45" y="11" width="1.1" height="8.5" style={{ fill: "var(--acc)" }} />
          <circle cx="12" cy="10.4" r="1.5" style={{ fill: "var(--acc)" }} />
        </>
      )}
    </svg>
  )
}

export function Logo({ size = 26, fontSize = 19, tile, cut }: { size?: number; fontSize?: number; tile?: string; cut?: string }) {
  return (
    <>
      <LogoMark size={size} tile={tile} cut={cut} />
      <span style={{ font: `600 ${fontSize}px/1 var(--sans)`, letterSpacing: "-0.035em" }}>LexGuard</span>
    </>
  )
}

export function ThemeToggle({ size = 36 }: { size?: number }) {
  const { toggle } = useTheme()
  const icon = size > 34 ? 16 : 15
  return (
    <button
      type="button"
      onClick={toggle}
      title="Switch theme"
      aria-label="Switch theme"
      className="lg-iconbtn"
      style={{ width: size, height: size, flex: "none", display: "grid", placeItems: "center", border: 0, background: "transparent", borderRadius: "50%", cursor: "pointer", color: "var(--t1)" }}
    >
      <svg width={icon} height={icon} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.4 }} />
        <path d="M8 2a6 6 0 0 0 0 12z" style={{ fill: "currentColor" }} />
      </svg>
    </button>
  )
}

/** The small accent "Pro" mark on plan badges and on buttons for Pro-only features. */
export function ProTag({ style }: { style?: React.CSSProperties }) {
  return (
    <span style={{ font: "500 10px/1 var(--sans)", letterSpacing: ".02em", background: "var(--acc)", color: "var(--onacc)", padding: "3px 7px", borderRadius: 999, flex: "none", ...style }}>
      Pro
    </span>
  )
}
