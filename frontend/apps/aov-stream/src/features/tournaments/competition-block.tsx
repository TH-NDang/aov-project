import type { ReactNode } from "react"
import { StreamIcon } from "../../components/stream-icon"

/** A section of the competition page: a title, an optional link to the tab that has all of it, then the content. */
export function Block({
  title,
  note,
  more,
  children,
}: {
  title: string
  note?: ReactNode
  more?: { label: string; open: () => void }
  children: ReactNode
}) {
  return (
    <section className="tn-block">
      <div className="tn-heading">
        <h2>
          {title} {note && <small>{note}</small>}
        </h2>
        {more && (
          <button type="button" onClick={more.open}>
            {more.label}
            <StreamIcon name="arrow" size={15} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
