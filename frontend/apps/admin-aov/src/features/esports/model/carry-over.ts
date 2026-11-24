import type { GameContent, Lane, Loadout, Participant, Selection, Side } from "@aov/community-contracts"
import { heroKeys } from "./series-rules"

/** What one seat can take over from elsewhere: who played it, or that player's spell, emblems and arcana. */
export type CarryPart = "playerId" | "spell" | "enchantments" | "arcana"
export const LOADOUT_PARTS: CarryPart[] = ["spell", "enchantments", "arcana"]

type Value = Participant[CarryPart]
export type CarryChange = {
  side: Side
  teamId: string
  lane: Lane
  part: CarryPart
  before: Value
  after: Value
}
/** `fills` only touch what is empty; `conflicts` would replace something recorded, so they need a question first. */
export type CarryPlan = { fills: CarryChange[]; conflicts: CarryChange[] }

const same = (a: Value, b: Value) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const hasSelection = (selection: Selection | null | undefined) => heroKeys(selection).length > 0
const emptyLoadout = (loadout: Loadout<unknown>) => loadout.status === "UNKNOWN" && !loadout.entries.length

const present = (participant: Participant, part: CarryPart) =>
  part === "playerId"
    ? !!participant.playerId
    : part === "spell"
      ? hasSelection(participant.spell)
      : participant[part].entries.length > 0

const free = (participant: Participant, part: CarryPart) =>
  part === "enchantments" || part === "arcana" ? emptyLoadout(participant[part]) : !present(participant, part)

/** The value without what belongs to the other game: when its source showed it and the note about that source. */
const carried = (participant: Participant, part: CarryPart): Value =>
  part === "enchantments" || part === "arcana"
    ? ({ status: participant[part].status, entries: participant[part].entries } as Value)
    : participant[part]

const teamSide = (content: GameContent, teamId: string) => content.sides.find((side) => side.teamId === teamId)

/**
 * Line-ups of the previous game, team by team whatever side each plays now. A player already seated in another lane
 * is not seated twice.
 */
export function lineupPlan(content: GameContent, previous: GameContent): CarryPlan {
  const plan: CarryPlan = { fills: [], conflicts: [] }
  for (const side of content.sides) {
    const source = teamSide(previous, side.teamId)
    if (!source) continue
    for (const participant of side.participants) {
      const from = source.participants.find((entry) => entry.lane === participant.lane)
      if (!from?.playerId || from.playerId === participant.playerId) continue
      const seated = side.participants.some((entry) => entry.playerId === from.playerId)
      const change: CarryChange = {
        side: side.side,
        teamId: side.teamId,
        lane: participant.lane,
        part: "playerId",
        before: participant.playerId ?? null,
        after: from.playerId,
      }
      if (participant.playerId) plan.conflicts.push(change)
      else if (!seated) plan.fills.push(change)
    }
  }
  return plan
}

/** Spells, emblems and arcana of the previous game, for each player who plays again. */
export function loadoutPlan(content: GameContent, previous: GameContent): CarryPlan {
  const plan: CarryPlan = { fills: [], conflicts: [] }
  for (const side of content.sides) {
    const source = teamSide(previous, side.teamId)
    for (const participant of side.participants) {
      const from = participant.playerId
        ? source?.participants.find((entry) => entry.playerId === participant.playerId)
        : undefined
      if (!from) continue
      for (const part of LOADOUT_PARTS) {
        if (!present(from, part)) continue
        const after = carried(from, part)
        if (same(carried(participant, part), after)) continue
        const change: CarryChange = {
          side: side.side,
          teamId: side.teamId,
          lane: participant.lane,
          part,
          before: participant[part],
          after,
        }
        if (free(participant, part)) plan.fills.push(change)
        else plan.conflicts.push(change)
      }
    }
  }
  return plan
}

/** Seats whose player differs between two versions of a game, as changes that can be taken back one by one. */
export function seatChanges(before: GameContent, after: GameContent): CarryChange[] {
  return after.sides.flatMap((side) =>
    side.participants.flatMap((participant) => {
      const old = teamSide(before, side.teamId)?.participants.find((entry) => entry.lane === participant.lane)
      const change: CarryChange = {
        side: side.side,
        teamId: side.teamId,
        lane: participant.lane,
        part: "playerId",
        before: old?.playerId ?? null,
        after: participant.playerId ?? null,
      }
      return old && change.before !== change.after ? [change] : []
    }),
  )
}

function write(content: GameContent, changes: CarryChange[], from: "before" | "after"): GameContent {
  const to = from === "before" ? "after" : "before"
  return {
    ...content,
    sides: content.sides.map((side) => ({
      ...side,
      participants: side.participants.map((participant) =>
        changes
          .filter((change) => change.teamId === side.teamId && change.lane === participant.lane)
          // A seat somebody changed meanwhile keeps that newer value.
          .reduce<Participant>(
            (current, change) =>
              same(current[change.part], change[from]) ? { ...current, [change.part]: change[to] } : current,
            participant,
          ),
      ),
    })),
  }
}

export const applyCarry = (content: GameContent, changes: CarryChange[]) => write(content, changes, "before")
export const revertCarry = (content: GameContent, changes: CarryChange[]) => write(content, changes, "after")

/** The game to take line-ups from: the latest earlier game of the match that names any player. */
export function previousGame(games: readonly { content: GameContent }[], number: number): GameContent | null {
  return (
    games
      .map((game) => game.content)
      .filter(
        (content) =>
          content.number < number &&
          content.sides.some((side) => side.participants.some((participant) => participant.playerId)),
      )
      .sort((a, b) => b.number - a.number)[0] ?? null
  )
}
