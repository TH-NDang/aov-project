import assert from "node:assert/strict"
import test from "node:test"

import { gameToVideo, orderedPauses, videoToGame } from "../src/lib/game-video.ts"

const pauses = [
  { atSeconds: 600, durationSeconds: 60 },
  { atSeconds: 300, durationSeconds: 120 },
]

test("a second of a game without pauses is as far from 0:00 in its video", () => {
  assert.equal(gameToVideo(1546, [], 333), 1879)
  assert.equal(gameToVideo(1546, null, 0), 1546)
  assert.equal(gameToVideo(1546, undefined, 883), 2429)
})

test("a pause pushes back what comes after it, and not the second it holds", () => {
  assert.equal(gameToVideo(1000, pauses, 300), 1300)
  assert.equal(gameToVideo(1000, pauses, 301), 1421)
  assert.equal(gameToVideo(1000, pauses, 601), 1781)
})

test("the game clock is 0 before the game begins", () => {
  assert.equal(videoToGame(1546, [], 1500), 0)
  assert.equal(videoToGame(1546, [], 1546), 0)
})

test("the game clock is held while the broadcast is paused", () => {
  assert.equal(videoToGame(1000, pauses, 1299), 299)
  assert.equal(videoToGame(1000, pauses, 1300), 300)
  assert.equal(videoToGame(1000, pauses, 1420), 300)
  assert.equal(videoToGame(1000, pauses, 1421), 301)
})

test("the game clock runs on after every pause before it", () => {
  assert.equal(videoToGame(1000, pauses, 1720), 600)
  assert.equal(videoToGame(1000, pauses, 1780), 600)
  assert.equal(videoToGame(1000, pauses, 1781), 601)
})

test("every second of a game is found again from its video", () => {
  for (let at = 0; at <= 900; at += 7) assert.equal(videoToGame(1000, pauses, gameToVideo(1000, pauses, at)), at)
})

test("a pause without a length or before the game is none", () => {
  const wrong = [
    { atSeconds: 100, durationSeconds: 0 },
    { atSeconds: -5, durationSeconds: 30 },
    { atSeconds: 200, durationSeconds: -10 },
  ]
  assert.deepEqual(orderedPauses(wrong), [])
  assert.equal(gameToVideo(1000, wrong, 300), 1300)
})

test("pauses are put in order without changing the list they came in", () => {
  const list = [...pauses]
  assert.deepEqual(
    orderedPauses(list).map(({ atSeconds }) => atSeconds),
    [300, 600],
  )
  assert.deepEqual(list, pauses)
})
