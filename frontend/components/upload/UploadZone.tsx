"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { uploadContract } from "@/lib/api"
import { animateUploadEntry } from "@/lib/utils"
import WebGLBackground from "./WebGLBackground"

function WordmarkSplit({ text }: { text: string }) {
  return (
    <span>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="wordmark-char"
          style={{ display: "inline-block" }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  )
}

interface UploadZoneProps {
  onUploadStart: () => void
  onUploadError: (msg: string) => void
}

export default function UploadZone({ onUploadStart, onUploadError }: UploadZoneProps) {
  const router = useRouter()
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)

  useEffect(() => {
    animateUploadEntry()
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase()
      if (!lower.endsWith(".pdf") && !lower.endsWith(".docx") && !lower.endsWith(".doc")) {
        onUploadError("Only PDF and DOCX files are supported.")
        return
      }
      if (file.size > 20 * 1024 * 1024) {
        onUploadError("File too large. Maximum size is 20MB.")
        return
      }

      onUploadStart()
      try {
        const result = await uploadContract(file)
        router.push(`/analyze/${result.session_id}`)
      } catch (err) {
        onUploadError((err as Error).message || "Upload failed. Please try again.")
      }
    },
    [router, onUploadStart, onUploadError]
  )

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      isDragging.current = false
      resetDropzone()
      const file = e.dataTransfer.files?.[0]
      if (file) await handleFile(file)
    },
    [handleFile]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isDragging.current) {
      isDragging.current = true
      activateDropzone()
    }
  }

  const onDragLeave = () => {
    isDragging.current = false
    resetDropzone()
  }

  const activateDropzone = () => {
    if (!dropRef.current) return
    dropRef.current.style.borderColor = "#BCB8AA"
    dropRef.current.style.backgroundColor = "#ECEAE4"
  }

  const resetDropzone = () => {
    if (!dropRef.current) return
    dropRef.current.style.borderColor = "#E5E2D8"
    dropRef.current.style.backgroundColor = "transparent"
  }

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await handleFile(file)
  }

  return (
    <>
      <WebGLBackground />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "64px 32px",
        }}
      >
        {/* Wordmark */}
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "48px",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            marginBottom: "12px",
            color: "var(--text-0)",
          }}
        >
          <WordmarkSplit text="LexGuard" />
        </h1>

        {/* Tagline */}
        <p
          className="tagline"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "18px",
            fontWeight: 300,
            fontStyle: "italic",
            color: "var(--text-1)",
            marginBottom: "48px",
          }}
        >
          Read before you sign.
        </p>

        {/* Drop Zone */}
        <div
          ref={dropRef}
          className="dropzone"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          style={{
            border: "1px dashed var(--border-0)",
            padding: "64px 80px",
            cursor: "pointer",
            transition: "border-color 240ms, background 240ms",
            backgroundColor: "transparent",
            textAlign: "center",
            minWidth: "420px",
          }}
        >
          <p
            className="drop-label"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "var(--text-2)",
              marginBottom: "8px",
            }}
          >
            Drop your contract here
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "var(--text-2)",
              letterSpacing: "0.08em",
            }}
          >
            PDF · DOCX · up to 20MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={onInputChange}
            style={{ display: "none" }}
          />
        </div>

        {/* Meta */}
        <p
          className="upload-meta"
          style={{
            marginTop: "32px",
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            color: "var(--text-2)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Powered by Gemini AI · Your data stays private
        </p>
      </div>
    </>
  )
}
