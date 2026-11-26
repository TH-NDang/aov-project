import assert from "node:assert/strict"
import { test } from "node:test"
import { stageMeetings, type Meeting } from "../src/lib/meetings-model.ts"
import { meetingDay, meetingWords, pairName, pairWords, playedDay, roundName } from "../src/lib/meetings-words.ts"
import { namesOf } from "../src/lib/question-words.ts"
import { competition, on, stage, type TestMatch } from "./fixtures/competition.ts"

const ZONE = "Asia/Ho_Chi_Minh"
const vi = (vietnamese: string, _: string) => vietnamese
const en = (_: string, english: string) => english

const viewOf = (matches: TestMatch[]) =>
  competition(
    matches.map((match) => ({ bestOf: 5, a: "sgp", b: "bme", ...match })),
    { stages: [stage("RR", { format: "ROUND_ROBIN" })] },
  )
const listOf = (matches: TestMatch[]): Meeting[] => stageMeetings(viewOf(matches), "RR", null).get("sgp")!
const one = (match: Partial<TestMatch> = {}): Meeting => listOf([{ key: "m1", scheduledAt: on(15), ...match }])[0]!

test("a match is said from the side of one team", () => {
  assert.equal(meetingWords(one({ score: [3, 1] }), "15/11", vi), "thắng 3–1")
  assert.equal(meetingWords(one({ score: [2, 3] }), "15/11", vi), "thua 2–3")
  assert.equal(meetingWords(one({ score: [2, 3] }), "15/11", en), "lost 2–3")
})

test("a level match is a draw, and one still being played only has its score", () => {
  assert.equal(meetingWords(one({ score: [1, 1] }), "15/11", vi), "hòa 1–1")
  assert.equal(meetingWords(one({ score: [2, 0] }), "15/11", vi), "tỷ số 2–0")
})

test("a match without a score says what it waits for", () => {
  const before = Date.parse(on(10))
  const after = Date.parse(on(20))
  assert.equal(meetingWords(one(), "15/11", vi, before), "chưa đấu, ngày 15/11")
  assert.equal(meetingWords(one(), "15/11", vi, after), "chưa có kết quả, ngày 15/11")
  assert.equal(meetingWords(one({ scheduledAt: null }), null, vi), "chưa có lịch")
})

test("the day of a match is the one it falls on for the reader", () => {
  const late = one({ scheduledAt: "2026-11-15T20:00:00Z" })
  assert.equal(meetingDay(late, "UTC", "vi-VN"), "15/11")
  assert.equal(meetingDay(late, ZONE, "vi-VN"), "16/11")
  assert.equal(meetingDay(one({ scheduledAt: null }), ZONE, "vi-VN"), null)
})

test("the day a match was played is the one where the event is held", () => {
  assert.equal(playedDay(one({ scheduledAt: "2026-11-15T20:00:00Z" }), "vi-VN"), "16/11")
  assert.equal(playedDay(one({ scheduledAt: null }), "vi-VN"), null)
})

const wordsOf = (matches: TestMatch[], text = vi) =>
  pairWords("sgp", listOf(matches), {
    names: namesOf(viewOf(matches), text),
    text,
    timeZone: ZONE,
    languageTag: "vi-VN",
  })

test("two teams that met twice are said match by match and in all", () => {
  const twice: TestMatch[] = [
    { key: "m1", score: [3, 1], scheduledAt: on(1) },
    { key: "m2", a: "bme", b: "sgp", score: [2, 3], scheduledAt: on(9) },
  ]
  assert.equal(wordsOf(twice), "SGP gặp BME: thắng 3–1, thắng 3–2, cộng lại 6–3")
  assert.equal(wordsOf(twice, en), "SGP against BME: won 3–1, won 3–2, 6–3 in all")
})

test("one match needs no sum", () => {
  assert.equal(wordsOf([{ key: "m1", score: [3, 1] }]), "SGP gặp BME: thắng 3–1")
})

test("a team without a name is said to be unknown", () => {
  const names = namesOf(viewOf([{ key: "m1" }]), vi)
  assert.equal(pairName("sgp", "nobody", names, vi), "SGP gặp đội chưa rõ")
})

test("a column is called what the plan calls its round, or counted", () => {
  const name = (kind: Parameters<typeof roundName>[0]["kind"], text = vi) => roundName({ kind, number: 3 }, text)
  assert.deepEqual(
    [name("ROUND"), name("WEEK"), name("MATCHDAY"), name(null)],
    ["Vòng 3", "Tuần 3", "Ngày 3", "Lượt 3"],
  )
  assert.equal(name(null, en), "Match 3")
})
