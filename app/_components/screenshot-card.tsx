"use client"

import { type Screenshot, type Breakpoint } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { IconRefresh, IconAlertTriangle } from "@tabler/icons-react"

type ScreenshotCardProps = {
  screenshot: Screenshot | undefined
  breakpoint: Breakpoint
  onRetry: () => void
}

export default function ScreenshotCard({
  screenshot,
  breakpoint,
  onRetry,
}: ScreenshotCardProps) {
  const scaledWidth = Math.max(120, Math.min(400, breakpoint.width * 0.22))
  const aspectRatio = breakpoint.height / breakpoint.width

  if (!screenshot || screenshot.status === "loading") {
    return (
      <div
        className="animate-in fade-in overflow-hidden rounded-md border bg-muted/50"
        style={{ width: scaledWidth }}
      >
        <Skeleton
          className="w-full"
          style={{ aspectRatio: `${breakpoint.width}/${breakpoint.height}` }}
        />
      </div>
    )
  }

  if (screenshot.status === "error") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4"
        style={{
          width: scaledWidth,
          minHeight: scaledWidth * aspectRatio * 0.5,
        }}
      >
        <IconAlertTriangle className="size-5 text-destructive" />
        <p className="text-center text-xs text-destructive">
          {screenshot.error || "Failed"}
        </p>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <IconRefresh className="size-3.5" />
          Retry
        </Button>
      </div>
    )
  }

  if (screenshot.status === "done" && screenshot.imageBase64) {
    return (
      <div
        className="animate-in fade-in duration-300 overflow-hidden rounded-md border bg-card shadow-sm transition-shadow hover:shadow-md"
        style={{ width: scaledWidth }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${screenshot.imageBase64}`}
          alt={`Screenshot of ${screenshot.pageUrl} at ${breakpoint.width}px`}
          className="w-full"
          style={{ imageRendering: "auto" }}
        />
      </div>
    )
  }

  return null
}
