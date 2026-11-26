import { useState } from "react"
import type { GameSide, PublishedGame } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { EntityPageLink } from "../../../components/go-link"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { banPlaces, inventoryTimes, lineupRecord } from "../../../lib/build-view"
import { recordWords } from "../../../lib/build-words"
import { laneName } from "../../../lib/feed-words"
import { laneDuels } from "../../../lib/series-model"
import { present, seriesSides } from "../../../lib/tournament-model"
import { GameClock } from "./game-clock"
import { nicknameOf } from "./loadout-names"
import { LoadoutSeat, type Shown } from "./loadout-seat"
import { TeamName } from "./match-row"
import { ReferenceArt } from "./reference-art"
import "./game-lineup.css"

type Slot = "a" | "b"

/** The heroes a side banned, in the order the record lists them; a ban nobody saw leaves its place struck and empty. */
function Bans({ game, side, places }: { game: PublishedGame; side: GameSide; places: number }) {
  const { text } = useStreamLocale()
  if (!places) return null
  const unseen = text("Chưa rõ tướng bị cấm", "Banned hero not known")
  return (
    <p className="tn-bans">
      <span>{text("Cấm", "Bans")}</span>
      {Array.from({ length: places }, (_, index) => {
        const ban = side.bans[index]
        return present(ban) ? (
          <ReferenceArt key={index} catalog={game.catalog} kind="heroes" selection={ban} className="tn-ban" />
        ) : (
          <span key={index} className="tn-ban" data-unseen="" role="img" aria-label={unseen} title={unseen} />
        )
      })}
    </p>
  )
}

/**
 * The head of one side: its team, the side of the map it played on, whether it won and what it banned. `told` says once
 * that no player of the side is known.
 */
function SideHead({
  game,
  side,
  slot,
  places,
  told,
}: {
  game: PublishedGame
  side: GameSide
  slot: Slot
  places: number
  told: boolean
}) {
  const { text } = useStreamLocale()
  const { winner } = game.content
  const team = game.teams[side.teamId]
  const name = team?.name || team?.shortName || text("Đội chưa có thông tin", "No team information yet")
  return (
    <div
      className="tn-lineup-head"
      data-side={side.side}
      data-slot={slot}
      data-lost={(!!winner && winner !== side.side) || undefined}
    >
      <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
      <div>
        <h3>
          {team ? (
            <EntityPageLink kind="TEAM" id={side.teamId} name={name}>
              <TeamName wide={name} compact={team.shortName || name} />
            </EntityPageLink>
          ) : (
            name
          )}
        </h3>
        <p>
          <span className="tn-side">
            {side.side === "BLUE" ? text("Bên xanh", "Blue side") : text("Bên đỏ", "Red side")}
          </span>
          {winner === side.side && (
            <span className="tn-lineup-won">
              <StreamIcon name="trophy" size={14} />
              {text("Thắng", "Won")}
            </span>
          )}
          {told && <span>{text("Chưa rõ tuyển thủ", "Players not known")}</span>}
        </p>
      </div>
      <Bans game={game} side={side} places={places} />
    </div>
  )
}

/**
 * The lineup of a game lane by lane, both players of a lane facing each other: the hero, who played it, the spell, the
 * main enchantment and the items, all at a glance; a seat opens the rest. Without items the lanes stand side by side on
 * a wide screen. The slider comes with several moments at which inventories were seen.
 */
export function GameLineup({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const wide = usePageLayout() === "wide"
  const [at, setAt] = useState<number | null>(null)
  const sides = seriesSides(game)
  const [a, b] = sides
  if (!a || !b) return null
  const record = lineupRecord(game)
  const times = inventoryTimes(sides)
  const kit = record.spells + record.enchantments > 0
  const shown: Shown = record.items || times.length > 1 ? "ITEMS" : kit ? "KIT" : "HEROES"
  const board = wide && shown !== "ITEMS"
  const places = banPlaces(sides)
  // A game that names nobody says so under the lineup, with what else it lacks.
  const unnamed = (side: GameSide) =>
    record.players > 0 && side.participants.length > 0 && side.participants.every((seat) => !nicknameOf(game, seat))
  const told = { a: !record.players || unnamed(a), b: !record.players || unnamed(b) }
  const words = recordWords(at == null ? record : lineupRecord(game, at), text, at)
  const heads = {
    a: <SideHead game={game} side={a} slot="a" places={places} told={unnamed(a)} />,
    b: <SideHead game={game} side={b} slot="b" places={places} told={unnamed(b)} />,
  }
  return (
    <section className="tn-block" aria-labelledby="game-lineup">
      <div className="tn-heading">
        <h2 id="game-lineup">{text("Đội hình", "Lineups")}</h2>
      </div>
      {times.length > 1 && <GameClock times={times} value={at} onChange={setAt} />}
      <div className="tn-lineup" data-shown={shown} data-board={board || undefined}>
        {heads.a}
        {!board && heads.b}
        {laneDuels([a, b]).map((duel) => {
          const lane = laneName(duel.lane, text)
          const seat = { game, shown, kit, board, at }
          return (
            <div className="tn-lane-duel" key={duel.lane} role="group" aria-label={lane}>
              <LoadoutSeat {...seat} seat={duel.a} side={a} slot="a" told={told.a} />
              <span className="tn-lane-mark" title={lane}>
                <HeroLaneIcon lane={duel.lane} size={24} />
                {board && <span>{lane}</span>}
              </span>
              <LoadoutSeat {...seat} seat={duel.b} side={b} slot="b" told={told.b} />
            </div>
          )
        })}
        {board && heads.b}
      </div>
      {words.length > 0 && <p className="tn-lineup-note">{words.join(" ")}</p>}
    </section>
  )
}
