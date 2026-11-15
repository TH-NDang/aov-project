import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { missingPictures } from "../server/capture-sets"
import { captureSetFromFolder, collectFolder } from "../server/source-sync"
import type { Build, BuildHero, CaptureDetail } from "../src/features/builds/builds-api"
import {
  confirmBodyOf,
  draftOf,
  heroRows,
  missingParts,
  nextHeroToReview,
  panelImageStyle,
  reviewBodyOf,
  sameAs,
} from "../src/features/builds/builds-model"

const build = (id: string, position: number, extra: Partial<Build> = {}): Build => ({
  id,
  position,
  imageId: null,
  items: [1, 2, 3, 4, 5, 6].map((slot) => ({ slot, itemId: `item-${slot}`, code: `item-${slot}` })),
  enchantmentSetId: "set",
  enchantments: [1, 2, 3, 4, 5].map((slot) => ({ slot, enchantmentId: `ench-${slot}`, code: `ench-${slot}` })),
  arcanaPageId: null,
  arcana: [],
  spellId: "flicker",
  spellCode: "flicker",
  contentKey: `key-${id}`,
  playerName: null,
  playerPower: null,
  playerWinRate: null,
  needsReview: false,
  note: null,
  reviewedAt: null,
  version: 3,
  ...extra,
})

const hero = (heroId: string, name: string, builds: Build[]): BuildHero => ({
  heroId,
  heroCode: heroId,
  nameOnScreen: name,
  captureOrder: 1,
  result: "COLLECTED",
  builds,
})

const capture = (heroes: BuildHero[]): CaptureDetail => ({
  id: "capture",
  code: "vn-pro-20261111",
  regionCode: "VN",
  sourceKind: "PRO",
  sourceLabel: "Đề cử Pro",
  capturedAt: "2026-11-11T05:02:43Z",
  sourceTimeZone: "Asia/Ho_Chi_Minh",
  patchVariantId: null,
  patchCode: null,
  confirmedAt: null,
  heroCount: heroes.length,
  buildCount: 0,
  needsReviewCount: 0,
  version: 1,
  sourceRun: "run",
  sourceNote: null,
  createdAt: "2026-11-11T06:00:00Z",
  images: [],
  heroes,
})

test("heroes narrow by accent-free name and to those with builds in review", () => {
  const detail = capture([
    hero("dieu-thuyen", "Điêu Thuyền", [build("a", 1)]),
    hero("toro", "Toro", [build("b", 1, { needsReview: true })]),
  ])
  assert.deepEqual(
    heroRows(detail, { query: "dieu", reviewOnly: false }).map((entry) => entry.heroId),
    ["dieu-thuyen"],
  )
  assert.deepEqual(
    heroRows(detail, { query: "", reviewOnly: true }).map((entry) => entry.heroId),
    ["toro"],
  )
  assert.equal(nextHeroToReview(detail, "dieu-thuyen")?.heroId, "toro")
  assert.equal(nextHeroToReview(detail, "toro"), null)
})

test("a build equal to an earlier one of the same hero points at it", () => {
  const builds = [build("a", 1, { contentKey: "same" }), build("b", 2), build("c", 3, { contentKey: "same" })]
  assert.deepEqual([...sameAs(builds)], [["c", 1]])
})

test("an unknown item slot keeps the build in review while arcana stay optional", () => {
  const partial = build("a", 1, { needsReview: true, items: build("x", 1).items.filter((item) => item.slot !== 4) })
  const draft = draftOf(partial)
  assert.equal(draft.items[3], null)
  assert.deepEqual(missingParts(draft), ["1 ô trang bị"])
  assert.deepEqual(missingParts(draftOf(build("b", 1))), [])

  const body = reviewBodyOf(partial, { ...draft, note: "  Ô 4 chưa có trong Kho  " })
  assert.equal(body.expectedVersion, 3)
  assert.deepEqual(
    body.items.map((item) => item.slot),
    [1, 2, 3, 5, 6],
  )
  assert.equal(body.note, "Ô 4 chưa có trong Kho")
  assert.deepEqual(body.arcana, [])
  assert.equal(confirmBodyOf(build("c", 1, { needsReview: true })).needsReview, false)
})

test("the panel crop shows only the build part of a 2400 x 1080 screenshot", () => {
  const style = panelImageStyle()
  assert.equal(style.width, `${(2400 / 855) * 100}%`)
  assert.equal(style.left, `${(-1410 / 855) * 100}%`)
  assert.equal(style.top, `${(-170 / 760) * 100}%`)
})

test("a published set offers its import body, and a screenshot that changed is never published", async () => {
  const resources = await mkdtemp(join(tmpdir(), "build-captures-"))
  try {
    const bytes = Buffer.from("png-bytes")
    const good = createHash("sha256").update(bytes).digest("hex")
    const bad = "f".repeat(64)
    const raw = join(resources, "raw", "builds", "2026-11-11")
    await mkdir(join(raw, "pro-001"), { recursive: true })
    await writeFile(join(raw, "pro-001", "pro-001-1.png"), bytes)
    await writeFile(join(raw, "pro-001", "pro-001-2.png"), Buffer.from("other"))
    const extracted = join(resources, "extracted", "builds", "2026-11-11")
    await mkdir(extracted, { recursive: true })
    await writeFile(
      join(extracted, "build-manifest.json"),
      JSON.stringify({
        capturedOn: "2026-11-11",
        capture: {
          code: "vn-pro-20261111",
          capturedAt: "2026-11-11T05:02:43Z",
          sourceTimeZone: "Asia/Ho_Chi_Minh",
          sourceLabel: "Đề cử Pro",
          regionCode: "VN",
          images: [{}, {}],
          heroes: [{ builds: [{ needsReview: true }, { needsReview: false }] }],
        },
        images: { [good]: { path: "pro-001/pro-001-1.png" }, [bad]: { path: "pro-001/pro-001-2.png" } },
      }),
    )

    const { set, pictures } = await captureSetFromFolder("BUILD_CAPTURE", extracted)
    assert.equal(set.kind, "BUILD_CAPTURE")
    if (set.kind !== "BUILD_CAPTURE") return
    assert.deepEqual(set.set, {
      capturedOn: "2026-11-11",
      code: "vn-pro-20261111",
      capturedAt: "2026-11-11T05:02:43Z",
      sourceTimeZone: "Asia/Ho_Chi_Minh",
      sourceLabel: "Đề cử Pro",
      regionCode: "VN",
      heroes: 1,
      builds: 2,
      needsReview: 1,
    })
    assert.equal(set.capture.code, "vn-pro-20261111")

    const pushed = (await collectFolder(raw, "raw/builds/2026-11-11")).items
    assert.deepEqual(missingPictures(pictures, pushed), [
      { sha256: bad, path: "raw/builds/2026-11-11/pro-001/pro-001-2.png" },
    ])
  } finally {
    await rm(resources, { recursive: true, force: true })
  }
})
