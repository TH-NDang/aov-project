import assert from "node:assert/strict"
import { test } from "node:test"
import type { CommunityNotification } from "@aov/community-contracts"
import { notificationText } from "../src/lib/notification-text.ts"

const vietnamese = (vi: string) => vi
const english = (_vi: string, en: string) => en

const line = (extra: Partial<CommunityNotification>): CommunityNotification => ({
  id: "notification",
  pageId: "page",
  createdAt: "2026-11-18T03:00:00Z",
  read: false,
  ...extra,
})

test("a live broadcast is worded from the page name and the title in the reader's language", () => {
  const live = line({ kind: "PAGE_LIVE_STARTED", parameters: { pageName: "Saigon Phantom", title: "Week 3" } })

  assert.equal(notificationText(live, vietnamese), "Saigon Phantom đang phát trực tiếp: Week 3")
  assert.equal(notificationText(live, english), "Saigon Phantom is live: Week 3")
})

test("a kind without parameters is worded the same for every page", () => {
  const comment = line({ kind: "POST_COMMENTED", parameters: {} })

  assert.equal(notificationText(comment, vietnamese), "Bài viết của bạn có bình luận mới.")
  assert.equal(notificationText(comment, english), "Your post has a new comment.")
})

test("a line sent before kinds keeps its stored sentence in both languages", () => {
  const stored = line({ kind: null, message: "Báo cáo của bạn đã được xử lý." })

  assert.equal(notificationText(stored, english), "Báo cáo của bạn đã được xử lý.")
})

test("a kind this app does not know yet falls back to the stored sentence or a general one", () => {
  const newer = line({ kind: "PAGE_RENAMED" as CommunityNotification["kind"], parameters: { pageName: "Team" } })

  assert.equal(notificationText(newer, english), "You have a new notification.")
  assert.equal(notificationText({ ...newer, message: "Stored sentence" }, english), "Stored sentence")
})
