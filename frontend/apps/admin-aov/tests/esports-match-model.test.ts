import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import {
  applyCarry,
  lineupPlan,
  loadoutPlan,
  previousGame,
  revertCarry,
} from "../src/features/esports/model/carry-over"
import { swapSides } from "../src/features/esports/model/line-up"
import { gameTabs, openNumbers } from "../src/features/esports/model/game-tabs"
import { buildGameView } from "../src/features/esports/model/game-view"
import { matchDays, matchNeighbours } from "../src/features/esports/model/match-order"
import { commonBlocks, commonGaps, publishRows } from "../src/features/esports/model/match-publishing"
import { recordingProgress } from "../src/features/esports/model/recording-progress"
import { placeAt } from "../src/features/esports/model/playback-place"
import { layoutChapters } from "../src/features/esports/model/series-vod"
import {
  gameWinner,
  hasEveryGame,
  missingGameNumbers,
  nextGameNumber,
  presetWinners,
  quickRows,
  quickTally,
  scoreFromGames,
} from "../src/features/esports/model/series-score"
import { timingIssues } from "../src/features/esports/model/timing-issues"
import { followTool, openingTool, toolMarks, toolOfPlace } from "../src/features/esports/model/tool-state"
import { ApiError } from "../src/lib/api/errors"
import { withGlobals } from "./fixtures/dom"
import { completeGame, game, match, seat, view } from "./fixtures/match-records"

// The API client opens a channel between tabs, which would keep the test process alive.
const [{ publishGames }, { quickGame }] = await withGlobals({ BroadcastChannel: undefined }, () =>
  Promise.all([
    import("../src/features/esports/data/match-publishing"),
    import("../src/features/esports/data/quick-games"),
  ]),
)

const at = (id: string, scheduledAt?: string) => match(undefined, { scheduledAt }, id)

test("matches follow each other in time order, with those not scheduled yet at the end", () => {
  const records = [at("late", "2026-09-12T10:00:00Z"), at("open"), at("early", "2026-09-10T10:00:00Z")]
  const place = matchNeighbours(records, "late")
  assert.deepEqual([place.position, place.total, place.previous?.id, place.next?.id], [2, 3, "early", "open"])
})

test("the first match of a tournament has none before it", () => {
  assert.equal(matchNeighbours([at("only", "2026-09-10T10:00:00Z")], "only").previous, null)
})

test("the match list groups matches under the day they are played on in the reader's zone", () => {
  const days = matchDays(
    [at("night", "2026-09-10T18:30:00Z"), at("noon", "2026-09-10T05:00:00Z"), at("open")],
    "Asia/Ho_Chi_Minh",
  )
  assert.deepEqual(
    days.map((group) => [group.day, group.records.map((record) => record.id)]),
    [
      ["2026-09-10", ["noon"]],
      ["2026-09-11", ["night"]],
      [null, ["open"]],
    ],
  )
})

test("a game is won by the team that played the winning side, whatever side it was", () => {
  const swapped = swapSides(game(1, "a").content)
  assert.equal(gameWinner(match().content, swapped), "A")
})

test("swapping sides keeps each team's moments with it", () => {
  const content = game(1, null, {
    timeline: {
      pauses: [],
      events: [
        {
          id: "k",
          kind: "KILL",
          atSeconds: 60,
          killer: { side: "BLUE", lane: "MID" },
          victim: { side: "RED", lane: "TOP" },
        },
      ],
    },
  }).content
  const event = swapSides(content).timeline!.events[0]!
  assert.deepEqual([event.killer?.side, event.victim?.side], ["RED", "BLUE"])
})

test("games the score counts but nobody recorded are the missing numbers, gaps first", () => {
  assert.deepEqual(missingGameNumbers(match([3, 1]).content, [game(1), game(3)]), [2, 4])
})

test("a match without a score has no missing games", () => {
  assert.deepEqual(missingGameNumbers(match().content, []), [])
})

test("a new game takes the first number nobody recorded", () => {
  assert.equal(nextGameNumber([game(1), game(3)]), 2)
})

test("a match with every game of its score needs no other", () => {
  assert.equal(hasEveryGame(match([3, 0]).content, [game(1), game(2), game(3)]), true)
})

test("the last game of a decided match is preset to the winner of the match", () => {
  assert.deepEqual(presetWinners(match([1, 3]).content, [], [1, 2, 3, 4]), { 1: null, 2: null, 3: null, 4: "B" })
})

