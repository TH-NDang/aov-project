import assert from "node:assert/strict"
import { test } from "node:test"
import { useState } from "react"
import { MemoryRouter } from "react-router"
import type { Workspace, WorkspaceFocus } from "../src/features/competition/workspace/parts"
import { competition, roundRobin, stage } from "./fixtures/competition-plan"
import { button, click, render, withDom } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { ScheduleStep } = await import("../src/features/competition/workspace/schedule-step")
const { teamViewOf } = await import("../src/features/competition/workspace/parts")

/** A finished event: a league, then playoffs typed in team by team, so their matches are not joined into a bracket. */
const event = competition([
  stage("GROUP", "ROUND_ROBIN", roundRobin("G", "abcd"), { name: "Vòng bảng" }),
  stage("PO", "SINGLE_ELIMINATION", ["SF1 1: a 3-1 d", "SF2 1: b 3-2 c", "F 2: a 3-0 b"], { name: "Playoffs" }),
])

/** The schedule step as the workspace draws it, with the place inside it kept the way the address keeps it. */
function Screen({ canEdit = true }: { canEdit?: boolean }) {
  const [focus, setFocus] = useState<WorkspaceFocus>({ stage: "PO" })
  const ws = {
    entry: { id: "event", content: { standings: event.standings, resolved: event.resolved } },
    plan: event.plan,
    baseline: event.plan,
    resolved: new Map(event.resolved.map((row) => [row.key, row])),
    teams: event.teams,
    team: (id?: string | null) => teamViewOf(id ?? "", id ? event.teams[id] : undefined),
    series: [],
    rosters: [],
    games: [],
    loaded: true,
    canEdit,
    busy: false,
    dirty: false,
    focus,
    keep: (patch: WorkspaceFocus) => setFocus((current) => ({ ...current, ...patch })),
    go: () => {},
    run: () => {},
    change: () => {},
    changeAll: () => {},
  } as unknown as Workspace
  return <ScheduleStep ws={ws} />
}

const setups = () =>
  [...document.querySelectorAll("section h2")].filter((title) => /Công cụ lịch/.test(title.textContent ?? ""))
const tab = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((element) => element.textContent?.includes(name))

test("opening and closing the schedule tools again and again shows one panel at most", async () => {
  await render(<Screen />, { wrap: (node) => <MemoryRouter>{node}</MemoryRouter> })

  for (let round = 0; round < 3; round++) {
    await click(button("Công cụ lịch"), "tools button")
    assert.equal(setups().length, 1, `open, round ${round + 1}`)
    await click(button("Công cụ lịch"), "tools button")
    assert.equal(setups().length, 0, `closed, round ${round + 1}`)
  }
})

test("the tools follow the stage and close from their own header", async () => {
  await render(<Screen />, { wrap: (node) => <MemoryRouter>{node}</MemoryRouter> })

  await click(button("Công cụ lịch"), "tools button")
  await click(tab("Vòng bảng"), "league tab")
  assert.deepEqual(
    setups().map((title) => title.textContent),
    ["Công cụ lịch · Vòng bảng"],
  )
  await click(tab("Playoffs"), "playoffs tab")
  await click(button("Đóng công cụ lịch"), "close button")
  assert.equal(setups().length, 0)
  assert.equal(button("Công cụ lịch")?.getAttribute("aria-expanded"), "false")
})
