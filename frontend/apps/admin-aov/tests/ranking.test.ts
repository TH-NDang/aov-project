import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createRankingCaptureHandler } from "../server/ranking-captures"
import type { RankingDetail, RankingHero, RankingMetric, RankingValue } from "../src/features/ranking/ranking-api"
import {
  DEFAULT_VIEW,
  change,
  droppedHeroes,
  formatChange,
  formatValue,
  nextToReview,
  parseNumber,
  rankingRows,
  roleCounts,
  tierChange,
  viewRows,
} from "../src/features/ranking/ranking-model"

const value = (metric: RankingMetric, number: number | null, extra: Partial<RankingValue> = {}): RankingValue => ({
  metric,
  number,
  tier: null,
  heroId: null,
  heroCode: null,
  readText: null,
  needsReview: false,
  note: null,
  source: null,
  reviewedAt: null,
  version: 1,
  ...extra,
})

const hero = (
  heroId: string,
  name: string,
  role: RankingHero["roleOnScreen"],
  ratesPosition: number,
  tier: string,
  winRate: number | null,
  extra: RankingValue[] = [],
): RankingHero => ({
  heroId,
  heroCode: heroId,
  nameOnScreen: name,
  roleOnScreen: role,
  ratesPosition,
  figuresPosition: null,
  values: [value("TIER", null, { tier }), value("WIN_RATE", winRate), ...extra],
})

const snapshot = (id: string, heroes: RankingHero[]): RankingDetail => ({
  id,
  code: id,
  regionCode: "VN",
  modeCode: "RANKED_ELITE",
  modeLabel: "Đấu hạng (Tinh Anh trở lên)",
  periodLabel: null,
  capturedAt: "2026-11-11T00:07:49Z",
  sourceTimeZone: "Asia/Ho_Chi_Minh",
  confirmedAt: null,
  heroCount: heroes.length,
  valueCount: 0,
  needsReviewCount: 0,
  version: 1,
  sourceRun: "run",
  sourceNote: null,
  createdAt: "2026-11-11T02:00:00Z",
  images: [],
  heroes,
})

test("values read like the game prints them, and typed values read back", () => {
  assert.equal(formatValue(value("WIN_RATE", 49.42)), "49,42%")
  assert.equal(formatValue(value("DAMAGE_DEALT", 130189.1)), "130.189,10")
  assert.equal(formatValue(value("TIER", null, { tier: "T0" })), "T0")
  assert.equal(formatValue(value("KILLS", null)), "—")
  assert.equal(parseNumber("130.189,10"), 130189.1)
  assert.equal(parseNumber("49,42%"), 49.42)
  assert.equal(parseNumber("49.42"), 49.42)
  assert.equal(parseNumber("1.000"), null, "a dot alone is ambiguous, so it is refused")
  assert.equal(parseNumber("4,567"), null)
  assert.equal(parseNumber(""), null)
  assert.equal(formatChange("WIN_RATE", 0.52), "+0,52 điểm")
  assert.equal(formatChange("GOLD", -12.5), "−12,50")
})

test("the table filters by role, search and review, and sorts with gaps last", () => {
  const detail = snapshot("now", [
    hero("toro", "Toro", "TANK", 1, "T0", 49.42),
    hero("zanis", "Triệu Vân", "WARRIOR", 2, "T0", 55.39),
    hero("krixi", "Krixi", "MAGE", 3, "T1", null, [value("KILLS", null, { needsReview: true })]),
    hero("omega", "Omega", "TANK", 4, "T4", 55.09),
  ])
  const rows = rankingRows(detail)
  const names = (view: Partial<typeof DEFAULT_VIEW>) =>
    viewRows(rows, { ...DEFAULT_VIEW, ...view }).map((row) => row.hero.heroId)

  assert.deepEqual(names({}), ["toro", "zanis", "krixi", "omega"])
  assert.deepEqual(names({ role: "TANK" }), ["toro", "omega"])
  assert.deepEqual(names({ query: "trieu van" }), ["zanis"], "search ignores Vietnamese marks")
  assert.deepEqual(names({ reviewOnly: true }), ["krixi"])
  assert.deepEqual(names({ sort: "WIN_RATE", descending: true }), ["zanis", "omega", "toro", "krixi"])
  assert.deepEqual(names({ sort: "WIN_RATE", descending: false }), ["toro", "omega", "zanis", "krixi"])
  assert.deepEqual(names({ sort: "TIER", descending: true }), ["omega", "krixi", "zanis", "toro"])
  assert.equal(roleCounts(rows).TANK, 2)
  assert.equal(roleCounts(rows).ALL, 4)
})

test("comparing shows how each hero moved and who appeared or left", () => {
  const before = snapshot("before", [
    hero("toro", "Toro", "TANK", 1, "T1", 48.9),
    hero("gone", "Gone", "MAGE", 2, "T2", 50),
  ])
  const now = snapshot("now", [hero("toro", "Toro", "TANK", 1, "T0", 49.42), hero("new", "New", "MAGE", 2, "T3", 51)])
  const rows = rankingRows(now, before)

  assert.equal(change(rows[0]!, "WIN_RATE"), 0.52)
  assert.equal(tierChange(rows[0]!), 1, "T1 to T0 is one tier up")
  assert.equal(rows[1]!.previous, undefined)
  assert.equal(change(rows[1]!, "WIN_RATE"), null)
  assert.deepEqual(
    droppedHeroes(now, before).map((entry) => entry.heroId),
    ["gone"],
  )
  const byChange = viewRows(rows, { ...DEFAULT_VIEW, sort: "WIN_RATE", descending: true, byChange: true })
  assert.deepEqual(
    byChange.map((row) => row.hero.heroId),
    ["toro", "new"],
    "a hero without a change sorts last",
  )
})

