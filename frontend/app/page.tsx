"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import Landing from "@/components/landing/Landing"

// Public landing page. Signed-in users go straight to the app.
export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) router.replace("/new")
  }, [user, router])

  if (loading || user) return null
  return <Landing />
}
