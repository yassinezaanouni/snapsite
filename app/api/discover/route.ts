import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status}` },
        { status: 400 },
      )
    }

    const html = await response.text()

    const hrefRegex = /href=["']([^"']+)["']/gi
    const paths = new Set<string>(["/"])
    let match: RegExpExecArray | null

    while ((match = hrefRegex.exec(html)) !== null) {
      const href = match[1]

      // Skip anchors, mailto, tel, javascript, etc.
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        continue
      }

      try {
        const resolved = new URL(href, parsedUrl.origin)

        // Only same-origin links
        if (resolved.origin !== parsedUrl.origin) continue

        // Skip assets
        if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip)$/i.test(resolved.pathname)) {
          continue
        }

        // Normalize path
        let path = resolved.pathname
        if (path !== "/" && path.endsWith("/")) {
          path = path.slice(0, -1)
        }

        paths.add(path)
      } catch {
        // Skip malformed URLs
      }
    }

    const sortedPaths = Array.from(paths).sort((a, b) => {
      if (a === "/") return -1
      if (b === "/") return 1
      return a.localeCompare(b)
    })

    return NextResponse.json({ paths: sortedPaths })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
