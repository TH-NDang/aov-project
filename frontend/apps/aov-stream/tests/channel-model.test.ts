import assert from "node:assert/strict"
import { test } from "node:test"
import type { YouTubeVideo } from "@aov/community-contracts"
import {
  channelVideos,
  compactCount,
  isYouTubeChannel,
  splitShorts,
  videoLength,
} from "../src/features/community/model/channel-model.ts"

test("links to a YouTube channel open in the site", () => {
  for (const url of [
    "https://www.youtube.com/@GarenaLienQuan",
    "https://m.youtube.com/@saigon.phantom/videos",
    "https://youtube.com/channel/UCgYkGvtBuY4onYm2Eh61zwQ",
    "https://www.youtube.com/c/LienQuanMobile",
    "https://www.youtube.com/user/garenavn",
    "https://www.youtube.com/teamflash",
    "https://www.youtube.com/@Li%C3%AAnQu%C3%A2n",
  ])
    assert.equal(isYouTubeChannel(url), true, url)
})

test("videos, playlists and other sites keep opening where they point", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/playlist?list=PL1",
    "https://www.youtube.com/channel/UC123",
    "https://www.youtube.com/",
    "https://www.facebook.com/@team",
    "https://youtube.com.example.org/@team",
    "javascript:alert(1)",
    "not a link",
  ])
    assert.equal(isYouTubeChannel(url), false, url)
})

test("lengths read like a player's clock", () => {
  assert.equal(videoLength(45), "0:45")
  assert.equal(videoLength(754), "12:34")
  assert.equal(videoLength(3723), "1:02:03")
})

test("counts are shortened in the reader's language", () => {
  assert.equal(compactCount(1_530_000, "en-US"), "1.5M")
  assert.equal(compactCount(52_000, "en-US"), "52K")
  assert.match(compactCount(1_530_000, "vi-VN"), /^1,5\sTr$/)
})

const video = (id: string, shortForm = false): YouTubeVideo => ({
  id,
  title: id,
  publishedAt: "2026-11-25T12:00:00Z",
  durationSeconds: null,
  viewCount: null,
  broadcast: null,
  shortForm,
})

test("older parts add only the videos not shown yet, in order", () => {
  const merged = channelVideos(
    [video("a"), video("b")],
    [
      { videos: [video("a"), video("c")], nextPageToken: "x" },
      { videos: [video("c"), video("d")], nextPageToken: null },
    ],
  )
  assert.deepEqual(
    merged.map((item) => item.id),
    ["a", "b", "c", "d"],
  )
})

test("shorts stand apart from the other uploads", () => {
  const { videos, shorts } = splitShorts([video("a"), video("s", true), video("b")])
  assert.deepEqual(
    videos.map((item) => item.id),
    ["a", "b"],
  )
  assert.deepEqual(
    shorts.map((item) => item.id),
    ["s"],
  )
})
