import { Fragment, type ReactNode } from "react"

/** One card of the account settings: an icon and a title above its content. */
export function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="pas-section">
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

/** The parts of one line of facts, with a dot between the ones that are there. */
export function factLine(parts: ReactNode[]) {
  return parts
    .filter(Boolean)
    .flatMap((part, at) => (at === 0 ? [part] : [" · ", part]))
    .map((part, at) => <Fragment key={at}>{part}</Fragment>)
}
