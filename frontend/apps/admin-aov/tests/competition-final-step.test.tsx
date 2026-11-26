import assert from "node:assert/strict"
import { after, beforeEach, test } from "node:test"
import type { DocumentView, TournamentContent, TournamentPlacement } from "@aov/community-contracts"
import type { Workspace, WorkspaceFocus } from "../src/features/competition/workspace/parts"
import { competition, roundRobin, stage, type TestStage } from "./fixtures/competition-plan"
import { answerConfirm, button, click, confirmDialog, render, waitFor, withDom } from "./fixtures/dom"
import { tournamentRow } from "./fixtures/tournament-list-data"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { finalOutcome } = await import("../src/features/competition/workspace/final-state")
const { FinalStep } = await import("../src/features/competition/workspace/final-step")

const saved: TournamentContent[] = []
const went: [string, WorkspaceFocus | undefined][] = []
const { save, list } = tournamentApi
tournamentApi.list = (async () => []) as unknown as typeof list
tournamentApi.save = (async (_kind: string, entry: DocumentView<TournamentContent>, content: TournamentContent) => {
  saved.push(content)
  return { ...entry, content }
}) as unknown as typeof save
after(() => Object.assign(tournamentApi, { save, list }))
beforeEach(() => {
  saved.length = 0
  went.length = 0
})

const knockout = (...lines: string[]) => stage("Playoffs", "SINGLE_ELIMINATION", lines)
const played = [knockout("SF1 1: a 3-1 c", "SF2 1: b 3-2 d", "F 2: a 4-2 b")]
const line = (place: string, teamId: string, more: Partial<TournamentPlacement> = {}): TournamentPlacement => ({
  place,
  teamId,
  teamName: teamId.toUpperCase(),
  ...more,
})
const result = (winnerName: string) =>
  ({
    winnerName,
    runnerUpName: "B",
    winnerScore: 4,
    runnerUpScore: 2,
    sourceUrl: "https://example.org/final",
    verification: "UNVERIFIED",
  }) as TournamentContent["result"]

/** The step of a finished tournament. */
function step(stages: TestStage[], content: Partial<TournamentContent> = {}, canEdit = true) {
  const tournament = tournamentRow("event", "Giải", content)
  const { plan, resolved, standings, teams } = competition(stages)
  const ws = {
    entry: { id: "event", content: { players: {}, tournament: tournament.content } },
    plan,
    teams,
    team: (id: string) => ({ id, name: teams[id]?.name ?? id, shortName: id }),
    rosters: [],
    canEdit,
    go: (to: string, focus?: WorkspaceFocus) => went.push([to, focus]),
  } as unknown as Workspace
  const outcome = finalOutcome({ tournament: tournament.content, plan, resolved, standings, teams })
  return render(<FinalStep ws={ws} tournament={tournament} outcome={outcome} />)
}

const text = () => document.body.textContent ?? ""
const tableRows = () => [...document.querySelectorAll<HTMLElement>("tr[data-state]")]

test("the result and the places stand before the awards", async () => {
  await step(played, { result: result("A"), awards: [{ title: "MVP", recipientName: "Nguyễn" }] })

  const order = ["Vô địch", "Á quân", "Điền 4 thứ hạng", "Thua bán kết", "Nguyễn"].map((part) => text().indexOf(part))
  assert.ok(!order.includes(-1))
  assert.deepEqual([order[0]! < order[4]!, order[2]! < order[4]!, order[3]! < order[4]!], [true, true, true])
})

test("every team shows its place, its last match and why the matches place it there", async () => {
  await step(played)

  assert.deepEqual(
    tableRows().map((row) => row.dataset.state),
    ["MISSING", "MISSING", "MISSING", "MISSING"],
  )
  const last = tableRows().at(-1)!.textContent ?? ""
  for (const part of ["3–4", "D", "2–3", "Thua bán kết"]) assert.ok(last.includes(part), part)
})

test("what is missing is said beside the result", async () => {
  await step(played, { result: result("A") })

  const needs = document.querySelector('[aria-label="Những gì bước này cần"]')
  assert.deepEqual(
    [...needs!.querySelectorAll("li")].map((item) => item.textContent),
    ["Kết quả khớp các trận", "4 gợi ý chưa điền", "Chưa có giải thưởng"],
  )
})

