import assert from "node:assert/strict"
import test from "node:test"
import {
  usagePlaces,
  usageStateOf,
  usageSummaryExtra,
  usageSummaryLabel,
  type MediaUsageItem,
  type MediaUsageSummary,
} from "../src/features/media/media-usage"

const usage = (overrides: Partial<MediaUsageItem>): MediaUsageItem => ({
  ownerDomain: "HERO",
  ownerType: "HERO",
  ownerId: "hero",
  revisionId: "revision",
  propertyRole: "SKIN_ART:celestial",
  scope: "CURRENT",
  shown: true,
  ownerName: "Airi",
  partName: "Celestial Airi",
  ...overrides,
})

const summary = (overrides: Partial<MediaUsageSummary>): MediaUsageSummary => ({
  state: "NONE",
  current: 0,
  draft: 0,
  historical: 0,
  stored: 0,
  competition: 0,
  ...overrides,
})

test("a place repeated across revisions is one place with its strongest use", () => {
  const [place, ...others] = usagePlaces([
    usage({ scope: "HISTORICAL", revisionId: "old" }),
    usage({ scope: "HISTORICAL", revisionId: "older" }),
    usage({ scope: "DRAFT", revisionId: "draft" }),
    usage({ scope: "CURRENT", revisionId: "now" }),
  ])
  assert.deepEqual(others, [])
  assert.equal(place!.state, "SHOWN")
  assert.equal(place!.title, "Airi · Celestial Airi")
  assert.equal(place!.detail, "Trang phục · Ảnh nền")
  assert.equal(place!.draft, 1)
  assert.equal(place!.historical, 2)
  assert.equal(place!.href, "/hero/hero?revision=now&tab=skins&skin=celestial")
  assert.equal(place!.note, null)
})

test("a skin head only counts as shown where the Wiki really draws it", () => {
  const [stored] = usagePlaces([usage({ propertyRole: "SKIN_HEAD:celestial", shown: false })])
  assert.equal(stored!.state, "STORED_ONLY")
  assert.match(stored!.note!, /chỉ còn lưu mã/)
  assert.equal(usageStateOf([stored!], 0), "STORED_ONLY")

  const [fallback] = usagePlaces([usage({ propertyRole: "SKIN_HEAD:celestial", shown: true })])
  assert.equal(fallback!.state, "SHOWN")
  assert.match(fallback!.note!, /chưa có chân dung/)
})

test("an unchosen image option and a pending import keep the id without showing the image", () => {
  const [option] = usagePlaces([usage({ propertyRole: "HEAD", shown: false })])
  assert.equal(option!.state, "STORED_ONLY")
  assert.match(option!.note!, /Ảnh bổ sung/)
  const [pending] = usagePlaces([
    usage({
      ownerType: "HERO_UPLOAD_SESSION",
      propertyRole: "Pending import",
      scope: "DRAFT",
      shown: false,
      revisionId: null,
      ownerName: null,
      partName: null,
    }),
  ])
  assert.equal(pending!.detail, "Đang chờ nhập")
  assert.equal(pending!.href, null)
})

test("places link to the screen that shows them, strongest first", () => {
  const places = usagePlaces([
    usage({ ownerType: "ITEM", ownerId: "sword", propertyRole: "ICON", scope: "DRAFT", ownerName: "Kiếm" }),
    usage({ propertyRole: "SKILL_ICON:skill-1", partName: "Chiêu 1" }),
    usage({ ownerType: "USER_PROFILE", ownerId: "me", propertyRole: "AVATAR", ownerName: null, revisionId: null }),
    usage({ propertyRole: "SPLASH", scope: "HISTORICAL" }),
  ])
  assert.deepEqual(
    places.map((place) => [place.state, place.href]),
    [
      ["SHOWN", "/hero/hero?revision=revision&tab=skills&skill=skill-1"],
      ["SHOWN", "/users/me"],
      ["DRAFT_ONLY", "/items?item=sword"],
      ["HISTORY_ONLY", "/hero/hero?revision=revision&tab=media"],
    ],
  )
})

test("competition records count as shown on an image's sheet and in a list row", () => {
  assert.equal(usageStateOf([], 2), "SHOWN")
  assert.equal(usageStateOf([], 0), "NONE")
  assert.equal(usageSummaryLabel(summary({ state: "SHOWN", current: 1, competition: 2 })), "3 nơi")
})

test("a row says the strongest use and what else it leaves out", () => {
  assert.equal(usageSummaryLabel(summary({ state: "DRAFT_ONLY", draft: 2 })), "2 nơi trong bản nháp")
  assert.equal(usageSummaryLabel(summary({ state: "STORED_ONLY", stored: 3 })), "Chỉ còn lưu mã ở 3 nơi")
  assert.equal(usageSummaryLabel(summary({ state: "NONE" })), "Không còn nơi nào")
  assert.equal(
    usageSummaryExtra(summary({ state: "SHOWN", current: 1, draft: 2, historical: 1, stored: 1 })),
    "+ 2 bản nháp, 1 bản cũ, 1 chỉ lưu mã",
  )
  assert.equal(usageSummaryExtra(summary({ state: "NONE" })), null)
})
