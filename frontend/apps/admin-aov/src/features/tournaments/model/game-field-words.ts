import type { GameContent, GameSide, Side } from "@aov/community-contracts"
import { LANE_LABELS } from "@/lib/lanes"

/** The part of a game that says which team and which lane a field is about. */
type Sides = Pick<GameContent, "sides">

/** Fields of the game as a whole. */
const OF_GAME: Record<string, string> = {
  content: "Ván chưa có nội dung",
  seriesId: "Chưa chọn trận đấu",
  "seriesId.notFound": "Trận đấu không còn tồn tại",
  number: "Chưa ghi số ván",
  "number.range": "Số ván phải từ 1 đến 99",
  "number.exceedsBestOf": "Số ván vượt quá thể thức BO của trận",
  region: "Chưa chọn thị trường",
  locale: "Chưa chọn ngôn ngữ danh mục",
  "locale.unsupported": "Ngôn ngữ danh mục của ván chỉ nhận vi-VN hoặc en-US",
  "sourceUrl.invalid": "Nguồn kiểm chứng không phải một địa chỉ hợp lệ",
  "durationSeconds.range": "Thời lượng ván không hợp lệ",
  "mvpPlayerId.notFound": "MVP không còn trong danh sách tuyển thủ",
  "sides.two": "Ván cần đủ hai đội",
  "sides.maximum": "Ván chỉ có hai đội",
  "sides.hero.alreadyBanned": "Tướng được chọn trùng một tướng đã bị cấm",
  "sides.teams.matchSeries": "Hai đội trong ván phải là hai đội của trận đấu",
  "sides.teamId.notFound": "Một đội của ván không còn tồn tại",
  "sides.participants.playerId.notFound": "Một tuyển thủ của ván không còn tồn tại",
  "draft.maximum": "Cấm chọn có quá nhiều lượt",
  "draft.startSecond.range": "Mốc bắt đầu cấm chọn không hợp lệ",
  "draft.startSecond.afterGameStart": "Mốc bắt đầu cấm chọn phải trước lúc vào trận",
  "draft.lockedSecond.range": "Mốc chốt đội hình phải sau mốc bắt đầu cấm chọn",
  "draft.lockedSecond.afterGameStart": "Mốc chốt đội hình phải trước lúc vào trận",
  "timeline.maximum": "Dòng thời gian có quá nhiều mục",
}

/** What is wrong with the place before it; the steps of a rule are named without their index. */
const RULES: Record<string, string> = {
  duplicate: "bị trùng",
  "id.duplicate": "mã bị trùng",
  "lane.duplicate": "hai người cùng một đường",
  range: "thời điểm nằm ngoài ván",
  type: "chưa có loại",
  kind: "chưa có loại",
  slot: "chưa có ô",
  color: "chưa có màu",
  branchCode: "chưa có nhánh",
  objective: "chưa có mục tiêu",
  order: "số thứ tự không đúng",
  id: "mã không hợp lệ",
  title: "tiêu đề trống hoặc quá dài",
  "name.length": "tên quá dài",
  "note.length": "ghi chú quá dài",
  unavailableInPatch: "Wiki không có ở patch của ván; chọn lại hoặc ghi tên thủ công",
  "side.duplicate": "hai đội cùng một bên",
  "teamId.duplicate": "hai bên cùng một đội",
  "bans.maximum": "nhiều nhất 4 lượt cấm",
  "participants.five": "cần đủ năm người",
  "participants.maximum": "nhiều nhất năm người",
  usedInSeries: "đội đã dùng ở ván khác của trận",
  notDrafted: "không có trong các lượt cấm chọn",
  notBanned: "không có trong các tướng bị cấm của đội",
  maximum: "đội đã đủ lượt",
  "atSecond.range": "mốc video nằm ngoài giai đoạn cấm chọn",
  "atSecond.order": "mốc video phải sau lượt trước",
  "atSeconds.range": "thời điểm nằm ngoài ván",
  "time.order": "thời điểm phải sau mục trước",
  "durationSeconds.range": "thời lượng không hợp lệ",
  "fields.unexpected": "có phần không thuộc loại này",
  "kill.participant": "cần người hạ gục hoặc người bị hạ",
  "victim.sameSide": "người hạ gục và người bị hạ cùng đội",
  "assists.maximum": "nhiều nhất bốn người hỗ trợ",
  "by.side": "người phá không thuộc đội ghi điểm",
  unknownHasEntries: "chưa rõ thì không có mục nào",
  "count.range": "số viên phải từ 1 đến 10",
  "color.mismatch": "màu không khớp với Wiki",
  "total.thirty": "tổng phải bằng 30 viên",
  "colors.RED.ten": "ngọc đỏ phải đủ 10 viên",
  "colors.PURPLE.ten": "ngọc tím phải đủ 10 viên",
  "colors.GREEN.ten": "ngọc xanh phải đủ 10 viên",
  "enchantments.maximum": "nhiều nhất năm phù hiệu",
  "tier.mismatch": "cấp không khớp với Wiki",
  "tier.range": "cấp không hợp lệ",
  "branch.mismatch": "nhánh không khớp với Wiki",
  "primaryTier.duplicate": "nhánh chính có hai phù hiệu cùng cấp",
  "primaryThree.secondaryTwo": "cần 3 phù hiệu chính và 2 phù hiệu phụ",
  "primary.sameBranch": "nhánh chính phải cùng một hệ",
  "secondary.differentBranch": "nhánh phụ phải khác hệ chính",
  "secondary.tiersOneTwo": "cùng hệ phụ phải chọn cấp I và II",
  "secondary.mixedTierOne": "hai hệ phụ khác nhau chỉ dùng cấp I",
  "equipment.maximum": "quá nhiều mốc hoặc lần mua bán",
  "slots.six": "cần đủ sáu ô",
  "slot.uniqueOneToSix": "các ô phải khác nhau, từ 1 đến 6",
  "slot.unknownHasItem": "ô chưa rõ thì không có món",
  "swap.slots": "đổi chỗ cần hai ô khác nhau",
  "build.maximum": "nhiều nhất 24 món đã lên",
  "kept.maximum": "giữ đến cuối nhiều nhất 6 món",
  "from.maximum": "lên từ nhiều nhất 3 món",
  tier: "chỉ ghi trang bị cấp 2 và 3",
  same: "không thể lên từ chính nó",
  notLower: "phải cấp thấp hơn, trừ khi công thức có món đó",
}

