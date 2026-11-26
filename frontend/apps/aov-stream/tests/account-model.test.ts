import assert from "node:assert/strict"
import { test } from "node:test"
import { inboxDays, memberSince } from "../src/lib/account-model.ts"

test("the inbox is cut into today, yesterday and earlier by the reader's own days", () => {
  const now = "2026-11-26T03:00:00Z" // 10:00 in Hanoi, 22:00 the day before in New York
  const items = [
    { id: "a", createdAt: "2026-11-25T18:00:00Z" }, // 01:00 on the 26th in Hanoi
    { id: "b", createdAt: "2026-11-25T10:00:00Z" },
    { id: "c", createdAt: "2026-11-24T16:30:00Z" }, // 23:30 on the 24th in Hanoi
    { id: "d", createdAt: "2026-11-01T10:00:00Z" },
  ]
  const ids = (parts: ReturnType<typeof inboxDays<{ id: string; createdAt: string }>>) =>
    parts.map(({ day, items }) => [day, items.map((item) => item.id).join("")])
  assert.deepEqual(ids(inboxDays(items, now, "Asia/Ho_Chi_Minh")), [
    ["today", "a"],
    ["yesterday", "b"],
    ["earlier", "cd"],
  ])
  assert.deepEqual(ids(inboxDays(items, now, "America/New_York")), [
    ["today", "ab"],
    ["yesterday", "c"],
    ["earlier", "d"],
  ])
  assert.deepEqual(inboxDays([], now, "UTC"), [])
})

test("an account says the month it was made, and nothing for a missing date", () => {
  assert.equal(memberSince("2026-03-02T08:00:00Z", "en-US", "UTC"), "March 2026")
  assert.match(memberSince("2026-03-02T08:00:00Z", "vi-VN", "Asia/Ho_Chi_Minh") ?? "", /3.*2026/)
  assert.equal(memberSince(null, "vi-VN", "UTC"), null)
  assert.equal(memberSince("not a date", "vi-VN", "UTC"), null)
})
