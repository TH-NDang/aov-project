import assert from "node:assert/strict"
import test from "node:test"
import { lengthWords, MUSIC_LISTS } from "../src/lib/music-catalog.ts"
import { videoIdOf } from "../src/lib/music-links.ts"

test("every form of a link to a video gives its id", () => {
  const links = [
    "qJn0uACPdG0",
    "https://www.youtube.com/watch?v=qJn0uACPdG0",
    "https://www.youtube.com/watch?list=PL123&v=qJn0uACPdG0&t=42s",
    "youtube.com/watch?v=qJn0uACPdG0",
    "https://m.youtube.com/watch?v=qJn0uACPdG0",
    "https://music.youtube.com/watch?v=qJn0uACPdG0&si=abc",
    "https://youtu.be/qJn0uACPdG0?si=abc",
    "https://www.youtube.com/shorts/qJn0uACPdG0",
    "https://www.youtube.com/live/qJn0uACPdG0?feature=share",
    "https://www.youtube-nocookie.com/embed/qJn0uACPdG0",
    "  https://youtu.be/qJn0uACPdG0  ",
  ]
  for (const link of links) assert.equal(videoIdOf(link), "qJn0uACPdG0", link)
})

test("what is not a video gives nothing", () => {
  const others = [
    "",
    "nhạc liên quân",
    "https://www.youtube.com/@GarenaLienQuanMobile",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/watch?v=short",
    "https://example.com/watch?v=qJn0uACPdG0",
    "https://youtu.be.example.com/qJn0uACPdG0",
    "javascript:alert(1)",
  ]
  for (const text of others) assert.equal(videoIdOf(text), null, text)
})

test("no video is offered twice and every one has a title and a singer", () => {
  const videos = MUSIC_LISTS.flatMap(({ tracks }) => tracks.map(({ video }) => video))
  assert.equal(new Set(videos).size, videos.length)
  for (const { tracks } of MUSIC_LISTS) {
    assert.ok(tracks.length > 0)
    for (const track of tracks) {
      assert.match(track.video, /^[\w-]{11}$/)
      assert.ok(track.title && track.artist, track.video)
    }
  }
})

test("a length reads as minutes and seconds", () => {
  assert.equal(lengthWords(249), "4:09")
  assert.equal(lengthWords(60), "1:00")
  assert.equal(lengthWords(5), "0:05")
})
