"use client"

import { useState } from "react"
import { type Screenshot, type Breakpoint } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  IconRefresh,
  IconAlertTriangle,
  IconMaximize,
  IconDownload,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react"

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
  const [fullscreen, setFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!screenshot || screenshot.status === "loading") {
    return (
      <div
        className="overflow-hidden rounded-lg border bg-muted/50"
        style={{ width: scaledWidth }}
      >
        <Skeleton
          className="w-full"
          style={{
            aspectRatio: `${breakpoint.width}/${breakpoint.height}`,
          }}
        />
      </div>
    )
  }

  if (screenshot.status === "error") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
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
    const dataUrl = `data:image/png;base64,${screenshot.imageBase64}`

    function handleDownload() {
      const a = document.createElement("a")
      a.href = dataUrl
      const hostname = new URL(screenshot!.pageUrl).hostname
      const path = new URL(screenshot!.pageUrl).pathname.replace(/\//g, "-") || "home"
      a.download = `${hostname}${path}-${breakpoint.width}x${breakpoint.height}.png`
      a.click()
    }

    async function handleCopy() {
      try {
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ])
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        // Fallback: copy data URL as text
        await navigator.clipboard.writeText(dataUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }
    }

    return (
      <>
        <div
          className="group/shot relative overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md"
          style={{ width: scaledWidth }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={`Screenshot of ${screenshot.pageUrl} at ${breakpoint.width}px`}
            className="w-full"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover/shot:opacity-100">
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => setFullscreen(true)}
            >
              <IconMaximize className="size-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={handleDownload}
            >
              <IconDownload className="size-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={handleCopy}
            >
              {copied ? (
                <IconCheck className="size-3.5" />
              ) : (
                <IconCopy className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="max-h-[90vh] max-w-[90vw] overflow-auto p-0">
            <DialogTitle className="sr-only">
              Screenshot of {screenshot.pageUrl} at {breakpoint.width}px
            </DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt={`Screenshot of ${screenshot.pageUrl} at ${breakpoint.width}px`}
              className="w-full"
            />
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return null
}
