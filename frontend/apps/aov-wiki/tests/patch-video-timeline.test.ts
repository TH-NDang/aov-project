import assert from "node:assert/strict"
import { test } from "node:test"
import { releaseMoment, splitAtRelease, videoMoment } from "../src/lib/patch-video-timeline.ts"

const video = (id: string, publishedAt: string | null, publishedOn: string | null = null) => ({
  id,
  publishedAt,
  publishedOn,
})

test("a day-only release starts at midnight on its market's clock, an exact one at its moment", () => {
  assert.equal(
    releaseMoment({ region: "VN", timeZone: "Asia/Ho_Chi_Minh", effectiveOn: "2026-11-26" }),
    Date.parse("2026-11-25T17:00:00Z"),
  )
  assert.equal(
    releaseMoment({ region: "TW", timeZone: "Asia/Taipei", effectiveAt: "2026-09-23T00:00:00Z" }),
    Date.parse("2026-09-23T00:00:00Z"),
  )
  assert.equal(releaseMoment(undefined), null)
})

test("videos are ordered oldest first and split where the release falls", () => {
  const release = Date.parse("2026-11-17T00:00:00+07:00")
  const { ordered, firstAfter } = splitAtRelease(
    [
      video("review", "2026-11-19T05:00:00Z"),
      video("preview", "2026-11-08T05:00:00Z"),
      video("dated", null, "2026-11-17"),
      video("undated", null),
    ],
    release,
  )
  assert.deepEqual(
    ordered.map((entry) => entry.id),
    ["preview", "dated", "review", "undated"],
  )
  assert.equal(firstAfter, 1)
  assert.equal(videoMoment(video("dated", null, "2026-11-17")), Date.parse("2026-11-17T05:00:00Z"))
  assert.equal(splitAtRelease([video("a", "2026-11-08T05:00:00Z")], release).firstAfter, 1)
  assert.equal(splitAtRelease([video("a", "2026-11-08T05:00:00Z")], null).firstAfter, -1)
})
