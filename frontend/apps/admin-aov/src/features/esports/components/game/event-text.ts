import { Crosshair, Flag, Gem, ShoppingBag, Sparkles, Swords, type LucideIcon } from "lucide-react"
import type { GameSeat, GameView } from "../../model/game-view"
import { ITEM_ACTION_LABELS, OBJECTIVE_LABELS, type SeatKey, type TimelineEvent } from "../../model/timeline"

export const KIND_ICONS: Record<TimelineEvent["kind"], LucideIcon> = {
  KILL: Swords,
  OBJECTIVE: Flag,
  ITEM: ShoppingBag,
  NOTE: Sparkles,
}
export const OBJECTIVE_ICON: LucideIcon = Gem
export const FALLBACK_ICON: LucideIcon = Crosshair

export function seatLookup(game: GameView) {
  const seats = new Map<SeatKey, GameSeat>(
    [...game.sides.BLUE.seats, ...game.sides.RED.seats].map((seat) => [seat.key, seat]),
  )
  return (key?: SeatKey) => (key ? seats.get(key) : undefined)
}

export const seatLabel = (seat?: GameSeat) =>
  seat ? (seat.hero ? `${seat.hero.name} (${seat.playerName})` : seat.playerName) : "Chưa rõ"

/** One-line, human readable description used in the feed, tooltips and screen reader labels. */
export function describeEvent(event: TimelineEvent, game: GameView): { title: string; detail: string } {
  const seat = seatLookup(game)
  switch (event.kind) {
    case "KILL": {
      const assists = event.assists.map((key) => seat(key)?.playerName ?? "?").join(", ")
      return {
        title: event.killer && event.victim ? "Hạ gục" : event.victim ? "Bị hạ" : "Hạ gục",
        detail: `${seatLabel(seat(event.killer))} hạ ${seatLabel(seat(event.victim))}${assists ? ` · hỗ trợ: ${assists}` : ""}`,
      }
    }
    case "OBJECTIVE":
      return {
        title: OBJECTIVE_LABELS[event.objective],
        detail: `${game.sides[event.side].team.name} giành ${OBJECTIVE_LABELS[event.objective].toLocaleLowerCase()}${
          event.by ? ` · ${seatLabel(seat(event.by))}` : ""
        }`,
      }
    case "ITEM":
      return {
        title: `${ITEM_ACTION_LABELS[event.action]} trang bị`,
        detail: `${seat(event.seat)?.playerName ?? "?"} ${ITEM_ACTION_LABELS[event.action].toLocaleLowerCase()} ${
          event.item?.name ?? "trang bị"
        } · ô ${event.slot}${event.toSlot ? ` → ô ${event.toSlot}` : ""}`,
      }
    case "NOTE":
      return { title: event.title, detail: event.side ? game.sides[event.side].team.name : "Khoảnh khắc đáng chú ý" }
  }
}
