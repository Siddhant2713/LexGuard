import type { Severity } from "./types"

// ─── Severity helpers ───────────────────────────────────────────────────────

export const severityColors: Record<Severity, { text: string; border: string; bg: string }> = {
  critical: { text: "#9B3B28", border: "#C89080", bg: "#FBF1EE" },
  high:     { text: "#8A5C10", border: "#C8A055", bg: "#FBF6EC" },
  medium:   { text: "#4D6E25", border: "#92B065", bg: "#F3F7ED" },
  low:      { text: "#2B6494", border: "#7AAAC8", bg: "#EEF3F9" },
}

export const severityLabel: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
}

export function severityWeight(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s]
}

// ─── Citation parsing ───────────────────────────────────────────────────────

export interface ParsedSegment {
  type: "text" | "citation"
  content: string
  clauseId?: string
  heading?: string
}

/**
 * Parse [[CLAUSE:clause_id:Heading]] markers from chat response text.
 * Returns an array of text and citation segments for rendering.
 */
export function parseCitations(text: string): ParsedSegment[] {
  const regex = /\[\[CLAUSE:([\w\-]+):([^\]]+)\]\]/g
  const segments: ParsedSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) })
    }
    segments.push({
      type: "citation",
      content: match[0],
      clauseId: match[1],
      heading: match[2],
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) })
  }

  return segments
}

// ─── Red flag highlighting ──────────────────────────────────────────────────

/**
 * Highlight red_flag phrases within clause text.
 * Returns an array of {text, isFlag} segments.
 */
export function highlightRedFlags(
  clauseText: string,
  redFlags: string[]
): Array<{ text: string; isFlag: boolean }> {
  if (!redFlags.length) return [{ text: clauseText, isFlag: false }]

  // Escape special regex chars in flag phrases
  const escaped = redFlags.map((f) =>
    f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  )
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi")
  const parts = clauseText.split(pattern)

  const flagSet = new Set(redFlags.map((f) => f.toLowerCase()))

  return parts.map((part) => ({
    text: part,
    isFlag: flagSet.has(part.toLowerCase()),
  }))
}

// ─── GSAP animation helpers (browser-only) ─────────────────────────────────

export function animateUploadEntry() {
  if (typeof window === "undefined") return
  // Small delay ensures elements are painted before GSAP reads their positions
  setTimeout(() => {
    import("gsap").then(({ gsap }) => {
      // Use fromTo so the final state (opacity:1, y:0) is always explicit.
      // If the animation is interrupted, elements end up visible — not hidden.
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } })
      tl.fromTo(".wordmark-char",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, stagger: 0.04 })
        .fromTo(".tagline",
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 }, "-=0.4")
        .fromTo(".dropzone",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 }, "-=0.3")
        .fromTo(".upload-meta",
          { opacity: 0 },
          { opacity: 1, duration: 0.4 }, "-=0.2")
    })
  }, 80)
}

export function animateDashboardEntry() {
  if (typeof window === "undefined") return
  setTimeout(() => {
    import("gsap").then(({ gsap }) => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } })
      tl.fromTo(".header-bar",  { opacity: 0 }, { opacity: 1, duration: 0.3 })
        .fromTo(".risk-banner", { opacity: 0 }, { opacity: 1, duration: 0.3 }, "-=0.1")
        .fromTo(".clause-card", { opacity: 0 }, { opacity: 1, stagger: 0.04, duration: 0.3 }, "-=0.1")
        .fromTo(".detail-panel",{ opacity: 0 }, { opacity: 1, duration: 0.35 }, "-=0.2")
        .fromTo(".chat-panel",  { opacity: 0 }, { opacity: 1, duration: 0.3 }, "-=0.25")
    })
  }, 60)
}

export function animateClauseSelect(detailEl: HTMLElement) {
  if (typeof window === "undefined") return
  import("gsap").then(({ gsap }) => {
    gsap.fromTo(
      detailEl,
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.28, ease: "power4.out" }
    )
  })
}
