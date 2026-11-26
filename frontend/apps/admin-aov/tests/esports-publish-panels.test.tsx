import assert from "node:assert/strict"
import { after, test } from "node:test"
import type { DocumentView, GameContent, Participant } from "@aov/community-contracts"
import {
  answerConfirm,
  button,
  click,
  confirmDialog,
  QuietResizeObserver,
  render,
  waitFor,
  withDom,
} from "./fixtures/dom"
import { completeGame, game, team } from "./fixtures/match-records"

withDom({
  url: "http://localhost:5175/tournaments/t/matches/s",
  globals: () => ({ ResizeObserver: QuietResizeObserver, CSS: { escape: (value: string) => value } }),
})

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { MatchPublishPanel } = await import("../src/features/esports/pages/match-publish-panel")
const { ProgressPanel } = await import("../src/features/esports/pages/progress-panel")
const { buildGameView } = await import("../src/features/esports/model/game-view")
const { commonBlocks, publishRows } = await import("../src/features/esports/model/match-publishing")
const { recordingProgress } = await import("../src/features/esports/model/recording-progress")

const { publish, read } = tournamentApi
after(() => Object.assign(tournamentApi, { publish, read }))

/** A complete game with every seat changed alike. */
const everySeat = (entry: DocumentView<GameContent>, change: Partial<Participant>): DocumentView<GameContent> => ({
  ...entry,
  content: {
    ...entry.content,
    sides: entry.content.sides.map((side) => ({
      ...side,
      participants: side.participants.map((participant) => ({ ...participant, ...change })),
    })),
  },
})
const withoutSpells = (number: number) => everySeat(completeGame(number, "b"), { spell: null })
const step = (entry: DocumentView<GameContent>, id: string) =>
  recordingProgress(entry).steps.find((own) => own.id === id)!

test("a game without bans, players or spells can be published, those parts read as unknown", () => {
  const unseen = everySeat(completeGame(1, "a"), { playerId: undefined, spell: null })
  const entry = {
    ...unseen,
    content: { ...unseen.content, sides: unseen.content.sides.map((side) => ({ ...side, bans: [] })) },
  }
  const progress = recordingProgress(entry)

  assert.equal(progress.publishable, true)
  assert.deepEqual(
    progress.steps
      .filter((own) => ["bans", "players", "spells"].includes(own.id))
      .map((own) => [own.id, own.status, !!own.blocks]),
    [
      ["bans", "todo", false],
      ["players", "todo", false],
      ["spells", "todo", false],
    ],
  )
})

test("what is saved within two seconds of publishing is the publication itself, and later it is an edit", () => {
  const at = (milliseconds: number) =>
    recordingProgress({
      ...completeGame(1, "a"),
      publishedAt: "2026-09-01T00:00:00.000Z",
      updatedAt: new Date(Date.parse("2026-09-01T00:00:00Z") + milliseconds).toISOString(),
    }).state

  assert.deepEqual([at(1999), at(2001)], ["confirmed", "changed"])
})

test("a draft with every turn is done only once it is locked", () => {
  const turns = Array.from({ length: 18 }, (_, at) => ({
    order: at + 1,
    kind: "BAN" as const,
    side: "BLUE" as const,
    hero: { id: null, name: `Hero ${at}` },
    atSecond: 100 + at,
  }))
  const drafted = (lockedSecond: number | null) =>
    step(
      {
        ...completeGame(1, "a"),
        content: { ...completeGame(1, "a").content, draft: { startSecond: 90, lockedSecond, turns } },
      },
      "draft",
    ).status

  assert.deepEqual([drafted(null), drafted(200)], ["partial", "done"])
})

test("emblems the broadcast showed for some players and did not show for the others are done", () => {
  const half = completeGame(1, "a")
  const entry = {
    ...half,
    content: {
      ...half.content,
      sides: half.content.sides.map((side) => ({
        ...side,
        participants: side.participants.map((participant) => ({
          ...participant,
          enchantments: { status: side.side === "BLUE" ? ("KNOWN" as const) : ("NOT_SHOWN" as const), entries: [] },
        })),
      })),
    },
  }

  assert.equal(step(entry, "enchantments").status, "done")
})

test("players and items are counted by those recorded, not by the seats", () => {
  const entry = everySeat(completeGame(1, "a"), { playerId: undefined })

  assert.deepEqual([step(entry, "players").detail, step(entry, "items").detail], ["0/10", "0/10"])
})

test("the games of a match are listed by their number, and five players a side are not asked for twice", () => {
  const short = {
    ...game(1, "a"),
    missingFields: ["sides[0].participants.five", "sides[0].participants[0].hero", "number.exceedsBestOf"],
  }
  const rows = publishRows([completeGame(3, "a"), short, completeGame(2, "b")])

  assert.deepEqual(
    rows.map(({ number }) => number),
    [1, 2, 3],
  )
  assert.deepEqual(rows[0]!.issues, ["number.exceedsBestOf"])
  assert.deepEqual(
    commonBlocks(rows, (field) => field),
    [{ label: "Tướng", games: 1 }],
  )
})

test("the spinner stands on the action of the group being published", async () => {
  const games = [completeGame(1, "a"), withoutSpells(2)]
  let release = () => {}
  tournamentApi.read = (async (_kind: string, id: string) => games.find((entry) => entry.id === id)) as typeof read
  tournamentApi.publish = (entry) => new Promise((resolve) => (release = () => resolve(entry)))
  await render(
    <MatchPublishPanel games={games} team={team} canPublish beforePublish={async () => {}} onOpenStep={() => {}} />,
  )
  await click(button("Xuất bản 1 ván còn thiếu"))
  await answerConfirm("Xuất bản 1 ván")

  await waitFor(() => button("Xuất bản 1 ván còn thiếu")?.querySelector(".animate-spin"))
  assert.equal(button("Xuất bản 1 ván đủ dữ liệu")?.querySelector(".animate-spin"), null)
  release()
})

test("the question before publishing a game that lacks only its length names the length", async () => {
  const entry = { ...completeGame(1, "a"), content: { ...completeGame(1, "a").content, durationSeconds: null } }
  await render(
    <ProgressPanel
      progress={recordingProgress(entry)}
      game={buildGameView(entry, [], [])}
      content={entry.content}
      canPublish
      onOpen={() => {}}
      onConfirm={async () => true}
    />,
  )
  await click(button("Xuất bản ván 1"))

  const question = await waitFor(confirmDialog)
  assert.match(question.textContent ?? "", /chưa rõ: thời lượng\./)
})
