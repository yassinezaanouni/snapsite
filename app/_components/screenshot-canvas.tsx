"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type NodeChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  IconX,
  IconShare,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react"
import { type Breakpoint, type Screenshot, screenshotKey } from "@/lib/types"
import {
  ScreenshotFrameNode,
  PageLabelNode,
} from "./screenshot-canvas-node"

const nodeTypes = {
  screenshotFrame: ScreenshotFrameNode,
  pageLabel: PageLabelNode,
}

const SCALE = 0.5
const DEFAULT_SPACING = 100
const LABEL_WIDTH = 200

export type CanvasData = {
  pages: Array<{ path: string; fullUrl: string }>
  breakpoints: Breakpoint[]
  breakpointOrder: string[]
  screenshots: Map<string, Screenshot>
}

type CanvasDialogProps = CanvasData & {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteUrl?: string
}

function buildNodes(
  pages: CanvasData["pages"],
  breakpoints: Breakpoint[],
  breakpointOrder: string[],
  screenshots: Map<string, Screenshot>,
  spacing: number,
): Node[] {
  const orderedBreakpoints = breakpointOrder
    .map((id) => breakpoints.find((b) => b.id === id))
    .filter(Boolean) as Breakpoint[]

  const nodes: Node[] = []
  let y = 0

  for (const page of pages) {
    nodes.push({
      id: `label::${page.path}`,
      type: "pageLabel",
      position: { x: 0, y: y + 20 },
      data: { label: page.path, pagePath: page.path },
      connectable: false,
      draggable: false,
    })

    let x = LABEL_WIDTH

    for (const bp of orderedBreakpoints) {
      const key = screenshotKey(page.fullUrl, bp.id)
      const screenshot = screenshots.get(key)

      nodes.push({
        id: `frame::${page.path}::${bp.id}`,
        type: "screenshotFrame",
        position: { x, y },
        data: {
          screenshot,
          breakpoint: bp,
          scale: SCALE,
          pagePath: page.path,
        },
        connectable: false,
        draggable: true,
      })

      x += bp.width * SCALE + spacing
    }

    y += 800
  }

  return nodes
}

function repositionNodes(
  nodes: Node[],
  pages: Array<{ path: string }>,
  spacing: number,
): Node[] {
  const rowMaxHeight = new Map<string, number>()
  for (const node of nodes) {
    if (node.type !== "screenshotFrame") continue
    const pagePath = node.data.pagePath as string
    const h = node.measured?.height || 0
    rowMaxHeight.set(pagePath, Math.max(rowMaxHeight.get(pagePath) || 0, h))
  }

  const rowY = new Map<string, number>()
  let y = 0
  for (const page of pages) {
    rowY.set(page.path, y)
    y += (rowMaxHeight.get(page.path) || 500) + spacing * 1.2
  }

  let changed = false
  const result = nodes.map((node) => {
    const pagePath = node.data.pagePath as string | undefined
    if (!pagePath) return node

    const targetY =
      node.type === "pageLabel"
        ? (rowY.get(pagePath) || 0) + 20
        : rowY.get(pagePath) || 0

    if (Math.abs(node.position.y - targetY) < 1) return node
    changed = true
    return { ...node, position: { x: node.position.x, y: targetY } }
  })

  return changed ? result : nodes
}

// --- Undo/Redo helpers ---

function snapshotNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => ({ ...n, position: { ...n.position } }))
}

function ScreenshotCanvas({
  pages,
  breakpoints,
  breakpointOrder,
  screenshots,
  spacing,
  onClose,
}: CanvasData & {
  spacing: number
  onClose: () => void
}) {
  const [nodes, setNodes] = useState<Node[]>(() =>
    buildNodes(pages, breakpoints, breakpointOrder, screenshots, spacing),
  )
  const { fitView } = useReactFlow()
  const didInitialFit = useRef(false)

  // Rebuild nodes when data or spacing changes
  useEffect(() => {
    setNodes(
      buildNodes(pages, breakpoints, breakpointOrder, screenshots, spacing),
    )
    didInitialFit.current = false
  }, [pages, breakpoints, breakpointOrder, screenshots, spacing])

  // --- Undo / Redo ---
  const historyRef = useRef<{ past: Node[][]; future: Node[][] }>({
    past: [],
    future: [],
  })
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const saveSnapshot = useCallback(() => {
    historyRef.current.past.push(snapshotNodes(nodesRef.current))
    historyRef.current.future = []
  }, [])

  const undo = useCallback(() => {
    const { past, future } = historyRef.current
    if (past.length === 0) return
    const previous = past.pop()!
    future.push(snapshotNodes(nodesRef.current))
    setNodes(previous)
  }, [])

  const redo = useCallback(() => {
    const { past, future } = historyRef.current
    if (future.length === 0) return
    const next = future.pop()!
    past.push(snapshotNodes(nodesRef.current))
    setNodes(next)
  }, [])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        redo()
      }
      if (mod && e.key === "0") {
        e.preventDefault()
        fitView({ padding: 0.1 })
      }
      if (e.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [undo, redo, fitView, onClose])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasDimensionChange = changes.some((c) => c.type === "dimensions")

      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds)

        if (!hasDimensionChange) return updated

        const repositioned = repositionNodes(updated, pages, spacing)
        if (repositioned !== updated) {
          if (!didInitialFit.current) {
            didInitialFit.current = true
            requestAnimationFrame(() => fitView({ padding: 0.1 }))
          }
          return repositioned
        }

        return updated
      })
    },
    [pages, spacing, fitView],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      onNodesChange={onNodesChange}
      onNodeDragStart={saveSnapshot}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.05}
      maxZoom={2}
      panOnScroll
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  )
}

