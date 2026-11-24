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
import { matchDays, matchNeighbours } from "../src/features/esports/model/match-order"
import { publishRows } from "../src/features/esports/model/match-publishing"
import { recordingProgress } from "../src/features/esports/model/recording-progress"
import { recordingTools } from "../src/features/esports/model/recording-tools"
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
import { ApiError } from "../src/lib/api/errors"
import { withGlobals } from "./fixtures/dom"
import { completeGame, game, match, seat } from "./fixtures/match-records"

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

test("a game with every required part is ready, one with a gap names the panel that fills it", () => {
  const rows = publishRows([completeGame(1, "a"), game(2, "b")])
  assert.deepEqual(
    rows.map((row) => row.state),
    ["ready", "blocked"],
  )
  assert.deepEqual(
    rows[1]!.steps.map((step) => step.target),
    ["draft", "draft", "draft", "loadout", "result"],
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

test("what the service reports beyond the recording steps is listed on its own", () => {
  const [row] = publishRows([
    completeGame(1, "a", {
      missingFields: ["sides[0].bans[1]", "sides[0].participants[2].hero.unavailableInPatch"],
    }),
  ])
  assert.deepEqual(row!.issues, ["sides[0].participants[2].hero.unavailableInPatch"])
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

test("the panel to open next is the first one whose required data is not complete", () => {
  assert.equal(recordingTools(recordingProgress(game(1))).next, "draft")
  const withoutSpells = seat(completeGame(1, "a"), "RED", "TOP", { spell: { id: null, name: null } })
  assert.equal(recordingTools(recordingProgress(withoutSpells)).next, "loadout")
})

test("a complete game points at the last look before publishing, a published one at nothing", () => {
  assert.equal(recordingTools(recordingProgress(completeGame(1, "a"))).next, "progress")
  const publishedAt = "2026-09-02T00:00:00Z"
  const published = completeGame(1, "a", { publishedAt, updatedAt: publishedAt })
  assert.equal(recordingTools(recordingProgress(published)).next, null)
})
