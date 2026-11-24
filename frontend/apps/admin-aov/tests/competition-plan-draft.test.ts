import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionPlan, PlannedMatch, TournamentContent } from "@aov/community-contracts"
import {
  changedDraft,
  draftChanges,
  planDraft,
  redoneDraft,
  restoredPlan,
  undoneDraft,
} from "../src/features/competition/model/plan-draft"
import { copiedRoster, planWithCopy, tournamentWithCopy } from "../src/features/competition/model/copy-setup"
import {
  duplicatedStage,
  freeStageCode,
  movedStage,
  templateStages,
} from "../src/features/competition/model/stage-templates"

const match = (key: string, more: Partial<PlannedMatch> = {}): PlannedMatch => ({
  key,
  stageCode: "GROUP",
  round: 1,
  bestOf: 5,
  a: { type: "TEAM", teamId: "a" },
  b: { type: "TEAM", teamId: "b" },
  ...more,
})
const entrant = (teamId: string, status = "REGISTERED") => ({ teamId, status, note: "" })
const plan = (more: Partial<CompetitionPlan> = {}): CompetitionPlan => ({
  circuit: "",
  organizer: "",
  timezone: "Asia/Ho_Chi_Minh",
  prizePool: "",
  currency: "VND",
  sourceUrl: "https://example.org",
  notes: "",
  venues: [],
  entrants: [entrant("a"), entrant("b")],
  stages: templateStages("LEAGUE_KNOCKOUT", ""),
  playoffSeeds: {},
  matches: [match("M1")],
  ...more,
})
const named = (id: string) => id.toUpperCase()

test("an undone change comes back with redo", () => {
  const first = planDraft(plan())
  const changed = changedDraft(first, plan({ notes: "New" }), "notes", 0)

  const undone = undoneDraft(changed)

  assert.equal(undone.plan.notes, "")
  assert.equal(redoneDraft(undone).plan.notes, "New")
})

test("quick typing in one field is one step back, and another field is a step of its own", () => {
  let draft = planDraft(plan())
  draft = changedDraft(draft, { ...draft.plan, notes: "N" }, "notes", 1000)
  draft = changedDraft(draft, { ...draft.plan, notes: "Ne" }, "notes", 1400)
  draft = changedDraft(draft, { ...draft.plan, prizePool: "5" }, "prizePool", 1500)

  assert.equal(draft.past.length, 2)
  assert.equal(undoneDraft(undoneDraft(draft)).plan.notes, "")
})

test("a change that changes nothing adds no step", () => {
  const draft = planDraft(plan())

  assert.equal(changedDraft(draft, plan(), "notes", 0), draft)
})

test("a new change after an undo drops what could have been redone", () => {
  const changed = changedDraft(planDraft(plan()), plan({ notes: "A" }), "notes", 0)

  const next = changedDraft(undoneDraft(changed), plan({ notes: "B" }), "notes", 5000)

  assert.equal(next.future.length, 0)
})

test("the changes waiting to be saved are worded by step", () => {
  const before = plan()
  const after = plan({
    prizePool: "100",
    entrants: [entrant("b"), entrant("a", "WITHDRAWN"), entrant("c")],
    stages: [before.stages[1]!, before.stages[0]!],
    matches: [match("M1", { scheduledAt: "2026-11-24T05:00:00Z" }), match("M2")],
  })

  assert.deepEqual(
    draftChanges(before, after, named).map((change) => [change.step, change.text]),
    [
      ["overview", "Quỹ giải thưởng đã đổi"],
      ["teams", "Thêm đội: C"],
      ["teams", "Đổi trạng thái: A"],
      ["teams", "Đổi thứ tự đội"],
      ["format", "Đổi thứ tự giai đoạn"],
      ["schedule", "Thêm 1 trận"],
      ["schedule", "Đổi giờ 1 trận"],
    ],
  )
})

test("a plan brought back keeps the matches that became real since, with their stage and teams", () => {
  const past = plan({ entrants: [entrant("a")], stages: [templateStages("KNOCKOUT", "")[0]!], matches: [] })
  const current = plan({ matches: [match("M1", { seriesId: "s1" }), match("M2")] })

  const restored = restoredPlan(current, past)

  assert.deepEqual(
    restored.matches.map((row) => row.key),
    ["M1"],
  )
  assert.ok(restored.stages.some((stage) => stage.code === "GROUP"))
  assert.ok(restored.entrants.some((entry) => entry.teamId === "b"))
})

test("a copied setup takes the teams and stages over without their withdrawn teams and game updates", () => {
  const source = plan({
    entrants: [entrant("b"), entrant("c"), entrant("d", "WITHDRAWN")],
    stages: [{ ...templateStages("KNOCKOUT", "")[0]!, patches: [{ label: "Week 1" }], teamIds: ["b"] }],
  })
  const copied = planWithCopy(plan({ matches: [] }), source, new Set(["entrants", "stages"] as const))

  assert.deepEqual(
    copied.entrants.map((entry) => entry.teamId),
    ["a", "b", "c"],
  )
  assert.deepEqual(
    copied.stages.map((stage) => [stage.code, stage.patches, stage.teamIds, stage.sourceUrl]),
    [["PLAYOFF", [], [], "https://example.org"]],
  )
})

test("a copied roster leaves out who left, who is listed already and the old source", () => {
  const line = (playerId: string, status: "ACTIVE" | "INACTIVE") => ({
    tournamentId: "old",
    teamId: "a",
    playerId,
    status,
    sourceUrl: "https://example.org/roster",
    verification: "PRIMARY" as const,
  })

  const copied = copiedRoster([line("p1", "ACTIVE"), line("p2", "INACTIVE"), line("p3", "ACTIVE")], "new", [
    { tournamentId: "new", teamId: "a", playerId: "p3" },
  ])

  assert.deepEqual(
    copied.map((row) => [row.tournamentId, row.playerId, row.sourceUrl, row.verification]),
    [["new", "p1", null, "UNVERIFIED"]],
  )
})

test("staff is copied for the teams taken over, and nobody is listed twice", () => {
  const coach = { teamId: "a", pageId: "p", role: "COACH" as const }
  const content = { code: "new", name: "New", region: "VN", staff: [coach] } as TournamentContent
  const source = { ...content, staff: [coach, { ...coach, pageId: "q" }, { ...coach, teamId: "z" }] }

  const copied = tournamentWithCopy(content, source, new Set(["staff"] as const), new Set(["a"]))

  assert.deepEqual(
    copied.staff?.map((row) => row.pageId),
    ["p", "q"],
  )
})

test("a duplicated stage has a code of its own and no teams of its own", () => {
  const base = plan()

  const copy = duplicatedStage(base, { ...base.stages[0]!, teamIds: ["a"] })

  assert.equal(copy.code, "GROUP_2")
  assert.deepEqual(copy.teamIds, [])
})

test("a stage code never repeats one a stage or a match already uses", () => {
  assert.equal(freeStageCode(plan({ matches: [match("M1", { stageCode: "STAGE_2" })] })), "STAGE_3")
})

test("a stage moves by one place and stays where it has nowhere to go", () => {
  const { stages } = plan()

  assert.deepEqual(
    movedStage(stages, "PLAYOFF", -1).map((stage) => stage.code),
    ["PLAYOFF", "GROUP"],
  )
  assert.equal(movedStage(stages, "GROUP", -1), stages)
})
