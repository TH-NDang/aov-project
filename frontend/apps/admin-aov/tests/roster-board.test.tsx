import assert from "node:assert/strict"
import { after, test } from "node:test"
import type { DocumentView, PlayerContent, RosterMembershipContent } from "@aov/community-contracts"
import { answerConfirm, button, click, render, waitFor, withDom } from "./fixtures/dom"

withDom({ url: "http://localhost:5175/tournaments/event" })

const { tournamentApi } = await import("../src/features/tournaments/api/tournament-api")
const { RosterBoardSheet } = await import("../src/features/tournaments/components/roster-board-sheet")
const { addedLine, captainLines, goesByName, pastedNames, rosterBatchOf, rosterLines, rosterWarnings } =
  await import("../src/features/tournaments/model/roster-board-model")

const line = (id: string, more: Partial<RosterMembershipContent> = {}): DocumentView<RosterMembershipContent> => ({
  id,
  version: 3,
  createdAt: "",
  updatedAt: "",
  missingFields: [],
  content: { tournamentId: "event", teamId: "team", playerId: id, status: "ACTIVE", lane: "TOP", ...more },
})
const scope = { tournamentId: "event", teamId: "team" }
const name = (id: string) => id.toUpperCase()

test("a roster reads starters by lane, then the bench, then who left", () => {
  const lines = rosterLines([
    line("gone", { status: "INACTIVE" }),
    line("mid", { lane: "MID" }),
    line("bench", { status: "SUBSTITUTE" }),
    line("top"),
  ])

  assert.deepEqual(
    lines.map((row) => row.content.playerId),
    ["top", "mid", "bench", "gone"],
  )
})

test("an added player takes their own lane while it is free and waits on the bench otherwise", () => {
  const lines = rosterLines([line("top")])

  assert.deepEqual(
    [addedLine(lines, scope, "new", "MID"), addedLine(lines, scope, "other", "TOP"), addedLine(lines, scope, "x")].map(
      ({ content }) => [content.lane, content.status],
    ),
    [
      ["MID", "ACTIVE"],
      ["TOP", "SUBSTITUTE"],
      [null, "SUBSTITUTE"],
    ],
  )
})

test("a save writes only what changed", () => {
  const [kept, moved, dropped] = rosterLines([
    line("kept"),
    line("moved", { lane: "MID" }),
    line("dropped", { lane: "DRAGON" }),
  ])
  const batch = rosterBatchOf([
    kept!,
    { ...moved!, content: { ...moved!.content, lane: "SUPPORT" } },
    { ...dropped!, removed: true },
    addedLine([], scope, "new"),
  ])

  assert.deepEqual(
    [batch.create.map((row) => row.playerId), batch.update.map((row) => row.id), batch.remove],
    [["new"], ["moved"], [{ id: "dropped", version: 3 }]],
  )
})

test("a team has one captain: choosing another takes the crown, choosing the same one again takes it off", () => {
  const lines = rosterLines([line("one", { captain: true }), line("two", { lane: "MID" })])

  const moved = captainLines(lines, "two")

  assert.deepEqual(
    moved.map((row) => row.content.captain ?? null),
    [null, true],
  )
  assert.deepEqual(
    rosterBatchOf(moved).update.map((row) => [row.id, row.content.captain ?? null]),
    [
      ["one", null],
      ["two", true],
    ],
  )
  assert.deepEqual(
    captainLines(moved, "two").map((row) => row.content.captain ?? null),
    [null, null],
  )
})

test("two starters in a lane and lanes without one are pointed out, and only a broken line blocks the save", () => {
  const lines = rosterLines([line("one"), line("two"), line("bad", { lane: "MID", verification: "PRIMARY" })])

  const warnings = rosterWarnings(lines, name)

  assert.deepEqual(
    warnings.map((warning) => warning.blocking),
    [true, false, false],
  )
  assert.match(warnings[1]!.text, /ONE, TWO/)
  assert.match(warnings[2]!.text, /Rừng, Rồng, Trợ thủ/)
})

test("pasted names lose their numbering and repeats", () => {
  assert.deepEqual(pastedNames("1. Lai Bâng\n2) Fish, lai bang\n- Khoa"), ["lai bang", "Fish", "Khoa"])
  assert.equal(goesByName("lai bang", ["Lai Bâng"]), true)
  assert.equal(goesByName("Lai", ["Lai Bâng"]), false)
})

const original = { rosterBatch: tournamentApi.rosterBatch, read: tournamentApi.read }
const batches: Parameters<typeof tournamentApi.rosterBatch>[0][] = []
tournamentApi.rosterBatch = (async (batch) => {
  batches.push(batch)
  return { created: [], updated: [], removed: 0 }
}) as typeof tournamentApi.rosterBatch
tournamentApi.read = (async (_kind: string, id: string) => ({
  ...line(id),
  content: { code: id, name: id, region: "VN" },
})) as unknown as typeof tournamentApi.read
after(() => Object.assign(tournamentApi, original))

const players = new Map<string, PlayerContent>([
  ["one", { code: "one", nickname: "Nolan" }],
  ["two", { code: "two", nickname: "Fish" }],
])
const sheet = () =>
  render(
    <RosterBoardSheet
      teamId="team"
      team={{ code: "sgp", name: "Saigon Phantom" }}
      tournamentId="event"
      rows={[line("one"), line("two", { lane: "MID" })]}
      players={players}
      actorKey="editor"
      canWrite
      onClose={() => {}}
    />,
  )
const inGroup = (group: string, label: string) =>
  [...document.querySelectorAll(`[aria-label="${group}"] button`)].find(
    (entry) => entry.getAttribute("aria-label") === label || entry.textContent === label,
  ) as HTMLButtonElement

test("a lane and a standing change with one click each and are written together", async () => {
  batches.length = 0
  const rendered = await sheet()

  await click(inGroup("Vị trí của Nolan", "Đi rừng"), "jungle")
  await click(inGroup("Trạng thái của Fish", "Dự bị"), "bench")
  await click(button("Lưu đội hình · 2"), "save")
  await waitFor(() => batches.length === 1)

  assert.deepEqual(
    batches[0]!.update?.map((row) => [row.id, row.content.lane, row.content.status]),
    [
      ["one", "JUNGLE", "ACTIVE"],
      ["two", "MID", "SUBSTITUTE"],
    ],
  )
  await rendered.unmount()
})

test("taking someone off the roster asks first and can be taken back", async () => {
  batches.length = 0
  const rendered = await sheet()

  await click(button("Bỏ Fish khỏi đội hình"), "remove")
  await click(button("Lưu đội hình · 1"), "save")
  await waitFor(() => document.body.textContent?.includes("Bỏ 1 người khỏi đội hình?"))
  await answerConfirm("Hủy")
  assert.equal(batches.length, 0)

  await click(button("Giữ lại"), "keep")
  assert.equal(button("Lưu đội hình")?.hasAttribute("disabled"), true)
  await rendered.unmount()
})

test("the crown moves with one click and is saved with the roster", async () => {
  batches.length = 0
  const rendered = await sheet()

  await click(button("Fish là đội trưởng"), "captain")
  assert.equal(button("Fish là đội trưởng")?.getAttribute("aria-pressed"), "true")
  await click(button("Lưu đội hình · 1"), "save")
  await waitFor(() => batches.length === 1)

  assert.deepEqual(
    batches[0]!.update?.map((row) => [row.id, row.content.captain]),
    [["two", true]],
  )
  await rendered.unmount()
})
