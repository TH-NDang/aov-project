import assert from "node:assert/strict"
import { test } from "node:test"
import { achievementRank } from "@aov/community-contracts/achievements"
import { achievementMark } from "../src/features/community/model/achievement-mark.ts"

test("a title written in English gets the cup, not the sign of an award", () => {
  assert.deepEqual(achievementMark([achievementRank({ placement: "Champion" })]), { kind: "champion" })
})

test("a stored rank sets the mark whatever the wording says", () => {
  const rank = achievementRank({ placement: "Vòng chung kết", place: 5, placeTo: 8 })

  assert.deepEqual(achievementMark([rank]), { kind: "place", text: "5–8" })
})

test("the best result of a competition sets its mark", () => {
  const ranks = [
    achievementRank({ placement: "MVP", award: true }),
    achievementRank({ placement: "3rd–4th" }),
    achievementRank({ placement: "Runner-up", place: 2 }),
  ]

  assert.deepEqual(achievementMark(ranks), { kind: "place", text: "2" })
})

test("a competition with only individual awards shows the sign of an award", () => {
  assert.deepEqual(achievementMark([achievementRank({ placement: "MVP" })]), { kind: "award" })
})
