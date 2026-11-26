import type { ReactNode } from "react"
import { EntityPageLink, GoLink } from "../../../components/go-link"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionChampion } from "../../../lib/champion-model"
import { gamesText } from "../../../lib/feed-words"
import { statsHref } from "../../../lib/statistics-routes"
import { teamHeroes, teamTally, type TeamRecord } from "../../../lib/team-draft-model"
import { ClubSeason } from "./club-season"
import type { StatsData } from "./stats-data"
import "./club-head.css"

/** A team on a stage of its own light: what it won and lost, how many heroes it played, and its season game by game. */
export function ClubHead({ data, record }: { data: StatsData; record: TeamRecord }) {
  const { text, languageTag } = useStreamLocale()
  const { view, period } = data
  const team = view.content.teams[record.teamId]
  const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
  const { wins, losses } = teamTally(record)
  const heroes = teamHeroes(record).length
  // A count that stands for no game leads nowhere.
  const count = (games: number, won: boolean): ReactNode => {
    const told = gamesText(games, text, languageTag)
    return games > 0 ? (
      <GoLink
        prose
        to={statsHref(view.id, { question: { team: record.teamId, won }, scope: period?.key })}
        aria-label={won ? text(`${told} thắng`, `${told} won`) : text(`${told} thua`, `${told} lost`)}
      >
        {games}
      </GoLink>
    ) : (
      games
    )
  }
  return (
    <Stage
      tint={name}
      lights={[{ src: team?.logoUrl, darkSrc: team?.logoDarkUrl, at: "left" }]}
      shaded
      className="tn-club-head"
    >
      <div className="tn-club-head-team">
        <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
        <div>
          {competitionChampion(view)?.winner.id === record.teamId && (
            <p className="tn-club-head-title">
              <StreamIcon name="trophy" size={14} />
              {text("Nhà vô địch", "Champion")}
            </p>
          )}
          <h2>{team ? <EntityPageLink kind="TEAM" id={record.teamId} name={name} /> : name}</h2>
          <p className="tn-club-head-record">
            {text("Thắng ", "Won ")}
            {count(wins, true)}
            {text(", thua ", ", lost ")}
            {count(losses, false)}
            {text(" ván", losses === 1 ? " game" : " games")}
            {heroes > 0 && text(`, chơi ${heroes} tướng`, `, played ${heroes} ${heroes === 1 ? "hero" : "heroes"}`)}
          </p>
        </div>
      </div>
      <ClubSeason key={`${record.teamId}:${period?.key}`} view={view} record={record} />
    </Stage>
  )
}
