import assert from "node:assert/strict"
import { test } from "node:test"
import {
  COMMON_TIME_ZONES,
  browserTimeZone,
  calendarDaysBetween,
  canonicalTimeZone,
  chooseTimeZone,
  currentTimeZone,
  dayKeyInZone,
  formatCalendarDate,
  formatInZone,
  isCalendarDate,
  isValidTimeZone,
  timeZoneChoice,
  timeZoneLabel,
  toInstant,
  utcOffsetLabel,
} from "../src/lib/time-zone.ts"

const moment = "2026-11-06T18:30:00Z"

test("a moment reads differently in each zone, and moves to the next day when it should", () => {
  const time = { hour: "2-digit", minute: "2-digit" }
  assert.equal(formatInZone(moment, "Asia/Ho_Chi_Minh", time), "01:30")
  assert.equal(formatInZone(moment, "America/New_York", time), "13:30")
  assert.equal(formatInZone(moment, "UTC", time), "18:30")
  assert.equal(dayKeyInZone(moment, "Asia/Ho_Chi_Minh"), "2026-11-07")
  assert.equal(dayKeyInZone(moment, "America/New_York"), "2026-11-06")
  assert.equal(formatInZone("not a date", "UTC"), "")
  assert.equal(formatInZone(null, "UTC"), "")
})

test("a calendar date stays the day it says in every zone", () => {
  assert.equal(isCalendarDate("2026-10-30"), true)
  assert.equal(isCalendarDate("2026-10-30T00:00:00Z"), false)
  assert.equal(toInstant("2026-10-30"), null, "a day is not a moment")
  assert.equal(formatInZone("2026-10-30", "America/Los_Angeles"), "", "zones cannot be applied to a day")

  const original = process.env.TZ
  try {
    for (const zone of ["America/Los_Angeles", "Pacific/Kiritimati", "Asia/Ho_Chi_Minh", "UTC"]) {
      process.env.TZ = zone
      assert.equal(formatCalendarDate("2026-10-30"), "30/10/2026", zone)
      assert.match(formatCalendarDate("2026-10-30", { day: "2-digit", month: "2-digit" }), /^30\D10$/, zone)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
  assert.match(
    formatCalendarDate("2026-10-30", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    /^30\D10$/,
    "time parts are dropped because a day has no time",
  )
  assert.equal(formatCalendarDate("2026-10-30", { hour: "2-digit" }), "30/10/2026")
})

test("days between moments are counted on the calendar of the zone", () => {
  const now = "2026-11-06T16:30:00Z"
  assert.equal(calendarDaysBetween(now, "2026-11-06T17:30:00Z", "Asia/Ho_Chi_Minh"), 1, "past midnight in Vietnam")
  assert.equal(calendarDaysBetween(now, "2026-11-06T17:30:00Z", "UTC"), 0)
  assert.equal(calendarDaysBetween(now, "2026-11-07", "America/New_York"), 1, "a calendar date is not converted")
  assert.equal(calendarDaysBetween(now, "2026-11-01", "UTC"), -5)
})

test("offsets follow the moment where clocks change", () => {
  assert.equal(utcOffsetLabel("Asia/Ho_Chi_Minh"), "UTC+7")
  assert.equal(utcOffsetLabel("Asia/Kolkata"), "UTC+5:30")
  assert.equal(utcOffsetLabel("UTC"), "UTC+0")
  assert.equal(utcOffsetLabel("America/New_York", "2026-07-01T00:00:00Z"), "UTC-4")
  assert.equal(utcOffsetLabel("America/New_York", "2026-12-01T00:00:00Z"), "UTC-5")
})

test("zones have readable names in the page's language", () => {
  assert.equal(timeZoneLabel("Asia/Ho_Chi_Minh"), "Việt Nam (UTC+7)")
  assert.equal(timeZoneLabel("Asia/Ho_Chi_Minh", Date.now(), "en-US"), "Vietnam (UTC+7)")
  assert.equal(timeZoneLabel("Asia/Saigon"), "Việt Nam (UTC+7)", "the legacy name browsers report")
  assert.equal(timeZoneLabel("UTC"), "UTC")
  assert.equal(timeZoneLabel("Etc/UTC"), "UTC")
  assert.equal(timeZoneLabel("Asia/Dhaka"), "Asia/Dhaka (UTC+6)", "a zone outside the common list keeps its name")
  assert.equal(canonicalTimeZone("Asia/Calcutta"), "Asia/Kolkata")
})

test("the settings list holds common zones only, each one valid, and includes Vietnam", () => {
  assert.ok(COMMON_TIME_ZONES.some((zone) => zone.value === "Asia/Ho_Chi_Minh"))
  assert.ok(COMMON_TIME_ZONES.length < 30)
  assert.equal(new Set(COMMON_TIME_ZONES.map((zone) => zone.value)).size, COMMON_TIME_ZONES.length)
  for (const zone of COMMON_TIME_ZONES) assert.equal(isValidTimeZone(zone.value), true, zone.value)
  assert.equal(isValidTimeZone("Mars/Olympus"), false)
  assert.equal(isValidTimeZone(""), false)
  assert.equal(isValidTimeZone(null), false)
})

test("a locale or zone the browser does not know falls back instead of throwing", () => {
  const time = { hour: "2-digit", minute: "2-digit" }
  assert.equal(formatInZone(moment, "Mars/Olympus", time), "18:30", "an unknown zone reads as UTC")
  assert.equal(formatInZone(moment, "UTC", time, "not a locale"), "18:30")
  assert.equal(dayKeyInZone(moment, "Mars/Olympus"), "2026-11-06")
  assert.equal(timeZoneLabel("Mars/Olympus"), "Mars/Olympus", "no offset is invented for an unknown zone")
})

test("a choice wins over the browser, survives a visit and clears back to the browser", async () => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  try {
    await chooseTimeZone(null)
    assert.equal(timeZoneChoice(), null)
    assert.equal(currentTimeZone(), browserTimeZone())

    await chooseTimeZone("Asia/Tokyo")
    assert.equal(currentTimeZone(), "Asia/Tokyo")
    assert.deepEqual([...values.values()], ["Asia/Tokyo"], "kept for the next visit")

    await chooseTimeZone("Asia/Saigon")
    assert.equal(currentTimeZone(), "Asia/Ho_Chi_Minh", "stored under the name the list uses")

    await chooseTimeZone("Mars/Olympus")
    assert.equal(timeZoneChoice(), null, "an unknown zone falls back to the browser")
    assert.equal(values.size, 0)
  } finally {
    delete globalThis.localStorage
  }
})
