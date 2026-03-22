import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const createSession = mutation({
  args: {
    url: v.string(),
    pages: v.array(
      v.object({
        path: v.string(),
        fullUrl: v.string(),
      }),
    ),
    breakpoints: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    breakpointOrder: v.array(v.string()),
    screenshots: v.array(
      v.object({
        pageUrl: v.string(),
        breakpointId: v.string(),
        storageId: v.id("_storage"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", args)
  },
})

export const getSession = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("sessions", args.id)
    if (!id) return null

    const session = await ctx.db.get(id)
    if (!session) return null

    const screenshots = await Promise.all(
      session.screenshots.map(async (s) => ({
        pageUrl: s.pageUrl,
        breakpointId: s.breakpointId,
        imageUrl: await ctx.storage.getUrl(s.storageId),
      })),
    )

    return {
      url: session.url,
      pages: session.pages,
      breakpoints: session.breakpoints,
      breakpointOrder: session.breakpointOrder,
      screenshots,
    }
  },
})
