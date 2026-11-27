import assert from "node:assert/strict"
import test from "node:test"
import { readVideoLink, videoCanSeek } from "@aov/ui/lib/video-playback"
import {
  byPurpose,
  formatDuration,
  isVideoEndedMessage,
  neighbours,
  purposeLabel,
  purposesIn,
  splitHeroVideos,
  videoPlayback,
  videosAtVersion,
  videoThumbnail,
  videoWatchUrl,
  type PublicVideo,
} from "../src/components/videos/video-model.ts"

const video = (changes: Partial<PublicVideo> = {}): PublicVideo => ({
  id: "v",
  subjectKind: "HERO",
  subjectId: "h",
  subjectKey: null,
  purpose: "GUIDE_BASIC",
  title: "Video",
  note: null,
  url: "https://www.youtube.com/watch?v=yISPe_EM4sQ",
  provider: "YOUTUBE",
  providerVideoId: "yISPe_EM4sQ",
  startSeconds: 0,
  durationSeconds: null,
  channelName: null,
  publishedOn: null,
  patchVariantId: null,
  ...changes,
})

const timeline = [{ id: "p1" }, { id: "p2" }, { id: "p3" }]

test("a video without a patch shows at every version", () => {
  assert.equal(videosAtVersion([video()], timeline, "p1").length, 1)
  assert.equal(videosAtVersion([video()], [], null).length, 1)
})

test("a video tagged with a patch hides at older versions", () => {
  const tagged = [video({ patchVariantId: "p2" })]
  assert.equal(videosAtVersion(tagged, timeline, "p1").length, 0)
  assert.equal(videosAtVersion(tagged, timeline, "p2").length, 1)
  assert.equal(videosAtVersion(tagged, timeline, "p3").length, 1)
})

test("a patch outside the reader's timeline hides the video", () => {
  assert.equal(videosAtVersion([video({ patchVariantId: "draft" })], timeline, "p3").length, 0)
  assert.equal(videosAtVersion([video({ patchVariantId: "draft" })], timeline, null).length, 0)
})

test("without a selected version every known patch shows", () => {
  assert.equal(videosAtVersion([video({ patchVariantId: "p3" })], timeline, null).length, 1)
  assert.equal(videosAtVersion([video({ patchVariantId: "p3" })], timeline, "unknown").length, 1)
})

const HOST = "wiki.example"
const srcOf = (changes: Partial<PublicVideo>) => {
  const playback = videoPlayback(video(changes), HOST)
  return playback && playback.src
}
const link = (url: string, provider: PublicVideo["provider"]) => ({ url, provider, providerVideoId: null })

test("YouTube plays through the privacy-enhanced host at the chosen start", () => {
  assert.equal(srcOf({}), "https://www.youtube-nocookie.com/embed/yISPe_EM4sQ?autoplay=1&rel=0")
  assert.equal(
    srcOf({ startSeconds: 90 }),
    "https://www.youtube-nocookie.com/embed/yISPe_EM4sQ?autoplay=1&rel=0&start=90",
  )
})

test("a YouTube playlist plays in the page, and a channel page stays a link", () => {
  assert.equal(
    srcOf(link("https://www.youtube.com/playlist?list=PL123", "YOUTUBE")),
    "https://www.youtube-nocookie.com/embed/videoseries?autoplay=1&rel=0&list=PL123",
  )
  assert.equal(srcOf(link("https://www.youtube.com/@garena", "YOUTUBE")), null)
})

test("Facebook videos and reels play in the page, and other pages stay links", () => {
  const playback = videoPlayback(video(link("https://www.facebook.com/lienquan/videos/123", "FACEBOOK")), HOST)
  assert.equal(playback?.kind, "frame")
  assert.equal(
    playback?.src,
    "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Flienquan%2Fvideos%2F123&show_text=false&autoplay=true",
  )
  assert.equal(playback?.kind === "frame" && playback.portrait, false)

  const reel = videoPlayback(video(link("https://www.facebook.com/reel/456", "FACEBOOK")), HOST)
  assert.equal(reel?.kind === "frame" && reel.portrait, true)
  assert.ok(srcOf(link("https://fb.watch/abc/", "FACEBOOK")))
  assert.ok(srcOf(link("https://www.facebook.com/watch/?v=789", "FACEBOOK")))
  assert.equal(srcOf(link("https://www.facebook.com/lienquan", "FACEBOOK")), null)
})

