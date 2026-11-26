import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameSide, Lane, Side } from "@aov/community-contracts"
import { gameFieldWords } from "../src/features/tournaments/model/game-field-words"
import { emptyParticipant } from "../src/features/tournaments/model/tournament-model"

const side = (code: Side, lanes: Lane[]): GameSide => ({
  side: code,
  teamId: code,
  bans: [],
  participants: lanes.map(emptyParticipant),
})
/** A game that names its red team first and the players of that team out of lane order. */
const game = {
  sides: [
    side("RED", ["SUPPORT", "TOP", "MID", "DRAGON", "JUNGLE"]),
    side("BLUE", ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]),
  ],
}
const words = (field: string) => gameFieldWords(field, game)

test("a team is named by its side, whichever of the two a game names first", () => {
  assert.equal(words("sides[0].teamId"), "Đội đỏ: chưa có đội")
  assert.equal(words("sides[1].teamId"), "Đội xanh: chưa có đội")
})

test("a player is named by the lane of the seat, not by its place in the list", () => {
  assert.equal(words("sides[0].participants[0].hero"), "Đội đỏ, trợ thủ: chưa có tướng")
  assert.equal(words("sides[0].participants[1].hero"), "Đội đỏ, đường Caesar: chưa có tướng")
})

test("a side or a lane nobody named is counted instead", () => {
  const { sides } = game
  const open = {
    sides: [
      { ...sides[0]!, side: null as never },
      { ...sides[1]!, participants: [] },
    ],
  }
  assert.equal(gameFieldWords("sides[0].side", open), "Đội thứ 1: chưa có bên")
  assert.equal(gameFieldWords("sides[1].participants[2].lane", open), "Đội xanh, người thứ 3: chưa có đường")
})

test("what is wrong stands after the place it is wrong at", () => {
  assert.equal(
    words("sides[1].participants[4].spell.unavailableInPatch"),
    "Đội xanh, trợ thủ, phụ trợ: Wiki không có ở patch của ván; chọn lại hoặc ghi tên thủ công",
  )
  assert.equal(words("sides[1].bans[2].duplicate"), "Đội xanh, lượt cấm 3: bị trùng")
  assert.equal(
    words("draft.turns[4].hero.notBanned"),
    "Lượt cấm chọn 5, tướng: không có trong các tướng bị cấm của đội",
  )
})

test("the items of a build and what they grew from are counted from one", () => {
  const build = "sides[0].participants[2].build"
  assert.equal(words(`${build}.maximum`), "Đội đỏ, đường giữa: nhiều nhất 24 món đã lên")
  assert.equal(words(`${build}[1].item.duplicate`), "Đội đỏ, đường giữa, trang bị đã lên, món 2: bị trùng")
  assert.equal(
    words(`${build}[1].from[0].notLower`),
    "Đội đỏ, đường giữa, trang bị đã lên, món 2, món ghép 1: phải cấp thấp hơn, trừ khi công thức có món đó",
  )
  assert.equal(words(`${build}[1].from.maximum`), "Đội đỏ, đường giữa, trang bị đã lên, món 2: lên từ nhiều nhất 3 món")
})

test("a field of the game as a whole is a sentence of its own", () => {
  assert.equal(words("number.exceedsBestOf"), "Số ván vượt quá thể thức BO của trận")
  assert.equal(words("content.seriesId"), "Chưa chọn trận đấu")
})

const seat = "sides[1].participants[3]"
const loadout = (part: string) => [
  `${seat}.${part}.unknownHasEntries`,
  `${seat}.${part}.entries[1].selection`,
  `${seat}.${part}.entries[1].selection.name.length`,
  `${seat}.${part}.entries[1].selection.unavailableInPatch`,
  `${seat}.${part}.entries[1].duplicate`,
  `${seat}.${part}.observedAtSeconds.range`,
]
/**
 * Every field the service can report, one index for each list: GameRules.violations, the checks GameRecords.publish
 * adds and SeriesPickRule of community-service.
 */
