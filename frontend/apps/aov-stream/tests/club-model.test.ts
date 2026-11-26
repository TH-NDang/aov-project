import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionStanding } from "@aov/community-contracts"
import {
  barAt,
  clubBans,
  clubHeroes,
  clubOrder,
  gameWords,
  inSentence,
  lanePicks,
  lengthRows,
  poolLanes,
  seasonMarks,
  seasonStages,
  seasonSteps,
} from "../src/lib/club-model.ts"
import { feedScope } from "../src/lib/game-feed.ts"
import { playerPools, teamRecords } from "../src/lib/team-draft-model.ts"
import { competition, loserOf, on, stage, winnerOf, type TestMatch } from "./fixtures/competition.ts"
import { feedOf, five, roundRobin, roundRobinView, type TestGame } from "./fixtures/lineups.ts"

const vi = (text: string) => text
const en = (_: string, text: string) => text

const recordsOf = (teams: string[]) => teams.map((teamId) => ({ teamId, games: [] }))
const ids = (records: { teamId: string }[]) => records.map(({ teamId }) => teamId)

/** A table with the teams in the order given; a team that did not play is written in brackets. */
const table = (stageCode: string, teams: string[]) => ({
  stageCode,
  complete: true,
  rows: teams.map((name, index): CompetitionStanding => {
    const played = name.startsWith("(") ? 0 : 2
    const teamId = name.replace(/[()]/g, "")
    const row = { won: 0, lost: 0, gameWins: 0, gameLosses: 0, points: 0, tied: false, qualified: false }
    return { ...row, teamId, rank: index + 1, played }
  }),
})

const ROUND_ROBIN = { format: "ROUND_ROBIN" }

test("teams come as the final table places them", () => {
  const placements = ["z", "x", "y"].map((teamId, index) => ({ place: String(index + 1), teamId }))
  const view = competition(roundRobin, { tournament: { placements } })
  assert.deepEqual(ids(clubOrder(view, recordsOf(["x", "y", "z"]), null)), ["z", "x", "y"])
})

const bracket: TestMatch[] = [
  { key: "s1", a: "x", b: "y", score: [3, 0], scheduledAt: on(1) },
  { key: "s2", a: "z", b: "w", score: [1, 3], scheduledAt: on(2) },
  { key: "f", a: winnerOf("s1"), b: winnerOf("s2"), score: [0, 3], round: 2, scheduledAt: on(3) },
]

test("a bracket with a champion places its teams by how far they went", () => {
  const view = competition(bracket)
  assert.deepEqual(ids(clubOrder(view, recordsOf(["x", "y", "z", "w"]), null)), ["w", "x", "z", "y"])
})

test("a bracket still played places nobody", () => {
  const view = competition(bracket.map((match) => (match.key === "f" ? { ...match, score: undefined } : match)))
  assert.deepEqual(ids(clubOrder(view, recordsOf(["z", "y", "x", "w"]), null)), ["z", "y", "x", "w"])
})

test("a stage that only sends teams on places nobody, since none of its matches decides it", () => {
  const view = competition([
    { key: "o1", a: "x", b: "y", score: [2, 0], scheduledAt: on(1) },
    { key: "o2", a: "z", b: "w", score: [2, 0], scheduledAt: on(1) },
    { key: "w", a: winnerOf("o1"), b: winnerOf("o2"), score: [2, 0], round: 2, scheduledAt: on(2) },
    { key: "l", a: loserOf("o1"), b: loserOf("o2"), score: [2, 0], round: 2, scheduledAt: on(2) },
    { key: "d", a: loserOf("w"), b: winnerOf("l"), score: [0, 2], round: 3, scheduledAt: on(3) },
  ])
  assert.deepEqual(ids(clubOrder(view, recordsOf(["x", "z", "y", "w"]), null)), ["x", "z", "y", "w"])
})

test("without a bracket the last table each team played in places it, those that went on coming first", () => {
  const view = competition(
    [
      { key: "m1", a: "x", b: "y", stageCode: "RR1", scheduledAt: on(1) },
      { key: "m2", a: "z", b: "w", stageCode: "RR1", scheduledAt: on(2) },
      { key: "m3", a: "y", b: "z", stageCode: "RR2", scheduledAt: on(9) },
    ],
    {
      stages: [stage("RR1", ROUND_ROBIN), stage("RR2", ROUND_ROBIN)],
      standings: [table("RR2", ["y", "z", "(x)", "(w)"]), table("RR1", ["x", "z", "y", "w"])],
    },
  )
  assert.deepEqual(ids(clubOrder(view, recordsOf(["w", "x", "y", "z"]), null)), ["y", "z", "x", "w"])
})

