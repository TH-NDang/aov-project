import type { Catalog, EquipmentSnapshot, GameSide, Selection, Participant } from "@aov/community-contracts"

export type CatalogKind = "heroes" | "items" | "arcana" | "enchantments" | "spells"

export const LANES = {
  TOP: "Đường Caesar",
  JUNGLE: "Đi rừng",
  MID: "Đường giữa",
  DRAGON: "Đường Rồng",
  SUPPORT: "Hỗ trợ",
} as const
export const LANE_SHORT = { TOP: "DSL", JUNGLE: "JUG", MID: "MID", DRAGON: "ADL", SUPPORT: "SUP" } as const
export const OBSERVATIONS = {
  UNKNOWN: "Chưa thu thập",
  NOT_SHOWN: "Nguồn không hiển thị",
  PARTIAL: "Hiện một phần",
  KNOWN: "Đã ghi nhận",
} as const
export function findReference(catalog: Catalog, kind: CatalogKind, selection?: Selection | null) {
  return selection?.id ? catalog[kind].find((item) => item.id === selection.id) : undefined
}
export function referenceName(catalog: Catalog, kind: CatalogKind, selection?: Selection | null) {
  return findReference(catalog, kind, selection)?.name || selection?.name || "Chưa xác định"
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
  const order = Object.keys(LANES)
  return [...participants].sort((a, b) => order.indexOf(a.lane) - order.indexOf(b.lane))
}
