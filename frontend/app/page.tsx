"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

// Dynamically import to avoid SSR issues with Three.js / GSAP
const UploadZone = dynamic(() => import("@/components/upload/UploadZone"), {
  ssr: false,
})

export default function HomePage() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--bg-0)" }}>
      {error && (
        <div
          style={{
            position: "fixed",
            top: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            backgroundColor: "var(--sev-critical-bg)",
            border: "1px solid var(--sev-critical-border)",
            padding: "12px 20px",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
            color: "var(--sev-critical-text)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-2)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ×
          </button>
        </div>
      )}

      {uploading ? (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "28px",
              color: "var(--text-0)",
            }}
          >
            Uploading contract…
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--text-2)",
              letterSpacing: "0.08em",
            }}
          >
            Running structural extraction
          </p>
        </div>
      ) : (
        <UploadZone
          onUploadStart={() => setUploading(true)}
          onUploadError={(msg) => {
            setUploading(false)
            setError(msg)
          }}
        />
      )}
    </main>
  )
}
