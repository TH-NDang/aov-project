import type { Participant, PublishedGame } from "@aov/community-contracts"
import { EntityPageLink, GoLink } from "../../../components/go-link"
import { asksAhead } from "../../../components/on-demand"
import { MvpBadge } from "../../../components/mvp-badge"
import { useStreamLocale } from "../../../components/stream-locale"
import { statsHref } from "../../../lib/statistics-routes"
import { heroKey, referenceName, UNKNOWN_REFERENCE } from "../../../lib/tournament-model"
import { statistics } from "./on-demand-tabs"
import "./loadout-names.css"

/** The nickname of the player in a seat, while the game names one. */
export const nicknameOf = (game: PublishedGame, seat: Participant) =>
  seat.playerId ? game.players[seat.playerId]?.nickname || null : null

/** Whether the MVP of the game sat here. */
export const isMvp = (game: PublishedGame, seat: Participant) =>
  !!seat.playerId && seat.playerId === game.content.mvpPlayerId

/** The hero of a seat in the statistics of the competition; null for one nobody named. */
export function heroHref(game: PublishedGame, seat: Participant) {
  const key = heroKey(game.catalog, seat.hero)
  return key ? statsHref(game.series.tournamentId, { hero: key }) : null
}

/**
 * Who sat in a seat: the player over the hero, or the hero alone while nobody knows the player. `linked` names open the
 * player's page and the hero in the statistics of the competition; `mvp` says who the MVP was; `told` leaves out that
 * the player is not known, where it has been said of the whole side.
 */
export function SeatNames({
  game,
  seat,
  linked = false,
  mvp = false,
  told = false,
}: {
  game: PublishedGame
  seat: Participant
  linked?: boolean
  mvp?: boolean
  told?: boolean
}) {
  const { text } = useStreamLocale()
  const nickname = nicknameOf(game, seat)
  const hero = referenceName(game.catalog, "heroes", seat.hero, text(...UNKNOWN_REFERENCE))
  const href = linked ? heroHref(game, seat) : null
  const heroName = href ? (
    <GoLink to={href} plain={!!nickname} {...asksAhead(statistics)}>
      {hero}
    </GoLink>
  ) : (
    hero
  )
  return (
    <span className="tn-loadout-names">
      <strong>
        {linked && seat.playerId && nickname ? (
          <EntityPageLink kind="PLAYER" id={seat.playerId} name={nickname} />
        ) : (
          (nickname ?? heroName)
        )}
        {mvp && isMvp(game, seat) && <MvpBadge className="tn-loadout-mvp" label={text("MVP ván", "Game MVP")} />}
      </strong>
      {nickname ? <span>{heroName}</span> : !told && <small>{text("Chưa rõ tuyển thủ", "Player not known")}</small>}
    </span>
  )
}
