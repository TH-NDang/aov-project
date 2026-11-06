import type { ComponentProps, ElementType, ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"

const CORNERS = ["tl", "tr", "bl", "br"] as const

/** One gold corner: a faceted bracket with a small gem. The other three are this one mirrored in CSS. */
function OrnateCorner({ corner }: { corner: (typeof CORNERS)[number] }) {
  return (
    <svg className="ornate-corner" data-corner={corner} viewBox="0 0 48 48" fill="currentColor" aria-hidden="true">
      <path d="M0 0h48v3H9L3 9v39H0z" />
      <path d="M8 8h24v1.5H12L9.5 12v20H8z" opacity=".75" />
      <path d="m8 2.5 5.5 5.5L8 13.5 2.5 8z" />
      <path d="m15 12 3 3-3 3-3-3zM36 4.5l2 2-2 2-2-2zM4.500 36l2-2 2 2-2 2z" opacity=".8" />
    </svg>
  )
}

/**
 * A sheet of parchment in a navy and gold frame, the main surface of the public pages. Everything inside takes the
 * parchment colors from the tokens, so its contents need no colors of their own. A panel with nothing to show is hidden.
 */
export function OrnatePanel<Tag extends ElementType = "section">({
  as,
  className,
  children,
  ...props
}: { as?: Tag; className?: string; children?: ReactNode } & Omit<
  ComponentProps<Tag>,
  "as" | "className" | "children"
>) {
  const Element: ElementType = as ?? "section"
  return (
    <Element className={cn("ornate-panel public-panel", className)} {...props}>
      {CORNERS.map((corner) => (
        <OrnateCorner key={corner} corner={corner} />
      ))}
      <div className="ornate-panel-body">{children}</div>
    </Element>
  )
}

/** A line with a small crest in the middle, between a panel's heading and its content. */
export function OrnateDivider({ className }: { className?: string }) {
  return (
    <div className={cn("ornate-divider", className)} aria-hidden="true">
      <svg viewBox="0 0 44 12" fill="currentColor">
        <path d="m22 0 6 6-6 6-6-6zM22 3.200 19.200 6 22 8.800 24.800 6z" fillRule="evenodd" />
        <path d="m11 4 2 2-2 2-2-2zM33 4l2 2-2 2-2-2z" />
      </svg>
    </div>
  )
}