// --- Share logic ---

function base64ToBlob(base64: string): Blob {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i)
  }
  return new Blob([arr], { type: "image/png" })
}

function ShareButton({
  pages,
  breakpoints,
  breakpointOrder,
  screenshots,
  siteUrl,
}: CanvasData & { siteUrl?: string }) {
  const generateUploadUrl = useMutation(api.sessions.generateUploadUrl)
  const createSession = useMutation(api.sessions.createSession)
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      // Upload each done screenshot to Convex storage
      const uploadedScreenshots: Array<{
        pageUrl: string
        breakpointId: string
        storageId: Id<"_storage">
      }> = []

      for (const [, screenshot] of screenshots) {
        if (screenshot.status !== "done" || !screenshot.imageBase64) continue

        const uploadUrl = await generateUploadUrl()
        const blob = base64ToBlob(screenshot.imageBase64)
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        })
        const { storageId } = await result.json()

        uploadedScreenshots.push({
          pageUrl: screenshot.pageUrl,
          breakpointId: screenshot.breakpointId,
          storageId,
        })
      }

      // Create session
      const sessionId = await createSession({
        url: siteUrl || "",
        pages,
        breakpoints,
        breakpointOrder,
        screenshots: uploadedScreenshots,
      })

      // Copy link to clipboard
      const shareUrl = `${window.location.origin}/canvas/${sessionId}`
      await navigator.clipboard.writeText(shareUrl)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch (error) {
      console.error("Failed to share:", error)
    } finally {
      setSharing(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={sharing}
    >
      {sharing ? (
        <>
          <IconLoader2 className="size-3.5 animate-spin" />
          Sharing...
        </>
      ) : shared ? (
        <>
          <IconCheck className="size-3.5" />
          Link copied!
        </>
      ) : (
        <>
          <IconShare className="size-3.5" />
          Share
        </>
      )}
    </Button>
  )
}

// --- Main Dialog Export ---

export default function CanvasDialog({
  open,
  onOpenChange,
  pages,
  breakpoints,
  breakpointOrder,
  screenshots,
  siteUrl,
}: CanvasDialogProps) {
  const [spacing, setSpacing] = useState(DEFAULT_SPACING)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh w-dvw max-w-none -translate-x-0 -translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Screenshot Canvas</DialogTitle>

        {/* Floating toolbar */}
        <div className="flex items-center gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur-sm">
          <span className="text-sm font-semibold">Canvas View</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {pages.length} page{pages.length !== 1 && "s"} &times;{" "}
            {breakpoints.length} breakpoint{breakpoints.length !== 1 && "s"}
          </Badge>
          <div className="ml-auto flex items-center gap-3">
            {/* Spacing slider */}
            <div className="hidden items-center gap-2 sm:flex">
              <Label
                htmlFor="spacing-slider"
                className="cursor-pointer text-xs text-muted-foreground"
              >
                Spacing
              </Label>
              <input
                id="spacing-slider"
                type="range"
                min={20}
                max={300}
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="w-8 font-mono text-[10px] text-muted-foreground">
                {spacing}
              </span>
            </div>
            <div className="hidden items-center gap-1.5 border-l pl-3 text-xs text-muted-foreground lg:flex">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                ⌘Z
              </kbd>
              <span>undo</span>
              <kbd className="ml-1.5 rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                ⌘⇧Z
              </kbd>
              <span>redo</span>
              <kbd className="ml-1.5 rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                ⌘0
              </kbd>
              <span>fit</span>
            </div>
            <ShareButton
              pages={pages}
              breakpoints={breakpoints}
              breakpointOrder={breakpointOrder}
              screenshots={screenshots}
              siteUrl={siteUrl}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
            >
              <IconX />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="canvas-view min-h-0 flex-1">
          <ReactFlowProvider>
            <ScreenshotCanvas
              pages={pages}
              breakpoints={breakpoints}
              breakpointOrder={breakpointOrder}
              screenshots={screenshots}
              spacing={spacing}
              onClose={() => onOpenChange(false)}
            />
          </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Also export the canvas for standalone use (shared page)
export { ScreenshotCanvas, buildNodes, SCALE, DEFAULT_SPACING }
