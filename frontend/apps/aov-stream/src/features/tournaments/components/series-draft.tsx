import { Link } from "react-router"
import type { PublishedGame } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { EntityPageLink } from "../../../components/go-link"
import { MvpBadge } from "../../../components/mvp-badge"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { draftRows, gameWinner, type DraftRow } from "../../../lib/series-model"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./series-draft.css"

/** A row of a team; `named` tells that some rows of it name their player, so one that does not says so. */
function PlayerRow({ row, games, named }: { row: DraftRow; games: PublishedGame[]; named: boolean }) {
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
          {row.playerId && nickname ? (
            <EntityPageLink kind="PLAYER" id={row.playerId} name={nickname} />
          ) : named ? (
            <span className="tn-pool-unknown">{text("Chưa rõ tuyển thủ", "Player not known")}</span>
          ) : (
            lane
          )}
        </span>
      </th>
      {row.cells.map((cell, index) => (
        <td key={games[index]!.id} data-lost={cell?.won === false || undefined}>
          {cell && (
            <span className="tn-pool-cell">
              <ReferenceArt catalog={cell.game.catalog} kind="heroes" selection={cell.hero} />
              {cell.mvp && <MvpBadge className="tn-pool-mvp" label={text("MVP ván", "Game MVP")} />}
            </span>
          )}
        </td>
      ))}
    </tr>
  )
}

/**
 * Who played what over the whole match: a row per player, a column per game, the games a team lost a step back. One
 * table per team, in the order of the head. A team whose games name nobody has a row per lane instead.
 */
export function SeriesDraft({ games, teamIds }: { games: PublishedGame[]; teamIds: [string, string] }) {
  const { text } = useStreamLocale()
  if (games.length < 2) return null
  const tables = teamIds.map((teamId) => {
    const rows = draftRows(games, teamId)
    return { teamId, rows, named: rows.some((row) => row.playerId) }
  })
  return (
    <section className="tn-block" aria-labelledby="series-draft">
      <div className="tn-heading">
        <h2 id="series-draft">
          {tables.some(({ named }) => named)
            ? text("Tướng của từng tuyển thủ", "Heroes of each player")
            : text("Tướng theo đường", "Heroes by lane")}
        </h2>
      </div>
      <div className="tn-pools">
        {tables.map(({ teamId, rows, named }) => {
          const team = games[0]!.teams[teamId]
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
                      <span className="sr-only">{named ? text("Tuyển thủ", "Player") : text("Đường", "Lane")}</span>
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
                    <PlayerRow key={row.key} row={row} games={games} named={named} />
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
