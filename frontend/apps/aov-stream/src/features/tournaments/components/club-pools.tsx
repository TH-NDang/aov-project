import { useEffect, useRef, type CSSProperties } from "react"
import { Link } from "react-router"
import { FoldTile } from "../../../components/fold-button"
import { EntityPageLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { poolLanes } from "../../../lib/club-model"
import { gamesText, recordText, score } from "../../../lib/feed-words"
import { shareWords } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { namedSeats, playerPools, type PlayerPool, type TeamRecord } from "../../../lib/team-draft-model"
import { useFold } from "../../../lib/use-fold"
import { LaneHeading } from "./column-heading"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./club-pools.css"

/** Heroes of a player before the rest unfolds. */
const SHOWN = 7

function Pool({ data, teamId, pool }: { data: StatsData; teamId: string; pool: PlayerPool }) {
  const { text, languageTag } = useStreamLocale()
  const { rows, rest, open, toggle } = useFold(pool.heroes, SHOWN, `pool:${pool.playerId}`)
  const list = useRef<HTMLUListElement>(null)
  const unfolded = useRef(false)
  // What unfolds the rest gives its place to the first of them, and with it the focus.
  useEffect(() => {
    if (open && unfolded.current) list.current?.children[SHOWN]?.querySelector("a")?.focus()
    unfolded.current = false
  }, [open])
  const { view, period } = data
  // The finder only knows the players the competition names.
  const known = view.content.players[pool.playerId]?.nickname
  const name = known ?? text("Chưa rõ tên", "Name not known")
  const count = pool.heroes.length
  const games = gamesText(pool.games, text, languageTag)
  return (
    <section className="tn-club-pool">
      <h4>{known ? <EntityPageLink kind="PLAYER" id={pool.playerId} name={name} /> : name}</h4>
      <p>
        {text(`${count} tướng, `, `${count} ${count === 1 ? "hero" : "heroes"}, `)}
        {known ? (
          <Link
            to={statsHref(view.id, { question: { team: teamId, player: pool.playerId }, scope: period?.key })}
            aria-label={text(`${games} của ${name}`, `${games} of ${name}`)}
          >
            {games}
          </Link>
        ) : (
          games
        )}
      </p>
      <ul ref={list}>
        {rows.map(({ hero, wins, losses }) => {
          const drawn = (
            <>
              <HeroPortrait hero={hero} />
              <small>{score({ wins, losses })}</small>
            </>
          )
          return (
            <li key={hero.key}>
              {known ? (
                <Link
                  title={hero.name}
                  to={statsHref(view.id, {
                    question: { team: teamId, player: pool.playerId, pick: [hero] },
                    scope: period?.key,
                  })}
                  aria-label={`${hero.name}: ${recordText({ wins, losses }, text)}`}
                >
                  {drawn}
                </Link>
              ) : (
                <span title={hero.name}>{drawn}</span>
              )}
            </li>
          )
        })}
        {rest > 0 && (
          <li>
            <FoldTile
              rest={rest}
              unit={text("tướng", "heroes")}
              label={text(`Xem thêm ${rest} tướng của ${name}`, `Show ${rest} more heroes of ${name}`)}
              onOpen={() => {
                unfolded.current = true
                toggle()
              }}
            />
          </li>
        )}
      </ul>
    </section>
  )
}

/**
 * The heroes of each player of a team, in lane order, with what they won and lost with them. Nothing shows while no seat
 * names its player; a line says how many do.
 */
export function ClubPools({ data, record }: { data: StatsData; record: TeamRecord }) {
  const { text } = useStreamLocale()
  const lanes = poolLanes(playerPools(record))
  if (!lanes.length) return null
  const { named, seats } = namedSeats(record)
  const share = shareWords(named / seats, text)
  return (
    <Section
      title={text("Tướng của từng tuyển thủ", "Heroes of each player")}
      note={
        named < seats
          ? text(`Đã ghi tuyển thủ ở ${share} lượt chọn`, `Players recorded for ${share} of the picks`)
          : undefined
      }
    >
      <div className="tn-club-pools" style={{ "--lanes": lanes.length } as CSSProperties}>
        {lanes.map(({ lane, pools }) => (
          <section key={lane ?? "unknown"}>
            <LaneHeading lane={lane} />
            {pools.map((pool) => (
              <Pool key={pool.playerId} data={data} teamId={record.teamId} pool={pool} />
            ))}
          </section>
        ))}
      </div>
    </Section>
  )
}
