"use client"

import { useState } from "react"
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
import { type Breakpoint, DEFAULT_BREAKPOINTS } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IconPlus } from "@tabler/icons-react"

type BreakpointBarProps = {
  breakpoints: Breakpoint[]
  breakpointOrder: string[]
  onToggle: (breakpoint: Breakpoint) => void
  onAdd: (breakpoint: Breakpoint) => void
  onReorder: (order: string[]) => void
}

export default function BreakpointBar({
  breakpoints,
  breakpointOrder,
  onToggle,
  onAdd,
  onReorder,
}: BreakpointBarProps) {
  const [customLabel, setCustomLabel] = useState("")
  const [customWidth, setCustomWidth] = useState("")
  const [customHeight, setCustomHeight] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault()
    const w = parseInt(customWidth)
    const h = parseInt(customHeight)
    if (!customLabel.trim() || isNaN(w) || isNaN(h) || w < 1 || h < 1) return

    onAdd({
      id: `custom-${customLabel.toLowerCase().replace(/\s+/g, "-")}-${w}`,
      label: customLabel.trim(),
      width: w,
      height: h,
    })

    setCustomLabel("")
    setCustomWidth("")
    setCustomHeight("")
    setDialogOpen(false)
  }

  const isSelected = (bp: Breakpoint) =>
    breakpoints.some((b) => b.id === bp.id)

  const orderedSelected = breakpointOrder
    .map((id) => breakpoints.find((b) => b.id === id))
    .filter(Boolean) as Breakpoint[]

  const unselectedDefaults = DEFAULT_BREAKPOINTS.filter(
    (bp) => !isSelected(bp),
  )

  const allItems = [...orderedSelected, ...unselectedDefaults]
  const allIds = allItems.map((bp) => bp.id)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const selectedIds = breakpointOrder
    const oldSelectedIndex = selectedIds.indexOf(active.id as string)
    const newSelectedIndex = selectedIds.indexOf(over.id as string)
    if (oldSelectedIndex === -1 || newSelectedIndex === -1) return

    const newOrder = [...selectedIds]
    newOrder.splice(oldSelectedIndex, 1)
    newOrder.splice(newSelectedIndex, 0, active.id as string)

    onReorder(newOrder)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={allIds} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-2.5">
          {allItems.map((bp) => (
            <SortableBreakpointCard
              key={bp.id}
              breakpoint={bp}
              selected={isSelected(bp)}
              onToggle={onToggle}
            />
          ))}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-3 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <IconPlus className="size-4" />
                <span className="text-xs font-medium">Custom</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Breakpoint</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCustom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bp-label">Label</Label>
                  <Input
                    id="bp-label"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Surface Pro"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="bp-width">Width (px)</Label>
                    <Input
                      id="bp-width"
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      placeholder="1280"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="bp-height">Height (px)</Label>
                    <Input
                      id="bp-height"
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      placeholder="800"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Add Breakpoint
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableBreakpointCard({
  breakpoint,
  selected,
  onToggle,
}: {
  breakpoint: Breakpoint
  selected: boolean
  onToggle: (bp: Breakpoint) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: breakpoint.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const previewWidth = Math.max(48, Math.min(100, breakpoint.width * 0.05))

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onToggle(breakpoint)}
      className={cn(
        "group relative flex shrink-0 cursor-grab flex-col items-center gap-2 rounded-lg border p-3 transition-all active:cursor-grabbing",
        selected
          ? "border-primary bg-primary/5 text-primary shadow-sm"
          : "bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
        isDragging && "z-10 shadow-lg",
      )}
      {...attributes}
      {...listeners}
    >
      <div
        className={cn(
          "rounded border border-dashed",
          selected
            ? "border-primary/30 bg-primary/10"
            : "border-muted-foreground/20 bg-muted/50",
        )}
        style={{
          width: previewWidth,
          aspectRatio: `${breakpoint.width}/${breakpoint.height}`,
        }}
      />
      <span className="text-xs font-medium">{breakpoint.label}</span>
      <Badge variant="secondary" className="font-mono text-[0.625rem]">
        {breakpoint.width}&times;{breakpoint.height}
      </Badge>
    </div>
  )
}