test("every game of a sweep is preset", () => {
  assert.deepEqual(presetWinners(match([3, 0]).content, [], [1, 2, 3]), { 1: "A", 2: "A", 3: "A" })
})

test("games left over are preset when only one team still has wins to take", () => {
  const games = [game(1, "b"), game(2, "a")]
  assert.deepEqual(presetWinners(match([3, 1]).content, games, [3, 4]), { 3: "A", 4: "A" })
})

test("a quick game names the winning team and its length and leaves the rest to be recorded", () => {
  const content = quickGame(match([3, 1]), 2, "B", 845)
  assert.equal(gameWinner(match().content, content), "B")
  assert.equal(content.durationSeconds, 845)
  assert.equal(content.sides[0]!.participants[0]!.playerId, null)
})

test("the quick entry lists recorded and missing games in order", () => {
  const rows = quickRows(match([2, 1]).content, [game(2, "b")])
  assert.deepEqual(
    rows.map((row) => [row.number, row.entry?.id ?? null, row.winner]),
    [
      [1, null, null],
      [2, "g2", "B"],
      [3, null, null],
    ],
  )
})

test("the quick entry counts recorded winners together with the ones being picked", () => {
  const rows = quickRows(match([2, 1]).content, [game(2, "b")])
  assert.deepEqual(quickTally(rows, { 1: "A", 3: null }), { scoreA: 1, scoreB: 1, open: 1 })
})

test("games that add up to another score than the match are reported", () => {
  const games = [game(1, "a"), game(2, "b"), game(3, "b"), game(4, "b")]
  assert.deepEqual(scoreFromGames(match([3, 1]).content, games), { scoreA: 1, scoreB: 3 })
})

test("games still being recorded do not contradict the score", () => {
  assert.equal(scoreFromGames(match([3, 1]).content, [game(1, "a"), game(2)]), null)
})

test("one win more than the score allows is reported before every game is recorded", () => {
  assert.deepEqual(scoreFromGames(match([1, 3]).content, [game(1, "a"), game(2, "a")]), { scoreA: 2, scoreB: 0 })
})

test("a decided match without a score takes it from its games", () => {
  const games = [game(1, "a"), game(2, "a"), game(3, "a")]
  assert.deepEqual(scoreFromGames(match().content, games), { scoreA: 3, scoreB: 0 })
})

const lineup = (number: number, ...players: [side: "BLUE" | "RED", lane: "TOP" | "MID", id: string][]) =>
  players.reduce<DocumentView<GameContent>>(
    (entry, [side, lane, playerId]) => seat(entry, side, lane, { playerId }),
    game(number),
  )

test("a line-up is taken from the previous game team by team, whatever side each plays now", () => {
  const previous = swapSides(lineup(1, ["BLUE", "MID", "azure-mid"]).content)
  const plan = lineupPlan(game(2).content, previous)
  assert.deepEqual(
    plan.fills.map((change) => [change.teamId, change.lane, change.after]),
    [["a", "MID", "azure-mid"]],
  )
})

test("a seat that names another player is a conflict, never a fill", () => {
  const plan = lineupPlan(lineup(2, ["BLUE", "MID", "sub"]).content, lineup(1, ["BLUE", "MID", "starter"]).content)
  assert.deepEqual(
    [plan.fills.length, plan.conflicts.map((change) => [change.before, change.after])],
    [0, [["sub", "starter"]]],
  )
})

test("a player already seated in another lane is not seated twice", () => {
  const plan = lineupPlan(lineup(2, ["BLUE", "TOP", "flex"]).content, lineup(1, ["BLUE", "MID", "flex"]).content)
  assert.deepEqual(plan.fills, [])
})

const spell = { id: null, name: "Flicker" }
const arcana = { status: "KNOWN" as const, entries: [], note: "seen at the start", observedAtSeconds: 12 }

test("loadouts are copied only for a player who plays again", () => {
  const previous = seat(lineup(1, ["BLUE", "MID", "azure-mid"]), "BLUE", "MID", { spell }).content
  assert.equal(loadoutPlan(lineup(2, ["BLUE", "MID", "someone-else"]).content, previous).fills.length, 0)
  assert.equal(loadoutPlan(lineup(2, ["BLUE", "MID", "azure-mid"]).content, previous).fills.length, 1)
})

test("a copied loadout leaves behind when and where the other game showed it", () => {
  const entries = [{ selection: { id: "stone", name: "Stone" }, count: 10, color: "RED" as const }]
  const previous = seat(lineup(1, ["BLUE", "MID", "p"]), "BLUE", "MID", {
    playerId: "p",
    arcana: { ...arcana, entries },
  })
  const [change] = loadoutPlan(lineup(2, ["BLUE", "MID", "p"]).content, previous.content).fills
  assert.deepEqual(change!.after, { status: "KNOWN", entries })
})

