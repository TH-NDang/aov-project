import type { ReactNode } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../components/wiki-icon"
import "./catalog-heading.css"

interface CatalogHeadingProps {
  title: string
  /** One muted line under the title saying what the page holds. */
  lead?: ReactNode
  /** The page one level up, for a page that is not reached from the header. */
  back?: { to: string; label: string }
  /** One action or status on the right of the title. */
  action?: ReactNode
  /** Keeps the head on the compact layout too, for a page whose header does not name it. */
  compact?: boolean
}

/**
 * The head of a library page: its name, one line about it and at most one action. The header already says which
 * section this is, so only a nested page carries a way back. The compact layout names the page in its header instead,
 * unless `compact` asks for the head there as well.
 */
export function CatalogHeading({ title, lead, back, action, compact = false }: CatalogHeadingProps) {
  if (usePageLayout() === "compact" && !compact) return null
  return (
    <header className="wiki-catalog-heading">
      {back && (
        <Link className="wiki-catalog-back" to={back.to}>
          <WikiIcon name="chevronLeft" size={16} />
          {back.label}
        </Link>
      )}
      <div className="wiki-catalog-title">
        <h1>{title}</h1>
        {action}
      </div>
      {lead && <p>{lead}</p>}
    </header>
  )
}
