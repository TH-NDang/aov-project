import assert from "node:assert/strict"
import { test } from "node:test"
import {
  dayOpenings,
  foldsBody,
  pinnedSummary,
  postChange,
  postForm,
} from "../src/features/community/model/post-form.ts"

const post = (extra: object = {}) => ({ kind: "TEXT" as const, body: "", videoUrl: null, imageUrls: [], ...extra })

test("news keeps its own form whatever it carries", () => {
  assert.equal(postForm(post({ kind: "NEWS", body: "Short.", imageUrls: ["a.jpg"] })), "news")
})

test("a video comes before pictures, and pictures before words", () => {
  assert.equal(postForm(post({ kind: "VIDEO", videoUrl: "https://youtu.be/x", imageUrls: ["a.jpg"] })), "video")
  assert.equal(postForm(post({ body: "Short.", imageUrls: ["a.jpg"] })), "photo")
})

test("a short message on one line is a statement, a longer or broken one is text", () => {
  assert.equal(postForm(post({ body: "See you at the next match!" })), "statement")
  assert.equal(postForm(post({ body: "See you\nat the next match!" })), "text")
  assert.equal(postForm(post({ body: "a".repeat(141) })), "text")
})

test("a post without words is text, so it is never set large", () => {
  assert.equal(postForm(post({ body: "  " })), "text")
})

test("only long words fold", () => {
  assert.equal(foldsBody("Short."), false)
  assert.equal(foldsBody("a".repeat(421)), true)
  assert.equal(foldsBody("line\n".repeat(8)), true)
})

test("the first post of each day opens it, by the reader's calendar", () => {
  const posts = [
    { id: "a", createdAt: "2026-11-25T01:00:00Z" },
    { id: "b", createdAt: "2026-11-24T18:00:00Z" },
    { id: "c", createdAt: "2026-11-24T16:00:00Z" },
  ]

  assert.deepEqual([...dayOpenings(posts, "Asia/Ho_Chi_Minh")], ["a", "c"])
  assert.deepEqual([...dayOpenings(posts, "UTC")], ["a", "b"])
})

test("the post after a pinned one opens its day again", () => {
  const posts = [
    { id: "pinned", createdAt: "2026-11-24T02:00:00Z", pinned: true },
    { id: "next", createdAt: "2026-11-24T03:00:00Z" },
  ]

  assert.deepEqual([...dayOpenings(posts, "UTC")], ["pinned", "next"])
})

test("a folded pinned post shows its first picture, else its video's, and its headline", () => {
  const news = { title: "Bảo trì ngày 3/12", body: "Máy chủ bảo trì.", videoUrl: null, imageUrls: ["a.jpg", "b.jpg"] }
  assert.deepEqual(pinnedSummary(news), { picture: "a.jpg", headline: "Bảo trì ngày 3/12" })
  const video = { title: null, body: "", videoUrl: "https://www.youtube.com/watch?v=tDg0yapYuOw", imageUrls: [] }
  assert.equal(pinnedSummary(video).picture, "https://i.ytimg.com/vi/tDg0yapYuOw/mqdefault.jpg")
})

test("a pinned post without a headline shows the first line of its words without the markup of names", () => {
  const words = { title: null, body: "\nChúc mừng <ref=team:t1>Saigon Phantom</ref>!\nHẹn gặp lại.", videoUrl: null }
  assert.deepEqual(pinnedSummary(words), { picture: null, headline: "Chúc mừng Saigon Phantom!" })
})

test("a draft posted as it is keeps its words and everything it carries", () => {
  const draft = {
    version: 3,
    kind: "NEWS" as const,
    title: "Mini game",
    body: "Đoán tỉ số.",
    videoUrl: null,
    imageUrls: ["a.jpg"],
    asPage: true,
  }
  assert.deepEqual(postChange(draft, true), { ...draft, publish: true })
  assert.equal(postChange(draft, false, { body: "Đoán đúng tỉ số." }).body, "Đoán đúng tỉ số.")
})
