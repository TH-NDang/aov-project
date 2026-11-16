import type { Catalog, EquipmentSnapshot, GameSide, Selection, Participant } from "@aov/community-contracts"

export type CatalogKind = "heroes" | "items" | "arcana" | "enchantments" | "spells"

/** Each lane in Vietnamese and in English, in the order a lineup is listed. */
export const LANE_NAMES = {
  TOP: ["Đường Caesar", "Dark Slayer lane"],
  JUNGLE: ["Đi rừng", "Jungle"],
  MID: ["Đường giữa", "Mid lane"],
  DRAGON: ["Đường Rồng", "Abyssal Dragon lane"],
  SUPPORT: ["Hỗ trợ", "Support"],
} as const
export const LANE_SHORT = { TOP: "DSL", JUNGLE: "JUG", MID: "MID", DRAGON: "ADL", SUPPORT: "SUP" } as const
/** How much of a loadout the source showed, in Vietnamese and in English. */
export const OBSERVATION_NAMES = {
  UNKNOWN: ["Chưa thu thập", "Not collected"],
  NOT_SHOWN: ["Nguồn không hiển thị", "Not shown by the source"],
  PARTIAL: ["Hiện một phần", "Partly shown"],
  KNOWN: ["Đã ghi nhận", "Recorded"],
} as const
/** The name used when a pick is not linked to the wiki and carries no name of its own. */
export const UNKNOWN_REFERENCE = ["Chưa xác định", "Unknown"] as const
export function findReference(catalog: Catalog, kind: CatalogKind, selection?: Selection | null) {
  return selection?.id ? catalog[kind].find((item) => item.id === selection.id) : undefined
}
export function referenceName(
  catalog: Catalog,
  kind: CatalogKind,
  selection?: Selection | null,
  unknown: string = UNKNOWN_REFERENCE[0],
) {
  return findReference(catalog, kind, selection)?.name || selection?.name || unknown
}
export function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`
}
export function snapshotAt(snapshots: EquipmentSnapshot[], seconds: number) {
  return snapshots
    .filter((snapshot) => snapshot.atSeconds <= seconds)
    .reduce<EquipmentSnapshot | undefined>(
      (last, next) => (!last || next.atSeconds > last.atSeconds ? next : last),
      undefined,
    )
}
export function observationTimes(sides: GameSide[]) {
  return [
    ...new Set(
      sides.flatMap((side) =>
        side.participants.flatMap((participant) => [
          ...participant.equipmentSnapshots.map((snapshot) => snapshot.atSeconds),
          ...participant.equipmentEvents.map((event) => event.atSeconds),
        ]),
      ),
    ),
  ].sort((a, b) => a - b)
}
export function orderedParticipants(participants: Participant[]) {
  const order = Object.keys(LANE_NAMES)
  return [...participants].sort((a, b) => order.indexOf(a.lane) - order.indexOf(b.lane))
}
