import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { competitionStatusLabels, dayRange, hueOf } from "../community/community-ui"
import { champion, competitionStatus, type CompetitionStatus } from "./competition-model"

const hue = (name: string) => ({ "--hub-hue": hueOf(name) }) as CSSProperties
const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join("")

export function StatusBadge({ status }: { status: CompetitionStatus | null }) {
  // The status names are read in the reader's language, so the badge follows a change of language.
  useStreamLocale()
  return status ? (
    <span className="hub-status" data-status={status}>
      {competitionStatusLabels()[status]}
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
function scale(entry: CompetitionView, text: (vi: string, en: string) => string) {
  const { plan } = entry.content
  return [
    plan.entrants.length &&
      text(`${plan.entrants.length} đội`, `${plan.entrants.length} ${plan.entrants.length === 1 ? "team" : "teams"}`),
    plan.matches.length &&
      text(`${plan.matches.length} trận`, `${plan.matches.length} ${plan.matches.length === 1 ? "match" : "matches"}`),
  ]
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
 * A competition in a grid: its mark, name, dates and size, and on the last line either where it stands or, once the
 * final table names a champion, who won it. `within` names the circuit the card is listed under.
 */
export function CompetitionCard({ entry, within }: { entry: CompetitionView; within?: string | null }) {
  const { text } = useStreamLocale()
  const { tournament, teams } = entry.content
  const status = competitionStatus(entry.content)
  const won = champion(tournament, teams)
  return (
    <Link className="tn-card" to={`/competitions/${entry.id}`} data-status={status ?? undefined}>
      <CompetitionLogo name={tournament.name} url={tournament.logoUrl} />
      <span className="tn-card-body">
        <strong title={tournament.name}>{seasonName(tournament.name, within)}</strong>
        <span className="tn-card-meta">
          {dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}
          {tournament.region && ` · ${tournament.region}`}
        </span>
        <span className="tn-card-foot">
          {won ? (
            <span className="tn-card-champion">
              <StreamIcon name="trophy" size={14} />
              {won.winner.name}
            </span>
          ) : (
            status && status !== "FINISHED" && <b data-status={status}>{competitionStatusLabels()[status]}</b>
          )}
          {scale(entry, text) && <span>{scale(entry, text)}</span>}
        </span>
      </span>
    </Link>
  )
}

/** A competition that is on or about to start, shown larger above the directory. */
export function CompetitionFeature({ entry }: { entry: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
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
          <StatusBadge status={competitionStatus({ tournament, plan })} />
          <span className="hub-kicker">
            {[plan.circuit, tournament.region].filter(Boolean).join(" · ") || text("Giải đấu", "Tournament")}
          </span>
        </span>
        <strong>{tournament.name}</strong>
        <span className="tn-card-meta">
          <StreamIcon name="calendar" size={14} />
          {dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}
        </span>
        <span className="tn-card-meta">
          {scale(entry, text) && (
            <span>
              <StreamIcon name="users" size={14} />
              {scale(entry, text)}
            </span>
          )}
          {plan.prizePool && (
            <span>
              <StreamIcon name="trophy" size={14} />
              <LocalPrizeText
                text={plan.prizePool}
                currency={plan.currency}
                on={tournament.endsOn ?? tournament.startsOn}
                locale={languageTag}
              />
            </span>
          )}
        </span>
      </span>
    </Link>
  )
}
