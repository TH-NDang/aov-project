import type { CSSProperties, ReactNode } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import type { LineupSeat } from "../lib/lineup-model"
import { CaptainBadge } from "./captain-badge"
import { LANE_NAMES } from "../lib/tournament-model"
import { Jersey } from "./jersey"
import { useStreamLocale } from "./stream-locale"
import "./team-lineup.css"

/**
 * A team's starters as their jerseys, hung on the rail of the locker room lane by lane. `children` are the members who
 * do not start, under it; `note` says which roster it is.
 */
export function TeamLineup({
  seats,
  logoUrl,
  logoDarkUrl,
  note,
  children,
}: {
  seats: LineupSeat[]
  logoUrl?: string | null
  logoDarkUrl?: string | null
  note?: ReactNode
  children?: ReactNode
}) {
  const { text } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  return (
    <section className="ln" aria-labelledby="profile-lineup">
      <div className="tn-heading">
        <h2 id="profile-lineup">
          {text("Đội hình", "Lineup")} {note && <small>{note}</small>}
        </h2>
      </div>
      <div className="ln-room">
        <ol className="ln-rail" style={{ "--ln-count": seats.length } as CSSProperties}>
          {seats.map((seat) => (
            <li key={seat.key}>
              <span className="ln-hung">
                <svg viewBox="0 0 60 30" fill="none" aria-hidden="true">
                  <path
                    d="M30 15v-4c5-1 6-9 0-9-3 0-5 2-5 4M30 15 8 28h44Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <Jersey
                  name={seat.name}
                  lane={seat.lane}
                  logoUrl={logoUrl}
                  logoDarkUrl={logoDarkUrl}
                  size={compact ? 92 : "min(124px, 18cqi)"}
                />
              </span>
              <strong>
                {seat.to ? <Link to={seat.to}>{seat.name}</Link> : seat.name}
                {seat.captain && <CaptainBadge />}
              </strong>
              <span>{text(LANE_NAMES[seat.lane][0], LANE_NAMES[seat.lane][1])}</span>
            </li>
          ))}
        </ol>
      </div>
      {children}
    </section>
  )
}
