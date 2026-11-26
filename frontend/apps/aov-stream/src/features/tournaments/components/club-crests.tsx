import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { namesOf } from "../../../lib/question-words"
import { useCentred } from "../../../lib/use-centred"
import "./club-crests.css"

/** The teams of a competition as a row of crests, each of which opens its team in the place of the one being read. */
export function ClubCrests({
  view,
  teams,
  current,
  hrefOf,
}: {
  view: CompetitionView
  teams: string[]
  current: string
  hrefOf: (teamId: string) => string
}) {
  const { text } = useStreamLocale()
  const row = useCentred<HTMLElement>(current)
  const names = namesOf(view, text)
  return (
    <nav ref={row} className="tn-club-crests" aria-label={text("Các đội của giải", "The teams of the tournament")}>
      {teams.map((teamId) => {
        const team = view.content.teams[teamId]
        return (
          <Link
            key={teamId}
            to={hrefOf(teamId)}
            title={team?.name}
            aria-label={team?.name ?? names.team(teamId)}
            aria-current={teamId === current ? "page" : undefined}
          >
            <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={names.team(teamId)} />
            <span>{names.team(teamId)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
