import { NextRequest, NextResponse } from "next/server"
import puppeteer, { type Browser } from "puppeteer"

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance
  }

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  })

  browserInstance.on("disconnected", () => {
    browserInstance = null
  })

  return browserInstance
}

export async function POST(req: NextRequest) {
  try {
    const { url, width, height, scroll = true } = await req.json()

    if (!url || !width || !height) {
      return NextResponse.json(
        { error: "url, width, and height are required" },
        { status: 400 },
      )
    }

    const browser = await getBrowser()
    const page = await browser.newPage()

    try {
      // Emulate prefers-reduced-motion so frameworks that respect it
      // (Framer Motion with MotionConfig reducedMotion="user") skip animations
      await page.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: "reduce" },
      ])

      // Use CDP to fast-forward ALL browser-level animations (WAAPI + CSS)
      // This works at the engine level — Framer Motion's WAAPI animations
      // complete almost instantly instead of running for 500ms+
      const cdp = await page.createCDPSession()
      await cdp.send("Animation.enable")
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 10000 })

      await page.setViewport({ width, height })
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      })

      // Let hydration + fast-forwarded above-the-fold animations complete
      await new Promise((r) => setTimeout(r, 800))

      if (scroll) {
        // Scroll through to trigger IntersectionObserver / whileInView / lazy-load
        // Animations complete almost instantly due to 10000x playback rate
        await page.evaluate(async () => {
          const delay = (ms: number) =>
            new Promise((r) => setTimeout(r, ms))
          const scrollHeight = document.body.scrollHeight
          const viewportHeight = window.innerHeight
          let currentY = 0

          while (currentY < scrollHeight) {
            window.scrollTo({ top: currentY, behavior: "instant" })
            await delay(150)
            currentY += Math.floor(viewportHeight / 3)
          }

          window.scrollTo({ top: scrollHeight, behavior: "instant" })
          await delay(300)
        })
      }

      // Expand viewport to full page height so ALL elements are "in view"
      const fullHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      )
      await page.setViewport({
        width,
        height: Math.max(height, fullHeight),
      })
      await page.evaluate(() => window.scrollTo(0, 0))

      // Wait for viewport-expansion-triggered animations to fast-forward
      await new Promise((r) => setTimeout(r, 1000))

      // Inject CSS to force any remaining CSS animations to end state
      // The negative delay trick makes animations jump to their final keyframe
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-delay: -0.0001s !important;
            animation-duration: 0s !important;
            animation-play-state: paused !important;
            transition-delay: 0s !important;
            transition-duration: 0s !important;
          }
        `,
      })

      // Finish any WAAPI animations that are still lingering
      await page.evaluate(() => {
        for (const a of document.getAnimations()) {
          try {
            a.finish()
          } catch {}
        }
      })

      await new Promise((r) => setTimeout(r, 300))

      // Wait for network to settle (lazy images)
      await page
        .waitForNetworkIdle({ idleTime: 500, timeout: 10000 })
        .catch(() => {})

      // Wait for all images
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll("img"))
        await Promise.all(
          imgs.map((img) => {
            if (img.complete && img.naturalWidth > 0)
              return Promise.resolve()
            return new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true })
              img.addEventListener("error", () => resolve(), { once: true })
              setTimeout(resolve, 5000)
            })
          }),
        )
      })

      await new Promise((r) => setTimeout(r, 200))

      const screenshot = await page.screenshot({
        type: "png",
        fullPage: true,
      })

      const base64 = Buffer.from(screenshot).toString("base64")

      return NextResponse.json({ image: base64 })
    } finally {
      await page.close()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
