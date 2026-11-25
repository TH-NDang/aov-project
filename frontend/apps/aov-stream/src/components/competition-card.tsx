import type { CSSProperties } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { TierEmblem } from "@aov/ui/components/tier-emblem"
import { StreamIcon } from "./stream-icon"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { ThemedLogo } from "./themed-logo"
import { competitionStatusLabels, dayRange, hueOf } from "./community-ui"
import { competitionChampion } from "../lib/champion-model"
import { codeName, competitionStatus, TIER_NAMES, type CompetitionStatus } from "../lib/competition-model"
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
 * A competition's mark on the plate every logo stands on, in the version for the theme; one without artwork gets its
 * initials on a colour taken from its name.
 */
export function CompetitionLogo({
  name,
  url,
  darkUrl,
  size,
}: {
  name: string
  url?: string | null
  darkUrl?: string | null
  size?: "card" | "head"
}) {
  if (url || darkUrl)
    return (
      <span className="tn-logo" data-size={size}>
        <ThemedLogo src={url} darkSrc={darkUrl} />
      </span>
    )
  return (
    <span className="tn-logo hub-art" data-size={size} style={{ "--hub-hue": hueOf(name) } as CSSProperties}>
      <b>{monogram(name)}</b>
    </span>
  )
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
 * stands.
 */
export function CompetitionCard({ entry }: { entry: CompetitionView }) {
  const { text } = useStreamLocale()
  const { tournament } = entry.content
  const status = competitionStatus(entry.content)
  const won = competitionChampion(entry)
  const tier = codeName(TIER_NAMES, tournament.tier, text)
  return (
    <Link className="tn-card" to={`/competitions/${entry.id}`}>
      <CompetitionLogo name={tournament.name} url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} size="card" />
      <span className="tn-card-body">
        <strong title={tournament.name}>{tournament.name}</strong>
        <span className="tn-card-meta">
          {tier && <TierEmblem tier={tournament.tier} size={18} label={tier} />}
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
