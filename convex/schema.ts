import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  sessions: defineTable({
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
  }),
})
