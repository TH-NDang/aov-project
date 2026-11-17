import assert from "node:assert/strict"
import { test } from "node:test"
import { videoEmbed, videoPoster } from "../src/features/community/model/post-media-model.ts"

test("YouTube watch, short, live and youtu.be links play in the privacy-enhanced player", () => {
  const src = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ?si=abc",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  ])
    assert.deepEqual(videoEmbed(url), { kind: "youtube", src }, url)
})

test("other platforms and YouTube channel links become link cards", () => {
  assert.deepEqual(videoEmbed("https://www.facebook.com/LienquanMobile/videos/123"), {
    kind: "link",
    platform: "Facebook",
    href: "https://www.facebook.com/LienquanMobile/videos/123",
  })
  assert.equal((videoEmbed("https://www.tiktok.com/@a/video/1") as { platform: string }).platform, "TikTok")
  assert.equal((videoEmbed("https://www.youtube.com/@LienQuanMobileSportsGarena") as { kind: string }).kind, "link")
})

test("malformed and non-web links are not embedded", () => {
  assert.equal(videoEmbed("not a url"), null)
  assert.equal(videoEmbed("javascript:alert(1)"), null)
  assert.equal(videoEmbed("https://www.youtube.com/watch?v=short")?.kind, "link")
})

test("a YouTube video has its own picture, large with bars or small without; other platforms have none", () => {
  const embed = videoEmbed("https://youtu.be/dQw4w9WgXcQ")!
  assert.equal(videoPoster(embed), "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")
  assert.equal(videoPoster(embed, "mqdefault"), "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg")
  assert.equal(videoPoster(videoEmbed("https://www.tiktok.com/@a/video/1")!), null)
})
