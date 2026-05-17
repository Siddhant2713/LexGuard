"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type { ChatMessage, RiskAnalysis } from "@/lib/types"
import { streamChat } from "@/lib/api"
import { parseCitations } from "@/lib/utils"

interface CitationTagProps {
  clauseId: string
  heading: string
  onCitationClick: (clauseId: string) => void
}

function CitationTag({ clauseId, heading, onCitationClick }: CitationTagProps) {
  return (
    <button
      className="citation-tag"
      onClick={() => onCitationClick(clauseId)}
      title={`Go to: ${heading}`}
    >
      § {heading}
    </button>
  )
}

interface ChatPanelProps {
  sessionId: string
  onCitationClick: (clauseId: string) => void
}

export default function ChatPanel({ sessionId, onCitationClick }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stopStreamRef = useRef<(() => void) | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    return () => {
      // Abort any in-flight stream when panel unmounts
      stopStreamRef.current?.()
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const query = inputValue.trim()
    if (!query || isStreaming) return

    setInputValue("")
    setIsStreaming(true)

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: "user", content: query, timestamp: Date.now() },
    ])

    // Add empty assistant message that will be filled by stream
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", timestamp: Date.now() },
    ])

    let fullContent = ""

    stopStreamRef.current = streamChat(
      sessionId,
      query,
      (token) => {
        fullContent += token
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: fullContent,
          }
          return updated
        })
      },
      () => {
        setIsStreaming(false)
        stopStreamRef.current = null
      },
      (err) => {
        setIsStreaming(false)
        stopStreamRef.current = null
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: "An error occurred. Please try again.",
          }
          return updated
        })
      }
    )
  }, [inputValue, isStreaming, sessionId])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const renderMessageContent = (content: string, isAssistant: boolean) => {
    if (!isAssistant) {
      return (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px" }}>
          {content}
        </span>
      )
    }

    const segments = parseCitations(content)
    return (
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.7 }}>
        {segments.map((seg, i) =>
          seg.type === "citation" ? (
            <CitationTag
              key={i}
              clauseId={seg.clauseId!}
              heading={seg.heading!}
              onCitationClick={onCitationClick}
            />
          ) : (
            <span key={i} style={{ whiteSpace: "pre-wrap" }}>
              {seg.content}
            </span>
          )
        )}
      </span>
    )
  }

  return (
    <div
      className="chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderLeft: "1px solid var(--border-0)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-0)",
          flexShrink: 0,
        }}
      >
        <p className="caps-label">Ask the contract</p>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: "32px" }}>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--text-2)",
                letterSpacing: "0.06em",
              }}
            >
              Ask anything about this contract
            </p>
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {[
                "Can they own code I write at home?",
                "What happens if I quit early?",
                "Can they share my data?",
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputValue(q)
                    textareaRef.current?.focus()
                  }}
                  style={{
                    background: "none",
                    border: "1px solid var(--border-0)",
                    padding: "8px 12px",
                    color: "var(--text-2)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "color 120ms, border-color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.color = "var(--text-1)"
                    ;(e.target as HTMLElement).style.borderColor = "var(--border-1)"
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.color = "var(--text-2)"
                    ;(e.target as HTMLElement).style.borderColor = "var(--border-0)"
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1
          const isStreaming_ = isLast && msg.role === "assistant" && isStreaming

          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "90%",
                  padding: "10px 14px",
                  backgroundColor:
                    msg.role === "user" ? "var(--bg-3)" : "transparent",
                  color: "var(--text-0)",
                }}
                className={isStreaming_ && !msg.content ? "streaming-cursor" : ""}
              >
                <span
                  className={
                    isStreaming_ && msg.content ? "streaming-cursor" : ""
                  }
                >
                  {renderMessageContent(msg.content, msg.role === "assistant")}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          aria-label="Ask a question"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question… (Enter to send)"
          rows={1}
          disabled={isStreaming}
        />
      </div>
    </div>
  )
}
