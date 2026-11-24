import type { ReactNode } from "react"
import { Link } from "react-router"
import { StreamIcon } from "./stream-icon"
import "./go-link.css"

/**
 * A name that opens another page. The small arrow after it says so before anyone points at it, the same on every page;
 * `plain` leaves it out where a card or a row around the name already shows that it opens.
 */
export function GoLink({
  to,
  plain = false,
  className,
  title,
  children,
}: {
  to: string
  plain?: boolean
  className?: string
  title?: string
  children: ReactNode
}) {
  return (
    <Link className={className ? `hub-go ${className}` : "hub-go"} to={to} title={title}>
      {children}
      {!plain && <StreamIcon name="chevronRight" size={12} />}
    </Link>
  )
}

/**
 * A team's or a player's name, linked to its page. Every team and player of a published competition has one; that
 * page gives way to the one their owners run, once it is published. `children` replace the plain name where the
 * name is drawn in more than one form.
 */
export function EntityPageLink({
  kind,
  id,
  name,
  plain,
  children,
}: {
  kind: "TEAM" | "PLAYER"
  id: string
  name: string
  plain?: boolean
  children?: ReactNode
}) {
  return (
    <GoLink to={`/${kind === "TEAM" ? "teams" : "players"}/${id}`} plain={plain}>
      {children ?? name}
    </GoLink>
  )
}
