import assert from "node:assert/strict"
import { test } from "node:test"
import type { GameContent } from "@aov/community-contracts"
import { seatWords, seenAt } from "../src/features/esports/model/seat-changes"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import { completeGame, game } from "./fixtures/match-records"

const VIDEO = "R5rCsGqDJIg"

/** Game 1 on the video of the match, with more of it recorded. */
const placed = (change: Partial<GameContent>) => {
  const entry = game(1)
  return layoutChapters(
    [{ ...entry, content: { ...entry.content, sourceUrl: `https://youtu.be/${VIDEO}`, ...change } }],
    VIDEO,
  )[0]!
}

test("a loadout seen while a game has no 0:00 is seen at 0:00, however long its draft runs", () => {
  const drafting = placed({ draft: { startSecond: 600, lockedSecond: null, turns: [] } })
  assert.deepEqual(seenAt(drafting, 1200), { second: 0, refusal: null })
})

test("a loadout may be seen past the guessed end of a game whose end is not recorded", () => {
  const running = placed({ sourceTimestampSeconds: 1000 })
  assert.deepEqual(seenAt(running, 2500), { second: 1500, refusal: null })
})

test("taking back that the video did not show a player's emblems says so", () => {
  const player = completeGame(1, "a").content.sides[0]!.participants[0]!
  const hidden = { ...player, enchantments: { status: "NOT_SHOWN" as const, entries: [] } }
  const shown = { ...player, enchantments: { status: "UNKNOWN" as const, entries: [] } }
  assert.equal(seatWords(hidden, shown, "Mid A"), "Đã bỏ đánh dấu không hiển thị phù hiệu của Mid A")
})
