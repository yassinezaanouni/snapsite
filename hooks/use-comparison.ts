import { create } from "zustand"
import {
  type Breakpoint,
  type ComparisonSite,
  type DiscoveredPage,
  type MatchedPage,
  type Screenshot,
  type ScreenshotStatus,
  screenshotKey,
} from "@/lib/types"

type ComparisonStore = {
  sites: ComparisonSite[]
  matchedPages: MatchedPage[]

  importFromCurrent: (
    url: string,
    pages: Array<{ path: string; fullUrl: string }>,
    screenshots: Map<string, Screenshot>,
  ) => void
  addSite: (url: string) => Promise<void>
  removeSite: (siteId: string) => void
  toggleSitePage: (siteId: string, path: string) => void
  captureSite: (
    siteId: string,
    breakpoints: Breakpoint[],
    scrollBeforeCapture: boolean,
  ) => Promise<void>
  computeMatches: () => void
  reset: () => void
}

function generateId() {
  return crypto.randomUUID().slice(0, 8)
}

function buildMatches(sites: ComparisonSite[]): MatchedPage[] {
  const allPaths = new Set<string>()
  for (const site of sites) {
    for (const page of site.pages) {
      if (page.selected) allPaths.add(page.path)
    }
  }

  const sortedPaths = Array.from(allPaths).sort((a, b) => {
    if (a === "/") return -1
    if (b === "/") return 1
    return a.localeCompare(b)
  })

  return sortedPaths.map((path) => ({
    path,
    sites: sites.map((site) => {
      const page = site.pages.find((p) => p.path === path && p.selected)
      return {
        siteId: site.id,
        fullUrl: path === "/" ? site.url : `${site.url}${path}`,
        present: !!page,
      }
    }),
  }))
}

export const useComparison = create<ComparisonStore>((set, get) => ({
  sites: [],
  matchedPages: [],

  importFromCurrent: (url, pages, screenshots) => {
    const label = (() => {
      try {
        return new URL(url).hostname
      } catch {
        return url
      }
    })()

    // Convert gridPages format to DiscoveredPage format
    const discoveredPages: DiscoveredPage[] = pages.map((p) => ({
      path: p.path,
      selected: true,
    }))

    // Check if this site is already imported
    const existing = get().sites.find((s) => s.url === url)
    if (existing) return

    const site: ComparisonSite = {
      id: generateId(),
      url,
      label,
      pages: discoveredPages,
      screenshots: new Map(screenshots),
      isCapturing: false,
      captureProgress: { done: 0, total: 0 },
    }

    set((s) => {
      const sites = [...s.sites, site]
      return { sites, matchedPages: buildMatches(sites) }
    })
  },

  addSite: async (url) => {
    const label = (() => {
      try {
        return new URL(url).hostname
      } catch {
        return url
      }
    })()

    const siteId = generateId()

    // Add site in discovering state
    const site: ComparisonSite = {
      id: siteId,
      url,
      label,
      pages: [],
      screenshots: new Map(),
      isCapturing: false,
      captureProgress: { done: 0, total: 0 },
    }

    set((s) => ({ sites: [...s.sites, site] }))

    // Discover pages
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

    set((s) => {
      const sites = s.sites.map((site) =>
        site.id === siteId ? { ...site, pages } : site,
      )
      return { sites, matchedPages: buildMatches(sites) }
    })
  },

  removeSite: (siteId) => {
    set((s) => {
      const sites = s.sites.filter((site) => site.id !== siteId)
      return { sites, matchedPages: buildMatches(sites) }
    })
  },

  toggleSitePage: (siteId, path) => {
    set((s) => {
      const sites = s.sites.map((site) =>
        site.id === siteId
          ? {
              ...site,
              pages: site.pages.map((p) =>
                p.path === path ? { ...p, selected: !p.selected } : p,
              ),
            }
          : site,
      )
      return { sites, matchedPages: buildMatches(sites) }
    })
  },

  captureSite: async (siteId, breakpoints, scrollBeforeCapture) => {
    const site = get().sites.find((s) => s.id === siteId)
    if (!site) return

    const selectedPages = site.pages.filter((p) => p.selected)
    const total = selectedPages.length * breakpoints.length
    if (total === 0) return

    // Set capturing state
    set((s) => ({
      sites: s.sites.map((st) =>
        st.id === siteId
          ? { ...st, isCapturing: true, captureProgress: { done: 0, total } }
          : st,
      ),
    }))

    // Initialize screenshots as loading
    const initMap = new Map(get().sites.find((s) => s.id === siteId)!.screenshots)
    for (const page of selectedPages) {
      const pageUrl = page.path === "/" ? site.url : `${site.url}${page.path}`
      for (const bp of breakpoints) {
        const key = screenshotKey(pageUrl, bp.id)
        initMap.set(key, {
          pageUrl,
          breakpointId: bp.id,
          status: "loading" as ScreenshotStatus,
        })
      }
    }

    set((s) => ({
      sites: s.sites.map((st) =>
        st.id === siteId ? { ...st, screenshots: initMap } : st,
      ),
    }))

    // Build task queue
    const tasks: Array<{
      pageUrl: string
      breakpointId: string
      width: number
      height: number
    }> = []

    for (const page of selectedPages) {
      const pageUrl = page.path === "/" ? site.url : `${site.url}${page.path}`
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

            const screenshot: Screenshot = !res.ok
              ? {
                  pageUrl: task.pageUrl,
                  breakpointId: task.breakpointId,
                  status: "error",
                  error: data.error || "Failed",
                }
              : {
                  pageUrl: task.pageUrl,
                  breakpointId: task.breakpointId,
                  status: "done",
                  imageBase64: data.image,
                }

            set((s) => ({
              sites: s.sites.map((st) => {
                if (st.id !== siteId) return st
                const newMap = new Map(st.screenshots)
                newMap.set(key, screenshot)
                return { ...st, screenshots: newMap }
              }),
            }))
          } catch (error) {
            set((s) => ({
              sites: s.sites.map((st) => {
                if (st.id !== siteId) return st
                const newMap = new Map(st.screenshots)
                newMap.set(key, {
                  pageUrl: task.pageUrl,
                  breakpointId: task.breakpointId,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                })
                return { ...st, screenshots: newMap }
              }),
            }))
          }

          done++
          set((s) => ({
            sites: s.sites.map((st) =>
              st.id === siteId
                ? { ...st, captureProgress: { done, total } }
                : st,
            ),
          }))
        }),
      )
    }

    set((s) => ({
      sites: s.sites.map((st) =>
        st.id === siteId ? { ...st, isCapturing: false } : st,
      ),
    }))
  },

  computeMatches: () => {
    set((s) => ({ matchedPages: buildMatches(s.sites) }))
  },

  reset: () => {
    set({ sites: [], matchedPages: [] })
  },
}))
