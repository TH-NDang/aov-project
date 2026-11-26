import { useMemo } from "react"
import type { Step } from "../../../components/place-trail"
import { useStreamLocale } from "../../../components/stream-locale"
import { clubOrder } from "../../../lib/club-model"
import { gamesText } from "../../../lib/feed-words"
import { feedScope, sideOf } from "../../../lib/game-feed"
import { beside } from "../../../lib/neighbours"
import { namesOf } from "../../../lib/question-words"
import { statsHref, type StatsList, type StatsPlace } from "../../../lib/statistics-routes"
import { teamRecords, type TeamRecord } from "../../../lib/team-draft-model"
import { useGameOrder } from "../../../lib/use-game-order"
import { ClubBans } from "./club-bans"
import { ClubCrests } from "./club-crests"
import { ClubGames } from "./club-games"
import { ClubHead } from "./club-head"
import { ClubPicks } from "./club-picks"
import { ClubPools } from "./club-pools"
import { ClubScript } from "./club-script"
import { ClubSplits } from "./club-splits"
import { StageTabs } from "./stage-tabs"
import type { StatsData } from "./stats-data"
import { StatsTrail } from "./stats-trail"
import { StatsWhole } from "./stats-whole"
import "./stats-team.css"

/** What the games of a team add up to. A part nothing is recorded for is left out. */
function Analysis({ data, record }: { data: StatsData; record: TeamRecord }) {
  const { text } = useStreamLocale()
  const heroes = record.games.some(({ side }) => side.picks.length > 0)
  return (
    <div className="tn-club-analysis">
      {!heroes && (
        <p className="tn-quiet">
          {text("Chưa ghi tướng của các ván này.", "The heroes of these games are not recorded yet.")}
        </p>
      )}
      <ClubPicks data={data} record={record} />
      <ClubBans data={data} record={record} />
      <ClubScript data={data} record={record} />
      <ClubSplits data={data} record={record} />
      <ClubPools key={record.teamId} data={data} record={record} />
    </div>
  )
}

/**
 * One team in the games counted: its season on a stage, then what it picks and bans and how it won and lost, or the list
 * of its games. The other teams are one press away.
 */
export function StatsTeam({ data, record, place }: { data: StatsData; record: TeamRecord; place: StatsPlace }) {
  const { text, languageTag } = useStreamLocale()
  const { view, whole, feed, period } = data
  const { teamId } = record
  const scope = period?.key
  const teams = useMemo(
    () => clubOrder(view, teamRecords(feed), period).map((other) => other.teamId),
    [view, feed, period],
  )
  const periods = useMemo(
    () => whole.periods.filter(({ key }) => feedScope(whole, key).feed.games.some((game) => sideOf(game, teamId))),
    [whole, teamId],
  )
  const names = namesOf(view, text)
  const list: StatsList | null = place.list === "games" ? "games" : null
  // The list of another team keeps the order of this one, as the list of another hero does.
  const { order: sort } = useGameOrder()
  const hrefOf = (team: string, opened = list) =>
    statsHref(view.id, { part: "teams", team, list: opened, scope, sort: opened ? sort : undefined })
  const near = beside(teams, teams.indexOf(teamId))
  const step = (team: string | null): Step | null => (team ? { to: hrefOf(team), name: names.team(team) } : null)
  const name = view.content.teams[teamId]?.name ?? names.team(teamId)
  const played = record.games.length > 0
  const games = gamesText(record.games.length, text, languageTag)
  const counted = gamesText(feed.games.length, text, languageTag)
  const title = list && played ? text(`${games} của ${name}`, `${games} of ${name}`) : name
  return (
    <div className="tn-club-page">
      <title>{`${title}, ${view.content.tournament.name} — AOV Stream`}</title>
      <StatsTrail
        data={data}
        periods={periods}
        part="teams"
        current={names.team(teamId)}
        label={text("Đội liền kề", "Teams before and after")}
        before={step(near.before)}
        after={step(near.after)}
      />
      <ClubCrests view={view} teams={teams} current={teamId} hrefOf={hrefOf} />
      {played ? (
        <>
          <ClubHead data={data} record={record} />
          <StageTabs
            label={text("Nội dung về đội", "About the team")}
            open={list}
            tabs={[
              { key: null, name: text("Phân tích", "Analysis"), to: hrefOf(teamId, null) },
              { key: "games", name: games, to: hrefOf(teamId, "games") },
            ]}
          />
          {list ? <ClubGames data={data} teamId={teamId} /> : <Analysis data={data} record={record} />}
        </>
      ) : (
        <div>
          <p className="tn-quiet">
            {text(`Trong ${counted} này không có ván nào của ${name}.`, `None of these ${counted} is of ${name}.`)}
          </p>
          <StatsWhole to={statsHref(view.id, { part: "teams", team: teamId })} name={name} />
        </div>
      )}
    </div>
  )
}
