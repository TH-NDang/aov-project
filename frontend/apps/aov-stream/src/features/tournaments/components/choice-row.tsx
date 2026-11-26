import type { ReactNode } from "react"
import { Link, type To } from "react-router"

/** One of a few choices. With an address it is a link, and the address says which one is in use; else it is a button. */
export type Choice<T extends string | null> = {
  key: T
  name: ReactNode
  to?: To
  /** Says the choice where its name is a mark. */
  label?: string
  title?: string
}

export type ChoiceProps<T extends string | null> = {
  /** What is chosen, for those who do not see the row. */
  label: string
  value: T
  choices: readonly Choice<T>[]
  /** What pressing a choice without an address does. */
  onChoose?: (key: T) => void
  /** Whether a link takes the place of the address it leaves. */
  replace?: boolean
}

/** A few choices side by side, one of them in use: links are a navigation, buttons a group. */
export function ChoiceRow<T extends string | null>({
  className,
  size,
  fill,
  label,
  value,
  choices,
  onChoose,
  replace,
  current = "true",
}: ChoiceProps<T> & { className: string; size?: string; fill?: string; current?: "page" | "true" }) {
  const links = choices.some(({ to }) => to != null)
  const Row = links ? "nav" : "div"
  return (
    <Row className={className} data-size={size} data-fill={fill} role={links ? undefined : "group"} aria-label={label}>
      {choices.map(({ key, name, to, label: said, title }) => {
        const marks = { "aria-label": said, title, "data-mark": said ? "" : undefined }
        return to == null ? (
          <button key={key ?? ""} type="button" aria-pressed={key === value} onClick={() => onChoose?.(key)} {...marks}>
            {name}
          </button>
        ) : (
          <Link key={key ?? ""} to={to} replace={replace} aria-current={key === value ? current : undefined} {...marks}>
            {name}
          </Link>
        )
      })}
    </Row>
  )
}
