import { Link } from "react-router"
import { useCentred } from "../../../lib/use-centred"
import "./stage-tabs.css"

/** A part of a page: what the address calls it, where it opens and its name. */
export type StageTab<T extends string | null> = { key: T; to: string; name: string }

/** The parts of a page under its stage, as one row of underlined links, which keeps the open one in view. */
export function StageTabs<T extends string | null>({
  label,
  tabs,
  open,
}: {
  label: string
  tabs: readonly StageTab<T>[]
  open: T
}) {
  const row = useCentred<HTMLElement>(tabs.find(({ key }) => key === open)?.to)
  return (
    <nav ref={row} className="tn-stage-tabs" aria-label={label}>
      {tabs.map(({ key, to, name }) => (
        <Link key={key ?? ""} to={to} aria-current={key === open ? "page" : undefined}>
          {name}
        </Link>
      ))}
    </nav>
  )
}
