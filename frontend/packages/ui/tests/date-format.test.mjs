import assert from "node:assert/strict"
import { test } from "node:test"
import { dateFormatLabel, formatWithDateChoice, isDateFormat } from "../src/lib/time-zone.ts"

const date = new Date("2026-12-31T07:05:00Z")
const dateOnly = { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
const withTime = { ...dateOnly, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
const write = (options, format, locale = "vi-VN") =>
  formatWithDateChoice(new Intl.DateTimeFormat(locale, options), date, options, format)

test("each format writes the same date in its own order", () => {
  assert.equal(write(dateOnly, "DMY"), "31/12/2026")
  assert.equal(write(dateOnly, "MDY"), "12/31/2026")
  assert.equal(write(dateOnly, "YMD"), "2026-12-31")
})

test("following the language leaves the formatter's own text alone", () => {
  assert.equal(write(dateOnly, "AUTO"), new Intl.DateTimeFormat("vi-VN", dateOnly).format(date))
  assert.equal(write(dateOnly, "AUTO", "en-US"), new Intl.DateTimeFormat("en-US", dateOnly).format(date))
})

test("a time stays beside the date on the side the language puts it", () => {
  const written = write(withTime, "YMD")
  assert.ok(written.includes("2026-12-31"), written)
  assert.ok(written.includes("07:05"), written)
  assert.ok(written.indexOf("07:05") < written.indexOf("2026-12-31"), written)
  assert.ok(write(withTime, "MDY", "en-US").startsWith("12/31/2026"))
})

test("a month written as a word is not reordered", () => {
  const options = { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
  assert.equal(write(options, "YMD"), new Intl.DateTimeFormat("vi-VN", options).format(date))
})

test("a date without a year keeps only the parts it has", () => {
  const options = { day: "2-digit", month: "2-digit", timeZone: "UTC" }
  assert.equal(write(options, "MDY"), "12/31")
  assert.equal(write(options, "DMY"), "31/12")
})

test("a weekday stays in front of the reordered date", () => {
  const options = { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
  assert.equal(write(options, "YMD", "en-US"), "Thursday, 2026-12-31")
  assert.equal(write(options, "MDY", "en-US"), "Thursday, 12/31/2026")
  const short = {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }
  const written = write(short, "MDY", "en-US")
  assert.ok(written.startsWith("Thu, 12/31"), written)
  assert.ok(written.includes("07:05"), written)
})

test("only known formats are accepted", () => {
  assert.equal(isDateFormat("DMY"), true)
  assert.equal(isDateFormat("dmy"), false)
  assert.equal(isDateFormat(null), false)
  assert.equal(dateFormatLabel("YMD"), "2026-12-31")
})