const SERVICE_FIELDS = [
  "content",
  ...["sourceUrl.invalid", "number.range", "durationSeconds.range", "locale.unsupported", "sides.maximum"],
  ...["seriesId", "number", "region", "locale", "sides.two"],
  ...["sides[1].side.duplicate", "sides[1].teamId.duplicate", "sides[1].bans.maximum", "sides[1].participants.maximum"],
  ...["sides[1].side", "sides[1].teamId", "sides[1].participants.five"],
  ...["sides[1].bans[2].name.length", "sides[1].bans[2].unavailableInPatch", "sides[1].bans[2].duplicate"],
  "sides[1].bans[2].notDrafted",
  ...[`${seat}.playerId.duplicate`, `${seat}.lane.duplicate`, `${seat}.lane`, `${seat}.hero`],
  ...[`${seat}.hero.name.length`, `${seat}.hero.unavailableInPatch`, `${seat}.hero.duplicate`],
  ...[`${seat}.hero.notDrafted`, `${seat}.hero.usedInSeries`],
  ...[`${seat}.spell.name.length`, `${seat}.spell.unavailableInPatch`, `${seat}.spellObservedAtSeconds.range`],
  ...loadout("arcana"),
  ...[`${seat}.arcana.entries[1].count.range`, `${seat}.arcana.entries[1].color.mismatch`],
  ...[`${seat}.arcana.entries[1].color`, `${seat}.arcana.total.thirty`],
  ...["RED", "PURPLE", "GREEN"].map((color) => `${seat}.arcana.colors.${color}.ten`),
  ...loadout("enchantments"),
  ...[`${seat}.enchantments.maximum`, `${seat}.enchantments.entries[1].tier.mismatch`],
  ...[`${seat}.enchantments.entries[1].branch.mismatch`, `${seat}.enchantments.entries[1].tier.range`],
  ...[`${seat}.enchantments.entries[1].branchCode`, `${seat}.enchantments.entries[1].primaryTier.duplicate`],
  ...[`${seat}.enchantments.primaryThree.secondaryTwo`, `${seat}.enchantments.primary.sameBranch`],
  ...[`${seat}.enchantments.secondary.differentBranch`, `${seat}.enchantments.secondary.tiersOneTwo`],
  `${seat}.enchantments.secondary.mixedTierOne`,
  `${seat}.equipment.maximum`,
  ...["atSeconds.range", "time.order", "slots.six", "slot.uniqueOneToSix", "slot.unknownHasItem"].map(
    (rule) => `${seat}.equipmentSnapshots[3].${rule}`,
  ),
  ...[`${seat}.equipmentSnapshots[3].item.name.length`, `${seat}.equipmentSnapshots[3].item.unavailableInPatch`],
  ...["atSeconds.range", "time.order", "type", "swap.slots", "item", "item.name.length", "item.unavailableInPatch"].map(
    (rule) => `${seat}.equipmentEvents[4].${rule}`,
  ),
  ...["slot", "replacedItem.name.length", "replacedItem.unavailableInPatch"].map(
    (rule) => `${seat}.equipmentEvents[4].${rule}`,
  ),
  `${seat}.build.maximum`,
  ...["item", "item.name.length", "item.unavailableInPatch", "item.tier", "item.duplicate", "from.maximum"].map(
    (rule) => `${seat}.build[5].${rule}`,
  ),
  ...["", ".name.length", ".unavailableInPatch", ".tier", ".duplicate", ".same", ".notLower"].map(
    (rule) => `${seat}.build[5].from[1]${rule}`,
  ),
  ...[`${seat}.build[5].atSeconds.range`, `${seat}.build[5].kept.maximum`],
  "sides.hero.alreadyBanned",
  "timeline.maximum",
  ...["atSeconds.range", "time.order", "durationSeconds.range"].map((rule) => `timeline.pauses[1].${rule}`),
  ...["id", "id.duplicate", "atSeconds.range", "time.order", "note.length", "kind", "fields.unexpected"].map(
    (rule) => `timeline.events[6].${rule}`,
  ),
  ...["kill.participant", "killer", "victim", "victim.sameSide", "assists.maximum", "assists[1]"].map(
    (rule) => `timeline.events[6].${rule}`,
  ),
  ...["assists[1].duplicate", "assists[1].side", "side", "objective", "by", "by.side", "title"].map(
    (rule) => `timeline.events[6].${rule}`,
  ),
  ...["draft.maximum", "draft.startSecond.range", "draft.lockedSecond.range"],
  ...["draft.startSecond.afterGameStart", "draft.lockedSecond.afterGameStart"],
  ...["order", "kind", "side", "hero", "hero.name.length", "hero.duplicate", "maximum"].map(
    (rule) => `draft.turns[7].${rule}`,
  ),
  ...["atSecond.range", "atSecond.order", "hero.notBanned", "hero.usedInSeries"].map(
    (rule) => `draft.turns[7].${rule}`,
  ),
  ...["seriesId.notFound", "number.exceedsBestOf", "sides.teamId.notFound", "sides.participants.playerId.notFound"],
  ...["mvpPlayerId.notFound", "sides.teams.matchSeries"],
]

