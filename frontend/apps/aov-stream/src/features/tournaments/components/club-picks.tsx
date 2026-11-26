import type { CSSProperties } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import { lanePicks, type LaneHero, type LanePicks } from "../../../lib/club-model"
import { ofMatches, recordText, score } from "../../../lib/feed-words"
import { statsHref } from "../../../lib/statistics-routes"
import { teamMatches, type TeamRecord } from "../../../lib/team-draft-model"
import { LaneHeading } from "./column-heading"
import { cellUnit, GameCells } from "./game-marks"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./club-picks.css"

/** Heroes of a lane, where the lanes stand side by side and where they stand one under another. */
const SHOWN = { wide: 5, compact: 3 }
/** The width the cells of the longest line have. */
const TRACK = 92

function Pick({
  data,
  teamId,
  lane,
  pick,
  matches,
  longest,
}: {
  data: StatsData
  teamId: string
  lane: LanePicks["lane"]
  pick: LaneHero
  matches: number
  longest: number
}) {
  const { text } = useStreamLocale()
  const { hero, wins, losses, whole } = pick
  const taken = ofMatches(pick.matches, matches, text)
  const record = recordText({ wins, losses }, text)
  const drawn = (
    <>
      <HeroPortrait hero={hero} />
      <strong>{hero.name}</strong>
      <b>{score({ wins, losses })}</b>
      <span className="tn-club-pick-cells">
        <GameCells wins={wins} losses={losses} unit={cellUnit(longest, TRACK)} whole={longest} height={13} />
      </span>
      <small>
        {pick.matches}/{matches}
        <span>{text(" trận", "")}</span>
      </small>
    </>
  )
  // Games without a lane cannot be told from those of another lane, so only a hero without others leads to its games.
  if (!lane && !whole) return <span className="tn-club-pick">{drawn}</span>
  return (
    <Link
      className="tn-club-pick"
      to={statsHref(data.view.id, {
        question: { team: teamId, pick: [hero], lane: whole ? null : lane },
        scope: data.period?.key,
      })}
      aria-label={text(`${hero.name}: chọn ở ${taken}, ${record}`, `${hero.name}: picked in ${taken}, ${record}`)}
    >
      {drawn}
    </Link>
  )
}

/**
 * What a team picks for each lane, counted in matches since it takes a hero once in a match, with the games won and lost
 * as cells. A line leads to its games.
 */
export function ClubPicks({ data, record }: { data: StatsData; record: TeamRecord }) {
  const { text } = useStreamLocale()
  const shown = SHOWN[usePageLayout()]
  const lanes = lanePicks(record).map(({ lane, heroes }) => ({ lane, heroes: heroes.slice(0, shown) }))
  if (!lanes.length) return null
  const matches = teamMatches(record)
  const longest = Math.max(...lanes.flatMap(({ heroes }) => heroes.map(({ games }) => games.length)))
  return (
    <Section
      title={text("Hay chọn", "Usual picks")}
      note={text("số trận có chọn, ván thắng–thua", "matches picked in, games won–lost")}
    >
      <div className="tn-club-picks" style={{ "--lanes": lanes.length } as CSSProperties}>
        {lanes.map(({ lane, heroes }) => (
          <section key={lane ?? "unknown"}>
            <LaneHeading lane={lane} />
            <ol>
              {heroes.map((pick) => (
                <li key={pick.hero.key}>
                  <Pick
                    data={data}
                    teamId={record.teamId}
                    lane={lane}
                    pick={pick}
                    matches={matches}
                    longest={longest}
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Section>
  )
}
