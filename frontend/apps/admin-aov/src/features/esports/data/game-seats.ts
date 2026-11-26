import type { DocumentView, GameContent } from "@aov/community-contracts"
import { emptyParticipant } from "@/features/tournaments/model/tournament-model"
import { LANE_ORDER } from "@/lib/lanes"

const SEATS = 5

/**
 * A game with a place for each of its ten players. One that was imported with its result alone has none, and a player, a
 * hero or a pick recorded for it would have nowhere to go.
 */
export function withSeats(entry: DocumentView<GameContent>): DocumentView<GameContent> {
  const { sides } = entry.content
  if (sides.every((side) => side.participants.length >= SEATS)) return entry
  return {
    ...entry,
    content: {
      ...entry.content,
      sides: sides.map((side) => {
        const taken = new Set(side.participants.map((participant) => participant.lane))
        const free = LANE_ORDER.filter((lane) => !taken.has(lane)).slice(0, SEATS - side.participants.length)
        return { ...side, participants: [...side.participants, ...free.map(emptyParticipant)] }
      }),
    },
  }
}
