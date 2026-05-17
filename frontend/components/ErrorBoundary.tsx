"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: "20px", color: "var(--sev-critical-text)", fontFamily: "var(--font-sans)" }}>
          <h3>Component Error</h3>
          <p>Something went wrong rendering this panel.</p>
        </div>
      )
    }

    return this.props.children
  }
}
