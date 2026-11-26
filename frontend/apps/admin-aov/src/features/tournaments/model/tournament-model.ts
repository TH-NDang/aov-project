import type {
  EquipmentSnapshot,
  GameContent,
  GameSide,
  Lane,
  Participant,
  Reference,
  Selection,
  SeriesContent,
  Side,
} from "@aov/community-contracts"
import { LANE_LABELS, LANE_ORDER } from "@/lib/lanes"

/** Lanes in map order with their names; the names come from the one table the match screens use. */
export const LANES: { code: Lane; name: string; short: string }[] = LANE_ORDER.map((code) => ({
  code,
  ...LANE_LABELS[code],
}))
export const GAME_REGIONS = ["VN", "TH", "TW", "ID", "GLOBAL"]
export const emptySelection = (): Selection => ({ id: null, name: null })

export function emptyParticipant(lane: Lane): Participant {
  return {
    playerId: null,
    lane,
    hero: emptySelection(),
    spell: emptySelection(),
    arcana: { status: "UNKNOWN", entries: [] },
    enchantments: { status: "UNKNOWN", entries: [] },
    equipmentSnapshots: [],
    equipmentEvents: [],
  }
}
export function initialGame(seriesId: string, series: SeriesContent, number: number, region = "VN"): GameContent {
  const side = (side: Side, teamId: string): GameSide => ({
    side,
    teamId,
    bans: Array.from({ length: 4 }, emptySelection),
    participants: LANES.map((lane) => emptyParticipant(lane.code)),
  })
  return {
    seriesId,
    number,
    region: GAME_REGIONS.includes(region) ? region : "GLOBAL",
    locale: "vi-VN",
    seasonId: null,
    patchVariantId: null,
    sourceUrl: series.sourceUrl ?? "",
    sides: [side("BLUE", series.teamAId), side("RED", series.teamBId)],
    // community-service binds this to a primitive boolean and rejects the whole game when it is omitted.
    includeUnscoped: false,
  }
}
export function emptySnapshot(atSeconds: number): EquipmentSnapshot {
  return { atSeconds, slots: Array.from({ length: 6 }, (_, slot) => ({ slot: slot + 1, known: false, item: null })) }
}
export function selectionName(selection: Selection | null | undefined, references: Reference[] = []) {
  return (
    selection?.name?.trim() ||
    references.find((reference) => reference.id === selection?.id)?.name?.trim() ||
    (selection?.id ? "Mục đã liên kết Wiki" : "Chưa chọn")
  )
}
export function minuteLabel(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`
}
export function parseGameTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,3}):([0-5]\d)$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}