test("review walks through waiting values in the game's order and wraps", () => {
  const detail = snapshot("now", [
    hero("a", "A", "TANK", 1, "T0", 50, [value("KILLS", null, { needsReview: true })]),
    hero("b", "B", "MAGE", 2, "T0", 50, [value("COUNTER_1", null, { needsReview: true })]),
  ])
  assert.deepEqual(nextToReview(detail, null), { heroId: "a", metric: "KILLS" })
  assert.deepEqual(nextToReview(detail, { heroId: "a", metric: "KILLS" }), { heroId: "b", metric: "COUNTER_1" })
  assert.deepEqual(nextToReview(detail, { heroId: "b", metric: "COUNTER_1" }), { heroId: "a", metric: "KILLS" })
  assert.deepEqual(nextToReview(detail, { heroId: "a", metric: "WIN_RATE" }), { heroId: "a", metric: "KILLS" })
  const single = snapshot("one", [hero("a", "A", "TANK", 1, "T0", 50, [value("KILLS", null, { needsReview: true })])])
  assert.equal(nextToReview(single, { heroId: "a", metric: "KILLS" }), null, "nothing else waits")
})

const call = async (handler: ReturnType<typeof createRankingCaptureHandler>, url: string, method = "GET") => {
  const chunks: Buffer[] = []
  let status = 0
  let type = ""
  let passed = false
  const res = {
    writeHead(code: number, headers: Record<string, string>) {
      status = code
      type = headers["Content-Type"] ?? ""
    },
    end(chunk?: Uint8Array | string) {
      if (chunk) chunks.push(Buffer.from(chunk))
    },
  }
  await handler({ url, method } as never, res as never, () => {
    passed = true
  })
  return { status, type, body: Buffer.concat(chunks), passed }
}

test("the dev endpoint offers capture sets and serves only verified screenshots", async () => {
  const resources = await mkdtemp(join(tmpdir(), "ranking-captures-"))
  const previous = process.env.AOV_RESOURCES_DIR
  process.env.AOV_RESOURCES_DIR = resources
  try {
    const bytes = Buffer.from("png-bytes")
    const good = createHash("sha256").update(bytes).digest("hex")
    const bad = "f".repeat(64)
    await mkdir(join(resources, "raw", "ranking", "2026-11-11", "ty-le"), { recursive: true })
    await writeFile(join(resources, "raw", "ranking", "2026-11-11", "ty-le", "page-1.png"), bytes)
    await writeFile(join(resources, "raw", "ranking", "2026-11-11", "ty-le", "page-2.png"), "other")
    await mkdir(join(resources, "extracted", "ranking", "2026-11-11"), { recursive: true })
    const manifest = {
      capturedOn: "2026-11-11",
      snapshot: {
        code: "vn-ranked-elite-20261111-0705",
        capturedAt: "2026-11-11T00:07:49Z",
        sourceTimeZone: "Asia/Ho_Chi_Minh",
        modeLabel: "Đấu hạng (Tinh Anh trở lên)",
        regionCode: "VN",
        images: [{}, {}],
        heroes: [{ values: [{ needsReview: true }, { needsReview: false }] }],
      },
      images: {
        [good]: { path: "ty-le/page-1.png", fileName: "page-1.png", width: 2400, height: 1080 },
        [bad]: { path: "ty-le/page-2.png", fileName: "page-2.png", width: 2400, height: 1080 },
      },
    }
    await writeFile(
      join(resources, "extracted", "ranking", "2026-11-11", "ranking-manifest.json"),
      JSON.stringify(manifest),
    )
    const handler = createRankingCaptureHandler({ start: resources })

    const sets = await call(handler, "/sets.json")
    assert.equal(sets.status, 200)
    assert.deepEqual(JSON.parse(sets.body.toString()).sets, [
      {
        capturedOn: "2026-11-11",
        code: "vn-ranked-elite-20261111-0705",
        capturedAt: "2026-11-11T00:07:49Z",
        sourceTimeZone: "Asia/Ho_Chi_Minh",
        modeLabel: "Đấu hạng (Tinh Anh trở lên)",
        regionCode: "VN",
        heroes: 1,
        values: 2,
        needsReview: 1,
        images: 2,
      },
    ])
    const set = await call(handler, "/sets/2026-11-11.json")
    assert.equal(JSON.parse(set.body.toString()).code, "vn-ranked-elite-20261111-0705")
    assert.equal((await call(handler, "/sets/2026-11-12.json")).status, 404)

    const image = await call(handler, `/images/${good}.png`)
    assert.equal(image.status, 200)
    assert.equal(image.type, "image/png")
    assert.deepEqual(image.body, bytes)
    assert.equal((await call(handler, `/images/${bad}.png`)).status, 502, "bytes that changed are refused")
    assert.equal((await call(handler, `/images/${"0".repeat(64)}.png`)).status, 404)
    assert.equal((await call(handler, "/images/..%2Fsecret.png")).status, 400)
    assert.equal((await call(handler, "/sets.json", "POST")).status, 405)
    assert.equal((await call(handler, "/other")).passed, true)
  } finally {
    if (previous === undefined) delete process.env.AOV_RESOURCES_DIR
    else process.env.AOV_RESOURCES_DIR = previous
    await rm(resources, { recursive: true, force: true })
  }
})
