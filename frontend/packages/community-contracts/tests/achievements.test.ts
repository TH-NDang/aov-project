import assert from "node:assert/strict"
import { test } from "node:test"
import { achievementRank, compareAchievementRanks, readStanding } from "../src/achievements.ts"

test("a title written in Vietnamese or English reads as first place", () => {
  for (const wording of ["Vô địch", "Nhà vô địch", "Quán quân", "Champion", "Champions", "Winner", "1st", "Hạng 1"])
    assert.deepEqual(readStanding(wording), { place: 1, placeTo: null }, wording)
})

test("a runner-up written in Vietnamese or English reads as second place", () => {
  for (const wording of ["Á quân", "Runner-up", "Runner up", "2nd", "2nd place", "Hạng nhì"])
    assert.deepEqual(readStanding(wording), { place: 2, placeTo: null }, wording)
})

test("a shared standing reads from its first to its last place whatever dash it is written with", () => {
  for (const wording of ["Hạng 5-8", "hạng 5 – 8", "5th–8th", "5th-8th place", "5-8", "Top 8", "Quarterfinalist"])
    assert.deepEqual(readStanding(wording), { place: 5, placeTo: 8 }, wording)
})

test("an individual award and a top band that is not a bracket size read as no standing", () => {
  for (const wording of ["MVP", "Tuyển thủ xuất sắc nhất", "Top 6", "Hạng 8-5"])
    assert.equal(readStanding(wording), null, wording)
})

test("a stored rank wins over the wording", () => {
  assert.deepEqual(achievementRank({ placement: "Vô địch", place: 3, placeTo: 4 }), { place: 3, placeTo: 4 })
  assert.equal(achievementRank({ placement: "Champion", award: true }), "AWARD")
})

test("a record without a rank falls back to its wording and counts as an award when it names no standing", () => {
  assert.deepEqual(achievementRank({ placement: "Champion" }), { place: 1, placeTo: null })
  assert.equal(achievementRank({ placement: "MVP" }), "AWARD")
})

test("ranks order by place, an exact place before a shared one, and awards after every standing", () => {
  const ranks = [
    "AWARD" as const,
    { place: 5, placeTo: 8 },
    { place: 3, placeTo: 4 },
    { place: 3, placeTo: null },
    { place: 1, placeTo: null },
  ]

  assert.deepEqual(ranks.sort(compareAchievementRanks), [
    { place: 1, placeTo: null },
    { place: 3, placeTo: null },
    { place: 3, placeTo: 4 },
    { place: 5, placeTo: 8 },
    "AWARD",
  ])
})