test("a full TikTok link plays upright in the page, and a short link stays a link", () => {
  const playback = videoPlayback(video(link("https://www.tiktok.com/@aov/video/7300000000000000000", "TIKTOK")), HOST)
  assert.equal(playback?.src, "https://www.tiktok.com/player/v1/7300000000000000000?autoplay=1&rel=0&description=0")
  assert.equal(playback?.kind === "frame" && playback.portrait, true)
  assert.equal(srcOf(link("https://vm.tiktok.com/ZMabc/", "TIKTOK")), null)
})

test("Twitch videos, clips and channels name the page they play on", () => {
  assert.equal(
    srcOf({ ...link("https://www.twitch.tv/videos/123", "TWITCH"), startSeconds: 3723 }),
    "https://player.twitch.tv/?video=v123&parent=wiki.example&autoplay=true&time=1h2m3s",
  )
  assert.equal(
    srcOf(link("https://clips.twitch.tv/FunnySlug", "TWITCH")),
    "https://clips.twitch.tv/embed?clip=FunnySlug&parent=wiki.example&autoplay=true",
  )
  assert.equal(
    srcOf(link("https://www.twitch.tv/aov/clip/FunnySlug", "TWITCH")),
    "https://clips.twitch.tv/embed?clip=FunnySlug&parent=wiki.example&autoplay=true",
  )
  assert.equal(
    srcOf(link("https://www.twitch.tv/aov", "TWITCH")),
    "https://player.twitch.tv/?channel=aov&parent=wiki.example&autoplay=true",
  )
  assert.equal(srcOf(link("https://www.twitch.tv/directory", "TWITCH")), null)
})

test("a video file plays directly over https, and other pages stay links", () => {
  const file = videoPlayback(video(link("https://cdn.example/clip.mp4?v=1", "OTHER")), HOST)
  assert.equal(file?.kind, "file")
  assert.equal(file?.src, "https://cdn.example/clip.mp4?v=1")
  assert.equal(srcOf(link("http://cdn.example/clip.mp4", "OTHER")), null)
  assert.equal(srcOf(link("https://example.com/watch/clip", "OTHER")), null)
})

test("a link without a YouTube id has no thumbnail and opens as written", () => {
  const facebook = video(link("https://www.facebook.com/x/videos/1", "FACEBOOK"))
  assert.equal(videoThumbnail(facebook), null)
  assert.equal(videoWatchUrl(facebook), "https://www.facebook.com/x/videos/1")
})

test("a pasted link is read the way the backend stores it", () => {
  for (const pasted of [
    "https://youtu.be/yISPe_EM4sQ",
    "http://youtube.com/watch?list=abc&v=yISPe_EM4sQ",
    "https://www.youtube.com/shorts/yISPe_EM4sQ",
    "https://www.youtube-nocookie.com/embed/yISPe_EM4sQ",
    "https://music.youtube.com/watch?v=yISPe_EM4sQ",
  ]) {
    const read = readVideoLink(pasted)
    assert.equal(read?.providerVideoId, "yISPe_EM4sQ", pasted)
    assert.equal(read?.url, "https://www.youtube.com/watch?v=yISPe_EM4sQ", pasted)
  }
  assert.equal(readVideoLink("https://youtu.be/yISPe_EM4sQ?t=1h2m3s")?.startSeconds, 3723)
  assert.equal(readVideoLink("https://fb.watch/abc/")?.provider, "FACEBOOK")
  assert.equal(readVideoLink("https://vm.tiktok.com/x/")?.provider, "TIKTOK")
  assert.equal(readVideoLink("https://clips.twitch.tv/x")?.provider, "TWITCH")
  assert.equal(readVideoLink("https://notyoutube.com/watch?v=yISPe_EM4sQ")?.provider, "OTHER")
  assert.equal(readVideoLink("javascript:alert(1)"), null)
  assert.equal(readVideoLink("not a link"), null)
})

