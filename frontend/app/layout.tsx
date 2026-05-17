import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LexGuard — Read Before You Sign",
  description:
    "AI-powered contract intelligence. Upload any agreement and understand the real risks before you sign.",
  keywords: ["contract analysis", "legal AI", "risk detection", "legal intelligence"],
  openGraph: {
    title: "LexGuard — Read Before You Sign",
    description: "AI-powered contract intelligence platform",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Mono:wght@300;400;500&family=Geist:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "var(--bg-0)", color: "var(--text-0)" }}>
        {children}
      </body>
    </html>
  )
}
