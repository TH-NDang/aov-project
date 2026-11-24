import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { StreamIcon } from "./stream-icon"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { competitionStatusLabels, dayRange, hueOf } from "./community-ui"
import { competitionChampion } from "../lib/champion-model"
import { competitionStatus, type CompetitionStatus } from "../lib/competition-model"
import { daysUntil } from "../lib/countdown"
import { competitionProgress } from "../lib/stage-phases"
import { useNow } from "../lib/use-now"
import "./competition-card.css"

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join("")

/** A competition's state. `banner` draws it on a banner's art, `small` in a card's first line. */
export function StatusBadge({
  status,
  tone,
  size,
}: {
  status: CompetitionStatus | null
  tone?: "banner"
  size?: "small"
}) {
  // The status names are read in the reader's language, so the badge follows a change of language.
  useStreamLocale()
  return status ? (
    <span className="hub-status" data-status={status} data-tone={tone} data-size={size}>
      {competitionStatusLabels()[status]}
    </span>
  ) : null
}

/**
 * A competition's mark on a tile; one without artwork gets its initials on a colour taken from its name. The tile is
 * dark in both themes, so the logo drawn for dark backgrounds comes first, unless the tile is white.
 */
export function CompetitionLogo({
  name,
  url,
  darkUrl,
  onLight = false,
  size,
}: {
  name: string
  url?: string | null
  darkUrl?: string | null
  /** The tile is white, as at the head of a competition page, so the light version comes first. */
  onLight?: boolean
  size?: "card" | "head"
}) {
  const shown = onLight ? url || darkUrl : darkUrl || url
  return (
    <span
      className="tn-logo hub-art"
      data-size={size}
      data-light={onLight || undefined}
      style={{ "--hub-hue": hueOf(name) } as CSSProperties}
    >
      {shown ? (
        <img src={shown} alt="" loading="lazy" data-rim={(!onLight && !darkUrl) || undefined} />
      ) : (
        <b>{monogram(name)}</b>
      )}
    </span>
  )
}

/** A season's name without the circuit it belongs to, for lists already grouped under that circuit. */
export function seasonName(name: string, circuit?: string | null) {
  if (!circuit || !name.toLowerCase().startsWith(circuit.toLowerCase())) return name
  const rest = name.slice(circuit.length).replace(/^[\s\-–—:·]+/, "")
  return rest || name
}

/** How far a competition is, in a few words: in how many days it starts, or how many of its matches are played. */
export function CompetitionClock({ entry }: { entry: CompetitionView }) {
  const { text } = useStreamLocale()
  const now = useNow()
  const { tournament, plan } = entry.content
  const status = competitionStatus(entry.content, now)
  if (status === "ONGOING") {
    const { played, total } = competitionProgress(entry)
    return total > 0 ? <>{text(`${played}/${total} trận đã đấu`, `${played}/${total} matches played`)}</> : null
  }
  const days = daysUntil(tournament.startsOn, now, plan.timezone)
  if (days == null || days < 0) return null
  if (days === 0) return <>{text("Khởi tranh hôm nay", "Starts today")}</>
  return <>{text(`Còn ${days} ngày`, `In ${days} ${days === 1 ? "day" : "days"}`)}</>
}

/**
 * A competition in a grid: its mark, name and dates, and on the last line its champion or, until it has one, where it
 * stands. `within` names the circuit the card is listed under.
 */
export function CompetitionCard({ entry, within }: { entry: CompetitionView; within?: string | null }) {
  const { text } = useStreamLocale()
  const { tournament } = entry.content
  const status = competitionStatus(entry.content)
  const won = competitionChampion(entry)
  return (
    <Link className="tn-card" to={`/competitions/${entry.id}`}>
      <CompetitionLogo name={tournament.name} url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} size="card" />
      <span className="tn-card-body">
        <strong title={tournament.name}>{seasonName(tournament.name, within)}</strong>
        <span className="tn-card-meta">
          {dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}
        </span>
        {won ? (
          <span className="tn-card-champion">
            <StreamImage src={won.winner.logoUrl} darkSrc={won.winner.logoDarkUrl} logo name={won.winner.name} />
            {won.winner.name}
            <StreamIcon name="trophy" size={14} />
          </span>
        ) : (
          status &&
          status !== "FINISHED" && (
            <span className="tn-card-state">
              <StatusBadge status={status} size="small" />
              <CompetitionClock entry={entry} />
            </span>
          )
        )}
      </span>
    </Link>
  )
}
