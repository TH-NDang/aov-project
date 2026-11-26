import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { clubBans, clubHeroes, seasonMarks } from "../../../lib/club-model"
import { gamesText, ofMatches, recordText, score } from "../../../lib/feed-words"
import { ENOUGH_FOR_SHARE, shareWords } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { teamMatches, teamTally, type TeamRecord } from "../../../lib/team-draft-model"
import { GameMarks } from "./game-marks"
import { HeroPortrait } from "./hero-portrait"
import type { StatsData } from "./stats-data"
import "./club-row.css"

/** Heroes a line shows of those a team picks, and of those it bans more than the others. */
const PICKS = 5
const BANS = 3

/** How tall the mark of a game won is. */
const HEIGHT = { wide: 26, compact: 22 }

/** What the columns of the list hold, over its first line. */
export function ClubRowHead({ heroes }: { heroes: boolean }) {
  const { text } = useStreamLocale()
  return (
    <div className="tn-club-row-head" data-heroes={heroes || undefined} aria-hidden="true">
      <span>{text("Đội", "Team")}</span>
      <span>{text("Từng ván", "Game by game")}</span>
      {heroes && (
        <>
          <span>{text("Hay chọn, số trận", "Usual picks, in matches")}</span>
          <span>{text("Cấm hơn đội khác", "Bans more often")}</span>
        </>
      )}
    </div>
  )
}

/**
 * One team of the list on a line: its record, every game it played in order, the heroes it picks in most of its matches
 * and those it bans more than the others do. The marks are as long as the team's share of the longest season, so that
 * the seasons compare. The whole line opens the team.
 */
export function ClubRow({
  data: { view, feed, period },
  record,
  most,
  heroes,
}: {
  data: StatsData
  record: TeamRecord
  /** The games of the team that played most of them. */
  most: number
  /** Whether the games of the competition name their heroes. */
  heroes: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const height = HEIGHT[usePageLayout()]
  const team = view.content.teams[record.teamId]
  const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
  const { wins, losses } = teamTally(record)
  const decided = wins + losses
  const rate = decided >= ENOUGH_FOR_SHARE ? shareWords(wins / decided, text) : null
  const matches = teamMatches(record)
  const picks = clubHeroes(record).slice(0, PICKS)
  const bans = clubBans(feed, record, "own", BANS)
  const marks = seasonMarks(record)
  const said = [
    `${name}: ${recordText({ wins, losses }, text)}`,
    picks.length > 0 &&
      text(
        `hay chọn ${picks.map((pick) => `${pick.hero.name} ${ofMatches(pick.matches, matches, text)}`).join(", ")}`,
        `usual picks ${picks.map((pick) => `${pick.hero.name} in ${ofMatches(pick.matches, matches, text)}`).join(", ")}`,
      ),
    bans.length > 0 &&
      text(
        `cấm hơn đội khác ${bans.map((ban) => `${ban.hero.name} ${ban.games} ván`).join(", ")}`,
        `bans more than others ${bans.map((ban) => `${ban.hero.name} in ${gamesText(ban.games, text, languageTag)}`).join(", ")}`,
      ),
  ]
  return (
    <Link
      className="tn-club-row"
      data-heroes={heroes || undefined}
      to={statsHref(view.id, { part: "teams", team: record.teamId, scope: period?.key })}
      aria-label={said.filter(Boolean).join("; ")}
    >
      <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
      <strong className="tn-club-row-name">{name}</strong>
      <span className="tn-club-row-record">
        <b>{score({ wins, losses })}</b>
        {rate && <small>{text(`, thắng ${rate}`, `, ${rate} won`)}</small>}
      </span>
      <span className="tn-club-row-season">
        <span style={{ width: `${(marks.length / most) * 100}%` }}>
          <GameMarks marks={marks} height={height} fill />
        </span>
      </span>
      {heroes && (
        <>
          <span className="tn-club-row-faces" data-kind="picks">
            {picks.map((pick) => (
              <span key={pick.hero.key} title={pick.hero.name}>
                <HeroPortrait hero={pick.hero} />
                <small>
                  {pick.matches}/{matches}
                </small>
              </span>
            ))}
          </span>
          <span className="tn-club-row-faces" data-kind="bans">
            {bans.map((ban) => (
              <span key={ban.hero.key} title={ban.hero.name}>
                <HeroPortrait hero={ban.hero} banned />
                <small>{ban.games}</small>
              </span>
            ))}
          </span>
        </>
      )}
    </Link>
  )
}
