import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import "./stats-whole.css"

/** Leads from a period that holds nothing of a hero or a team to the whole competition. */
export function StatsWhole({ to, name }: { to: string; name: string }) {
  const { text } = useStreamLocale()
  return (
    <Link className="tn-stats-whole" to={to}>
      {text(`Xem ${name} trong cả giải`, `See ${name} over the whole tournament`)}
    </Link>
  )
}
