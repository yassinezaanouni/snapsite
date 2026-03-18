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
      "--disable-gpu",
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
      await page.setViewport({ width, height })
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      })

      if (scroll) {
        // Scroll through the entire page to trigger whileInView / IntersectionObserver animations
        await page.evaluate(async () => {
          const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
          const scrollHeight = document.body.scrollHeight
          const viewportHeight = window.innerHeight
          let currentY = 0

          while (currentY < scrollHeight) {
            window.scrollTo(0, currentY)
            await delay(100)
            currentY += viewportHeight / 2
          }

          // Scroll to very bottom then back to top
          window.scrollTo(0, scrollHeight)
          await delay(200)
          window.scrollTo(0, 0)
          await delay(300)
        })
      }

      // Wait for all images to finish loading
      await page.evaluate(async () => {
        const imgs = Array.from(document.querySelectorAll("img"))
        await Promise.all(
          imgs.map((img) => {
            if (img.complete) return Promise.resolve()
            return new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true })
              img.addEventListener("error", () => resolve(), { once: true })
              // Timeout fallback per image
              setTimeout(resolve, 5000)
            })
          }),
        )
      })

      // Also wait for background images and any final paints
      await new Promise((r) => setTimeout(r, 500))

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
