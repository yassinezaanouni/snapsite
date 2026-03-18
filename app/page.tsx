"use client"

import { useState } from "react"
import { useSnapsite } from "@/hooks/use-snapsite"
import { groupPagesByParent } from "@/lib/types"
import { Separator } from "@/components/ui/separator"
import UrlInput from "./_components/url-input"
import PageList from "./_components/page-list"
import BreakpointBar from "./_components/breakpoint-bar"
import ScreenshotGrid from "./_components/screenshot-grid"
import { IconCamera } from "@tabler/icons-react"

export default function Page() {
  const {
    url,
    isDiscovering,
    pages,
    breakpoints,
    breakpointOrder,
    screenshots,
    isCapturing,
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

  const [discoveryError, setDiscoveryError] = useState("")

  const hasPages = pages.length > 0
  const hasBreakpoints = breakpoints.length > 0
  const hasScreenshots = screenshots.size > 0

  // Build the effective page list respecting deduplicated groups
  const groups = groupPagesByParent(pages)
  const effectivePages = Array.from(groups.entries()).flatMap(
    ([parent, group]) => {
      if (parent !== "/" && group.length >= 2 && deduplicatedGroups.has(parent)) {
        // Keep the index page (if exists) + one child representative
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
    captureAllScreenshots(url, effectivePages, breakpoints, scrollBeforeCapture)
  }

  const gridPages = selectedPages.map((p) => ({
    path: p.path,
    fullUrl: p.path === "/" ? url : `${url}${p.path}`,
  }))

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <IconCamera className="size-6 text-primary" />
          <h1 className="text-xl font-semibold">Snapsite</h1>
          <span className="text-sm text-muted-foreground">
            Visual Website Audit Tool
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* URL Input — always visible */}
        <section className="flex flex-col items-center gap-4 py-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Audit any website visually
            </h2>
            <p className="text-muted-foreground">
              Paste a URL to discover pages, pick breakpoints, and capture
              screenshots in a grid.
            </p>
          </div>
          <UrlInput
            onSubmit={handleDiscover}
            isLoading={isDiscovering}
            defaultValue={url}
          />
          {discoveryError && (
            <p className="text-sm text-destructive">{discoveryError}</p>
          )}
        </section>

        {/* Pages — after discovery */}
        {hasPages && (
          <>
            <Separator />
            <section className="flex justify-center">
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
            </section>
          </>
        )}

        {/* Breakpoints — after pages discovered */}
        {hasPages && (
          <>
            <Separator />
            <section className="flex justify-center">
              <BreakpointBar
                breakpoints={breakpoints}
                breakpointOrder={breakpointOrder}
                onToggle={toggleBreakpoint}
                onAdd={addBreakpoint}
                onReorder={reorderBreakpoints}
                onCapture={handleCapture}
                isCapturing={isCapturing}
                canCapture={canCapture}
                scrollBeforeCapture={scrollBeforeCapture}
                onScrollBeforeCaptureChange={setScrollBeforeCapture}
              />
            </section>
          </>
        )}

        {/* Screenshot Grid — after capture starts */}
        {hasScreenshots && (
          <>
            <Separator />
            <section>
              <ScreenshotGrid
                pages={gridPages}
                breakpoints={breakpoints}
                breakpointOrder={breakpointOrder}
                screenshots={screenshots}
                onReorder={reorderBreakpoints}
                onRetry={(pageUrl, bp) => retryScreenshot(pageUrl, bp, scrollBeforeCapture)}
                progress={captureProgress}
                isCapturing={isCapturing}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
