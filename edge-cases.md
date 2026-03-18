# Page Grouping — Edge Cases & Future Considerations

## Edge Cases

- Index page (e.g. `/articles`) merged into its child group — must always be independently selectable, never treated as a slug
- Toggling "Same route" on must deselect non-representative children immediately
- Clicking a dimmed child checkbox must toggle that checkbox AND auto-disable "Same route" if >1 child becomes selected
- Auto-enable "Same route" when exactly 1 child is selected via checkbox
- `effectivePages` must respect deduplication: only index + first selected child sent to capture
- Groups with exactly 1 child should NOT show group header or "Same route" toggle
- Root-level pages (`/`, `/about`) never grouped — only pages with 2+ path segments
- Nested slugs (e.g. `/blog/2024/post-1`) — current grouping only looks at immediate parent, deeper nesting groups under `/blog/2024` not `/blog`
- Custom-added pages should integrate into existing groups if parent matches
- Removing all children from a group should clean up deduplication state for that parent

## Future Features

- Let user pick which child is the representative (not always first selected)
- Support multi-level grouping (e.g. `/blog/2024/*` and `/blog/2025/*` as separate groups under `/blog`)
- Persist deduplication choices across re-discoveries of the same site
- Bulk "Same route" toggle for all groups at once
