import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "@/lib/auth"
import { ThemeProvider, themeBootScript } from "@/lib/theme"

export const metadata: Metadata = {
  title: "LexGuard — Read Before You Sign",
  description:
    "Upload any contract. LexGuard marks the clauses that could cost you, explains them in plain English, and answers your questions with the exact line to point to.",
  keywords: ["contract analysis", "legal AI", "risk detection", "contract review"],
  openGraph: {
    title: "LexGuard — Read Before You Sign",
    description: "Contract review in plain English.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" data-lg="auto" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,300..500;1,6..72,300..500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
