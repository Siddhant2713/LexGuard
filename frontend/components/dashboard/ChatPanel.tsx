"use client"

import { useEffect, useRef, useState } from "react"
import { streamChat } from "@/lib/api"
import { clauseNumber, parseCitations, severityLabel, severityStyle } from "@/lib/utils"
import { LogoMark } from "@/components/brand"
import type { RiskAnalysis } from "@/lib/types"

export type ChatItem =
  | { kind: "summary" }
  | { kind: "clause"; cid: string }
  | { kind: "user"; text: string }
  | { kind: "bot"; text: string; done: boolean }

interface ChatPanelProps {
  sessionId: string
  /** Shared reports: clause cards only, no questions. */
  readOnly?: boolean
  items: ChatItem[]
  setItems: React.Dispatch<React.SetStateAction<ChatItem[]>>
  /** Opening message, first line. */
  summary: string
  analyses: Record<string, RiskAnalysis>
  headings: Record<string, string>
  onCite: (clauseId: string) => void
}

const SUGGESTIONS = ["Can they own code I write at home?", "What if I quit after a year?", "Can they share my data?"]

const eyebrow = (color: string): React.CSSProperties => ({ font: "500 11px var(--mono)", letterSpacing: ".06em", color, marginBottom: 4 })

export default function ChatPanel({ sessionId, readOnly, items, setItems, summary, analyses, headings, onCite }: ChatPanelProps) {
  const [draft, setDraft] = useState("")
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items])

  // Abort an in-flight answer when the panel goes away.
  useEffect(() => () => stopRef.current?.(), [])

  // Grow the composer with its content, up to its max height.
  useEffect(() => {
    const t = textareaRef.current
    if (!t) return
    t.style.height = "auto"
    t.style.height = `${t.scrollHeight}px`
  }, [draft])

  const setLastBot = (patch: Partial<{ text: string; done: boolean }>) =>
    setItems((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last?.kind === "bot") next[next.length - 1] = { ...last, ...patch }
      return next
    })

  function ask(raw: string) {
    const query = raw.trim()
    if (!query || streaming) return
    setDraft("")
    setStreaming(true)
    setItems((prev) => [...prev, { kind: "user", text: query }, { kind: "bot", text: "", done: false }])

    let full = ""
    stopRef.current = streamChat(
      sessionId,
      query,
      (token) => {
        full += token
        setLastBot({ text: full })
      },
      () => {
        setLastBot({ done: true })
        setStreaming(false)
        stopRef.current = null
      },
      () => {
        setLastBot({ text: "Something went wrong. Please try again.", done: true })
        setStreaming(false)
        stopRef.current = null
      },
    )
  }

  const showSuggestions = !items.some((m) => m.kind === "user")

  return (
    <aside className="lg-no-print" style={{ flex: "0 1 clamp(300px,34%,520px)", minWidth: 300, display: "flex", flexDirection: "column", minHeight: 0, borderLeft: "1px solid var(--bd0)", background: "var(--bg0)" }}>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "clamp(20px,2.5vw,36px)", display: "flex", flexDirection: "column", gap: 28 }}>
        {items.map((m, i) => {
          if (m.kind === "summary") {
            return (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <LogoMark size={26} compact />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, fontSize: 15, lineHeight: 1.6 }}>
                  <div>{summary}</div>
                  <div style={{ color: "var(--t1)" }}>{readOnly ? "Pick a flag on the left to see what it means." : "Pick a flag on the left to see what it means, or ask me anything."}</div>
                </div>
              </div>
            )
          }
          if (m.kind === "clause") {
            const c = analyses[m.cid]
            if (!c) return null
            const L = severityStyle[c.severity]
            return (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 26, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, borderRadius: 16, background: "var(--bg1)", padding: "22px 22px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ font: "500 11px/1 var(--sans)", color: L.ltx, background: L.lbg, border: `1px solid ${L.lbd}`, padding: "4px 9px", borderRadius: 999, flex: "none" }}>{severityLabel[c.severity]}</span>
                    <span style={{ font: "400 12px var(--mono)", color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>§{clauseNumber(m.cid)} {headings[m.cid] ?? ""}</span>
                  </div>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.02em" }}>{c.risk_type}</div>
                  <div><div style={eyebrow("var(--t2)")}>IN PLAIN ENGLISH</div><div style={{ fontSize: 15, lineHeight: 1.6 }}>{c.plain_english}</div></div>
                  <div style={{ borderLeft: "2px solid var(--acc)", paddingLeft: 14 }}><div style={eyebrow("var(--acctx)")}>IF YOU SIGN THIS</div><div style={{ fontSize: 15, lineHeight: 1.6 }}>{c.consequence}</div></div>
                  <div><div style={eyebrow("var(--t2)")}>WHAT TO ASK FOR</div><div style={{ fontSize: 15, lineHeight: 1.6, color: "var(--t1)" }}>{c.negotiation_tip}</div></div>
                </div>
              </div>
            )
          }
          if (m.kind === "user") {
            return (
              <div key={i} style={{ alignSelf: "flex-end", maxWidth: "80%", background: "var(--t0)", color: "var(--bg0)", padding: "12px 18px", borderRadius: "20px 20px 6px 20px", fontSize: 15, whiteSpace: "pre-wrap" }}>
                {m.text}
              </div>
            )
          }
          const { text, cites } = parseCitations(m.text)
          return (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <LogoMark size={26} compact />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {text}
                  {!m.done && <span style={{ display: "inline-block", width: 8, height: 15, marginLeft: 2, verticalAlign: -2, background: "var(--acc)", animation: "lgBlink .9s step-end infinite" }} />}
                </div>
                {m.done && cites.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {cites.map((ct) => (
                      <button key={ct.clauseId} type="button" className="lg-chip" onClick={() => onCite(ct.clauseId)} style={{ font: "400 12px var(--mono)", color: "var(--t1)", background: "var(--bg1)", padding: "4px 9px", borderRadius: 7, cursor: "pointer", border: 0 }}>
                        §{clauseNumber(ct.clauseId)} {ct.heading}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!readOnly && <div style={{ padding: "12px clamp(16px,2vw,28px) clamp(16px,2vw,24px)", display: "flex", flexDirection: "column", gap: 10 }}>
        {showSuggestions && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none" }}>
            {SUGGESTIONS.map((q) => (
              <button key={q} type="button" className="lg-chip" onClick={() => ask(q)} style={{ flex: "none", fontSize: 13, padding: "8px 14px", borderRadius: 999, background: "var(--bg1)", color: "var(--t1)", cursor: "pointer", whiteSpace: "nowrap", border: 0 }}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="lg-composer" style={{ display: "flex", alignItems: "flex-end", gap: 10, borderRadius: 20, padding: "8px 8px 8px 20px", background: "var(--bg1)", border: "1.5px solid transparent" }}>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                ask(draft)
              }
            }}
            rows={1}
            placeholder="Ask anything about this contract"
            aria-label="Ask anything about this contract"
            style={{ flex: 1, resize: "none", border: 0, outline: "none", background: "transparent", font: "15px/1.5 var(--sans)", color: "var(--t0)", padding: "8px 0", maxHeight: 140 }}
          />
          <button type="button" onClick={() => ask(draft)} disabled={streaming} title="Send" aria-label="Send" style={{ width: 40, height: 40, flex: "none", border: 0, borderRadius: "50%", background: "var(--acc)", color: "#0A0A0A", cursor: streaming ? "wait" : "pointer", display: "grid", placeItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 12V2M2.5 6.5L7 2l4.5 4.5" style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6 }} />
            </svg>
          </button>
        </div>
      </div>}
    </aside>
  )
}
