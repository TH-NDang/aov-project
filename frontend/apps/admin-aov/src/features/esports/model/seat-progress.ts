import type { ObservationStatus, Participant } from "@aov/community-contracts"
import { buildOf, type Build, type ItemIndex } from "./build"
import { ARCANA_COLORS, STONES_PER_COLOR, type LoadoutPart } from "./loadout"
import { heroKeys } from "./series-rules"

/** How far one part of a player is recorded; `hidden` says the source never showed it. */
export type PartState = "done" | "partial" | "hidden" | "todo"

const LOADOUT_STATES: Record<ObservationStatus, PartState> = {
  KNOWN: "done",
  PARTIAL: "partial",
  NOT_SHOWN: "hidden",
  UNKNOWN: "todo",
}

/** Items read off a snapshot count as recorded in part, since nobody wrote them down. */
const buildState = (build: Build): PartState => (build.snapshot ? "partial" : build.steps.length ? "done" : "todo")

export const SEAT_PARTS = ["spell", "enchantments", "arcana", "equipment"] as const satisfies readonly LoadoutPart[]

/** `duration` is the length of the game, as far as it is known. */
export function partState(
  participant: Participant,
  part: LoadoutPart,
  duration: number | null | undefined,
  index?: ItemIndex,
): PartState {
  switch (part) {
    case "spell":
      return heroKeys(participant.spell).length ? "done" : "todo"
    case "enchantments":
    case "arcana":
      return LOADOUT_STATES[participant[part].status]
    case "equipment":
      return buildState(buildOf(participant, duration, index))
  }
}

/** How much of one part is recorded; null where that is nothing, or where there is nothing to count. */
export function partCount(
  participant: Participant,
  part: LoadoutPart,
  duration: number | null | undefined,
  index?: ItemIndex,
): string | null {
  switch (part) {
    case "spell":
      return null
    case "enchantments": {
      const { length } = participant.enchantments.entries
      return length ? `${length}/5` : null
    }
    case "arcana": {
      const stones = participant.arcana.entries.reduce((total, entry) => total + entry.count, 0)
      return stones ? `${stones}/${STONES_PER_COLOR * ARCANA_COLORS.length}` : null
    }
    case "equipment": {
      const { length } = buildOf(participant, duration, index).steps
      return length ? String(length) : null
    }
  }
}

const PART_WORDS: Record<LoadoutPart, string> = {
  spell: "phụ trợ",
  enchantments: "phù hiệu",
  arcana: "bảng ngọc",
  equipment: "trang bị",
}
const STATE_WORDS: Record<PartState, string> = {
  done: "đã ghi",
  partial: "một phần",
  hidden: "không hiển thị",
  todo: "chưa ghi",
}

/** How far a player is recorded, in words; a list nobody wrote is named after where it is read. */
export const seatState = (participant: Participant, duration: number | null | undefined, index?: ItemIndex) =>
  SEAT_PARTS.map((part) => {
    const state = partState(participant, part, duration, index)
    const read = part === "equipment" && state === "partial"
    return `${PART_WORDS[part]} ${read ? "đọc từ mốc" : STATE_WORDS[state]}`
  }).join(", ")
