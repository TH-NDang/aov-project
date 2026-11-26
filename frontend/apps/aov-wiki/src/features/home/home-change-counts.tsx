import { ChangeKindMark } from "../../components/change-tag"
import { useWikiContext } from "../../context/wiki-context"
import { patchChangeLabel } from "../../lib/change-kinds"
import "./home-change-counts.css"

/** How many heroes the version in force changed in each way, as the change marks with a number: ▲ 5 ▼ 1. */
export function HomeChangeCounts({ tally }: { tally: [kind: string, count: number][] }) {
  const { locale } = useWikiContext()
  if (!tally.length) return null
  const label = tally.map(([kind, count]) => `${count} ${patchChangeLabel(kind, locale)}`).join(", ")
  return (
    <span className="wiki-home-change-counts" role="img" aria-label={label} title={label}>
      {tally.map(([kind, count]) => (
        <span key={kind}>
          <ChangeKindMark kind={kind} size={18} />
          {count.toLocaleString(locale)}
        </span>
      ))}
    </span>
  )
}
