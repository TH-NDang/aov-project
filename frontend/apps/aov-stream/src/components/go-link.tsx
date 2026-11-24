import type { ComponentProps, ReactNode } from "react"
import { Link } from "react-router"
import { StreamIcon } from "./stream-icon"
import "./go-link.css"

type GoLinkProps = Omit<ComponentProps<"a">, "href" | "children"> & {
  to: string
  plain?: boolean
  /** Inside a sentence, where an arrow would come between the name and its comma: a line under the name instead. */
  prose?: boolean
  children: ReactNode
}

/**
 * A name that opens another page. The small arrow after it says so before anyone points at it, the same on every page;
 * `plain` leaves it out where a card or a row around the name already shows that it opens. A whole address leads to
 * another site, the Wiki.
 */
export function GoLink({ to, plain = false, prose = false, className, children, ...link }: GoLinkProps) {
  const props = { ...link, className: ["hub-go", prose && "hub-go-prose", className].filter(Boolean).join(" ") }
  if (!to.startsWith("/"))
    return (
      <a {...props} href={to}>
        {children}
        {!plain && !prose && <StreamIcon name="external" size={12} />}
      </a>
    )
  return (
    <Link {...props} to={to}>
      {children}
      {!plain && !prose && <StreamIcon name="chevronRight" size={12} />}
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
