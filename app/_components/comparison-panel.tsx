"use client"

import { useState } from "react"
import { useComparison } from "@/hooks/use-comparison"
import { type Breakpoint } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  IconPlus,
  IconX,
  IconLoader2,
  IconWorldSearch,
  IconCamera,
  IconCheck,
  IconMinus,
  IconArrowsShuffle,
} from "@tabler/icons-react"

const SITE_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

type ComparisonPanelProps = {
  breakpoints: Breakpoint[]
  scrollBeforeCapture: boolean
  onOpenComparisonCanvas: () => void
}

export default function ComparisonPanel({
  breakpoints,
  scrollBeforeCapture,
  onOpenComparisonCanvas,
}: ComparisonPanelProps) {
  const { sites, matchedPages, addSite, removeSite, captureSite, toggleSitePage } =
    useComparison()

  const [newUrl, setNewUrl] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState("")

  const hasMultipleSites = sites.length >= 2
  const allSitesCaptured = sites.every(
    (s) => s.pages.length > 0 && !s.isCapturing,
  )
  const hasCapturedScreenshots = sites.some((s) => s.screenshots.size > 0)

  async function handleAddSite(e: React.FormEvent) {
    e.preventDefault()
    setAddError("")

    let url = newUrl.trim()
    if (!url) return
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`
    }

    try {
      new URL(url)
    } catch {
      setAddError("Please enter a valid URL")
      return
    }

    setIsAdding(true)
    try {
      await addSite(url)
      setNewUrl("")
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : "Failed to discover pages",
      )
    } finally {
      setIsAdding(false)
    }
  }

  async function handleCaptureSite(siteId: string) {
    await captureSite(siteId, breakpoints, scrollBeforeCapture)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <IconArrowsShuffle className="size-4" />
          Site Comparison
        </CardTitle>
        <CardDescription>
          Add sites to compare pages side by side across breakpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Site cards */}
        {sites.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              Sites
            </h3>
            <div className="flex flex-wrap gap-2">
              {sites.map((site, i) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  colorClass={SITE_COLORS[i % SITE_COLORS.length]}
                  onRemove={() => removeSite(site.id)}
                  onCapture={() => handleCaptureSite(site.id)}
                  needsCapture={
                    site.pages.length > 0 && site.screenshots.size === 0
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Add site form */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            Add a site
          </h3>
          <form onSubmit={handleAddSite} className="flex gap-2">
            <div className="relative flex-1">
              <IconWorldSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="https://competitor.com"
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value)
                  setAddError("")
                }}
                className="h-8 pl-8"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              disabled={isAdding || !newUrl.trim()}
            >
              {isAdding ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <IconPlus className="size-4" />
                  Add Site
                </>
              )}
            </Button>
          </form>
          {addError && (
            <p className="text-sm text-destructive">{addError}</p>
          )}
        </div>

        {/* Matched pages table */}
        {hasMultipleSites && matchedPages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">
              Matched Pages
            </h3>
            <div className="overflow-hidden rounded-lg border">
              {/* Header */}
              <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
                <span className="flex-1 font-mono text-xs font-medium text-muted-foreground">
                  Path
                </span>
                {sites.map((site, i) => (
                  <span
                    key={site.id}
                    className="flex w-24 items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        SITE_COLORS[i % SITE_COLORS.length],
                      )}
                    />
                    <span className="truncate">{site.label}</span>
                  </span>
                ))}
              </div>
              {/* Rows */}
              <div className="max-h-48 overflow-y-auto">
                {matchedPages.map((mp) => (
                  <div
                    key={mp.path}
                    className="flex items-center gap-3 border-b px-4 py-2 last:border-b-0"
                  >
                    <span className="flex-1 truncate font-mono text-sm">
                      {mp.path}
                    </span>
                    {mp.sites.map((siteMeta, i) => (
                      <span key={siteMeta.siteId} className="flex w-24 justify-center">
                        {siteMeta.present ? (
                          <IconCheck className="size-4 text-primary" />
                        ) : (
                          <IconMinus className="size-4 text-muted-foreground/40" />
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Page selection per site (for newly added sites) */}
        {sites
          .filter((s) => s.pages.length > 0 && s.screenshots.size === 0)
          .map((site, i) => (
            <div key={site.id} className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    SITE_COLORS[
                      sites.indexOf(site) % SITE_COLORS.length
                    ],
                  )}
                />
                Select pages for {site.label}
              </h3>
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                {site.pages.map((page) => (
                  <div
                    key={page.path}
                    className="flex items-center gap-3 border-b px-4 py-2 last:border-b-0"
                  >
                    <Checkbox
                      checked={page.selected}
                      onCheckedChange={() =>
                        toggleSitePage(site.id, page.path)
                      }
                      id={`${site.id}-${page.path}`}
                    />
                    <label
                      htmlFor={`${site.id}-${page.path}`}
                      className="flex-1 cursor-pointer truncate font-mono text-sm"
                    >
                      {page.path}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Actions */}
        <div className="flex gap-2">
          {sites.some(
            (s) => s.pages.length > 0 && s.screenshots.size === 0,
          ) && (
            <Button
              onClick={() => {
                for (const site of sites) {
                  if (site.pages.length > 0 && site.screenshots.size === 0) {
                    handleCaptureSite(site.id)
                  }
                }
              }}
              size="lg"
              variant="secondary"
              disabled={sites.some((s) => s.isCapturing)}
            >
              {sites.some((s) => s.isCapturing) ? (
                <>
                  <IconLoader2 className="size-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <IconCamera className="size-4" />
                  Capture All Sites
                </>
              )}
            </Button>
          )}
          <Button
            onClick={onOpenComparisonCanvas}
            size="lg"
            disabled={!hasMultipleSites || !hasCapturedScreenshots}
            className="ml-auto"
          >
            <IconArrowsShuffle className="size-4" />
            Compare in Canvas
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SiteCard({
  site,
  colorClass,
  onRemove,
  onCapture,
  needsCapture,
}: {
  site: { id: string; label: string; pages: { path: string }[]; screenshots: Map<string, unknown>; isCapturing: boolean; captureProgress: { done: number; total: number } }
  colorClass: string
  onRemove: () => void
  onCapture: () => void
  needsCapture: boolean
}) {
  const selectedCount = site.pages.length
  const screenshotCount = site.screenshots.size

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", colorClass)} />
      <span className="font-mono text-sm font-medium">{site.label}</span>
      <Badge variant="secondary" className="font-mono text-[0.625rem]">
        {selectedCount} page{selectedCount !== 1 && "s"}
      </Badge>
      {screenshotCount > 0 && (
        <Badge variant="outline" className="font-mono text-[0.625rem]">
          {screenshotCount} shot{screenshotCount !== 1 && "s"}
        </Badge>
      )}
      {site.isCapturing && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <IconLoader2 className="size-3 animate-spin" />
          {site.captureProgress.done}/{site.captureProgress.total}
        </div>
      )}
      {needsCapture && !site.isCapturing && (
        <Button variant="ghost" size="icon-xs" onClick={onCapture}>
          <IconCamera className="size-3" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
      >
        <IconX className="size-3" />
      </Button>
    </div>
  )
}