test("undoing a fill leaves a seat somebody changed meanwhile as it is", () => {
  const empty = game(2).content
  const { fills } = lineupPlan(empty, lineup(1, ["BLUE", "MID", "mid"], ["BLUE", "TOP", "top"]).content)
  const filled = applyCarry(empty, fills)
  const edited = seat({ ...game(2), content: filled }, "BLUE", "TOP", { playerId: "other" }).content
  const players = revertCarry(edited, fills).sides[0]!.participants.map((participant) => participant.playerId)
  assert.deepEqual(players, ["other", null, null, null, null])
})

test("line-ups come from the latest earlier game that names any player", () => {
  const games = [lineup(1, ["BLUE", "MID", "mid"]), game(2), game(3)]
  assert.equal(previousGame(games, 3)?.number, 1)
})

test("of two earlier games that name players the later one gives the line-up", () => {
  const games = [lineup(1, ["BLUE", "MID", "first"]), lineup(2, ["BLUE", "MID", "second"]), game(3)]
  assert.equal(previousGame(games, 3)?.number, 2)
})

test("a game never takes its line-up from itself", () => {
  const games = [lineup(1, ["BLUE", "MID", "first"]), lineup(2, ["BLUE", "MID", "second"])]
  assert.equal(previousGame(games, 2)?.number, 1)
})

test("a game with every required part is ready, one with a gap names the panel that fills it", () => {
  const rows = publishRows([completeGame(1, "a"), game(2, "b")])
  assert.deepEqual(
    rows.map((row) => row.state),
    ["ready", "blocked"],
  )
  assert.deepEqual(
    rows[1]!.steps.map((step) => step.target),
    ["draft", "draft", "loadout", "loadout", "result"],
  )
})

test("a published game is ready again only after it changed", () => {
  const publishedAt = "2026-09-02T00:00:00Z"
  const rows = publishRows([
    completeGame(1, "a", { publishedAt, updatedAt: publishedAt }),
    completeGame(2, "a", { publishedAt, updatedAt: "2026-09-03T00:00:00Z" }),
  ])
  assert.deepEqual(
    rows.map((row) => row.state),
    ["published", "ready"],
  )
})

test("a game that lacks only what nobody saw can be published and names what it lacks", () => {
  const withoutSpell = seat(completeGame(1, "a"), "RED", "TOP", { spell: { id: null, name: null } })
  const [row] = publishRows([withoutSpell])
  assert.equal(row!.state, "partial")
  assert.deepEqual(
    row!.steps.map((step) => step.id),
    ["spells"],
  )
})

test("a game without its winner or a hero cannot be published", () => {
  const complete = completeGame(1, "a")
  const open = { ...complete, content: { ...complete.content, winner: null } }
  const withoutHero = seat(completeGame(2, "b"), "RED", "TOP", { hero: { id: null, name: null } })
  assert.deepEqual(
    publishRows([open, withoutHero]).map((row) => row.state),
    ["blocked", "blocked"],
  )
})

test("the gaps of several games are counted, the one most games have first", () => {
  const withoutSpell = (number: number) =>
    seat(completeGame(number, "a"), "RED", "TOP", { spell: { id: null, name: null } })
  const withoutBoth = seat(withoutSpell(2), "RED", "TOP", { playerId: null, spell: { id: null, name: null } })
  assert.deepEqual(commonGaps(publishRows([withoutSpell(1), withoutBoth])), [
    { label: "Phụ trợ", games: 2 },
    { label: "Tuyển thủ", games: 1 },
  ])
})

test("a game that lacks only its length is not said to lack its result", () => {
  const complete = completeGame(1, "a")
  const rows = publishRows([{ ...complete, content: { ...complete.content, durationSeconds: null } }])
  assert.equal(rows[0]!.state, "partial")
  assert.deepEqual(commonGaps(rows), [{ label: "Thời lượng", games: 1 }])
})

test("games held back are listed by what holds them back, not by everything they lack", () => {
  const withoutHero = seat(completeGame(1, "a"), "RED", "TOP", {
    hero: { id: null, name: null },
    spell: { id: null, name: null },
  })
  const refused = completeGame(2, "a", { missingFields: ["sides[0].participants[2].hero.unavailableInPatch"] })
  const rows = publishRows([withoutHero, refused])
  assert.deepEqual(
    rows.map((row) => row.state),
    ["blocked", "blocked"],
  )
  assert.deepEqual(
    commonBlocks(rows, (field) => `reported: ${field.split(".").at(-1)}`),
    [
      { label: "Tướng", games: 1 },
      { label: "reported: unavailableInPatch", games: 1 },
    ],
  )
})