test("places the table lacks are filled at once, without prizes", async () => {
  await step(played, { placements: [line("1", "a", { prizeUsd: 1000 })] })

  await click(button("Điền 3 thứ hạng"), "fill")
  await waitFor(() => saved.length === 1)

  assert.equal(confirmDialog(), null)
  assert.deepEqual(
    saved[0]!.placements!.map(({ place, teamId, prizeUsd }) => [place, teamId, prizeUsd]),
    [
      ["1", "a", 1000],
      ["2", "b", null],
      ["3-4", "c", null],
      ["3-4", "d", null],
    ],
  )
})

test("filling keeps the awards and everything else of the tournament", async () => {
  const awards = [{ title: "MVP", recipientName: "Nguyễn" }]
  await step(played, { awards, note: "Ghi chú", result: result("A") })

  await click(button("Điền 4 thứ hạng"), "fill")
  await waitFor(() => saved.length === 1)

  assert.deepEqual([saved[0]!.awards, saved[0]!.note, saved[0]!.result], [awards, "Ghi chú", result("A")])
})

const swapped = { placements: [line("1", "a"), line("2", "b"), line("3", "c", { prizeUsd: 300 }), line("5", "d")] }

test("a place the matches contradict is replaced only after a question that names the old and the new one", async () => {
  await step(played, swapped)

  await click(button("Thay 1 hạng lệch"), "replace")
  const dialog = await waitFor(confirmDialog)
  assert.match(dialog.textContent ?? "", /D: hạng 5.*hạng 3–4/)
  await answerConfirm("Thay 1 hạng")
  await waitFor(() => saved.length === 1)

  assert.deepEqual(
    saved[0]!.placements!.map(({ place, teamId, prizeUsd }) => [place, teamId, prizeUsd ?? null]),
    [
      ["1", "a", null],
      ["2", "b", null],
      ["3", "c", 300],
      ["3-4", "d", null],
    ],
  )
})

test("nothing is written when the question is answered with no", async () => {
  await step(played, swapped)

  await click(button("Thay 1 hạng lệch"), "replace")
  await answerConfirm("Hủy")

  assert.equal(saved.length, 0)
})

test("a champion the matches contradict is told, and nothing can be filled in", async () => {
  await step(played, { result: result("C") })

  assert.ok(text().includes("Kết quả đã ghi là C vô địch, còn các trận cho thấy A."))
  assert.equal(button("Điền"), undefined)
})

test("an old result that names another champion is told while the places can still be filled", async () => {
  await step(played, { placements: [line("1", "a"), line("2", "b")], result: result("D") })

  assert.ok(text().includes("Kết quả nhập trước đây ghi D vô địch, còn bảng thứ hạng ghi A."))
  assert.ok(button("Điền 2 thứ hạng"))
})

test("teams nothing places are listed with the reason", async () => {
  const lines = roundRobin("G", "abcde").map((entry) => (entry.startsWith("Gde") ? "Gde 1: d - e" : entry))
  await step([stage("Vòng bảng", "ROUND_ROBIN", lines), ...played])

  assert.ok(text().includes("Chưa rõ hạng của 1 đội. Vòng bảng còn 1 trận chưa có tỷ số."))
})

test("a stage that leaves teams level opens for the rule that parts them", async () => {
  const group = stage("Vòng bảng", "ROUND_ROBIN", roundRobin("G", "abcdefg", ["ge"]))
  await step([group, ...played])

  await click(button("Mở thể thức"), "open the format")

  assert.deepEqual(went, [["format", { stage: "Vòng bảng", open: "stage" }]])
})

test("someone who may not edit sees the places and no buttons", async () => {
  await step(played, {}, false)

  assert.equal(tableRows().length, 4)
  assert.equal(button("Điền"), undefined)
})

test("a save that fails says why and keeps the button", async () => {
  const working = tournamentApi.save
  tournamentApi.save = (async () => {
    throw new Error("down")
  }) as unknown as typeof save
  try {
    await step(played)
    await click(button("Điền 4 thứ hạng"), "fill")
    await waitFor(() => document.querySelector('[role="alert"]'))
    assert.ok(button("Điền 4 thứ hạng"))
  } finally {
    tournamentApi.save = working
  }
})
