"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ReactFlowProvider } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { type Screenshot, screenshotKey } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { IconCamera, IconLoader2 } from "@tabler/icons-react"
import {
  ScreenshotCanvas,
  DEFAULT_SPACING,
} from "@/app/_components/screenshot-canvas"

export default function SharedCanvasPage() {
  const { id } = useParams<{ id: string }>()
  const session = useQuery(api.sessions.getSession, { id })
  const [spacing, setSpacing] = useState(DEFAULT_SPACING)

  if (session === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <IconLoader2 className="size-5 animate-spin" />
          <span className="text-sm">Loading canvas...</span>
        </div>
      </div>
    )
  }

  if (session === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
        <h1 className="text-2xl font-semibold">Canvas not found</h1>
        <p className="text-muted-foreground">
          This shared canvas may have been deleted or the link is invalid.
        </p>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Go to Snapsite
        </Button>
      </div>
    )
  }

  // Convert session data to the format expected by ScreenshotCanvas
  const screenshots = new Map<string, Screenshot>()
  for (const s of session.screenshots) {
    if (!s.imageUrl) continue
    const key = screenshotKey(s.pageUrl, s.breakpointId)
    screenshots.set(key, {
      pageUrl: s.pageUrl,
      breakpointId: s.breakpointId,
      status: "done",
      imageUrl: s.imageUrl,
    })
  }

  const hostname = (() => {
    try {
      return new URL(session.url).hostname
    } catch {
      return session.url
    }
  })()

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary">
            <IconCamera className="size-3 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">Snapsite</span>
        </a>
        <span className="text-muted-foreground">/</span>
        <Badge variant="secondary" className="font-mono text-xs">
          {hostname}
        </Badge>
        <Badge variant="secondary" className="font-mono text-xs">
          {session.pages.length} page{session.pages.length !== 1 && "s"}{" "}
          &times; {session.breakpoints.length} breakpoint
          {session.breakpoints.length !== 1 && "s"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Label
            htmlFor="shared-spacing"
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Spacing
          </Label>
          <input
            id="shared-spacing"
            type="range"
            min={20}
            max={300}
            value={spacing}
            onChange={(e) => setSpacing(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="canvas-view min-h-0 flex-1">
        <ReactFlowProvider>
          <ScreenshotCanvas
            pages={session.pages}
            breakpoints={session.breakpoints}
            breakpointOrder={session.breakpointOrder}
            screenshots={screenshots}
            spacing={spacing}
            onClose={() => (window.location.href = "/")}
          />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
