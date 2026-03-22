export type Breakpoint = {
  id: string
  label: string
  width: number
  height: number
}

export type DiscoveredPage = {
  path: string
  selected: boolean
}

export type ScreenshotStatus = "idle" | "loading" | "done" | "error"

export type Screenshot = {
  pageUrl: string
  breakpointId: string
  status: ScreenshotStatus
  imageBase64?: string
  imageUrl?: string
  error?: string
}

export type SnapsiteState = {
  url: string
  isDiscovering: boolean
  pages: DiscoveredPage[]
  breakpoints: Breakpoint[]
  breakpointOrder: string[]
  screenshots: Map<string, Screenshot>
  isCapturing: boolean
  captureProgress: { done: number; total: number }
  scrollBeforeCapture: boolean
  deduplicatedGroups: Set<string>
}

export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { id: "wide", label: "Wide", width: 1920, height: 1080 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "laptop", label: "Laptop", width: 1366, height: 768 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "mobile", label: "Mobile", width: 375, height: 812 },
]

export function screenshotKey(pageUrl: string, breakpointId: string) {
  return `${pageUrl}::${breakpointId}`
}

export function groupPagesByParent(pages: DiscoveredPage[]) {
  const groups = new Map<string, DiscoveredPage[]>()

  // First pass: group child pages (2+ segments) by parent prefix
  for (const page of pages) {
    const segments = page.path.split("/").filter(Boolean)
    if (segments.length >= 2) {
      const parent = "/" + segments.slice(0, -1).join("/")
      const group = groups.get(parent) || []
      group.push(page)
      groups.set(parent, group)
    }
  }

  // Second pass: for root-level pages (1 segment like /articles),
  // if a group exists with that path as its parent, merge the page
  // into that group as the first item. Otherwise keep it ungrouped.
  const ungrouped: DiscoveredPage[] = []

  for (const page of pages) {
    const segments = page.path.split("/").filter(Boolean)
    if (segments.length >= 2) continue // already grouped above

    if (page.path !== "/" && groups.has(page.path)) {
      // /articles exists AND /articles/* children exist — merge it in front
      const group = groups.get(page.path)!
      group.unshift(page)
    } else {
      ungrouped.push(page)
    }
  }

  // Build final ordered map: ungrouped pages under "/" first, then groups
  const result = new Map<string, DiscoveredPage[]>()
  if (ungrouped.length > 0) {
    result.set("/", ungrouped)
  }
  for (const [parent, group] of groups) {
    result.set(parent, group)
  }

  return result
}
