import assert from "node:assert/strict"
import { after, test } from "node:test"
import { act } from "react"
import type { DocumentView, PlannedMatch, SeriesContent } from "@aov/community-contracts"
import type { Workspace } from "../src/features/competition/workspace/parts"
import type { MatchFacts } from "../src/features/competition/model/schedule-model"
import { answerConfirm, button, click, render, type, waitFor, withDom } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { QuickResults } = await import("../src/features/competition/schedule/quick-results")

const series = (id: string, result?: SeriesContent["result"]): DocumentView<SeriesContent> => ({
  id,
  version: 2,
  createdAt: "",
  updatedAt: "",
  missingFields: [],
  content: { code: id, tournamentId: "event", teamAId: "a", teamBId: "b", bestOf: 5, result },
})
const fact = (key: string, result?: SeriesContent["result"]): MatchFacts => ({
  match: {
    key,
    stageCode: "GROUP",
    round: 1,
    bestOf: 5,
    a: { type: "TEAM", teamId: "a" },
    b: { type: "TEAM", teamId: "b" },
    seriesId: key,
  } satisfies PlannedMatch,
  row: {
    key,
    teamAId: "a",
    teamBId: "b",
    scoreA: result?.scoreA,
    scoreB: result?.scoreB,
    seriesId: key,
    consistent: true,
  },
  series: series(key, result),
  games: [],
  gamesKnown: true,
})
const rows = [
  fact("one"),
  fact("two", { scoreA: 3, scoreB: 0, sourceUrl: "https://example.org", verification: "UNVERIFIED" }),
]
const ws = {
  plan: { sourceUrl: "https://example.org/results", timezone: "Asia/Ho_Chi_Minh", matches: [], playoffSeeds: {} },
  teams: {},
  team: (id: string) => ({ id, name: id === "a" ? "Alpha" : "Beta", shortName: id }),
  resolved: new Map(rows.map((row) => [row.match.key, row.row!])),
  canEdit: true,
  busy: false,
  run: () => {},
} as unknown as Workspace

const saved: { id: string; content: SeriesContent }[] = []
const original = tournamentApi.save
tournamentApi.save = (async (_kind: string, entry: DocumentView<SeriesContent>, content: SeriesContent) => {
  saved.push({ id: entry.id, content })
  return { ...entry, content }
}) as unknown as typeof tournamentApi.save
after(() => Object.assign(tournamentApi, { save: original }))

const table = () => render(<QuickResults ws={ws} rows={rows} waiting={0} onDirtyChange={() => {}} />)
const cell = (name: string) => document.querySelector<HTMLInputElement>(`[data-cell="${name}"]`)!

test("typing a digit moves on to the next score and then to the next match", async () => {
  const rendered = await table()

  cell("0:scoreA").focus()
  await type(cell("0:scoreA"), "3")
  assert.equal(document.activeElement, cell("0:scoreB"))
  await type(cell("0:scoreB"), "1")
  assert.equal(document.activeElement, cell("1:scoreA"))
  await rendered.unmount()
})

test("a new score is saved with the source written once for all", async () => {
  saved.length = 0
  const rendered = await table()

  await type(cell("0:scoreA"), "3")
  await type(cell("0:scoreB"), "2")
  await click(button("Lưu 1 trận"), "save")
  await waitFor(() => saved.length === 1)

  assert.deepEqual(saved[0]!.content.result, {
    scoreA: 3,
    scoreB: 2,
    sourceUrl: "https://example.org/results",
    verification: "UNVERIFIED",
    verifiedOn: null,
  })
  await rendered.unmount()
})

test("replacing a score asks first, with the old and the new one", async () => {
  saved.length = 0
  const rendered = await table()

  await type(cell("1:scoreA"), "1")
  await type(cell("1:scoreB"), "3")
  await click(button("Lưu 1 trận"), "save")
  await waitFor(() => document.body.textContent?.includes("3 : 0 → 1 : 3"))
  await answerConfirm("Hủy")
  assert.equal(saved.length, 0)
  await rendered.unmount()
})

test("a score its BO does not allow stays in the table with the reason", async () => {
  saved.length = 0
  const rendered = await table()

  await type(cell("0:scoreA"), "2")
  await type(cell("0:scoreB"), "2")
  await click(button("Lưu 1 trận"), "save")

  await waitFor(() => document.body.textContent?.includes("một đội phải thắng 3 ván"))
  assert.equal(saved.length, 0)
  await rendered.unmount()
})

test("pasted lines fill the rows from the cell they were pasted in", async () => {
  const rendered = await table()

  const paste = new window.Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(paste, "clipboardData", { value: { getData: () => "3-1\n0-3" } })
  await act(async () => {
    cell("0:scoreA").dispatchEvent(paste)
  })

  assert.deepEqual(
    ["0:scoreA", "0:scoreB", "1:scoreA", "1:scoreB"].map((name) => cell(name).value),
    ["3", "1", "0", "3"],
  )
  await rendered.unmount()
})
