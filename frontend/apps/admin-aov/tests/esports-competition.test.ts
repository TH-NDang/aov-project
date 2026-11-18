import assert from "node:assert/strict"
import { test } from "node:test"
import { buildBracket, computeStandings, seriesWinner } from "../src/features/esports/model/competition"
import { stageInfo } from "../src/features/esports/model/labels"
import { gameStatistics } from "../src/features/esports/model/statistics"
import { series } from "./fixtures/esports-model"

test("stage codes map to readable labels and bracket phases; free text is kept", () => {
  assert.equal(stageInfo("REGULAR_SEASON_FIRST_LEG").label, "Vòng bảng · Lượt đi")
  assert.equal(stageInfo("UPPER_BRACKET_SEMIFINAL").label, "Bán kết nhánh thắng")
  assert.equal(stageInfo("LOWER_BRACKET_QUARTERFINAL").phase, "LOWER")
  assert.equal(stageInfo("GRAND_FINAL").phase, "FINAL")
  assert.ok(stageInfo("LOWER_BRACKET_QUARTERFINAL").order < stageInfo("LOWER_BRACKET_FINAL").order)
  assert.deepEqual(stageInfo("Show match"), { code: "Show match", label: "Show match", phase: "OTHER", order: 90 })
})

test("a series is only decided once a team reaches the majority of its best-of", () => {
  assert.equal(seriesWinner(series("1", "X", "a", "b", [3, 1]).content), "A")
  assert.equal(seriesWinner(series("1", "X", "a", "b", [2, 4], 7).content), "B")
  assert.equal(seriesWinner(series("1", "X", "a", "b", [2, 1]).content), null)
  assert.equal(seriesWinner(series("1", "X", "a", "b").content), null)
})

test("standings count series points, then game difference, share ranks on full ties and flag playoff teams", () => {
  const rows = computeStandings([
    series("1", "REGULAR_SEASON_FIRST_LEG", "a", "b", [3, 0]),
    series("2", "REGULAR_SEASON_FIRST_LEG", "c", "a", [3, 2]),
    series("3", "REGULAR_SEASON_FIRST_LEG", "b", "c", [3, 1]),
    series("4", "REGULAR_SEASON_SECOND_LEG", "a", "c"),
    series("5", "UPPER_BRACKET_FINAL", "a", "c", [4, 3], 7),
  ])
  assert.deepEqual(
    rows.map((row) => [row.teamId, row.rank, row.points, row.gameDiff, row.played]),
    [
      ["a", 1, 1, 2, 2],
      ["c", 2, 1, -1, 2],
      ["b", 3, 1, -1, 2],
    ],
  )
  assert.deepEqual(rows[0].form, ["W", "L"])
  assert.equal(rows.find((row) => row.teamId === "b")?.advanced, false)
  assert.equal(rows.find((row) => row.teamId === "a")?.advanced, true)
})

test("the bracket orders rounds and projects the grand final from the upper final winner", () => {
  const bracket = buildBracket([
    series("6", "UPPER_BRACKET_FINAL", "sgp", "fpl", [3, 4], 7),
    series("1", "UPPER_BRACKET_SEMIFINAL", "sgp", "bme", [4, 2], 7),
    series("2", "UPPER_BRACKET_SEMIFINAL", "fpl", "fl", [4, 1], 7),
    series("3", "LOWER_BRACKET_QUARTERFINAL", "bme", "gam", [4, 1], 7),
    series("7", "LOWER_BRACKET_FINAL", "sgp", "bme", undefined, 7),
  ])
  assert.deepEqual(
    bracket.upper.map((round) => [round.label, round.slots.length]),
    [
      ["Bán kết nhánh thắng", 2],
      ["Chung kết nhánh thắng", 1],
    ],
  )
  assert.equal(bracket.lower[0].label, "Tứ kết nhánh thua")
  assert.equal(bracket.final?.slots[0].projected, true)
  assert.equal(bracket.final?.slots[0].teamAId, "fpl")
  assert.equal(bracket.final?.slots[0].teamBId, undefined)
})

test("hero statistics count presence from picks and bans and win rate per side", () => {
  const side = (code: "BLUE" | "RED", hero: string, ban: string) => ({
    side: code,
    teamId: code,
    bans: [{ id: ban, name: ban }],
    participants: [
      {
        lane: "MID" as const,
        hero: { id: hero, name: hero },
        spell: {},
        arcana: { status: "UNKNOWN" as const, entries: [] },
        enchantments: { status: "UNKNOWN" as const, entries: [] },
        equipmentSnapshots: [],
        equipmentEvents: [],
      },
    ],
  })
  const game = (winner: "BLUE" | "RED" | null, duration: number) => ({
    seriesId: "s",
    number: 1,
    region: "VN",
    locale: "vi-VN",
    winner,
    durationSeconds: duration,
    sides: [side("BLUE", "airi", "elsu"), side("RED", "elsu", "airi")],
  })
  const stats = gameStatistics([game("BLUE", 900), game("RED", 1200), game(null, 0)])
  const airi = stats.heroes.find((hero) => hero.key === "airi")!
  assert.equal(airi.picks, 3)
  assert.equal(airi.bans, 3)
  assert.equal(airi.wins, 1)
  assert.deepEqual(airi.blue, { picks: 3, wins: 1 })
  assert.deepEqual(stats.sideWins, { BLUE: 1, RED: 1 })
  assert.equal(stats.shortest?.seconds, 900)
  assert.equal(stats.averageSeconds, 1050)
})

test("dates near today read as words and keep the exact date for tooltips", async () => {
  const { exactDate, relativeDay } = await import("../src/features/esports/model/labels")
  const now = new Date(2026, 9, 29, 9, 0)
  assert.equal(relativeDay("2026-10-29T18:00:00", now), "Hôm nay")
  assert.equal(relativeDay("2026-10-28T23:30:00", now), "Hôm qua", "calendar days, not 24-hour spans")
  assert.equal(relativeDay("2026-10-30", now), "Ngày mai")
  assert.equal(relativeDay("2026-10-25T18:00:00", now), "4 ngày trước")
  assert.equal(relativeDay("2026-11-02T18:00:00", now), "4 ngày nữa")
  assert.match(relativeDay("2026-10-01T18:00:00", now), /01\/10/, "older dates fall back to the short date")
  assert.match(relativeDay("2025-10-01", now), /2025/, "another year shows the year")
  assert.equal(relativeDay(null, now), "")
  assert.match(exactDate("2026-10-28T18:00:00"), /28 tháng 10.*2026.*18:00/)
  assert.doesNotMatch(exactDate("2026-10-28T18:00:00", false), /18:00/)
  assert.doesNotMatch(exactDate("2026-10-28"), /:/, "a date-only value has no time")
})
