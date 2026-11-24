import assert from "node:assert/strict"
import { test } from "node:test"
import { daysUntil, timeUntil } from "../src/lib/countdown.ts"
import { roundPart, stageName } from "../src/lib/match-labels.ts"
import { matchTimeText } from "../src/lib/match-time.ts"
import { scheduleDayMarks } from "../src/lib/schedule-days.ts"
import { competition, matchesOf, on } from "./fixtures/competition.ts"

const HOUR = 60 * 60 * 1000
const ZONE = "Asia/Ho_Chi_Minh"

test("the time left is said in the units that matter", () => {
  const left = (ms: number, locale?: string) => timeUntil(ms, 0, locale)

  assert.equal(left(12 * 60_000), "12 phút")
  assert.equal(left(2 * HOUR + 14 * 60_000), "2 giờ 14 phút")
  assert.equal(left(5 * HOUR), "5 giờ")
  assert.equal(left(75 * HOUR), "3 ngày")
  assert.equal(left(25 * HOUR, "en-US"), "1 day")
  assert.equal(left(-1), null)
})

test("days until a date are counted on the calendar where the event is played", () => {
  // 18:00 UTC is already the next day in Vietnam.
  const now = Date.parse("2026-11-24T18:00:00Z")

  assert.equal(daysUntil("2026-11-26", now, ZONE), 1)
  assert.equal(daysUntil("2026-11-26", now, "Europe/London"), 2)
  assert.equal(daysUntil(null, now, ZONE), null)
})

test("a match's start names the days next to today and the year only when it is another one", () => {
  const now = Date.parse(on(24))
  const at = (value: string) => matchTimeText(Date.parse(value), ZONE, now)

  assert.equal(at("2026-11-24T11:30:00Z"), "18:30 hôm nay")
  assert.equal(at("2026-11-25T06:00:00Z"), "13:00 ngày mai")
  assert.match(at("2026-11-28T06:00:00Z"), /^13:00 .*28\/11$/)
  assert.equal(at("2025-11-28T06:00:00Z"), "13:00 28/11/2025")
})

test("imported round names read in the reader's language", () => {
  const read = (name: string) => [roundPart(name, "vi-VN"), roundPart(name, "en-US")]

  assert.deepEqual(read("Week 3"), ["Tuần 3", "Week 3"])
  assert.deepEqual(read("Upper Bracket Finals (Bo7)"), ["Chung kết nhánh thắng", "Upper bracket final"])
  assert.deepEqual(read("Group A Matches"), ["Bảng A", "Group A"])
  assert.deepEqual(read("Chung kết tổng"), ["Chung kết tổng", "Grand final"])
  assert.deepEqual(read("June 18 ― 0-0 (Bo3)"), [null, null])
  assert.deepEqual(read("Đêm khai mạc"), ["Đêm khai mạc", "Đêm khai mạc"])
})

test("a stage's name loses the English word an import left on it", () => {
  assert.equal(stageName("Vòng Thụy Sĩ Stage"), "Vòng Thụy Sĩ")
  assert.equal(stageName("League Stage"), "League Stage")
})

test("a schedule's days count their matches and mark the one on now", () => {
  const now = Date.parse(on(24)) + HOUR
  const marks = scheduleDayMarks(
    matchesOf(
      competition([
        { key: "x", a: "a", b: "b", scheduledAt: on(24) },
        { key: "y", a: "c", b: "d", scheduledAt: on(25) },
        { key: "z", a: "c", b: "a", scheduledAt: on(25) },
        { key: "open", a: "c", b: "a" },
      ]),
    ),
    ZONE,
    now,
  )

  assert.deepEqual(
    marks.map(({ day, count, live }) => [day, count, live]),
    [
      ["2026-11-24", 1, true],
      ["2026-11-25", 2, false],
    ],
  )
})

test("a long schedule keeps the days around now", () => {
  const entries = matchesOf(
    competition(
      Array.from({ length: 28 }, (_, index) => ({ key: `m${index}`, a: "a", b: "b", scheduledAt: on(index + 1) })),
    ),
  )
  const marks = scheduleDayMarks(entries, ZONE, Date.parse(on(10)), 8, 3)

  assert.deepEqual([marks[0]!.day, marks.at(-1)!.day], ["2026-11-07", "2026-11-14"])
})
