import type { GameContent, Lane, RosterStatus, Seat, Side, TimelineEvent } from "@aov/community-contracts"
import { LANE_LABELS } from "@/lib/lanes"
import { readDraft } from "./draft"

/** A registered player of a team at the tournament, as a choice for a seat. */
export type RosterOption = { id: string; name: string; lane?: Lane | null; status?: RosterStatus; photoUrl?: string }

/** Starters first, then members of unknown standing, then substitutes. */
const STANDING: Record<RosterStatus, number> = { ACTIVE: 0, UNKNOWN: 1, SUBSTITUTE: 2, INACTIVE: 3 }
export const byStanding = (a: RosterOption, b: RosterOption) =>
  STANDING[a.status ?? "UNKNOWN"] - STANDING[b.status ?? "UNKNOWN"]

export const otherSide = (side: Side): Side => (side === "BLUE" ? "RED" : "BLUE")

/** A moment of the game with the sides changed over, so it stays with the team and the hero it happened to. */
function swapEvent(event: TimelineEvent): TimelineEvent {
  const seat = (value: Seat) => ({ ...value, side: otherSide(value.side) })
  return {
    ...event,
    ...(event.killer ? { killer: seat(event.killer) } : {}),
    ...(event.victim ? { victim: seat(event.victim) } : {}),
    ...(event.assists ? { assists: event.assists.map(seat) } : {}),
    ...(event.by ? { by: seat(event.by) } : {}),
    ...(event.side ? { side: otherSide(event.side) } : {}),
  }
}

/** Swaps which team plays blue, keeping each team's bans, picks, turns, moments and its win with it. */
export function swapSides(content: GameContent): GameContent {
  const draft = readDraft(content)
  return {
    ...content,
    sides: content.sides
      .map((side) => ({ ...side, side: otherSide(side.side) }))
      .sort((a, b) => (a.side === b.side ? 0 : a.side === "BLUE" ? -1 : 1)),
    ...(content.winner ? { winner: otherSide(content.winner) } : {}),
    ...(content.timeline ? { timeline: { ...content.timeline, events: content.timeline.events.map(swapEvent) } } : {}),
    ...(draft.turns.length
      ? { draft: { ...draft, turns: draft.turns.map((turn) => ({ ...turn, side: otherSide(turn.side) })) } }
      : {}),
  }
}

/**
 * Fills empty player slots from the registered roster by lane, a starter before a substitute, and never seats one
 * player twice in a team. Substitutions are not known here, so a game a substitute played still needs that seat
 * changed by hand.
 */
export function fillFromRoster(content: GameContent, roster: (teamId: string) => RosterOption[]): GameContent {
  return {
    ...content,
    sides: content.sides.map((side) => {
      const members = [...roster(side.teamId)].sort(byStanding)
      const seated = new Set(side.participants.flatMap((participant) => participant.playerId ?? []))
      return {
        ...side,
        participants: side.participants.map((participant) => {
          if (participant.playerId) return participant
          const member = members.find(
            (option) => option.lane === participant.lane && option.status !== "INACTIVE" && !seated.has(option.id),
          )
          if (!member) return participant
          seated.add(member.id)
          return { ...participant, playerId: member.id }
        }),
      }
    }),
  }
}

/** A member as a choice for a seat: the lane only when it is not the seat's, and whether they sit out or left. */
export const rosterOptionLabel = (member: RosterOption, lane: Lane) =>
  [
    member.name,
    member.lane && member.lane !== lane ? ` (${LANE_LABELS[member.lane].name})` : "",
    member.status === "INACTIVE" ? " · đã rời" : member.status === "SUBSTITUTE" ? " · dự bị" : "",
  ].join("")
