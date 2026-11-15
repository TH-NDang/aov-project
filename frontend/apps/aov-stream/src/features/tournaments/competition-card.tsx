import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { StreamIcon } from "../../components/stream-icon"
import {
  competitionStatus,
  competitionStatusLabels,
  dayRange,
  hueOf,
  type CompetitionStatus,
} from "../community/community-ui"
import { champion } from "./competition-model"

const hue = (name: string) => ({ "--hub-hue": hueOf(name) }) as CSSProperties
const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join("")

export function StatusBadge({ status }: { status: CompetitionStatus | null }) {
  return status ? (
    <span className="hub-status" data-status={status}>
      {competitionStatusLabels[status]}
    </span>
  ) : null
}

/** A competition's mark on a tile; one without artwork gets its initials on a colour taken from its name. */
export function CompetitionLogo({
  name,
  url,
  className = "",
}: {
  name: string
  url?: string | null
  className?: string
}) {
  return (
    <span className={`tn-logo hub-art ${className}`} style={hue(name)}>
      {url ? <img src={url} alt="" loading="lazy" /> : <b>{monogram(name)}</b>}
    </span>
  )
}

/** How many teams and matches a competition has, leaving out what is not planned yet. */
function scale(entry: CompetitionView) {
  const { plan } = entry.content
  return [plan.entrants.length && `${plan.entrants.length} đội`, plan.matches.length && `${plan.matches.length} trận`]
    .filter(Boolean)
    .join(" · ")
}

/** A season's name without the circuit it belongs to, for lists already grouped under that circuit. */
export function seasonName(name: string, circuit?: string | null) {
  if (!circuit || !name.toLowerCase().startsWith(circuit.toLowerCase())) return name
  const rest = name.slice(circuit.length).replace(/^[\s\-–—:·]+/, "")
  return rest || name
}

/**
 * A competition in a grid: its mark, name, dates and size, and on the last line either where it stands or, once an
 * editor has recorded the result, who won it. `within` names the circuit the card is listed under.
 */
export function CompetitionCard({ entry, within }: { entry: CompetitionView; within?: string | null }) {
  const { tournament, teams } = entry.content
  const status = competitionStatus(tournament)
  const won = champion(tournament, teams)
  return (
    <Link className="tn-card" to={`/competitions/${entry.id}`} data-status={status ?? undefined}>
      <CompetitionLogo name={tournament.name} url={tournament.logoUrl} />
      <span className="tn-card-body">
        <strong title={tournament.name}>{seasonName(tournament.name, within)}</strong>
        <span className="tn-card-meta">
          {dayRange(tournament.startsOn, tournament.endsOn, "Chờ lịch")}
          {tournament.region && ` · ${tournament.region}`}
        </span>
        <span className="tn-card-foot">
          {won ? (
            <span className="tn-card-champion">
              <StreamIcon name="trophy" size={14} />
              {won.winner.name}
            </span>
          ) : (
            status && status !== "FINISHED" && <b data-status={status}>{competitionStatusLabels[status]}</b>
          )}
          {scale(entry) && <span>{scale(entry)}</span>}
        </span>
      </span>
    </Link>
  )
}

/** A competition that is on or about to start, shown larger above the directory. */
export function CompetitionFeature({ entry }: { entry: CompetitionView }) {
  const { tournament, plan } = entry.content
  return (
    <Link className="tn-feature" to={`/competitions/${entry.id}`}>
      <span className="tn-feature-art hub-art" style={hue(tournament.name)}>
        {tournament.logoUrl ? (
          <img src={tournament.logoUrl} alt="" loading="lazy" />
        ) : (
          <b>{monogram(tournament.name)}</b>
        )}
      </span>
      <span className="tn-feature-body">
        <span className="tn-feature-line">
          <StatusBadge status={competitionStatus(tournament)} />
          <span className="hub-kicker">
            {[plan.circuit, tournament.region].filter(Boolean).join(" · ") || "Giải đấu"}
          </span>
        </span>
        <strong>{tournament.name}</strong>
        <span className="tn-card-meta">
          <StreamIcon name="calendar" size={14} />
          {dayRange(tournament.startsOn, tournament.endsOn, "Chờ lịch")}
        </span>
        <span className="tn-card-meta">
          {scale(entry) && (
            <span>
              <StreamIcon name="users" size={14} />
              {scale(entry)}
            </span>
          )}
          {plan.prizePool && (
            <span>
              <StreamIcon name="trophy" size={14} />
              <LocalPrizeText
                text={plan.prizePool}
                currency={plan.currency}
                on={tournament.endsOn ?? tournament.startsOn}
              />
            </span>
          )}
        </span>
      </span>
    </Link>
  )
}
