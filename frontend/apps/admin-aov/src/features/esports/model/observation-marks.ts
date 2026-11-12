import type { GameContent, Lane, Participant, Side } from "@aov/community-contracts"

/** What a broadcast shows of a team's loadouts at one moment. */
export type MarkPart = "spell" | "enchantments" | "arcana" | "equipment"

export const MARK_LABELS: Record<MarkPart, string> = {
  spell: "phụ trợ",
  enchantments: "phù hiệu",
  arcana: "bảng ngọc",
  equipment: "trang bị",
}

/**
 * The game second a broadcast showed one part of a team's loadouts, for the players it was recorded for together.
 * `min` and `max` are the game seconds the mark may move between: anywhere in the game, except that the equipment
 * snapshots of one player are stored in order and so stay between their neighbours.
 */
export type ObservationMark = { side: Side; part: MarkPart; at: number; lanes: Lane[]; min: number; max: number }

const LOADOUT_PARTS = ["spell", "enchantments", "arcana"] as const

const observedAt = (participant: Participant, part: (typeof LOADOUT_PARTS)[number]) =>
  part === "spell" ? participant.spellObservedAtSeconds : participant[part].observedAtSeconds

/** Marks of a game in time order. Players of one team sharing a part and a second are one mark. */
export function observationMarks(content: GameContent, duration: number): ObservationMark[] {
  const marks = new Map<string, ObservationMark>()
  const add = (side: Side, part: MarkPart, at: number, lane: Lane, min: number, max: number) => {
    const key = `${side}:${part}:${at}`
    const mark = marks.get(key)
    if (!mark) return void marks.set(key, { side, part, at, lanes: [lane], min, max })
    mark.lanes.push(lane)
    mark.min = Math.max(mark.min, min)
    mark.max = Math.min(mark.max, max)
  }
  for (const side of content.sides)
    for (const participant of side.participants) {
      for (const part of LOADOUT_PARTS) {
        const at = observedAt(participant, part)
        if (at != null) add(side.side, part, at, participant.lane, 0, duration)
      }
      participant.equipmentSnapshots.forEach((snapshot, index, all) =>
        add(
          side.side,
          "equipment",
          snapshot.atSeconds,
          participant.lane,
          index > 0 ? all[index - 1]!.atSeconds + 1 : 0,
          index < all.length - 1 ? all[index + 1]!.atSeconds - 1 : duration,
        ),
      )
    }
  return [...marks.values()].sort((a, b) => a.at - b.at)
}

/** The game with one mark moved to another game second for every player it stands for; null when nobody holds it. */
export function moveMark(
  content: GameContent,
  mark: Pick<ObservationMark, "side" | "part" | "at">,
  gameSecond: number,
): GameContent | null {
  const second = Math.max(0, Math.round(gameSecond))
  let moved = false
  const move = (participant: Participant): Participant => {
    if (mark.part === "equipment") {
      if (!participant.equipmentSnapshots.some((snapshot) => snapshot.atSeconds === mark.at)) return participant
      moved = true
      return {
        ...participant,
        equipmentSnapshots: participant.equipmentSnapshots.map((snapshot) =>
          snapshot.atSeconds === mark.at ? { ...snapshot, atSeconds: second } : snapshot,
        ),
      }
    }
    if (observedAt(participant, mark.part) !== mark.at) return participant
    moved = true
    return mark.part === "spell"
      ? { ...participant, spellObservedAtSeconds: second }
      : { ...participant, [mark.part]: { ...participant[mark.part], observedAtSeconds: second } }
  }
  const sides = content.sides.map((side) =>
    side.side === mark.side ? { ...side, participants: side.participants.map(move) } : side,
  )
  return moved ? { ...content, sides } : null
}
