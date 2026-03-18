"use client"

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { type Breakpoint, type Screenshot, screenshotKey } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { IconGripVertical, IconExternalLink } from "@tabler/icons-react"
import ScreenshotCard from "./screenshot-card"

type ScreenshotGridProps = {
  pages: Array<{ path: string; fullUrl: string }>
  breakpoints: Breakpoint[]
  breakpointOrder: string[]
  screenshots: Map<string, Screenshot>
  onReorder: (order: string[]) => void
  onRetry: (pageUrl: string, breakpoint: Breakpoint) => void
  progress: { done: number; total: number }
  isCapturing: boolean
}

function SortableColumnHeader({ breakpoint }: { breakpoint: Breakpoint }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: breakpoint.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: Math.max(120, Math.min(400, breakpoint.width * 0.22)),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex shrink-0 cursor-grab items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-2 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <IconGripVertical className="size-3.5 text-muted-foreground" />
      <span className="truncate text-sm font-medium">{breakpoint.label}</span>
      <Badge variant="secondary" className="ml-auto font-mono text-[0.625rem]">
        {breakpoint.width}&times;{breakpoint.height}
      </Badge>
    </div>
  )
}

export default function ScreenshotGrid({
  pages,
  breakpoints,
  breakpointOrder,
  screenshots,
  onReorder,
  onRetry,
  progress,
  isCapturing,
}: ScreenshotGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const orderedBreakpoints = breakpointOrder
    .map((id) => breakpoints.find((b) => b.id === id))
    .filter(Boolean) as Breakpoint[]

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = breakpointOrder.indexOf(active.id as string)
    const newIndex = breakpointOrder.indexOf(over.id as string)

    const newOrder = [...breakpointOrder]
    newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, active.id as string)

    onReorder(newOrder)
  }

  return (
    <div className="w-full space-y-4">
      {isCapturing && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-sm text-muted-foreground">
            {progress.done} / {progress.total}
          </span>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="inline-flex min-w-full flex-col gap-3">
            {/* Column headers */}
            <div className="flex gap-3">
              {/* Row label spacer */}
              <div className="w-36 shrink-0" />
              <SortableContext
                items={breakpointOrder}
                strategy={horizontalListSortingStrategy}
              >
                {orderedBreakpoints.map((bp) => (
                  <SortableColumnHeader key={bp.id} breakpoint={bp} />
                ))}
              </SortableContext>
            </div>

            {/* Rows */}
            {pages.map((page) => (
              <div key={page.path} className="flex gap-3">
                {/* Row label */}
                <div className="flex w-36 shrink-0 items-start pt-2">
                  <a
                    href={page.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/link flex items-center gap-1 truncate font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="truncate">{page.path}</span>
                    <IconExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
                  </a>
                </div>

                {/* Screenshot cells */}
                {orderedBreakpoints.map((bp) => {
                  const key = screenshotKey(page.fullUrl, bp.id)
                  const screenshot = screenshots.get(key)

                  return (
                    <div key={bp.id} className="shrink-0">
                      <ScreenshotCard
                        screenshot={screenshot}
                        breakpoint={bp}
                        onRetry={() => onRetry(page.fullUrl, bp)}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  )
}
