import type { Participant, PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { useStreamLocale } from "../../components/stream-locale"
import { ReferenceArt } from "./reference-art"
import {
  clock,
  LANE_SHORT,
  LANE_NAMES,
  OBSERVATION_NAMES,
  orderedParticipants,
  referenceName,
  snapshotAt,
  UNKNOWN_REFERENCE,
} from "./tournament-model"

export type LoadoutTab = "equipment" | "arcana" | "enchantments"

function Inventory({ participant, game, time }: { participant: Participant; game: PublishedGame; time: number }) {
  const { text } = useStreamLocale()
  const snapshot = snapshotAt(participant.equipmentSnapshots, time)
  return (
    <div className="inventory-observation">
      <div className="inventory-slots">
        {Array.from({ length: 6 }, (_, slot) => {
          const value = snapshot?.slots.find((value) => value.slot === slot + 1)
          const known = value?.known === true
          return (
            <span
              key={slot}
              className="inventory-slot"
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
              <small className="sr-only">{text(`Ô ${slot + 1}`, `Slot ${slot + 1}`)}</small>
            </span>
          )
        })}
      </div>
      <span className="inventory-observed-at">
        {snapshot ? (
          <>
            {text("Ghi nhận lúc", "Recorded at")} <strong>{clock(snapshot.atSeconds)}</strong>
            {snapshot.note && (
              <span title={snapshot.note}>
                <StreamIcon name="info" size={12} />
              </span>
            )}
          </>
        ) : (
          text("Chưa có mốc ghi nhận", "No recorded time yet")
        )}
      </span>
    </div>
  )
}

function OptionalLoadout({
  participant,
  game,
  tab,
}: {
  participant: Participant
  game: PublishedGame
  tab: Exclude<LoadoutTab, "equipment">
}) {
  const { text } = useStreamLocale()
  const loadout = participant[tab]
  // A partial observation still shows what the source showed.
  if (loadout.status !== "KNOWN" && loadout.status !== "PARTIAL")
    return (
      <span className="loadout-unavailable">
        <StreamIcon name="info" size={14} />
        {text(OBSERVATION_NAMES[loadout.status][0], OBSERVATION_NAMES[loadout.status][1])}
        {loadout.note && <small>{loadout.note}</small>}
      </span>
    )
  if (tab === "arcana")
    return (
      <div className="arcana-observation">
        {participant.arcana.entries.map((entry, index) => (
          <span
            key={index}
            data-color={entry.color}
            title={`${referenceName(game.catalog, "arcana", entry.selection, text(...UNKNOWN_REFERENCE))} × ${entry.count}`}
          >
            <ReferenceArt catalog={game.catalog} kind="arcana" selection={entry.selection} />
            <b>×{entry.count}</b>
          </span>
        ))}
      </div>
    )
  return (
    <div className="enchantment-observation">
      {[true, false].map((primary) => (
        <div
          key={String(primary)}
          aria-label={primary ? text("Nhánh chính", "Primary branch") : text("Nhánh phụ", "Secondary branch")}
        >
          {participant.enchantments.entries
            .filter((entry) => entry.primary === primary)
            .map((entry, index) => (
              <span
                key={index}
                title={`${referenceName(game.catalog, "enchantments", entry.selection, text(...UNKNOWN_REFERENCE))} · ${primary ? text("Chính", "Primary") : text("Phụ", "Secondary")} · ${text(`Bậc ${entry.tier}`, `Tier ${entry.tier}`)}`}
              >
                <ReferenceArt catalog={game.catalog} kind="enchantments" selection={entry.selection} />
                <small>{["", "I", "II", "III"][entry.tier] || entry.tier}</small>
              </span>
            ))}
        </div>
      ))}
    </div>
  )
}

export function GameLoadouts({ game, tab, time }: { game: PublishedGame; tab: LoadoutTab; time: number }) {
  const { text } = useStreamLocale()
  return (
    <div className="game-loadout-sides">
      {game.content.sides.map((side) => (
        <section className="game-loadout-team" data-side={side.side} key={side.side}>
          <h3>
            <i />
            {game.teams[side.teamId]?.shortName || game.teams[side.teamId]?.name}
          </h3>
          {orderedParticipants(side.participants).map((participant) => (
            <div className="game-loadout-player" key={participant.lane}>
              <div className="game-loadout-identity">
                <ReferenceArt catalog={game.catalog} kind="heroes" selection={participant.hero} />
                <span>
                  <strong>
                    {game.players[participant.playerId || ""]?.nickname || text("Chưa rõ tuyển thủ", "Unknown player")}
                  </strong>
                  <small title={text(LANE_NAMES[participant.lane][0], LANE_NAMES[participant.lane][1])}>
                    {LANE_SHORT[participant.lane]}
                  </small>
                </span>
                <ReferenceArt
                  catalog={game.catalog}
                  kind="spells"
                  selection={participant.spell}
                  className="player-spell"
                />
              </div>
              {tab === "equipment" ? (
                <Inventory participant={participant} game={game} time={time} />
              ) : (
                <OptionalLoadout participant={participant} game={game} tab={tab} />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

const EVENT_NAMES = {
  BUY: ["Mua", "Buy"],
  SELL: ["Bán", "Sell"],
  UPGRADE: ["Nâng cấp", "Upgrade"],
  SWAP: ["Đổi ô", "Swap slots"],
} as const
export function EquipmentEvents({ game, time }: { game: PublishedGame; time: number }) {
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
    <details className="equipment-events">
      <summary>
        <StreamIcon name="list" size={16} />
        {text("Giao dịch đã ghi nhận", "Recorded transactions")} <span>{events.length}</span>
      </summary>
      <p>
        {text(
          "Chỉ hiển thị giao dịch có ghi nhận riêng; không suy từ các ảnh chụp đồ.",
          "Only transactions recorded on their own are shown; none are inferred from item snapshots.",
        )}
      </p>
      <ol>
        {events.map(({ event, participant, key }) => (
          <li key={key}>
            <time>{clock(event.atSeconds)}</time>
            <strong>{game.players[participant.playerId || ""]?.nickname}</strong>
            <span className="equipment-event-type" data-type={event.type}>
              {text(EVENT_NAMES[event.type][0], EVENT_NAMES[event.type][1])}
            </span>
            {event.replacedItem && <ReferenceArt catalog={game.catalog} kind="items" selection={event.replacedItem} />}
            {event.replacedItem && event.item && <StreamIcon name="arrow" size={13} />}
            {event.item && <ReferenceArt catalog={game.catalog} kind="items" selection={event.item} />}
            {event.type === "SWAP" && (
              <span>
                {text("Ô", "Slot")} {event.fromSlot} ↔ {event.toSlot}
              </span>
            )}
            {event.note && (
              <span title={event.note}>
                <StreamIcon name="info" size={13} />
              </span>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
