import { create } from "zustand"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { useSessions } from "./use-sessions"
import {
  type Breakpoint,
  type DiscoveredPage,
  type Screenshot,
  type ScreenshotStatus,
  type SnapsiteState,
  DEFAULT_BREAKPOINTS,
  screenshotKey,
} from "@/lib/types"
import { base64ToBlob } from "@/lib/utils"

// Lazy Convex HTTP client (no WebSocket, just HTTP calls)
let convexClient: ConvexHttpClient | null = null
function getConvex(): ConvexHttpClient {
  if (!convexClient) {
    convexClient = new ConvexHttpClient(
      process.env.NEXT_PUBLIC_CONVEX_URL!,
    )
  }
  return convexClient
}

async function uploadToStorage(imageBase64: string): Promise<string> {
  const client = getConvex()
  const uploadUrl: string = await client.mutation(
    api.sessions.generateUploadUrl,
  )
  const blob = base64ToBlob(imageBase64)
  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  })
  const { storageId } = await result.json()
  return storageId
}

type SnapsiteStore = SnapsiteState & {
  discoverPages: (url: string) => Promise<void>
  togglePage: (path: string) => void
  addPage: (path: string) => void
  removePage: (path: string) => void
  setGroupSelected: (paths: string[], selected: boolean) => void
  toggleBreakpoint: (breakpoint: Breakpoint) => void
  addBreakpoint: (breakpoint: Breakpoint) => void
  removeBreakpoint: (id: string) => void
  reorderBreakpoints: (order: string[]) => void
  captureAllScreenshots: (
    url: string,
    pages: DiscoveredPage[],
    breakpoints: Breakpoint[],
    scrollBeforeCapture: boolean,
  ) => Promise<void>
  retryScreenshot: (
    pageUrl: string,
    breakpoint: Breakpoint,
    scrollBeforeCapture: boolean,
  ) => Promise<void>
  setScrollBeforeCapture: (value: boolean) => void
  toggleDeduplicateGroup: (parent: string) => void
  setDeduplicateGroup: (parent: string, value: boolean) => void
}

