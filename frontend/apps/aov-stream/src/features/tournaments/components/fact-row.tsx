import type { ReactNode } from "react"
import { Link } from "react-router"
import "./fact-row.css"

/**
 * A fact on a line: the pictures of whom it is about, what it says and its figure. The whole line opens the games it
 * counts; `said` is the line in one sentence, where its parts would not read as one.
 */
export function FactRow({
  to,
  art,
  figure,
  said,
  children,
}: {
  to: string
  art?: ReactNode
  figure?: ReactNode
  said?: string
  children: ReactNode
}) {
  return (
    <li className="tn-fact-row">
      <Link to={to} aria-label={said}>
        {art && <span className="tn-fact-art">{art}</span>}
        <span className="tn-fact-text">{children}</span>
        {figure && <span className="tn-fact-figure">{figure}</span>}
      </Link>
    </li>
  )
}
