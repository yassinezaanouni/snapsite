"use client"

import { useState } from "react"
import { useSnapsite } from "@/hooks/use-snapsite"
import { groupPagesByParent } from "@/lib/types"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import UrlInput from "./_components/url-input"
import PageList from "./_components/page-list"
import BreakpointBar from "./_components/breakpoint-bar"
import ScreenshotGrid from "./_components/screenshot-grid"
import CanvasDialog from "./_components/screenshot-canvas"
import ComparisonPanel from "./_components/comparison-panel"
import { useComparison } from "@/hooks/use-comparison"
import { useSessions } from "@/hooks/use-sessions"
import {
  IconCamera,
  IconLoader2,
  IconInfoCircle,
  IconLayout,
  IconArrowsShuffle,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconTrash,
  IconHistory,
} from "@tabler/icons-react"

export default function Page() {
  const {
    url,
    isDiscovering,
    pages,
    breakpoints,
    breakpointOrder,
    screenshots,
    isCapturing,
    isUploading,
    sessionId,
    captureProgress,
    scrollBeforeCapture,
    deduplicatedGroups,
    discoverPages,
    togglePage,
    addPage,
    removePage,
    toggleBreakpoint,
    addBreakpoint,
    reorderBreakpoints,
    captureAllScreenshots,
    retryScreenshot,
    setScrollBeforeCapture,
    toggleDeduplicateGroup,
    setDeduplicateGroup,
    setGroupSelected,
  } = useSnapsite()

  const comparisonSites = useComparison((s) => s.sites)
  const comparisonMatchedPages = useComparison((s) => s.matchedPages)
  const importFromCurrent = useComparison((s) => s.importFromCurrent)
  const { sessions, removeSession } = useSessions()

  const [discoveryError, setDiscoveryError] = useState("")
  const [comparisonMode, setComparisonMode] = useState(false)
  const [comparisonCanvasOpen, setComparisonCanvasOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const hasPages = pages.length > 0
  const hasBreakpoints = breakpoints.length > 0
  const hasScreenshots = screenshots.size > 0

  const groups = groupPagesByParent(pages)
  const effectivePages = Array.from(groups.entries()).flatMap(
    ([parent, group]) => {
      if (
        parent !== "/" &&
        group.length >= 2 &&
        deduplicatedGroups.has(parent)
      ) {
        const indexPage = group.find((p) => p.path === parent)
        const children = group.filter((p) => p.path !== parent)
        const result: typeof group = []
        if (indexPage) result.push(indexPage)
        if (children[0]) result.push(children[0])
        return result
      }
      return group
    },
  )
  const selectedPages = effectivePages.filter((p) => p.selected)
  const canCapture = selectedPages.length > 0 && hasBreakpoints
  const totalScreenshots = selectedPages.length * breakpoints.length

  async function handleDiscover(url: string) {
    setDiscoveryError("")
    try {
      await discoverPages(url)
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Failed to discover pages",
      )
    }
  }

  function handleCapture() {
    captureAllScreenshots(
      url,
      effectivePages,
      breakpoints,
      scrollBeforeCapture,
    )
  }

  const gridPages = selectedPages.map((p) => ({
    path: p.path,
    fullUrl: p.path === "/" ? url : `${url}${p.path}`,
  }))

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary">
            <IconCamera className="size-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Snapsite
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Hero — before discovery */}
        {!hasPages && (
          <section className="flex flex-col items-center gap-6 py-20">
            <div className="space-y-3 text-center">
              <h1 className="text-4xl font-semibold tracking-tight">
                Audit any website visually
              </h1>
              <p className="mx-auto max-w-lg text-lg text-muted-foreground">
                Discover pages, pick breakpoints, and capture full-page
                screenshots in one click.
              </p>
            </div>
            <div className="w-full max-w-2xl">
              <UrlInput
                onSubmit={handleDiscover}
                isLoading={isDiscovering}
                defaultValue={url}
              />
            </div>
            {discoveryError && (
              <p className="text-sm text-destructive">{discoveryError}</p>
            )}

            {/* Recent sessions */}
            {sessions.length > 0 && (
              <div className="w-full max-w-2xl space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <IconHistory className="size-4" />
                  Recent Sessions
                </h3>
                <div className="space-y-2">
                  {sessions.slice(0, 5).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-sm font-medium">
                            {session.hostname}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 font-mono text-[0.625rem]"
                          >
                            {session.pageCount} page
                            {session.pageCount !== 1 && "s"} &times;{" "}
                            {session.breakpointCount} bp
                            {session.breakpointCount !== 1 && "s"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(session.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(`/canvas/${session.id}`, "_blank")
                        }
                      >
                        <IconExternalLink className="size-3.5" />
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeSession(session.id)}
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* After discovery */}
        {hasPages && (
          <div className="space-y-8">
            {/* Compact URL bar */}
            <section>
              <UrlInput
                onSubmit={handleDiscover}
                isLoading={isDiscovering}
                defaultValue={url}
              />
              {discoveryError && (
                <p className="mt-2 text-sm text-destructive">
                  {discoveryError}
                </p>
              )}
            </section>

            {/* Two-column configuration */}
            <div className="animate-in fade-in grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Pages panel */}
              <section className="lg:col-span-3">
                <Card className="h-full gap-0 pb-0">
                  <CardHeader className="border-b">
                    <CardTitle className="text-base">Pages</CardTitle>
                    <CardDescription>
                      {selectedPages.length} of {pages.length} page
                      {pages.length !== 1 && "s"} selected for capture
                    </CardDescription>
                    <CardAction>
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs"
                      >
                        {new URL(url).hostname}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="px-0">
                    <PageList
                      pages={pages}
                      baseUrl={url}
                      onToggle={togglePage}
                      onAdd={addPage}
                      onRemove={removePage}
                      deduplicatedGroups={deduplicatedGroups}
                      onToggleDeduplicate={toggleDeduplicateGroup}
                      onSetDeduplicate={setDeduplicateGroup}
                      onSetGroupSelected={setGroupSelected}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Breakpoints */}
              <section className="lg:col-span-2">
                <Card className="h-full">
                  <CardHeader className="border-b">
                    <CardTitle className="text-base">Breakpoints</CardTitle>
                    <CardDescription>
                      {breakpoints.length} viewport
                      {breakpoints.length !== 1 && "s"} selected
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BreakpointBar
                      breakpoints={breakpoints}
                      breakpointOrder={breakpointOrder}
                      onToggle={toggleBreakpoint}
                      onAdd={addBreakpoint}
                      onReorder={reorderBreakpoints}
                    />
                  </CardContent>
                </Card>
              </section>

              {/* Capture — full width */}
              <section className="lg:col-span-5">
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <IconInfoCircle className="size-3.5 cursor-help text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-56">
                          <p>
                            Scroll through each page before capturing to
                            trigger scroll-based animations and lazy-loaded
                            content.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <Label
                        htmlFor="scroll-toggle"
                        className="cursor-pointer text-sm"
                      >
                        Scroll before capture
                      </Label>
                      <Switch
                        id="scroll-toggle"
                        checked={scrollBeforeCapture}
                        onCheckedChange={setScrollBeforeCapture}
                      />
                    </div>
                    {isCapturing && (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${captureProgress.total > 0 ? (captureProgress.done / captureProgress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {captureProgress.done}/{captureProgress.total}
                        </span>
                      </div>
                    )}
                    <Button
                      onClick={handleCapture}
                      disabled={isCapturing || !canCapture}
                      size="lg"
                      className="ml-auto"
                    >
                      {isCapturing ? (
                        <>
                          <IconLoader2 className="size-4 animate-spin" />
                          Capturing...
                        </>
                      ) : (
                        <>
                          <IconCamera className="size-4" />
                          Capture {totalScreenshots} Screenshot
                          {totalScreenshots !== 1 && "s"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </section>
            </div>

            {/* Screenshot Grid */}
            {hasScreenshots && (
              <section className="animate-in fade-in space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Screenshots</h2>
                  <div className="flex items-center gap-2">
                    {sessionId && (
                      <div className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1">
                        <a
                          href={`/canvas/${sessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-40 truncate font-mono text-xs text-foreground hover:underline"
                        >
                          /canvas/{sessionId}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/canvas/${sessionId}`
                            navigator.clipboard.writeText(shareUrl).catch(() => {})
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                          }}
                        >
                          {copied ? (
                            <IconCheck className="size-3" />
                          ) : (
                            <IconCopy className="size-3" />
                          )}
                        </Button>
                      </div>
                    )}
                    {isUploading && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconLoader2 className="size-3 animate-spin" />
                        Uploading...
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!comparisonMode) {
                          importFromCurrent(url, gridPages, screenshots)
                        }
                        setComparisonMode(!comparisonMode)
                      }}
                    >
                      <IconArrowsShuffle className="size-4" />
                      {comparisonMode ? "Hide Compare" : "Compare"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!sessionId}
                      onClick={() =>
                        window.open(`/canvas/${sessionId}`, "_blank")
                      }
                    >
                      <IconLayout className="size-4" />
                      Show in Canvas
                    </Button>
                  </div>
                </div>
                <ScreenshotGrid
                  pages={gridPages}
                  breakpoints={breakpoints}
                  breakpointOrder={breakpointOrder}
                  screenshots={screenshots}
                  onReorder={reorderBreakpoints}
                  onRetry={(pageUrl, bp) =>
                    retryScreenshot(pageUrl, bp, scrollBeforeCapture)
                  }
                  progress={captureProgress}
                  isCapturing={isCapturing}
                />
                {comparisonMode && (
                  <ComparisonPanel
                    breakpoints={breakpoints}
                    scrollBeforeCapture={scrollBeforeCapture}
                    onOpenComparisonCanvas={() =>
                      setComparisonCanvasOpen(true)
                    }
                  />
                )}
                {comparisonCanvasOpen && (
                  <CanvasDialog
                    open
                    onOpenChange={setComparisonCanvasOpen}
                    pages={gridPages}
                    breakpoints={breakpoints}
                    breakpointOrder={breakpointOrder}
                    screenshots={screenshots}
                    comparisonData={{
                      sites: comparisonSites,
                      matchedPages: comparisonMatchedPages,
                    }}
                  />
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
