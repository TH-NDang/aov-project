import type {
  ArcanaAllocation,
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

export const LANES: { code: Lane; name: string; short: string }[] = [
  { code: "TOP", name: "Đường Caesar", short: "DSL" },
  { code: "JUNGLE", name: "Đi rừng", short: "JUG" },
  { code: "MID", name: "Đường giữa", short: "MID" },
  { code: "DRAGON", name: "Đường Rồng", short: "ADL" },
  { code: "SUPPORT", name: "Hỗ trợ", short: "SUP" },
]
export const OBSERVATION_LABELS = {
  UNKNOWN: "Chưa thu thập",
  NOT_SHOWN: "Nguồn không hiển thị",
  PARTIAL: "Hiện một phần",
  KNOWN: "Đã quan sát rõ",
} as const
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
export function arcanaTotal(entries: ArcanaAllocation[]) {
  return entries.reduce((total, entry) => total + entry.count, 0)
}
export function missingFieldLabel(path: string) {
  const special: Record<string, string> = {
    "number.exceedsBestOf": "Số ván vượt quá thể thức BO của trận",
    "sides.hero.alreadyBanned": "Tướng được chọn trùng một tướng đã bị cấm",
    "sides.teams.matchSeries": "Hai đội trong ván phải là hai đội của trận đấu",
    "seriesId.notFound": "Trận đấu không còn tồn tại",
    "draft.startSecond.afterGameStart": "Mốc bắt đầu cấm chọn phải trước lúc vào trận",
    "draft.lockedSecond.afterGameStart": "Mốc chốt đội hình phải trước lúc vào trận",
    "draft.lockedSecond.range": "Mốc chốt đội hình phải sau mốc bắt đầu cấm chọn",
  }
  if (special[path]) return special[path]
  return path
    .replace(/^content\./, "")
    .replace(/draft\.turns\[(\d+)\]/g, (_, index) => `Cấm chọn · Lượt ${Number(index) + 1}`)
    .replace(/\.usedInSeries/g, " · Đội đã dùng tướng này ở ván khác của loạt BO")
    .replace(/\.notDrafted/g, " · Không có trong các lượt cấm chọn")
    .replace(/\.atSecond\.range/g, " · Mốc video nằm ngoài giai đoạn cấm chọn")
    .replace(/sides\[0\]/g, "Đội xanh")
    .replace(/sides\[1\]/g, "Đội đỏ")
    .replace(/participants\[(\d+)\]/g, (_, index) => ` · ${LANES[Number(index)]?.name ?? "Tuyển thủ"}`)
    .replace(/bans\[(\d+)\]/g, (_, index) => ` · Cấm ${Number(index) + 1}`)
    .replace(/\.playerId/g, " · Tuyển thủ")
    .replace(/\.hero/g, " · Tướng")
    .replace(/\.spell/g, " · Phụ trợ")
    .replace(/\.teamId/g, " · Đội")
    .replace(/seriesId/g, "Trận đấu")
    .replace(/sourceUrl/g, "Nguồn kiểm chứng")
    .replace(/\.arcana/g, " · Bảng ngọc")
    .replace(/\.enchantments/g, " · Phù hiệu")
    .replace(/\.entries/g, " · Chi tiết")
    .replace(/\.name/g, " · Tên")
    .replace(/\.count/g, " · Số lượng")
    .replace(/\.unavailableInPatch/g, " · Không có dữ liệu Wiki công khai ở patch này; chọn lại hoặc ghi tên thủ công")
    .replace(/\.duplicate/g, " · Bị trùng")
    .replace(/\.total\.thirty/g, " · Tổng phải bằng 30 viên")
    .replace(/\.colors\.RED\.ten/g, " · Ngọc đỏ phải đủ 10 viên")
    .replace(/\.colors\.PURPLE\.ten/g, " · Ngọc tím phải đủ 10 viên")
    .replace(/\.colors\.GREEN\.ten/g, " · Ngọc xanh phải đủ 10 viên")
    .replace(/\.primaryThree\.secondaryTwo/g, " · Cần 3 phù hiệu chính và 2 phù hiệu phụ")
    .replace(/\.primary\.sameBranch/g, " · Nhánh chính phải cùng một hệ")
    .replace(/\.secondary\.differentBranch/g, " · Nhánh phụ phải khác hệ chính")
    .replace(/\.secondary\.tiersOneTwo/g, " · Cùng hệ phụ phải chọn cấp I và II")
    .replace(/\.secondary\.mixedTierOne/g, " · Hai hệ phụ khác nhau chỉ dùng cấp I")
}
