import assert from "node:assert/strict"
import { test } from "node:test"
import { dateLabel, scheduleDate, parseScheduleDate, scheduleDateText } from "../src/features/publishing/schedule-date"

test("typed dates round-trip without accepting impossible calendar dates", () => {
  assert.equal(scheduleDateText(parseScheduleDate("1/2/2026")), "01/02/2026")
  assert.equal(scheduleDateText(parseScheduleDate("29/02/2024")), "29/02/2024")
  for (const invalid of ["31/02/2026", "29/02/2025", "31/04/2026", "00/10/2026", "16/13/2026", "16/10/", ""]) {
    assert.equal(parseScheduleDate(invalid), undefined)
  }
})

test("calendar dates remain date-only while supplied times retain their instant", () => {
  assert.deepEqual(scheduleDate("2026-10-16", ""), { at: null, on: "2026-10-16" })
  assert.deepEqual(scheduleDate("2026-10-16", "09:30"), {
    at: new Date("2026-10-16T09:30").toISOString(),
    on: null,
  })
  assert.equal(dateLabel("2026-10-16", "en-US"), "Oct 16, 2026")
  assert.equal(
    dateLabel("2026-10-16T02:30:00Z", "en-US"),
    new Date("2026-10-16T02:30:00Z").toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
  )
  assert.equal(dateLabel(null), "—")
})
