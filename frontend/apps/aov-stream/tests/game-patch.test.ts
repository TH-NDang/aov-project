import assert from "node:assert/strict"
import { test } from "node:test"
import type { PublishedGame, ResolvedContext, StagePatch } from "@aov/community-contracts"
import { datedPatch, gamePatch, plannedPatch } from "../src/lib/game-patch.ts"
import { competition, on, stage, type TestMatch } from "./fixtures/competition.ts"

const context = (extra: Partial<ResolvedContext> = {}): ResolvedContext => ({
  region: "VN",
  locale: "vi-VN",
  seasonName: "S3 2026",
  patchCode: "s3-2026-observed",
  patchTitle: "Mốc dữ liệu trước S4 2026",
  unknown: false,
  includeUnscoped: true,
  ...extra,
})

const line = (label: string, releasedOn: string, seasonName = "S3 2026", name: string | null = null): StagePatch => ({
  label,
  releasedOn,
  seasonName,
  name,
})

test("a patch the game dates is named by its day and title", () => {
  const dated = context({ seasonName: "S4 2026", patchCode: "2026-09-29", patchTitle: "Vết Nứt Thời Không" })

  assert.equal(datedPatch(dated), true)
  assert.deepEqual(gamePatch(dated, line("Tuần 1", "2026-08-13")), {
    season: "S4 2026",
    day: "2026-09-29",
    title: "Vết Nứt Thời Không",
  })
})

test("a code the wiki made up is never shown, nor the title that goes with it", () => {
  assert.equal(datedPatch(context()), false)
  assert.deepEqual(gamePatch(context()), { season: "S3 2026", day: null, title: null })
})

test("the plan adds the day to a game that knows its season alone", () => {
  assert.deepEqual(gamePatch(context(), line("Tuần 1", "2026-08-13")), {
    season: "S3 2026",
    day: "2026-08-13",
    title: null,
  })
})

test("a line of another season than the game's says nothing of it", () => {
  assert.deepEqual(gamePatch(context(), line("Tuần 5–7", "2026-09-29", "S4 2026")), {
    season: "S3 2026",
    day: null,
    title: null,
  })
})

test("the plan speaks for a game whose patch nobody entered, and silence for one it does not cover", () => {
  const unknown = context({ unknown: true, seasonName: null, patchCode: null, patchTitle: null })

  assert.deepEqual(gamePatch(unknown, line("Playoffs", "2026-10-15", "S4 2026", "Điều chỉnh giữa mùa")), {
    season: "S4 2026",
    day: "2026-10-15",
    title: "Điều chỉnh giữa mùa",
  })
  assert.equal(gamePatch(unknown, null), null)
  assert.equal(gamePatch(undefined, null), null)
})

/** Two weeks of a stage, the second of them after a pause of five days, and a stage of one patch. */
const matches: TestMatch[] = [
  { key: "m1", seriesId: "s1", a: "x", b: "y", score: [2, 0], scheduledAt: on(1) },
  { key: "m2", seriesId: "s2", a: "y", b: "z", score: [2, 1], scheduledAt: on(8) },
  { key: "m3", seriesId: "s3", a: "z", b: "x", stageCode: "FINAL", scheduledAt: on(20) },
]
const stages = [
  stage("RR", { patches: [line("Tuần 1", "2026-10-13"), line("Tuần 2", "2026-10-27")] }),
  stage("FINAL", { patches: [{ label: "Playoffs", name: "Bản cuối" }] }),
]
const view = competition(matches, { stages })
const game = (seriesId: string, series: object = {}) =>
  ({ content: { seriesId }, series }) as unknown as Pick<PublishedGame, "content" | "series">

test("the week a match was played in decides its line of the plan", () => {
  assert.equal(plannedPatch(view, game("s1"))?.releasedOn, "2026-10-13")
  assert.equal(plannedPatch(view, game("s2"))?.releasedOn, "2026-10-27")
})

test("a stage played on one patch needs no weeks", () => {
  assert.equal(plannedPatch(view, game("s3"))?.name, "Bản cuối")
})

test("a match the plan does not hold is placed by its own stage and day", () => {
  assert.equal(plannedPatch(view, game("other", { stage: "RR", scheduledAt: on(8) }))?.releasedOn, "2026-10-27")
  assert.equal(plannedPatch(view, game("other", { stage: "GONE", scheduledAt: on(8) })), null)
  assert.equal(plannedPatch(view, game("other")), null)
})

test("a plan without patches names none", () => {
  assert.equal(plannedPatch(competition(matches, { stages: [stage("RR"), stage("FINAL")] }), game("s1")), null)
})
