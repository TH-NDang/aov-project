import assert from "node:assert/strict"
import { test } from "node:test"
import { dayOpenings, foldsBody, postForm } from "../src/features/community/model/post-form.ts"

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
