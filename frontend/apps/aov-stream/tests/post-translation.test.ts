import assert from "node:assert/strict"
import { test } from "node:test"
import { createTaskQueue } from "../src/lib/task-queue.ts"
import {
  guessLanguage,
  imageNotes,
  languageName,
  replacesWords,
  translatesOnItsOwn,
  translationOffer,
} from "../src/features/community/model/post-translation.ts"

const post = (body: string, extra: object = {}) => ({ status: "PUBLISHED", title: null, body, imageUrls: [], ...extra })
const answer = (extra: object = {}) => ({
  postId: "p",
  locale: "en-US",
  sourceLanguage: "vi-VN",
  sameLanguage: false,
  title: null,
  body: "Laville is busted right now",
  images: [],
  model: "claude-haiku-5-5",
  ...extra,
})

test("the language is told from the letters, as the service tells it", () => {
  assert.equal(guessLanguage("Laville giờ bá quá, nhớ mang Trừng trị nha ae"), "vi-VN")
  assert.equal(guessLanguage("Laville is strong this season, bring Punish"), "en-US")
  assert.equal(guessLanguage("ป่าเราฟาร์มไม่ทัน โดนขโมยบัฟแดงอีกแล้ว"), "th-TH")
  assert.equal(guessLanguage("今天的比賽很精彩"), "zh-TW")
  assert.equal(guessLanguage("GG wp"), null)
})

test("names in reference tags, links and hashtags do not decide the language", () => {
  assert.equal(guessLanguage("<ref=hero:1>Tôn Ngộ Không</ref> is strong this season #LiênQuân"), "en-US")
})

test("a post in another language offers its translation, one in the reader's words does not", () => {
  assert.equal(translationOffer(post("Laville giờ bá quá, nhớ mang Trừng trị nha ae"), "en-US"), "text")
  assert.equal(translationOffer(post("Laville giờ bá quá, nhớ mang Trừng trị nha ae"), "vi-VN"), null)
  assert.equal(translationOffer(post("Laville giờ bá quá", { status: "DRAFT" }), "en-US"), null)
})

test("pictures may say something even when the words are the reader's", () => {
  assert.equal(translationOffer(post("Shop mới nè anh em ơi", { imageUrls: ["a.png"] }), "vi-VN"), "images")
  assert.equal(translationOffer(post("GG", { imageUrls: ["a.png"] }), "vi-VN"), "unknown")
  assert.equal(translatesOnItsOwn("images"), false)
  assert.equal(translatesOnItsOwn("unknown"), true)
  assert.equal(translatesOnItsOwn("text"), true)
})

test("only pictures with words in another language get a note", () => {
  const notes = imageNotes(
    answer({
      images: [
        { index: 0, hasText: true, language: "vi-VN", text: "Shop screen, 199 Vouchers." },
        { index: 1, hasText: false, language: null, text: null },
        { index: 2, hasText: true, language: "en-US", text: "Victory" },
      ],
    }),
    "en-US",
  )
  assert.deepEqual(notes, [{ index: 0, text: "Shop screen, 199 Vouchers.", language: "vi-VN" }])
})

test("a translation replaces the words only when they change", () => {
  assert.equal(replacesWords(answer(), post("Laville giờ bá quá")), true)
  assert.equal(replacesWords(answer({ sameLanguage: true }), post("Laville giờ bá quá")), false)
  assert.equal(replacesWords(answer({ body: "GG" }), post("GG")), false)
})

test("languages are named the way a sentence names them", () => {
  assert.equal(languageName("th-TH", false), "tiếng Thái")
  assert.equal(languageName("th-TH", true), "Thai")
  assert.equal(languageName("other", true), null)
})

test("the queue runs a few tasks at a time, oldest first", async () => {
  const queued = createTaskQueue(2)
  let running = 0
  let most = 0
  const order: number[] = []
  const task = (n: number) => async () => {
    running++
    most = Math.max(most, running)
    await new Promise((resolve) => setTimeout(resolve, 5))
    order.push(n)
    running--
    return n
  }
  const results = await Promise.all([1, 2, 3, 4, 5].map((n) => queued(task(n))))
  assert.deepEqual(results, [1, 2, 3, 4, 5])
  assert.equal(most, 2)
  assert.deepEqual(order.slice(0, 2).sort(), [1, 2])
})