test("a table whose matches a team has still to play says nothing of its place", () => {
  const view = competition(
    [
      { key: "m1", a: "x", b: "y", stageCode: "RR1", scheduledAt: on(1) },
      { key: "m2", a: "z", b: "w", stageCode: "RR1", scheduledAt: on(2) },
      { key: "m3", a: "y", b: "z", stageCode: "RR2", scheduledAt: on(9) },
      { key: "m4", a: "x", b: "w", stageCode: "RR2", scheduledAt: on(10) },
    ],
    {
      stages: [stage("RR1", ROUND_ROBIN), stage("RR2", ROUND_ROBIN)],
      standings: [table("RR2", ["y", "z", "(w)", "(x)"]), table("RR1", ["x", "z", "y", "w"])],
    },
  )
  assert.deepEqual(ids(clubOrder(view, recordsOf(["w", "x", "y", "z"]), null)), ["y", "z", "x", "w"])
})

test("groups played side by side are read together, rank by rank", () => {
  const view = competition(
    [
      { key: "m1", a: "a1", b: "a2", stageCode: "A", scheduledAt: on(1) },
      { key: "m2", a: "b1", b: "b2", stageCode: "B", scheduledAt: on(2) },
    ],
    {
      stages: [stage("A", ROUND_ROBIN), stage("B", ROUND_ROBIN)],
      standings: [table("A", ["a1", "a2", "(b1)", "(b2)"]), table("B", ["b1", "b2", "(a1)", "(a2)"])],
    },
  )
  assert.deepEqual(ids(clubOrder(view, recordsOf(["a1", "a2", "b1", "b2"]), null)), ["a1", "b1", "a2", "b2"])
})

/** X and Y meet in the group and again in the final, which Y wins. */
const twoStages = competition(
  [
    { key: "g", seriesId: "g", a: "x", b: "y", stageCode: "GROUP", score: [2, 0], scheduledAt: on(1) },
    { key: "k", seriesId: "k", a: "x", b: "y", stageCode: "KO", score: [0, 1], scheduledAt: on(9) },
    { key: "k2", seriesId: "k2", a: "x", b: "y", stageCode: "KO", score: [1, 0], scheduledAt: on(10) },
  ],
  {
    stages: [
      stage("GROUP", {
        ...ROUND_ROBIN,
        patches: [
          { label: "Tuần 1", releasedOn: "2026-10-01" },
          { label: "Tuần 2", releasedOn: "2026-10-08" },
        ],
      }),
      stage("KO"),
    ],
    standings: [table("GROUP", ["x", "y"])],
  },
)
const game = (id: string, series: string, winner: "BLUE" | "RED", number = 1): TestGame => ({
  id,
  series,
  number,
  winner,
  blue: { team: "x", picks: five("a") },
  red: { team: "y", picks: five("b") },
})
const stages = feedOf(
  [
    game("g1", "g", "BLUE"),
    game("g2", "g", "BLUE", 2),
    game("g3", "k", "RED"),
    { ...game("g4", "k2", "BLUE"), winner: null },
  ],
  twoStages,
)

test("a stage is ordered by itself", () => {
  const view = competition(
    [
      { key: "g", a: "x", b: "y", stageCode: "GROUP", scheduledAt: on(1) },
      { key: "f", a: "x", b: "y", stageCode: "KO", score: [0, 3], scheduledAt: on(9) },
    ],
    { stages: [stage("GROUP", ROUND_ROBIN), stage("KO")], standings: [table("GROUP", ["x", "y"])] },
  )
  const group = { key: "GROUP", stage: view.content.plan.stages[0]!, patch: null, games: 1 }
  assert.deepEqual(ids(clubOrder(view, recordsOf(["y", "x"]), group)), ["x", "y"])
})

test("weeks under one patch keep the order given, having no table of their own", () => {
  const view = twoStages
  const [group] = view.content.plan.stages
  const period = { key: "GROUP.1", stage: group!, patch: group!.patches![0]!, games: 2 }
  assert.deepEqual(ids(clubOrder(view, recordsOf(["y", "x"]), period)), ["y", "x"])
})

const season = teamRecords(stages).find(({ teamId }) => teamId === "x")!

test("a season is marked game by game, each match standing apart", () => {
  assert.deepEqual(seasonMarks(season), [
    { won: true, gap: false },
    { won: true, gap: false },
    { won: false, gap: true },
    { won: null, gap: true },
  ])
})

test("another stage stands further apart than another match", () => {
  assert.deepEqual(seasonSteps(season), [0, 0, 4, 5])
})

