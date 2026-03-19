"use client"

import React from "react"
import { type NodeProps } from "@xyflow/react"
import { type Screenshot, type Breakpoint } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { IconAlertTriangle } from "@tabler/icons-react"

type FrameNodeData = {
  screenshot: Screenshot | undefined
  breakpoint: Breakpoint
  scale: number
}

type PageLabelData = {
  label: string
}

export const ScreenshotFrameNode = React.memo(function ScreenshotFrameNode({
  data,
}: NodeProps & { data: FrameNodeData }) {
  const { screenshot, breakpoint, scale } = data
  const w = breakpoint.width * scale

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 font-mono text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{breakpoint.label}</span>
        <span>
          {breakpoint.width}&times;{breakpoint.height}
        </span>
      </div>

      <div
        className="overflow-hidden rounded-sm border bg-card shadow-sm"
        style={{ width: w }}
      >
        {(!screenshot || screenshot.status === "loading") && (
          <Skeleton
            className="w-full"
            style={{ aspectRatio: `${breakpoint.width}/${breakpoint.height}` }}
          />
        )}

        {screenshot?.status === "error" && (
          <div
            className="flex w-full flex-col items-center justify-center gap-1 bg-destructive/5"
            style={{ aspectRatio: `${breakpoint.width}/${breakpoint.height}` }}
          >
            <IconAlertTriangle className="size-4 text-destructive" />
            <span className="text-[0.625rem] text-destructive">Failed</span>
          </div>
        )}

        {screenshot?.status === "done" && screenshot.imageBase64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${screenshot.imageBase64}`}
            alt={`${screenshot.pageUrl} at ${breakpoint.width}px`}
            className="w-full"
          />
        )}
      </div>
    </div>
  )
})

export const PageLabelNode = React.memo(function PageLabelNode({
  data,
}: NodeProps & { data: PageLabelData }) {
  return (
    <div className="font-mono text-sm font-medium text-foreground">
      {data.label}
    </div>
  )
})
