"use client"

import { useRef } from "react"
import { ConvexProvider, ConvexReactClient } from "convex/react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Lazy-init: only create the WebSocket connection on first render,
  // not at module load time (avoids competing with screenshot fetches)
  const clientRef = useRef<ConvexReactClient | null>(null)

  if (!convexUrl) return <>{children}</>

  if (!clientRef.current) {
    clientRef.current = new ConvexReactClient(convexUrl)
  }

  return (
    <ConvexProvider client={clientRef.current}>{children}</ConvexProvider>
  )
}
