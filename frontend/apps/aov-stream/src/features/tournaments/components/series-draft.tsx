import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { EntityPageLink } from "../../../components/public-competitions"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { draftRows, gameWinner, type DraftRow } from "../../../lib/series-model"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./series-draft.css"

function PlayerRow({ row, games }: { row: DraftRow; games: PublishedGame[] }) {
  const { text } = useStreamLocale()
  const nickname = games.map((game) => (row.playerId ? game.players[row.playerId]?.nickname : null)).find(Boolean)
  const lane = text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])
  return (
    <tr>
      <th scope="row">
        <span className="tn-pool-player">
          <span title={lane}>
            <HeroLaneIcon lane={row.lane} size={18} label={lane} />
          </span>
          {row.playerId && nickname ? <EntityPageLink kind="PLAYER" id={row.playerId} name={nickname} /> : lane}
        </span>
      </th>
      {row.cells.map((cell, index) => (
        <td key={games[index]!.id} data-lost={cell?.won === false || undefined}>
          {cell && (
            <span className="tn-pool-cell">
              <ReferenceArt catalog={cell.game.catalog} kind="heroes" selection={cell.hero} />
              {cell.mvp && (
                <span className="tn-pool-mvp" title={text("MVP ván", "Game MVP")}>
                  <StreamIcon name="spark" size={12} />
                  <span className="sr-only">{text("MVP ván", "Game MVP")}</span>
                </span>
              )}
            </span>
          )}
        </td>
      ))}
    </tr>
  )
}

/**
 * Who played what over the whole match: a row per player, a column per game, the games a team lost a step back. One
 * table per team, in the order of the head.
 */
export function SeriesDraft({ games, teamIds }: { games: PublishedGame[]; teamIds: [string, string] }) {
  const { text } = useStreamLocale()
  if (games.length < 2) return null
  return (
    <section className="tn-block" aria-labelledby="series-draft">
      <div className="tn-heading">
        <h2 id="series-draft">{text("Tướng của từng tuyển thủ", "Heroes of each player")}</h2>
      </div>
      <div className="tn-pools">
        {teamIds.map((teamId) => {
          const team = games[0]!.teams[teamId]
          const rows = draftRows(games, teamId)
          if (!rows.length) return null
          const name = team?.name || text("Đội chưa có thông tin", "No team information yet")
          return (
            <div className="tn-pool" key={teamId}>
              <table>
                <caption>
                  <span>
                    <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
                    {name}
                  </span>
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">{text("Tuyển thủ", "Player")}</span>
                    </th>
                    {games.map((game) => {
                      const winner = gameWinner(game)
                      return (
                        <th scope="col" key={game.id} data-won={winner === teamId || undefined}>
                          <Link to={`/games/${game.id}`}>
                            <span className="sr-only">{text("Ván", "Game")} </span>
                            {game.content.number}
                            {winner && <small>{winner === teamId ? text("Thắng", "Won") : text("Thua", "Lost")}</small>}
                          </Link>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <PlayerRow key={row.key} row={row} games={games} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </section>
  )
}
