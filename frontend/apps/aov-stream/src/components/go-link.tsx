import type { ComponentProps, ReactNode } from "react"
import { Link } from "react-router"
import { StreamIcon } from "./stream-icon"
import "./go-link.css"

type GoLinkProps = Omit<ComponentProps<"a">, "href" | "children"> & {
  to: string
  /** No line under the name at rest, where a card or a row around it already shows that it opens. */
  plain?: boolean
  /** Inside a sentence, where an arrow would come between the name and its comma: a line under the name instead. */
  prose?: boolean
  children: ReactNode
}

/**
 * A name that opens another page. A faint line under it says so before anyone points at it, the same on every page, and
 * takes the accent when pointed at; nothing comes between the name and the words after it. A whole address leads to
 * another site, the Wiki, and says so with a small arrow out.
 */
export function GoLink({ to, plain = false, prose = false, className, children, ...link }: GoLinkProps) {
  const props = {
    ...link,
    className: ["hub-go", prose && "hub-go-prose", className].filter(Boolean).join(" "),
    "data-plain": plain || undefined,
  }
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