test("a start point is offered only where the player honours it", () => {
  const can = (changes: Partial<PublicVideo>) => videoCanSeek(video(changes), HOST)
  assert.equal(can({}), true)
  assert.equal(can(link("https://www.twitch.tv/videos/123", "TWITCH")), true)
  assert.equal(can(link("https://cdn.example/clip.mp4", "OTHER")), true)
  assert.equal(can(link("https://www.facebook.com/x/videos/1", "FACEBOOK")), false)
  assert.equal(can(link("https://www.tiktok.com/@a/video/1", "TIKTOK")), false)
  assert.equal(can(link("https://example.com/page", "OTHER")), false)
})

test("opening on YouTube keeps the start point", () => {
  assert.equal(videoWatchUrl(video({ startSeconds: 90 })), "https://www.youtube.com/watch?v=yISPe_EM4sQ&t=90s")
  assert.equal(videoWatchUrl(video()), "https://www.youtube.com/watch?v=yISPe_EM4sQ")
})

test("hero videos split by where the page shows them", () => {
  const { general, skills, loreCount } = splitHeroVideos([
    video({ id: "guide" }),
    video({ id: "story", purpose: "LORE" }),
    video({ id: "s1", purpose: "SKILL_DEMO" }),
    video({ id: "s2", purpose: "SKILL_DEMO" }),
    video({ id: "skin", subjectKind: "SKIN", subjectKey: "lan-su", purpose: "SKIN_SHOWCASE" }),
  ])
  assert.deepEqual(
    general.map((row) => row.id),
    ["guide", "story"],
  )
  assert.deepEqual(
    skills.map((row) => row.id),
    ["s1", "s2"],
  )
  assert.equal(loreCount, 1)
})

test("filters offer only purposes present, how-to-play first", () => {
  assert.deepEqual(
    purposesIn([video({ purpose: "LORE" }), video({ purpose: "GUIDE_BASIC" }), video({ purpose: "LORE" })]),
    ["GUIDE_BASIC", "LORE"],
  )
})

test("grouping by purpose keeps the editor's order within a purpose", () => {
  const ordered = byPurpose([
    video({ id: "lore-1", purpose: "LORE" }),
    video({ id: "guide-1" }),
    video({ id: "lore-2", purpose: "LORE" }),
    video({ id: "guide-2" }),
  ])
  assert.deepEqual(
    ordered.map((row) => row.id),
    ["guide-1", "guide-2", "lore-1", "lore-2"],
  )
})

test("labels follow the locale and durations read as a clock", () => {
  assert.equal(purposeLabel("LORE", "vi-VN"), "Cốt truyện")
  assert.equal(purposeLabel("LORE", "en-US"), "Lore")
  assert.equal(formatDuration(47), "0:47")
  assert.equal(formatDuration(3723), "1:02:03")
})

test("a playlist knows the videos on either side, and stops at its ends", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }]
  assert.deepEqual(neighbours(list, "b"), { index: 1, previous: { id: "a" }, next: { id: "c" } })
  assert.deepEqual(neighbours(list, "a"), { index: 0, previous: null, next: { id: "b" } })
  assert.deepEqual(neighbours(list, "c"), { index: 2, previous: { id: "b" }, next: null })
  assert.deepEqual(neighbours(list, "x"), { index: -1, previous: null, next: null })
  assert.deepEqual(neighbours(list, null), { index: -1, previous: null, next: null })
})

test("the end of a YouTube video is read from its status messages", () => {
  assert.equal(isVideoEndedMessage(JSON.stringify({ event: "onStateChange", info: 0 })), true)
  assert.equal(isVideoEndedMessage(JSON.stringify({ event: "infoDelivery", info: { playerState: 0 } })), true)
  assert.equal(isVideoEndedMessage(JSON.stringify({ event: "onStateChange", info: 1 })), false)
  assert.equal(isVideoEndedMessage(JSON.stringify({ event: "infoDelivery", info: { playerState: 1 } })), false)
  assert.equal(isVideoEndedMessage(JSON.stringify({ event: "infoDelivery", info: null })), false)
  assert.equal(isVideoEndedMessage(JSON.stringify({ event: "initialDelivery", info: { playerState: 0 } })), false)
  assert.equal(isVideoEndedMessage("not json"), false)
  assert.equal(isVideoEndedMessage({ event: "onStateChange", info: 0 }), false)
})