test("what the service reports beyond the recording steps is listed on its own", () => {
  const [row] = publishRows([
    completeGame(1, "a", {
      missingFields: ["sides[0].participants[2].hero", "sides[0].participants[2].hero.unavailableInPatch"],
    }),
  ])
  assert.deepEqual(row!.issues, ["sides[0].participants[2].hero.unavailableInPatch"])
})

test("the gap most games share comes first, though another game lacks something else first", () => {
  const withoutPlayer = seat(completeGame(1, "a"), "RED", "TOP", { playerId: null })
  const withoutSpell = (number: number) =>
    seat(completeGame(number, "a"), "RED", "TOP", { spell: { id: null, name: null } })
  assert.deepEqual(commonGaps(publishRows([withoutPlayer, withoutSpell(2), withoutSpell(3)])), [
    { label: "Phụ trợ", games: 2 },
    { label: "Tuyển thủ", games: 1 },
  ])
})

test("a game held back twice for the same reason is counted once", () => {
  const refused = completeGame(1, "a", {
    missingFields: [
      "sides[0].participants[1].hero.unavailableInPatch",
      "sides[0].participants[2].hero.unavailableInPatch",
    ],
  })
  assert.deepEqual(
    commonBlocks(publishRows([refused]), (field) => `reported: ${field.split(".").at(-1)}`),
    [{ label: "reported: unavailableInPatch", games: 1 }],
  )
})

test("a game held back by a step of its own is not also listed by what the service reports", () => {
  const reported = completeGame(1, "a", { missingFields: ["sides[0].participants[2].hero.unavailableInPatch"] })
  const withoutHero = seat(reported, "RED", "TOP", { hero: { id: null, name: null } })
  assert.deepEqual(
    commonBlocks(publishRows([withoutHero]), (field) => `reported: ${field.split(".").at(-1)}`),
    [{ label: "Tướng", games: 1 }],
  )
})

test("a game the service refuses does not stop the games after it", async () => {
  const games = [completeGame(1, "a"), completeGame(2, "b")]
  const results = await publishGames(
    {
      publish: async (entry) => {
        if (entry.content.number === 1)
          throw new ApiError({
            status: 422,
            code: "PUBLICATION_INCOMPLETE",
            ...{ missingFields: ["sides[0].participants[0].hero"] },
          })
        return entry
      },
    },
    games,
  )
  assert.deepEqual(
    results.map((result) => [result.number, result.ok, result.ok ? [] : result.fields]),
    [
      [1, false, ["sides[0].participants[0].hero"]],
      [2, true, []],
    ],
  )
})

const VIDEO = "R5rCsGqDJIg"
const teams = [
  view("a", { code: "a", name: "Azure", shortName: "AZU" }),
  view("b", { code: "b", name: "Crimson", shortName: "CRI" }),
] as Parameters<typeof buildGameView>[1]

/** The game on the video of the match. */
const onVideo = (entry: DocumentView<GameContent>, change: Partial<GameContent> = {}) => ({
  ...entry,
  content: { ...entry.content, sourceUrl: `https://youtu.be/${VIDEO}`, ...change },
})

function tabs(games: DocumentView<GameContent>[], videoId: string | null = VIDEO) {
  const chapters = layoutChapters(games, videoId)
  return gameTabs(
    games,
    chapters,
    Object.fromEntries(games.map((entry) => [entry.id, buildGameView(entry, teams, [])])),
    Object.fromEntries(games.map((entry) => [entry.id, recordingProgress(entry)])),
    timingIssues(chapters, null),
    videoId !== null,
  )
}

const publishedAt = "2026-09-02T00:00:00Z"
const placed = { sourceTimestampSeconds: 1000 }

test("the tab of a published, unchanged game carries no mark and says all of it", () => {
  const entry = { ...onVideo(completeGame(1, "a"), placed), publishedAt, updatedAt: publishedAt }
  const [tab] = tabs([entry])
  assert.equal(tab!.mark, null)
  assert.equal(tab!.name, "Ván 1, AZU thắng, 15:00, đã xuất bản")
})

