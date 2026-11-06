import assert from "node:assert/strict"
import { test } from "node:test"
import { formatCalendarDate, formatInZone } from "@aov/ui/lib/time-zone"
import { patchDayLabel } from "../src/features/home/patch-day-label.ts"

test("a patch day set by the market reads the same to readers in every zone", () => {
  const original = process.env.TZ
  try {
    for (const zone of ["America/Los_Angeles", "Pacific/Kiritimati", "Asia/Ho_Chi_Minh", "UTC"]) {
      process.env.TZ = zone
      assert.equal(formatCalendarDate("2026-10-30"), "30/10/2026", zone)
      assert.equal(patchDayLabel("2026-10-30", zone), "30/10", zone)
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

test("a release known only by its timestamp is a moment, so its day depends on the reader's zone", () => {
  const moment = "2026-10-30T18:00:00Z"
  const day = { day: "2-digit", month: "2-digit", year: "numeric" } as const
  assert.equal(formatInZone(moment, "Asia/Ho_Chi_Minh", day), "31/10/2026")
  assert.equal(formatInZone(moment, "America/New_York", day), "30/10/2026")
  assert.equal(patchDayLabel(moment, "Asia/Ho_Chi_Minh"), "31/10")
  assert.equal(patchDayLabel(moment, "America/New_York"), "30/10")
})
