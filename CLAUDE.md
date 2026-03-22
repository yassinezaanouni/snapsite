# Project Rules

## Folder Structure

Page-specific components are colocated with their pages using `_components/` directories. Shared components, hooks, and utilities live in top-level directories.

```
app/
  layout.tsx
  page.tsx
  globals.css
  about/
    page.tsx
    _components/
      about-hero.tsx
      mission.tsx
      team-section.tsx
  blog/
    page.tsx
    _components/
      post-list.tsx
      post-card.tsx

components/
  ui/              # shadcn components
  layout/          # layout components (header, footer, etc.)
  sections/        # shared section components
  icons/           # custom SVG icons
  providers/       # context providers

hooks/             # custom hooks

lib/
  utils.ts         # cn() and shared utilities
  types.ts         # type definitions

public/
  images/
    home/
    about/
    blog/
```

## Styling

- Always use shadcn components
- Use Tailwind CSS utility classes - prefer utilities over custom CSS
- Use `space-y-*` for vertical spacing instead of flex with gap when appropriate
- Use utility classes like `hero-padding`, `section-padding`, `container`, `bigger-container` defined in globals.css
- For grids, use shorthand `gap-*` when X and Y gaps are equal. Only use explicit `gap-x-*` and `gap-y-*` when they need to be different
- Never use arbitrary color values like `bg-[#09090b]` - always check globals.css first and use semantic tokens (`bg-foreground`, `bg-primary`, `bg-muted`, etc.)
- Use shadcn-standard color token names — never invent custom color names like `grain-amber`. The brand/accent color uses `accent` tokens: `bg-accent`, `text-accent`, `text-accent-foreground`, `bg-accent-hover`, `bg-accent-light`, `bg-accent-subtle`
- For custom utilities with `@apply`, use `@layer utilities { .class { @apply ... } }` - not `@utility` which only accepts raw CSS
- `border-border` is already applied globally via `* { @apply border-border }` in globals.css — never add it to elements. Just use `border`, `border-t`, `border-b`, `border-l`, `border-r` directly
- Avoid arbitrary values — use Tailwind's standard scale whenever possible:
  - Font sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`... (arbitrary like `text-[0.625rem]` is fine for sub-xs sizes)
  - Line heights: `leading-none`, `leading-tight`, `leading-snug`, `leading-normal`, `leading-relaxed`, `leading-loose`
  - Max widths: `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl`...
  - Font weights: `font-normal`, `font-medium`, `font-semibold`, `font-bold`
  - Shadows: `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`
  - Rotations: `rotate-1`, `rotate-2`, `rotate-3`, `rotate-6`
  - Sizing: use `size-*` for equal width/height (e.g. `size-2` not `h-2 w-2`)
- For responsive headings, use Tailwind breakpoints: `text-4xl md:text-5xl lg:text-6xl` instead of `text-[clamp(...)]`
- No inline `style={{}}` for colors — use semantic tokens

## Components

- Button component has built-in tooltip support via `tooltip` and `tooltipSide` props
- Use `asChild` prop with Button when wrapping Link components
- Never pass `className` to Button for styling — use the existing `variant` and `size` props instead
- Use Next.js `Link` from `next/link` instead of `<a>` tags for all internal navigation
- Icons should be placed in `components/icons/` with proper SVG props typing:
  ```tsx
  export const IconName = (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      ...
    </svg>
  );
  ```

## Structure

- Page-specific components go in `app/<page>/_components/`
- Shared section components go in `components/sections/`
- Layout components go in `components/layout/`
- UI components go in `components/ui/`
- Provider components go in `components/providers/`
- Custom hooks go in `hooks/`
- Colocate data constants in the component file where they're used, not in a shared constants file
- Type definitions go in `lib/types.ts`
- Images organized by page: `public/images/home/`, `public/images/about/`, etc.

## Typography

- Fonts: DM Sans (text), DM Serif Display (display), JetBrains Mono (mono)
- Already font-text and font-weight-text set in globals.css body — don't need to set it again
- Headings automatically use `font-display` and `font-weight-display` via base layer (h1-h6)
- For non-heading elements that need the display font, use `font-display` explicitly
- Body text uses `font-text` utility (default via body, no need to specify)
- Data, labels, and small caps use `font-mono` utility

## MDX / Articles

### Setup

- Use `@tailwindcss/typography` plugin - import with `@plugin "@tailwindcss/typography"` in globals.css
- Keep MDX component definitions in the article page file, not in separate files
- Exception: Client components (e.g., code block with copy button) must be in separate files with `'use client'`

### Container Width Patterns

- When different elements need different max-widths (e.g., text narrower, code blocks wider):
  - Wrap text elements (h2, p, ul) in a container div: `<div className="container"><p>...</p></div>`
  - Never apply container classes directly to semantic elements - it overrides prose margin styles
  - Use `not-prose` on elements that break out to wider containers
  - Prose wrapper needs `max-w-none` to allow children to control their own widths
- Don't use arbitrary Tailwind values for breakouts - use existing container utilities

### Styling

- Use prose element modifiers for customization: `prose-a:`, `prose-lead:`, `prose-headings:`, etc.
- Use `not-prose` class to exclude elements from typography plugin styling
- MDX components should pass through `className` prop to allow custom styling per article

## Code Style

- When a file has multiple components, the parent/exported component goes at the top; child/helper components go below it — the more parent a component is, the higher it sits in the file
- Always use `cn()` from `@/lib/utils` for conditional class names — never use template literals with ternaries like `` className={`foo ${condition ? 'bar' : ''}`} ``
- Use `&apos;` for apostrophes in JSX text
- Prefer named exports for icons, default exports for components
- Keep components clean and focused
- No Co-Authored-By in commits
- Don't run build unless explicitly asked
- Use semantic HTML elements whenever possible (`ul`/`li` for lists, `section` for sections, `nav` for navigation, etc.)
- When refactoring components to be reusable, preserve the original layout structure (flex direction, alignment, spacing) - only add props for configurability
- Use nested object structures for constants with related properties:

  ```tsx
  // Good
  const items = [
    {
      image: { src: '', alt: '', classname: '' },
      emoji: { text: '', classname: '' },
    },
  ];

  // Bad
  const items = [
    {
      src: '',
      alt: '',
      className: '',
      emoji: '',
      emojiClassName: '',
    },
  ];
  ```

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
