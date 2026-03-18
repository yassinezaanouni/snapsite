"use client"

import { useState } from "react"
import { type DiscoveredPage, groupPagesByParent } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { IconPlus, IconX, IconInfoCircle } from "@tabler/icons-react"

type PageListProps = {
  pages: DiscoveredPage[]
  baseUrl: string
  onToggle: (path: string) => void
  onAdd: (path: string) => void
  onRemove: (path: string) => void
  deduplicatedGroups: Set<string>
  onToggleDeduplicate: (parent: string) => void
  onSetDeduplicate: (parent: string, value: boolean) => void
  onSetGroupSelected: (paths: string[], selected: boolean) => void
}

export default function PageList({
  pages,
  baseUrl,
  onToggle,
  onAdd,
  onRemove,
  deduplicatedGroups,
  onToggleDeduplicate,
  onSetDeduplicate,
  onSetGroupSelected,
}: PageListProps) {
  const [customPath, setCustomPath] = useState("")

  const groups = groupPagesByParent(pages)

  // Count how many pages will actually be captured
  let effectiveCount = 0
  for (const [parent, group] of groups) {
    const isGrouped = parent !== "/" && group.length >= 2
    const isDeduplicated = isGrouped && deduplicatedGroups.has(parent)

    if (isDeduplicated) {
      const indexPage = group.find((p) => p.path === parent)
      const children = group.filter((p) => p.path !== parent)
      if (indexPage?.selected) effectiveCount++
      if (children[0]?.selected) effectiveCount++
    } else {
      effectiveCount += group.filter((p) => p.selected).length
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    let path = customPath.trim()
    if (!path) return
    if (!path.startsWith("/")) path = `/${path}`
    onAdd(path)
    setCustomPath("")
  }

  // Build render list
  const renderItems: Array<
    | { type: "page"; page: DiscoveredPage }
    | { type: "group"; parent: string; group: DiscoveredPage[]; deduplicated: boolean }
  > = []

  for (const [parent, group] of groups) {
    const isGrouped = parent !== "/" && group.length >= 2
    if (isGrouped) {
      renderItems.push({
        type: "group",
        parent,
        group,
        deduplicated: deduplicatedGroups.has(parent),
      })
    } else {
      for (const page of group) {
        renderItems.push({ type: "page", page })
      }
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Discovered Pages</h2>
          <p className="text-sm text-muted-foreground">
            {effectiveCount} page{effectiveCount !== 1 && "s"} will be captured
          </p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {new URL(baseUrl).hostname}
        </Badge>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="max-h-80 overflow-y-auto">
          {renderItems.map((item) => {
            if (item.type === "group") {
              return (
                <PageGroup
                  key={`group-${item.parent}`}
                  parent={item.parent}
                  group={item.group}
                  deduplicated={item.deduplicated}
                  onToggleDeduplicate={() => onToggleDeduplicate(item.parent)}
                  onSetDeduplicate={(value) => onSetDeduplicate(item.parent, value)}
                  onTogglePage={onToggle}
                  onRemovePage={onRemove}
                  onSetGroupSelected={onSetGroupSelected}
                />
              )
            }

            return (
              <PageRow
                key={item.page.path}
                page={item.page}
                indent={false}
                dimmed={!item.page.selected}
                onToggle={() => onToggle(item.page.path)}
                onRemove={() => onRemove(item.page.path)}
              />
            )
          })}
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
            {new URL(baseUrl).origin}
          </span>
          <Input
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="/custom-path"
            className="pl-[var(--prefix-width)] font-mono text-sm"
            style={
              {
                "--prefix-width": `${new URL(baseUrl).origin.length * 0.55 + 1.5}rem`,
              } as React.CSSProperties
            }
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="default"
          disabled={!customPath.trim()}
        >
          <IconPlus className="size-4" />
          Add Page
        </Button>
      </form>
    </div>
  )
}

function PageGroup({
  parent,
  group,
  deduplicated,
  onToggleDeduplicate,
  onSetDeduplicate,
  onTogglePage,
  onRemovePage,
  onSetGroupSelected,
}: {
  parent: string
  group: DiscoveredPage[]
  deduplicated: boolean
  onToggleDeduplicate: () => void
  onSetDeduplicate: (value: boolean) => void
  onTogglePage: (path: string) => void
  onRemovePage: (path: string) => void
  onSetGroupSelected: (paths: string[], selected: boolean) => void
}) {
  const indexPage = group.find((p) => p.path === parent)
  const children = group.filter((p) => p.path !== parent)
  const selectedInGroup = group.filter((p) => p.selected).length
  const allSelected = selectedInGroup === group.length
  const noneSelected = selectedInGroup === 0

  // When deduplicated: count index (if selected) + representative (if selected)
  const willCapture = deduplicated
    ? (indexPage?.selected ? 1 : 0) + (children[0]?.selected ? 1 : 0)
    : selectedInGroup

  function handleGroupCheckbox() {
    const paths = group.map((p) => p.path)
    const selectAll = !allSelected
    onSetGroupSelected(paths, selectAll)
    // When selecting all, more than 1 child is selected — disable deduplicate
    if (selectAll && children.length > 1) {
      onSetDeduplicate(false)
    }
  }

  function handleDeduplicate() {
    if (!deduplicated) {
      // Turning on: deselect all children except the first
      const toDeselect = children.slice(1).map((p) => p.path)
      if (toDeselect.length > 0) {
        onSetGroupSelected(toDeselect, false)
      }
    }
    onToggleDeduplicate()
  }

  return (
    <>
      {/* Group header */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <Checkbox
          checked={allSelected ? true : noneSelected ? false : "indeterminate"}
          onCheckedChange={handleGroupCheckbox}
          id={`group-${parent}`}
        />
        <label
          htmlFor={`group-${parent}`}
          className="flex-1 cursor-pointer font-mono text-sm font-medium text-muted-foreground"
        >
          {parent}/
        </label>
        <Badge variant="secondary" className="font-mono text-[0.625rem]">
          {deduplicated
            ? `${willCapture} will capture`
            : `${selectedInGroup}/${group.length}`}
        </Badge>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconInfoCircle className="size-3.5 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-56">
              <p>
                {deduplicated
                  ? "Capturing one representative page. Toggle off to select individually."
                  : "These pages share the same layout? Toggle on to capture only one."}
              </p>
            </TooltipContent>
          </Tooltip>
          <Label
            htmlFor={`dedup-${parent}`}
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Capture unique
          </Label>
          <Switch
            id={`dedup-${parent}`}
            checked={deduplicated}
            onCheckedChange={handleDeduplicate}
          />
        </div>
      </div>

      {/* Index page — always independent */}
      {indexPage && (
        <PageRow
          page={indexPage}
          indent
          dimmed={!indexPage.selected}
          onToggle={() => onTogglePage(indexPage.path)}
          onRemove={() => onRemovePage(indexPage.path)}
        />
      )}

      {/* Children */}
      {children.map((page, i) => (
        <PageRow
          key={page.path}
          page={page}
          indent
          dimmed={!page.selected}
          onToggle={() => {
            onTogglePage(page.path)
            // After toggling, figure out how many children will be selected
            const selectedAfter = children.filter((c) =>
              c.path === page.path ? !page.selected : c.selected,
            ).length
            // Auto-enable "same route" when exactly 1 child selected,
            // auto-disable when more than 1
            if (selectedAfter <= 1) {
              onSetDeduplicate(true)
            } else {
              onSetDeduplicate(false)
            }
          }}
          onRemove={() => onRemovePage(page.path)}
          badge={
            deduplicated && page.selected ? (
              <Badge variant="outline" className="font-mono text-[0.625rem]">
                [slug] &middot; 1 of {children.length}
              </Badge>
            ) : undefined
          }
        />
      ))}
    </>
  )
}

function PageRow({
  page,
  onToggle,
  onRemove,
  indent,
  dimmed = false,
  badge,
}: {
  page: DiscoveredPage
  onToggle: () => void
  onRemove: () => void
  indent: boolean
  dimmed?: boolean
  badge?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0",
        indent && "pl-8",
        dimmed && "opacity-50",
      )}
    >
      <Checkbox
        checked={page.selected}
        onCheckedChange={onToggle}
        id={`page-${page.path}`}
      />
      <label
        htmlFor={`page-${page.path}`}
        className="flex-1 cursor-pointer truncate font-mono text-sm"
      >
        {page.path}
      </label>
      {badge}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <IconX className="size-3.5" />
      </Button>
    </div>
  )
}