/** What a step of a field names, where the steps before it do not say it already. */
const PLACES: Record<string, string> = {
  side: "bên",
  teamId: "đội",
  playerId: "tuyển thủ",
  lane: "đường",
  hero: "tướng",
  spell: "phụ trợ",
  spellObservedAtSeconds: "phụ trợ",
  arcana: "bảng ngọc",
  enchantments: "phù hiệu",
  equipment: "trang bị",
  replacedItem: "món bị thay",
  killer: "người hạ gục",
  victim: "người bị hạ",
  by: "người phá",
  bans: "lượt cấm",
  turns: "lượt cấm chọn",
  pauses: "đoạn tạm dừng",
  events: "diễn biến",
  assists: "người hỗ trợ",
  entries: "mục",
  build: "trang bị đã lên, món",
  from: "món ghép",
  equipmentSnapshots: "mốc trang bị",
  equipmentEvents: "lần mua bán",
}
/** Steps that only lead to others. */
const GROUPS = new Set(["draft", "timeline", "selection", "item", "observedAtSeconds", "atSeconds"])
/** People of a moment; the service names one alone when its side or its lane is missing. */
const SEATS = new Set(["killer", "victim", "by", "assists"])
/** What is wrong with a step of a person of a moment: one who assists is on another team than the one who scored. */
const OF_SEAT: Record<string, string> = { side: "không cùng đội với người hạ gục" }

/** What a step that only leads to others names when it is itself the part that is missing. */
function missingPart(name: string, steps: string[]) {
  if (name === "item") return "trang bị"
  if (name !== "selection") return null
  return steps.some((step) => step.startsWith("arcana")) ? "ngọc" : "phù hiệu"
}

const TEAMS: Record<Side, string> = { BLUE: "đội xanh", RED: "đội đỏ" }

const withoutCapital = (text: string) => text.charAt(0).toLocaleLowerCase("vi") + text.slice(1)
const withCapital = (text: string) => text.charAt(0).toLocaleUpperCase("vi") + text.slice(1)

/** The places a field leads through, from the team down; the steps that are none are left as they are. */
function placesOf(steps: string[], game: Sides): string[] {
  let side: GameSide | undefined
  return steps.flatMap((step) => {
    const [, name = step, index] = /^(\w+)(?:\[(\d+)\])?$/.exec(step) ?? []
    const at = index === undefined ? null : Number(index)
    if (name === "sides" && at != null) {
      side = game.sides[at]
      return side?.side ? TEAMS[side.side] : `đội thứ ${at + 1}`
    }
    if (name === "participants" && at != null) {
      const lane = side?.participants[at]?.lane
      return lane ? withoutCapital(LANE_LABELS[lane].name) : `người thứ ${at + 1}`
    }
    if (GROUPS.has(name)) return []
    const place = PLACES[name] ?? name
    return at == null ? place : `${place} ${at + 1}`
  })
}

/** What a field the service reports is about, in the words of the screens: the place in the game, then what is wrong. */
export function gameFieldWords(field: string, game: Sides): string {
  const path = field.replace(/^content\./, "")
  const whole = OF_GAME[path]
  if (whole) return whole

  const steps = path.split(".")
  const names = steps.map((step) => step.replace(/\[\d+\]$/, ""))
  const last = names.at(-1) ?? ""
  const sentence = (places: string[], wrong?: string | null) =>
    withCapital([places.join(", "), wrong].filter(Boolean).join(": "))
  const from = names.findIndex((_, position) => names.slice(position).join(".") in RULES)
  if (from >= 0) return sentence(placesOf(steps.slice(0, from), game), RULES[names.slice(from).join(".")])

  const ofSeat = SEATS.has(names.at(-2) ?? "") ? OF_SEAT[last] : undefined
  if (ofSeat) return sentence(placesOf(steps.slice(0, -1), game), ofSeat)
  // A field without a rule is one that is missing; a person of a moment named alone lacks a side or a lane.
  if (SEATS.has(last)) return sentence(placesOf(steps, game), "chưa đủ bên và đường")
  const part = missingPart(last, names)
  if (part) return sentence(placesOf(steps, game), `chưa có ${part}`)
  const places = placesOf(steps, game)
  const missing = places.length > 1 ? places.pop() : null
  return sentence(places, missing && `chưa có ${missing}`)
}
