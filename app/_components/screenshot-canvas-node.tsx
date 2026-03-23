"use client"

import React from "react"
import { type NodeProps } from "@xyflow/react"
import { type Screenshot, type Breakpoint } from "@/lib/types"
import { cn } from "@/lib/utils"
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

        {screenshot?.status === "done" &&
          (screenshot.imageBase64 || screenshot.imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                screenshot.imageBase64
                  ? `data:image/png;base64,${screenshot.imageBase64}`
                  : screenshot.imageUrl!
              }
              alt={`${screenshot.pageUrl} at ${breakpoint.width}px`}
              className="w-full"
            />
          )}
      </div>
    </div>
  )
})

const SITE_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

type ComparisonFrameData = {
  screenshot: Screenshot | null | undefined
  breakpoint: Breakpoint
  scale: number
  siteLabel: string
  siteIndex: number
  isPresent: boolean
}

export const ComparisonFrameNode = React.memo(function ComparisonFrameNode({
  data,
}: NodeProps & { data: ComparisonFrameData }) {
  const { screenshot, breakpoint, scale, siteLabel, siteIndex, isPresent } =
    data
  const w = breakpoint.width * scale
  const colorClass = SITE_COLORS[siteIndex % SITE_COLORS.length]

  if (!isPresent) {
    return (
      <div className="flex flex-col gap-2" style={{ width: w }}>
        <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <span className={cn("size-2 shrink-0 rounded-full", colorClass)} />
          <span className="font-medium text-foreground">{siteLabel}</span>
        </div>
        <div
          className="flex items-center justify-center rounded-sm border border-dashed bg-muted/30"
          style={{
            width: w,
            aspectRatio: `${breakpoint.width}/${breakpoint.height}`,
          }}
        >
          <span className="text-xs text-muted-foreground">Not found</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <span className={cn("size-2 shrink-0 rounded-full", colorClass)} />
        <span className="font-medium text-foreground">{siteLabel}</span>
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
            style={{
              aspectRatio: `${breakpoint.width}/${breakpoint.height}`,
            }}
          />
        )}
        {screenshot?.status === "error" && (
          <div
            className="flex w-full flex-col items-center justify-center gap-1 bg-destructive/5"
            style={{
              aspectRatio: `${breakpoint.width}/${breakpoint.height}`,
            }}
          >
            <IconAlertTriangle className="size-4 text-destructive" />
            <span className="text-[0.625rem] text-destructive">Failed</span>
          </div>
        )}
        {screenshot?.status === "done" &&
          (screenshot.imageBase64 || screenshot.imageUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                screenshot.imageBase64
                  ? `data:image/png;base64,${screenshot.imageBase64}`
                  : screenshot.imageUrl!
              }
              alt={`${siteLabel} at ${breakpoint.width}px`}
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