test("a season knows the stages it ran through, and the space from each to the next", () => {
  assert.deepEqual(seasonStages(season), [
    { code: "GROUP", games: 2, steps: 4 },
    { code: "KO", games: 2, steps: 1 },
  ])
})

test("a season without games ran through no stage", () => {
  assert.deepEqual(seasonStages({ games: [] }), [])
})

test("a place in a season is the game whose bar is nearest", () => {
  // Four bars of 10 with the gaps of the season, 2 to a step: they stand at 0, 10, 28 and 40.
  const at = (x: number) => barAt(seasonSteps(season), x, 50, 2)
  assert.deepEqual([at(-5), at(4), at(12), at(23), at(25), at(39), at(45), at(400)], [0, 0, 1, 1, 2, 2, 3, 3])
})

test("a season of one game has one bar", () => {
  assert.equal(barAt([0], 33, 40, 3), 0)
})

const named = feedOf([{ ...game("n1", "s1", "RED", 3), seconds: 1070 }], {
  ...roundRobinView(
    roundRobin.map((match) => (match.key === "m1" ? { ...match, label: "Round 12 · X vs Y · 2" } : match)),
  ),
})
const [met] = teamRecords(named).find(({ teamId }) => teamId === "x")!.games

test("a game reads as one sentence", () => {
  assert.equal(gameWords(met!, named.view, vi, "vi-VN"), "Ván 3, vòng 12, thua Y, 17:50")
  assert.equal(gameWords(met!, named.view, en, "en-US"), "Game 3, round 12, lost to Y, 17:50")
})

test("a game without a result or a length says whom it was against", () => {
  const open = { ...met!, won: null, game: { ...met!.game, seconds: null, entry: null } }
  assert.equal(gameWords(open, named.view, vi, "vi-VN"), "Ván 3, gặp Y")
})

test("a game whose number and opponent nobody recorded still says how it went", () => {
  const bare = { ...met!, won: true, other: null, game: { ...met!.game, number: 0, entry: null, seconds: null } }
  assert.equal(gameWords(bare, named.view, vi, "vi-VN"), "Thắng đối thủ chưa rõ")
})

test("a name inside a sentence starts small, an abbreviation does not", () => {
  assert.equal(inSentence("Vòng 12", "vi-VN"), "vòng 12")
  assert.equal(inSentence("BO5", "vi-VN"), "BO5")
})

/** X plays "star" in both lanes: twice on top, once in the jungle. "pair" is picked in three games of two matches. */
const drafted = feedOf([
  { id: "d1", series: "s1", number: 1, blue: { team: "x", picks: ["star", "pair"] }, red: { team: "y", picks: ["p"] } },
  { id: "d2", series: "s1", number: 2, blue: { team: "x", picks: ["solo", "pair"] }, red: { team: "y", picks: ["p"] } },
  {
    id: "d3",
    series: "s3",
    winner: "RED",
    blue: { team: "x", picks: ["pair", "star"] },
    red: { team: "z", picks: ["p"] },
  },
  { id: "d4", series: "s4", blue: { team: "x", picks: ["star"] }, red: { team: "z", picks: ["p"] } },
])
const club = teamRecords(drafted).find(({ teamId }) => teamId === "x")!

test("the heroes of a team come by the matches they were picked in, not by games", () => {
  assert.deepEqual(
    clubHeroes(club).map(({ hero, matches, games }) => [hero.key, matches, games.length]),
    [
      ["star", 3, 3],
      ["pair", 2, 3],
      ["solo", 1, 1],
    ],
  )
})

test("a lane holds what was picked for it, and knows which heroes were played elsewhere too", () => {
  const [top, jungle] = lanePicks(club)
  assert.deepEqual([top!.lane, jungle!.lane], ["TOP", "JUNGLE"])
  assert.deepEqual(
    top!.heroes.map(({ hero, matches, wins, losses, whole }) => [hero.key, matches, wins, losses, whole]),
    [
      ["star", 2, 2, 0, false],
      ["solo", 1, 1, 0, true],
      ["pair", 1, 0, 1, false],
    ],
  )
})

test("picks nobody recorded a lane for come last", () => {
  const games = club.games.map((item) => ({
    ...item,
    side: { ...item.side, picks: item.side.picks.map((pick) => ({ ...pick, lane: null })) },
  }))
  assert.deepEqual(
    lanePicks({ games }).map(({ lane }) => lane),
    [null],
  )
})

