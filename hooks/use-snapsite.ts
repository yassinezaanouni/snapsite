import { create } from "zustand"
import {
  type Breakpoint,
  type DiscoveredPage,
  type Screenshot,
  type ScreenshotStatus,
  type SnapsiteState,
  DEFAULT_BREAKPOINTS,
  screenshotKey,
} from "@/lib/types"

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

  // Page actions
  discoverPages: async (url) => {
    set({ url, isDiscovering: true })

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

    set({ isCapturing: true, captureProgress: { done: 0, total } })

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

    // Process in batches of 3
    let done = 0
    const batchSize = 3

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