test("every field the service can report is told in words, with nothing of its code left", () => {
  const raw = SERVICE_FIELDS.flatMap((field) => {
    const text = words(field)
    const steps = field.split(/[.[\]\d]+/).filter((step) => step.length > 1)
    const left = steps.filter((step) => new RegExp(`(^|[^\\p{L}])${step}([^\\p{L}]|$)`, "iu").test(text))
    return left.length || /[.[\]]|[a-z][A-Z]/.test(text) ? [`${field}: ${text}`] : []
  })
  assert.deepEqual([SERVICE_FIELDS.length, raw], [145, []])
})

test("a game the service finds without content says so", () => {
  assert.equal(words("content"), "Ván chưa có nội dung")
})

test("one who assists on the other team than the one who scored is told apart from a missing side", () => {
  assert.equal(
    words("timeline.events[6].assists[1].side"),
    "Diễn biến 7, người hỗ trợ 2: không cùng đội với người hạ gục",
  )
})

test("a person of a moment named alone lacks a side or a lane, and is not missing", () => {
  assert.equal(words("timeline.events[6].killer"), "Diễn biến 7, người hạ gục: chưa đủ bên và đường")
  assert.equal(words("timeline.events[6].victim"), "Diễn biến 7, người bị hạ: chưa đủ bên và đường")
  assert.equal(words("timeline.events[6].assists[1]"), "Diễn biến 7, người hỗ trợ 2: chưa đủ bên và đường")
})

test("one who took an objective for the other team is told so, not as one who assists", () => {
  assert.equal(words("timeline.events[6].by.side"), "Diễn biến 7: người phá không thuộc đội ghi điểm")
})

test("a purchase or a built item without its item lacks the item, not the purchase", () => {
  assert.equal(
    words("sides[1].participants[3].equipmentEvents[4].item"),
    "Đội xanh, đường Rồng, lần mua bán 5: chưa có trang bị",
  )
  assert.equal(
    words("sides[1].participants[3].build[5].item"),
    "Đội xanh, đường Rồng, trang bị đã lên, món 6: chưa có trang bị",
  )
})

test("an entry of arcana or emblems without its pick lacks the pick, not the entry", () => {
  assert.equal(
    words("sides[1].participants[3].arcana.entries[1].selection"),
    "Đội xanh, đường Rồng, bảng ngọc, mục 2: chưa có ngọc",
  )
  assert.equal(
    words("sides[1].participants[3].enchantments.entries[1].selection"),
    "Đội xanh, đường Rồng, phù hiệu, mục 2: chưa có phù hiệu",
  )
})

test("a repeated code of a moment and a lane two players share are said in words", () => {
  assert.equal(words("timeline.events[6].id.duplicate"), "Diễn biến 7: mã bị trùng")
  assert.equal(words("sides[1].participants[3].lane.duplicate"), "Đội xanh, đường Rồng: hai người cùng một đường")
})
