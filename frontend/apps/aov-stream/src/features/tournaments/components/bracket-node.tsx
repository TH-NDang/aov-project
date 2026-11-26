import type { CSSProperties, MouseEvent } from "react"
import { Link } from "react-router"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { MatchStatus } from "../../../components/match-card"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { roundWeight, type BracketNode } from "../../../lib/bracket-model"
import { matchUnderway } from "../../../lib/competition-model"
import { competitionMatchHref, type CompetitionMatch } from "../../../lib/match-model"
import { matchSides, type MatchSide } from "../../../lib/match-schedule"
import type { TablePlace } from "../../../lib/place-zones"
import { useNow } from "../../../lib/use-now"
import { MatchPeek } from "./match-peek"
import "./bracket-node.css"

function Team({ team, active, place }: { team: MatchSide; active: boolean; place?: TablePlace }) {
  const { text } = useStreamLocale()
  return (
    <span
      className="tn-node-team"
      data-team={team.teamId ?? undefined}
      data-active={active || undefined}
      data-won={team.won || undefined}
      data-lost={team.lost || undefined}
      data-open={!team.known || undefined}
    >
      {team.known ? (
        <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
      ) : (
        <span className="tn-node-blank" aria-hidden="true" />
      )}
      <span title={team.fullName}>
        {place && (
          <small>
            <span className="sr-only">{text("Hạng", "Place")} </span>
            <span aria-hidden="true">{place.group ?? "#"}</span>
            {place.place}{" "}
          </small>
        )}
        {team.brief}
      </span>
      {team.score != null && <b>{team.score}</b>}
    </span>
  )
}

/**
 * A match of a bracket. Pointing at it shows the match at a glance beside it; on a phone a tap opens that in a
 * sheet (`onPeek`), where the way on to the match's page is.
 */
export function BracketMatch({
  node,
  place,
  team,
  stop,
  anchor,
  places,
  onPeek,
}: {
  node: BracketNode
  /** Where its card stands in the drawing. */
  place: CSSProperties
  /** The team whose way is lit. */
  team: string | null
  /** Which match of that team's way this is, from 1. */
  stop?: number
  /** The name its round goes by inside the page. */
  anchor: string
  /** The place in the table before of the teams that play their first match here. */
  places?: Map<string, TablePlace>
  onPeek?: (entry: CompetitionMatch) => void
}) {
  const { languageTag } = useStreamLocale()
  const now = useNow()
  const { entry } = node
  const sides = matchSides(entry, languageTag)
  const peek = (event: MouseEvent) => {
    if (!onPeek || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    onPeek(entry)
  }
  const card = (
    <Link
      onClick={peek}
      className="tn-node"
      to={competitionMatchHref(entry.competition.id, entry.match.key)}
      style={place}
      data-round={anchor}
      data-live={matchUnderway(entry, now) || undefined}
      data-weight={roundWeight(node.round) ?? undefined}
      data-on={(team != null && sides.some((side) => side.teamId === team)) || undefined}
    >
      <span className="tn-node-head">
        <MatchStatus entry={entry} />
        <span>BO{entry.match.bestOf}</span>
      </span>
      {sides.map((side) => (
        <Team
          key={side.side}
          team={side}
          active={team != null && side.teamId === team}
          place={side.teamId ? places?.get(side.teamId) : undefined}
        />
      ))}
      {stop != null && (
        <span className="tn-node-stop" aria-hidden="true">
          {stop}
        </span>
      )}
    </Link>
  )
  if (onPeek) return card
  return (
    <HoverCard openDelay={280} closeDelay={120}>
      <HoverCardTrigger asChild>{card}</HoverCardTrigger>
      <HoverCardContent side="right" align="start" sideOffset={14} collisionPadding={12} className="tn-peek-card">
        <MatchPeek entry={entry} />
      </HoverCardContent>
    </HoverCard>
  )
}
