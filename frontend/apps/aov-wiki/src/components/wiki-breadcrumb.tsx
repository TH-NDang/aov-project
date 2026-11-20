import { Link } from "react-router"
import { useWikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
import "./wiki-breadcrumb.css"

export type BreadcrumbStep = { label: string; to?: string }

/** Where a page sits in the Wiki, from the home page to the page itself; every step but the last is a link. */
export function WikiBreadcrumb({ steps, className }: { steps: BreadcrumbStep[]; className?: string }) {
  const t = useWikiText()
  return (
    <nav
      className={className ? `wiki-breadcrumb ${className}` : "wiki-breadcrumb"}
      aria-label={t("Vị trí trang", "Breadcrumb")}
    >
      <ol>
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <li key={`${index}:${step.label}`}>
              {last || !step.to ? (
                <span aria-current={last ? "page" : undefined}>{step.label}</span>
              ) : (
                <Link to={step.to}>{step.label}</Link>
              )}
              {!last && <WikiIcon name="chevronRight" size={14} className="wiki-breadcrumb-separator" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
