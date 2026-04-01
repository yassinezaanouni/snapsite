import { NextRequest, NextResponse } from "next/server"
import type { Browser, CDPSession } from "puppeteer-core"

const IS_VERCEL = !!process.env.VERCEL

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance
  }

  if (IS_VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default
    const puppeteer = (await import("puppeteer-core")).default
    browserInstance = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    const puppeteer = (await import("puppeteer")).default
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    }) as unknown as Browser
  }

  browserInstance.on("disconnected", () => {
    browserInstance = null
  })

  return browserInstance
}

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const {
      url,
      width,
      height,
      scroll = true,
      animated = true,
    } = await req.json()

    if (!url || !width || !height) {
      return NextResponse.json(
        { error: "url, width, and height are required" },
        { status: 400 },
      )
    }

    const browser = await getBrowser()
    const page = await browser.newPage()

    try {
      let cdp: CDPSession | null = null

      if (animated) {
        await page.emulateMediaFeatures([
          { name: "prefers-reduced-motion", value: "reduce" },
        ])

        // Fast-forward all animations at 10000x speed (browser engine level)
        cdp = await page.createCDPSession()
        await cdp.send("Animation.enable")
        await cdp.send("Animation.setPlaybackRate", {
          playbackRate: 10000,
        })
      }

      await page.setViewport({ width, height })
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      })

      if (animated) {
        // Let hydration + fast-forwarded above-the-fold animations complete
        await new Promise((r) => setTimeout(r, 800))

        if (scroll) {
          // Scroll through to trigger IntersectionObserver / whileInView
          // Animations complete near-instantly at 10000x playback
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

        // Finish all current WAAPI animations to their end state
        await page.evaluate(() => {
          for (const a of document.getAnimations()) {
            try {
              a.finish()
            } catch {}
          }
        })

        // Inject CSS to block all CSS-level animations/transitions
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

        // FREEZE all future animations at creation (playbackRate: 0).
        // When we scroll back to top, exit animations are created but
        // paused at time 0 — which is the VISIBLE end-state of the
        // enter animation. Elements stay visible.
        await cdp!.send("Animation.setPlaybackRate", { playbackRate: 0 })

        // Scroll back to top — exit animations freeze at visible state
        await page.evaluate(() => window.scrollTo(0, 0))
        await new Promise((r) => setTimeout(r, 300))
      }

      // Wait for network to settle (images, fonts)
      await page
        .waitForNetworkIdle({
          idleTime: 500,
          timeout: animated ? 10000 : 5000,
        })
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

      // Lock all elements using viewport-relative heights (100vh, h-screen)
      // to their current pixel values. fullPage: true internally expands
      // the viewport which would make 100vh elements stretch to the full
      // document height. This locks them at the original viewport size.
      await page.evaluate((vh: number) => {
        const els = document.querySelectorAll<HTMLElement>("*")
        for (const el of els) {
          const rect = el.getBoundingClientRect()
          if (Math.abs(rect.height - vh) < 2) {
            el.style.setProperty("height", `${vh}px`, "important")
            el.style.setProperty("max-height", `${vh}px`, "important")
          }
        }
      }, height)

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
