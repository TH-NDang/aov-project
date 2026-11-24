import { useState } from "react"
import type { GameSide, Participant, PublishedGame, Selection } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { EntityPageLink } from "../../../components/public-competitions"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { laneDuels } from "../../../lib/series-model"
import {
  findReference,
  LANE_NAMES,
  observationTimes,
  recordedLoadouts,
  referenceName,
  seriesSides,
  UNKNOWN_REFERENCE,
  type LoadoutKind,
} from "../../../lib/tournament-model"
import { KIND_NAMES, PlayerLoadout } from "./player-loadout"
import { TeamName } from "./match-row"
import { GameClock } from "./game-clock"
import { ReferenceArt } from "./reference-art"
import "./game-lineup.css"

type Slot = "a" | "b"

/** The heroes a side banned, in the order the record lists them. */
function Bans({ game, bans }: { game: PublishedGame; bans: Selection[] }) {
  const { text } = useStreamLocale()
  if (!bans.length) return null
  return (
    <p className="tn-bans">
      <span>{text("Cấm", "Bans")}</span>
      {bans.map((selection, index) => (
        <ReferenceArt key={index} catalog={game.catalog} kind="heroes" selection={selection} className="tn-ban" />
      ))}
    </p>
  )
}

/** The head of one side: its team, the side of the map it played on, whether it won and what it banned. */
function SideHead({ game, side, slot }: { game: PublishedGame; side: GameSide; slot: Slot }) {
  const { text } = useStreamLocale()
  const team = game.teams[side.teamId]
  const name = team?.name || team?.shortName || text("Đội chưa có thông tin", "No team information yet")
  return (
    <div className="tn-lineup-head" data-side={side.side} data-slot={slot}>
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
            {side.side === "BLUE" ? text("Phe xanh", "Blue side") : text("Phe đỏ", "Red side")}
          </span>
          {game.content.winner === side.side && (
            <span className="tn-lineup-won">
              <StreamIcon name="trophy" size={14} />
              {text("Thắng", "Won")}
            </span>
          )}
        </p>
      </div>
      <Bans game={game} bans={side.bans} />
    </div>
  )
}

/** One player of a lane: the hero with its spell, who played it and, below, what they built. */
function Seat({
  game,
  seat,
  slot,
  side,
  kind,
  time,
}: {
  game: PublishedGame
  seat: Participant | undefined
  slot: Slot
  side: GameSide
  kind: LoadoutKind | null
  time: number
}) {
  const { text } = useStreamLocale()
  if (!seat) return <div className="tn-seat" data-slot={slot} />
  const hero = referenceName(game.catalog, "heroes", seat.hero, text(...UNKNOWN_REFERENCE))
  const nickname = seat.playerId ? game.players[seat.playerId]?.nickname : undefined
  const mvp = !!seat.playerId && seat.playerId === game.content.mvpPlayerId
  return (
    <div className="tn-seat" data-slot={slot} data-side={side.side}>
      <span className="tn-seat-art">
        <ReferenceArt catalog={game.catalog} kind="heroes" selection={seat.hero} />
        {findReference(game.catalog, "spells", seat.spell)?.iconUrl && (
          <span className="tn-seat-spell">
            <ReferenceArt catalog={game.catalog} kind="spells" selection={seat.spell} />
          </span>
        )}
      </span>
      <div className="tn-seat-who">
        <strong>
          {seat.playerId && nickname ? <EntityPageLink kind="PLAYER" id={seat.playerId} name={nickname} /> : hero}
          {mvp && (
            <span className="tn-seat-mvp">
              <StreamIcon name="spark" size={13} />
              MVP
            </span>
          )}
        </strong>
        {nickname && <span>{hero}</span>}
      </div>
      {kind && <PlayerLoadout game={game} participant={seat} kind={kind} time={time} />}
    </div>
  )
}

/**
 * The lineup of a game lane by lane, both players of a lane facing each other, with what they built under their
 * names. Only the kinds of loadout recorded for somebody are offered; equipment is read at a chosen moment.
 */
export function GameLineup({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const [chosen, setChosen] = useState<LoadoutKind | null>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  const sides = seriesSides(game)
  const [a, b] = sides
  if (!a || !b) return null
  const kinds = recordedLoadouts(sides)
  const kind = chosen && kinds.includes(chosen) ? chosen : (kinds[0] ?? null)
  const times = observationTimes(sides)
  const time = selectedTime ?? times.at(-1) ?? 0
  return (
    <section className="tn-block" aria-labelledby="game-lineup">
      <div className="tn-heading">
        <h2 id="game-lineup">{text("Đội hình", "Lineups")}</h2>
        {kinds.length > 1 && (
          <div className="hub-pills" role="group" aria-label={text("Loại thông tin", "Kind of information")}>
            {kinds.map((item) => (
              <button type="button" key={item} aria-pressed={kind === item} onClick={() => setChosen(item)}>
                {text(...KIND_NAMES[item])}
              </button>
            ))}
          </div>
        )}
      </div>
      {kind === "equipment" && times.length > 1 && <GameClock times={times} value={time} onChange={setSelectedTime} />}
      <div className="tn-lineup">
        <SideHead game={game} side={a} slot="a" />
        <SideHead game={game} side={b} slot="b" />
        {laneDuels([a, b]).map((duel) => {
          const lane = text(LANE_NAMES[duel.lane][0], LANE_NAMES[duel.lane][1])
          return (
            <div className="tn-lane-duel" key={duel.lane}>
              <Seat game={game} seat={duel.a} side={a} slot="a" kind={kind} time={time} />
              <span className="tn-lane-mark" title={lane}>
                <HeroLaneIcon lane={duel.lane} size={24} label={lane} />
              </span>
              <Seat game={game} seat={duel.b} side={b} slot="b" kind={kind} time={time} />
            </div>
          )
        })}
      </div>
      {!kind && (
        <p className="tn-quiet tn-lineup-note">
          {text(
            "Chưa ghi nhận trang bị, bảng ngọc hay phù hiệu của ván này.",
            "No items, arcana or enchantments are recorded for this game yet.",
          )}
        </p>
      )}
      {kind === "equipment" && (
        <p className="tn-quiet tn-lineup-note">
          {text(
            "Ô “?” là chưa quan sát; ô trống là đã xác nhận không có đồ.",
            "A “?” slot was not observed; an empty slot is confirmed to hold no item.",
          )}
        </p>
      )}
    </section>
  )
}