export const useSnapsite = create<SnapsiteStore>((set, get) => ({
  // State
  url: "",
  isDiscovering: false,
  pages: [],
  breakpoints: DEFAULT_BREAKPOINTS.filter((b) =>
    ["desktop", "tablet", "mobile"].includes(b.id),
  ),
  breakpointOrder: ["desktop", "tablet", "mobile"],
  screenshots: new Map(),
  isCapturing: false,
  captureProgress: { done: 0, total: 0 },
  scrollBeforeCapture: true,
  deduplicatedGroups: new Set<string>(),
  sessionId: null,
  isUploading: false,

  // Page actions
  discoverPages: async (url) => {
    set({ url, isDiscovering: true, sessionId: null })

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Discovery failed")
      }

      const pages: DiscoveredPage[] = data.paths.map((path: string) => ({
        path,
        selected: true,
      }))

      set({ pages })
    } finally {
      set({ isDiscovering: false })
    }
  },

  togglePage: (path) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.path === path ? { ...p, selected: !p.selected } : p,
      ),
    })),

  addPage: (path) =>
    set((s) => {
      if (s.pages.some((p) => p.path === path)) return s
      return { pages: [...s.pages, { path, selected: true }] }
    }),

  removePage: (path) =>
    set((s) => ({ pages: s.pages.filter((p) => p.path !== path) })),

  setGroupSelected: (paths, selected) =>
    set((s) => {
      const pathSet = new Set(paths)
      return {
        pages: s.pages.map((p) =>
          pathSet.has(p.path) ? { ...p, selected } : p,
        ),
      }
    }),

  // Breakpoint actions
  toggleBreakpoint: (breakpoint) =>
    set((s) => {
      const exists = s.breakpoints.some((b) => b.id === breakpoint.id)
      if (exists) {
        return {
          breakpoints: s.breakpoints.filter((b) => b.id !== breakpoint.id),
          breakpointOrder: s.breakpointOrder.filter(
            (id) => id !== breakpoint.id,
          ),
        }
      }
      return {
        breakpoints: [...s.breakpoints, breakpoint],
        breakpointOrder: [...s.breakpointOrder, breakpoint.id],
      }
    }),

  addBreakpoint: (breakpoint) =>
    set((s) => {
      if (s.breakpoints.some((b) => b.id === breakpoint.id)) return s
      return {
        breakpoints: [...s.breakpoints, breakpoint],
        breakpointOrder: [...s.breakpointOrder, breakpoint.id],
      }
    }),

  removeBreakpoint: (id) =>
    set((s) => ({
      breakpoints: s.breakpoints.filter((b) => b.id !== id),
      breakpointOrder: s.breakpointOrder.filter((bId) => bId !== id),
    })),

  reorderBreakpoints: (order) => set({ breakpointOrder: order }),

  // Screenshot actions
  captureAllScreenshots: async (url, pages, breakpoints, scrollBeforeCapture) => {
    const selectedPages = pages.filter((p) => p.selected)
    const total = selectedPages.length * breakpoints.length

    if (total === 0) return

    set({
      isCapturing: true,
      isUploading: true,
      sessionId: null,
      captureProgress: { done: 0, total },
    })

    // Initialize all screenshots as loading
    const initMap = new Map<string, Screenshot>()
    for (const page of selectedPages) {
      const pageUrl = page.path === "/" ? url : `${url}${page.path}`
      for (const bp of breakpoints) {
        const key = screenshotKey(pageUrl, bp.id)
        initMap.set(key, {
          pageUrl,
          breakpointId: bp.id,
          status: "loading" as ScreenshotStatus,
        })
      }
    }
    set({ screenshots: initMap })

    // Build task queue
    const tasks: Array<{
      pageUrl: string
      breakpointId: string
      width: number
      height: number
    }> = []

    for (const page of selectedPages) {
      const pageUrl = page.path === "/" ? url : `${url}${page.path}`
      for (const bp of breakpoints) {
        tasks.push({
          pageUrl,
          breakpointId: bp.id,
          width: bp.width,
          height: bp.height,
        })
      }
    }

    // Capture in batches of 3, upload each success in the background
    let done = 0
    const batchSize = 3
    const uploadPromises: Promise<void>[] = []

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (task) => {
          const key = screenshotKey(task.pageUrl, task.breakpointId)

          try {
            const res = await fetch("/api/screenshot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: task.pageUrl,
                width: task.width,
                height: task.height,
                scroll: scrollBeforeCapture,
              }),
            })

            const data = await res.json()

            if (!res.ok) {
              set((s) => {
                const newMap = new Map(s.screenshots)
                newMap.set(key, {
                  pageUrl: task.pageUrl,
                  breakpointId: task.breakpointId,
                  status: "error",
                  error: data.error || "Failed",
                })
                return { screenshots: newMap }
              })
            } else {
              // Store base64 locally for instant display
              set((s) => {
                const newMap = new Map(s.screenshots)
                newMap.set(key, {
                  pageUrl: task.pageUrl,
                  breakpointId: task.breakpointId,
                  status: "done",
                  imageBase64: data.image,
                })
                return { screenshots: newMap }
              })

              // Upload to Convex in the background (non-blocking)
              uploadPromises.push(
                uploadToStorage(data.image)
                  .then((storageId) => {
                    set((s) => {
                      const newMap = new Map(s.screenshots)
                      const existing = newMap.get(key)
                      if (existing) {
                        newMap.set(key, { ...existing, storageId })
                      }
                      return { screenshots: newMap }
                    })
                  })
                  .catch(() => {
                    // Upload failed — screenshot still works locally
                  }),
              )
            }
          } catch (error) {
            set((s) => {
              const newMap = new Map(s.screenshots)
              newMap.set(key, {
                pageUrl: task.pageUrl,
                breakpointId: task.breakpointId,
                status: "error",
                error:
                  error instanceof Error ? error.message : "Unknown error",
              })
              return { screenshots: newMap }
            })
          }

          done++
          set({ captureProgress: { done, total } })
        }),
      )
    }

    set({ isCapturing: false })

    // Wait for all background uploads to finish
    await Promise.all(uploadPromises)

    // Auto-create shareable session
    try {
      const client = getConvex()
      const sessionPages = selectedPages.map((p) => ({
        path: p.path,
        fullUrl: p.path === "/" ? url : `${url}${p.path}`,
      }))

      const screenshotEntries: Array<{
        pageUrl: string
        breakpointId: string
        storageId: string
      }> = []

      for (const [, s] of get().screenshots) {
        if (s.status === "done" && s.storageId) {
          screenshotEntries.push({
            pageUrl: s.pageUrl,
            breakpointId: s.breakpointId,
            storageId: s.storageId,
          })
        }
      }

      const sessionId = await client.mutation(
        api.sessions.createSession,
        {
          url,
          pages: sessionPages,
          breakpoints,
          breakpointOrder: get().breakpointOrder,
          screenshots: screenshotEntries as Array<{
            pageUrl: string
            breakpointId: string
            storageId: import("@/convex/_generated/dataModel").Id<"_storage">
          }>,
        },
      )

      const sid = sessionId as string
      set({ sessionId: sid, isUploading: false })

      // Save to session history (localStorage)
      const hostname = (() => {
        try { return new URL(url).hostname } catch { return url }
      })()
      useSessions.getState().addSession({
        id: sid,
        url,
        hostname,
        pageCount: sessionPages.length,
        breakpointCount: breakpoints.length,
        screenshotCount: screenshotEntries.length,
      })
    } catch {
      set({ isUploading: false })
    }
  },

  retryScreenshot: async (pageUrl, breakpoint, scrollBeforeCapture) => {
    const key = screenshotKey(pageUrl, breakpoint.id)

    set((s) => {
      const newMap = new Map(s.screenshots)
      newMap.set(key, {
        pageUrl,
        breakpointId: breakpoint.id,
        status: "loading",
      })
      return { screenshots: newMap }
    })

    try {
      const res = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: pageUrl,
          width: breakpoint.width,
          height: breakpoint.height,
          scroll: scrollBeforeCapture,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        set((s) => {
          const newMap = new Map(s.screenshots)
          newMap.set(key, {
            pageUrl,
            breakpointId: breakpoint.id,
            status: "error",
            error: data.error || "Failed",
          })
          return { screenshots: newMap }
        })
      } else {
        set((s) => {
          const newMap = new Map(s.screenshots)
          newMap.set(key, {
            pageUrl,
            breakpointId: breakpoint.id,
            status: "done",
            imageBase64: data.image,
          })
          return { screenshots: newMap }
        })
      }
    } catch (error) {
      set((s) => {
        const newMap = new Map(s.screenshots)
        newMap.set(key, {
          pageUrl,
          breakpointId: breakpoint.id,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        return { screenshots: newMap }
      })
    }
  },

  // Settings
  setScrollBeforeCapture: (value) => set({ scrollBeforeCapture: value }),

  toggleDeduplicateGroup: (parent) =>
    set((s) => {
      const next = new Set(s.deduplicatedGroups)
      if (next.has(parent)) {
        next.delete(parent)
      } else {
        next.add(parent)
      }
      return { deduplicatedGroups: next }
    }),

  setDeduplicateGroup: (parent, value) =>
    set((s) => {
      const next = new Set(s.deduplicatedGroups)
      if (value) {
        next.add(parent)
      } else {
        next.delete(parent)
      }
      return { deduplicatedGroups: next }
    }),
}))