test("a game changed after it was published asks for attention before anything else", () => {
  const entry = { ...onVideo(completeGame(1, "a")), publishedAt, updatedAt: "2026-09-03T00:00:00Z" }
  const [tab] = tabs([entry])
  assert.equal(tab!.mark, "attention")
  assert.match(tab!.name, /đã sửa sau khi xuất bản/)
})

test("games whose times on the video clash ask for attention", () => {
  const games = [onVideo(completeGame(1, "a"), placed), onVideo(completeGame(2, "b"), { sourceTimestampSeconds: 1500 })]
  assert.deepEqual(
    tabs(games).map((tab) => [tab.mark, /mốc video chồng ván khác/.test(tab.name)]),
    [
      ["attention", true],
      ["attention", true],
    ],
  )
})

test("a game without a place in the video of the match says so", () => {
  const [tab] = tabs([onVideo(completeGame(1, "a"))])
  assert.equal(tab!.mark, "unplaced")
  assert.match(tab!.name, /chưa đặt mốc trên video/)
})

test("a game that is being recorded says how far it is, a complete one that it waits", () => {
  const games = [onVideo(game(1), placed), onVideo(completeGame(2, "a"), { sourceTimestampSeconds: 4000 })]
  assert.deepEqual(
    tabs(games).map((tab) => tab.mark),
    ["recording", "ready"],
  )
  assert.match(tabs(games)[0]!.name, /đang ghi, 1 trên 6 mục/)
  assert.match(tabs(games)[1]!.name, /đủ dữ liệu, chờ xuất bản/)
})

test("without a video nothing is said about places in one", () => {
  assert.equal(tabs([completeGame(1, "a")], null)[0]!.mark, "ready")
})

test("the numbers a new game can take are those the score names and nobody recorded", () => {
  assert.deepEqual(openNumbers(match([3, 1]).content, [game(1), game(3)], false), [2, 4])
})

test("while a match has no score, only the next number can be taken", () => {
  assert.deepEqual(openNumbers(match().content, [game(1)], true), [2])
  assert.deepEqual(openNumbers(match().content, [game(1)], false), [])
})

const drafting = onVideo(game(1), { draft: { startSecond: 600, lockedSecond: 800, turns: [] } })
const live = onVideo(drafting, placed)
const toolAt = (second: number, gameId = "g1") => toolOfPlace(placeAt(layoutChapters([live], VIDEO), second), gameId)

test("the part on the desk follows the phase the video shows", () => {
  assert.deepEqual(
    [650, 900, 1100].map((second) => toolAt(second)),
    ["draft", "lineup", "moments"],
  )
})

test("outside the game on the desk the part that is open stays", () => {
  assert.equal(toolAt(100), null)
  assert.equal(toolAt(1100, "another"), null)
  assert.equal(followTool({ gameId: "g1", tool: "game", chosen: false }, "g1", null).tool, "game")
})

test("a part the editor chose stays until another game comes on the desk", () => {
  const chosen = { gameId: "g1", tool: "game" as const, chosen: true }
  assert.equal(followTool(chosen, "g1", "moments"), chosen)
  assert.deepEqual(followTool(chosen, "g2", "draft"), { gameId: "g2", tool: "draft", chosen: false })
})

test("without a video a game opens with the part it is recorded up to", () => {
  const opening = (entry: DocumentView<GameContent>) => openingTool(entry.content, layoutChapters([entry], null)[0]!)
  assert.equal(opening(game(1)), "draft")
  assert.equal(opening(completeGame(1, "a")), "lineup")
})

const marks = (entry: DocumentView<GameContent>, recording = true) => {
  const [chapter] = layoutChapters([entry], VIDEO)
  return toolMarks(entry.content, chapter!, recordingProgress(entry), 0, { recording, followed: false })
}

test("the parts of a game say what lacks only once it should be there, and only while recording", () => {
  const withoutSpell = seat(onVideo(completeGame(1, "a"), placed), "RED", "TOP", { spell: { id: null, name: null } })
  assert.equal(marks(withoutSpell).lineup.lacks, "thiếu phụ trợ")
  assert.equal(marks(withoutSpell, false).lineup.lacks, null)
  assert.equal(marks(onVideo(game(1))).lineup.lacks, null, "before the draft nothing is late")
})

test("a game that has ended without a winner says that it lacks one", () => {
  const ended = onVideo(completeGame(1, "a"), { ...placed, winner: null })
  assert.equal(marks(ended).game.lacks, "thiếu đội thắng")
  assert.equal(marks(onVideo(game(1), placed)).game.lacks, null, "a game that is played has no end yet")
})
