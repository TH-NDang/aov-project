import type { PublishedGame } from "@aov/community-contracts"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { clock, referenceName, UNKNOWN_REFERENCE } from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./equipment-events.css"

const EVENT_NAMES = {
  BUY: ["Mua", "Buy"],
  SELL: ["Bán", "Sell"],
  UPGRADE: ["Nâng cấp", "Upgrade"],
  SWAP: ["Đổi ô", "Swap slots"],
} as const

/** The purchases and sales recorded on their own, newest first, folded away. Nothing shows without any. */
export function EquipmentEvents({ game }: { game: PublishedGame }) {
  const { text } = useStreamLocale()
  const events = game.content.sides
    .flatMap((side) =>
      side.participants.flatMap((participant) =>
        participant.equipmentEvents.map((event, index) => ({
          event,
          participant,
          key: `${side.side}:${participant.lane}:${index}`,
        })),
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
