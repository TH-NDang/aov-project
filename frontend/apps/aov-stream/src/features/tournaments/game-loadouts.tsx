import { useState } from "react"
import type { Participant, PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { ReferenceArt } from "./reference-art"
import {
  clock,
  hasLoadout,
  LANE_NAMES,
  OBSERVATION_NAMES,
  observationTimes,
  orderedParticipants,
  recordedLoadouts,
  referenceName,
  seriesSides,
  snapshotAt,
  UNKNOWN_REFERENCE,
  type LoadoutKind,
} from "../../lib/tournament-model"

/** Each kind of loadout in Vietnamese and in English. */
const KIND_NAMES: Record<LoadoutKind, readonly [string, string]> = {
  equipment: ["Trang bị", "Equipment"],
  arcana: ["Bảng ngọc", "Arcana"],
  enchantments: ["Phù hiệu", "Enchantments"],
}
const ALL_KINDS: [string, string] = ["Trang bị, ngọc và phù hiệu", "Items, arcana and enchantments"]

function Inventory({ participant, game, time }: { participant: Participant; game: PublishedGame; time: number }) {
  const { text } = useStreamLocale()
  const snapshot = snapshotAt(participant.equipmentSnapshots, time)
  return (
    <>
      <span className="tn-slots">
        {Array.from({ length: 6 }, (_, slot) => {
          const value = snapshot?.slots.find((value) => value.slot === slot + 1)
          const known = value?.known === true
          return (
            <span
              key={slot}
              className="tn-slot"
              data-unknown={!known || undefined}
              title={
                !known
                  ? text(`Ô ${slot + 1} · Chưa quan sát`, `Slot ${slot + 1} · Not observed`)
                  : value.item
                    ? referenceName(game.catalog, "items", value.item, text(...UNKNOWN_REFERENCE))
                    : text(`Ô ${slot + 1} · Trống`, `Slot ${slot + 1} · Empty`)
              }
            >
              {known && value.item ? (
                <ReferenceArt catalog={game.catalog} kind="items" selection={value.item} />
              ) : (
                <span aria-hidden="true">{known ? "·" : "?"}</span>
              )}
              <span className="sr-only">{text(`Ô ${slot + 1}`, `Slot ${slot + 1}`)}</span>
            </span>
          )
        })}
      </span>
      {snapshot && (
        <span>
          {text("Ghi nhận lúc", "Recorded at")} <strong>{clock(snapshot.atSeconds)}</strong>
          {snapshot.note && ` · ${snapshot.note}`}
        </span>
      )}
    </>
  )
}

function OptionalLoadout({
  participant,
  game,
  kind,
}: {
  participant: Participant
  game: PublishedGame
  kind: Exclude<LoadoutKind, "equipment">
}) {
  const { text } = useStreamLocale()
  const loadout = participant[kind]
  // A partial observation still shows what the source showed, and says that it is partial.
  const caveat = [loadout.status === "PARTIAL" && text(...OBSERVATION_NAMES.PARTIAL), loadout.note]
    .filter(Boolean)
    .join(" · ")
  return (
    <>
      {kind === "arcana" ? (
        <span className="tn-arcana">
          {participant.arcana.entries.map((entry, index) => (
            <span
              key={index}
              title={referenceName(game.catalog, "arcana", entry.selection, text(...UNKNOWN_REFERENCE))}
            >
              <ReferenceArt catalog={game.catalog} kind="arcana" selection={entry.selection} />×{entry.count}
            </span>
          ))}
        </span>
      ) : (
        <span className="tn-enchantments">
          {[true, false].map((primary) => {
            const entries = participant.enchantments.entries.filter((entry) => entry.primary === primary)
            return (
              entries.length > 0 && (
                <span key={String(primary)}>
                  <span className="sr-only">
                    {primary ? text("Nhánh chính:", "Primary branch:") : text("Nhánh phụ:", "Secondary branch:")}
                  </span>
                  {entries.map((entry, index) => (
                    <span
                      key={index}
                      title={`${referenceName(game.catalog, "enchantments", entry.selection, text(...UNKNOWN_REFERENCE))} · ${primary ? text("Nhánh chính", "Primary branch") : text("Nhánh phụ", "Secondary branch")}`}
                    >
                      <ReferenceArt catalog={game.catalog} kind="enchantments" selection={entry.selection} />
                      {["", "I", "II", "III"][entry.tier] || entry.tier}
                    </span>
                  ))}
                </span>
              )
            )
          })}
        </span>
      )}
      {caveat && <span>{caveat}</span>}
    </>
  )
}

const EVENT_NAMES = {
  BUY: ["Mua", "Buy"],
  SELL: ["Bán", "Sell"],
  UPGRADE: ["Nâng cấp", "Upgrade"],
  SWAP: ["Đổi ô", "Swap slots"],
} as const

function EquipmentEvents({ game, time }: { game: PublishedGame; time: number }) {
  const { text } = useStreamLocale()
  const events = game.content.sides
    .flatMap((side) =>
      side.participants.flatMap((participant) =>
        participant.equipmentEvents
          .filter((event) => event.atSeconds <= time)
          .map((event, index) => ({ event, participant, key: `${side.side}:${participant.lane}:${index}` })),
      ),
    )
    .sort((a, b) => b.event.atSeconds - a.event.atSeconds)
  if (!events.length) return null
  return (
    <details className="tn-events">
      <summary>
        <StreamIcon name="list" size={16} />
        {text("Giao dịch đã ghi nhận", "Recorded transactions")}{" "}
        <small>{text(`${events.length} lượt`, `${events.length} ${events.length === 1 ? "entry" : "entries"}`)}</small>
      </summary>
      <p>
        {text(
          "Chỉ gồm giao dịch có ghi nhận riêng, không suy từ các ảnh chụp đồ.",
          "Only transactions recorded on their own, not read from item screenshots.",
        )}
      </p>
      <ol>
        {events.map(({ event, participant, key }) => (
          <li key={key}>
            <time>{clock(event.atSeconds)}</time>
            <strong>
              {game.players[participant.playerId || ""]?.nickname ||
                referenceName(game.catalog, "heroes", participant.hero, text(...UNKNOWN_REFERENCE))}
            </strong>
            <span>{text(EVENT_NAMES[event.type][0], EVENT_NAMES[event.type][1])}</span>
            {event.replacedItem && <ReferenceArt catalog={game.catalog} kind="items" selection={event.replacedItem} />}
            {event.replacedItem && event.item && <StreamIcon name="arrow" size={13} />}
            {event.item && <ReferenceArt catalog={game.catalog} kind="items" selection={event.item} />}
            {event.type === "SWAP" && (
              <span>
                {text("Ô", "Slot")} {event.fromSlot} ↔ {event.toSlot}
              </span>
            )}
            {event.note && <span>{event.note}</span>}
          </li>
        ))}
      </ol>
    </details>
  )
}

/**
 * What the players of a game built: equipment at a chosen moment, arcana and enchantments. Only players a source
 * showed something for are listed, and only the kinds recorded for somebody are offered; a game with nothing recorded
 * says so once.
 */
export function GameLoadouts({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const sides = seriesSides(game)
  const kinds = recordedLoadouts(sides)
  const times = observationTimes(sides)
  const [chosen, setChosen] = useState<LoadoutKind | null>(null)
  const [selectedTime, setSelectedTime] = useState<number | null>(null)
  if (!kinds.length)
    return (
      <section className="tn-loadouts" aria-labelledby="game-loadouts">
        <div className="tn-heading" data-flush="">
          <h2 id="game-loadouts">{text(...ALL_KINDS)}</h2>
        </div>
        <p className="tn-quiet">
          {text(
            "Chưa ghi nhận trang bị, bảng ngọc hay phù hiệu của tuyển thủ nào trong ván này.",
            "No player's items, arcana or enchantments are recorded for this game yet.",
          )}
        </p>
      </section>
    )
  const kind = chosen && kinds.includes(chosen) ? chosen : kinds[0]!
  const last = times.at(-1) ?? 0
  const time = selectedTime ?? last
  const players = sides.flatMap((side) =>
    orderedParticipants(side.participants).map((participant) => ({ side, participant })),
  )
  const recorded = players.filter(({ participant }) => hasLoadout(participant, kind))
  const missing = players.length - recorded.length
  return (
    <section className="tn-loadouts" aria-labelledby="game-loadouts">
      <div className="tn-heading" data-flush="">
        <h2 id="game-loadouts">{kinds.length > 1 ? text(...ALL_KINDS) : text(...KIND_NAMES[kind])}</h2>
      </div>
      {kinds.length > 1 && (
        <div className="hub-pills" role="group" aria-label={text("Loại thông tin", "Kind of information")}>
          {kinds.map((item) => (
            <button type="button" key={item} aria-pressed={kind === item} onClick={() => setChosen(item)}>
              {text(...KIND_NAMES[item])}
            </button>
          ))}
        </div>
      )}
      {kind === "equipment" && times.length > 1 && (
        <div className="tn-timeline">
          <label htmlFor="game-time">
            {text("Mốc đang xem", "Time shown")} <strong>{clock(time)}</strong>
            <span>
              {text(
                `${times.length} mốc ghi nhận`,
                `${times.length} recorded ${times.length === 1 ? "time" : "times"}`,
              )}
            </span>
          </label>
          <input
            id="game-time"
            type="range"
            min="0"
            max={Math.max(last, 1)}
            step="1"
            value={time}
            onChange={(event) => setSelectedTime(Number(event.target.value))}
          />
          <div className="tn-timeline-ticks">
            {times.map((value) => (
              <button type="button" key={value} aria-pressed={time === value} onClick={() => setSelectedTime(value)}>
                {clock(value)}
              </button>
            ))}
          </div>
        </div>
      )}
      {recorded.length > 0 && (
        <div className="tn-loadout-list">
          {recorded.map(({ side, participant }) => {
            const team = game.teams[side.teamId]
            const hero = referenceName(game.catalog, "heroes", participant.hero, text(...UNKNOWN_REFERENCE))
            return (
              <div className="tn-loadout" data-side={side.side} key={`${side.side}:${participant.lane}`}>
                <span className="tn-loadout-who">
                  <ReferenceArt catalog={game.catalog} kind="heroes" selection={participant.hero} />
                  <span>
                    <strong>{game.players[participant.playerId || ""]?.nickname || hero}</strong>
                    <span className="tn-side">
                      {[
                        team?.shortName || team?.name,
                        text(LANE_NAMES[participant.lane][0], LANE_NAMES[participant.lane][1]),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </span>
                <div className="tn-loadout-what">
                  {kind === "equipment" ? (
                    <Inventory participant={participant} game={game} time={time} />
                  ) : (
                    <OptionalLoadout participant={participant} game={game} kind={kind} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {recorded.length > 0 && (missing > 0 || kind === "equipment") && (
        <p className="tn-quiet">
          {missing > 0 &&
            text(
              `Chưa ghi nhận cho ${missing} tuyển thủ còn lại. `,
              `Not recorded yet for the other ${missing} ${missing === 1 ? "player" : "players"}. `,
            )}
          {kind === "equipment" &&
            text(
              "Ô “?” là chưa quan sát; ô trống là đã xác nhận không có đồ.",
              "A “?” slot was not observed; an empty slot is confirmed to hold no item.",
            )}
        </p>
      )}
      {kind === "equipment" && <EquipmentEvents game={game} time={time} />}
    </section>
  )
}