/** X bans "own" in all its games, the others "foe" against X in all of them; "all" is banned in some, and everywhere else. */
const banned = (count: number) =>
  feedOf(
    Array.from({ length: count }, (_, index): TestGame[] => [
      {
        id: `x${index}`,
        series: `s${index}`,
        blue: { team: "x", picks: five("a"), bans: ["own", ...(index < 6 ? ["all"] : [])] },
        red: { team: "y", picks: five("b"), bans: ["foe", ...(index < 6 ? ["all"] : [])] },
      },
      {
        id: `o${index}`,
        series: `t${index}`,
        blue: { team: "y", picks: five("a"), bans: ["all"] },
        red: { team: "z", picks: five("b"), bans: ["all"] },
      },
    ]).flat(),
  )
const bansOf = (feed: ReturnType<typeof feedOf>, whose: "own" | "against", size = 3) =>
  clubBans(
    feed,
    teamRecords(feed).find(({ teamId }) => teamId === "x")!,
    whose,
    size,
  ).map(({ hero, games }) => [hero.key, games])

test("the bans of a team are those it makes more than the others", () => {
  assert.deepEqual(bansOf(banned(12), "own"), [["own", 12]])
})

test("the bans made against a team are those it meets more than the others", () => {
  assert.deepEqual(bansOf(banned(12), "against"), [["foe", 12]])
})

test("a ban made once or twice tells nothing about a team", () => {
  assert.deepEqual(bansOf(banned(2), "own"), [])
})

test("a team needs fewer games of a ban where few of its games show their bans", () => {
  // Of X's 84 games four show their bans; "own" is in three of them, which 84 games would not be enough for.
  const shown = banned(4).games.map((item) =>
    item.id === "x0" ? { ...item, sides: item.sides.map((side) => ({ ...side, bans: side.bans.slice(1) })) } : item,
  )
  const silent = Array.from({ length: 80 }, (_, index) => game(`h${index}`, "s1", "BLUE"))
  const feed = feedOf(silent)
  assert.deepEqual(bansOf({ ...feed, games: [...shown, ...feed.games] }, "own"), [["own", 3]])
})

test("of the bans that stand out most, the one made most often comes first", () => {
  // "some" stands out by 3 games of 4, "often" by 4 of 4 less 2 of 6 elsewhere, "rest" by nothing.
  const bans = (index: number) => ["often", ...(index ? ["some"] : []), "rest"]
  const feed = feedOf([
    ...[0, 1, 2, 3].map((index): TestGame => ({
      id: `x${index}`,
      series: `s${index}`,
      blue: { team: "x", picks: five("a"), bans: bans(index) },
      red: { team: "y", picks: five("b"), bans: ["rest"] },
    })),
    {
      id: "o",
      series: "t",
      blue: { team: "y", picks: five("a"), bans: ["often", "rest"] },
      red: { team: "z", picks: five("b"), bans: ["often", "rest"] },
    },
  ])
  assert.deepEqual(bansOf(feed, "own"), [
    ["often", 4],
    ["some", 3],
  ])
  assert.deepEqual(bansOf(feed, "own", 1), [["some", 3]])
})

test("the lengths of a team's games carry what it won and lost in each", () => {
  const feed = feedOf([
    { ...game("l1", "s1", "BLUE"), seconds: 599 },
    { ...game("l2", "s1", "RED", 2), seconds: 600 },
    { ...game("l3", "s1", "BLUE", 3), seconds: 899 },
    game("l4", "s1", "BLUE", 4),
  ])
  assert.deepEqual(
    lengthRows(feed.games, "x").map(({ key, games, wins, losses }) => [key, games, wins, losses]),
    [
      ["9", 1, 1, 0],
      ["10", 2, 1, 1],
      ["15", 0, 0, 0],
      ["20", 0, 0, 0],
    ],
  )
})

test("players are set out by lane, those without one last", () => {
  const feed = feedOf([{ ...game("p1", "s1", "BLUE"), blue: { team: "x", picks: five("a"), players: ["ann", "bob"] } }])
  const pools = playerPools(teamRecords(feed).find(({ teamId }) => teamId === "x")!)
  const unknown = { ...pools[0]!, playerId: "cat", lane: null }
  assert.deepEqual(
    poolLanes([unknown, ...pools]).map(({ lane, pools: own }) => [lane, own.map(({ playerId }) => playerId)]),
    [
      ["TOP", ["ann"]],
      ["JUNGLE", ["bob"]],
      [null, ["cat"]],
    ],
  )
})

test("a period named by the address keeps its own stage for the order", () => {
  const { period } = feedScope(stages, "KO")
  assert.equal(period?.stage.code, "KO")
  // The final stage of the fixture has two matches nobody links, so nobody is its champion.
  assert.deepEqual(ids(clubOrder(twoStages, recordsOf(["y", "x"]), period)), ["y", "x"])
})
