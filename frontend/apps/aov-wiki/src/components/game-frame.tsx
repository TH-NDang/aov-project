import type { HTMLAttributes, ReactNode } from "react"

/**
 * A panel in the Wiki's game frame (`src/styles/game-frame.css`): cut corners, a gold rim turning to bronze, an inner
 * line and, unless `plain`, a small gem on the middle of the top and bottom edges.
 */
export function GameFrame({
  as: Tag = "div",
  selected = false,
  hover = false,
  plain = false,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: "div" | "li" | "nav" | "section"
  /** Lights the rim and the panel, for the chosen one of several frames. */
  selected?: boolean
  /** Softens the rim under the pointer, for a frame that can be pressed. */
  hover?: boolean
  /** Leaves out the gems on the top and bottom edges, for small frames. */
  plain?: boolean
  children?: ReactNode
}) {
  return (
    <Tag
      {...rest}
      className={`wiki-frame ${hover ? "wiki-frame-hover" : ""} ${className}`}
      data-selected={selected || undefined}
    >
      {!plain && <span className="wiki-frame-gem" data-at="top" aria-hidden="true" />}
      {children}
      {!plain && <span className="wiki-frame-gem" data-at="bottom" aria-hidden="true" />}
    </Tag>
  )
}
