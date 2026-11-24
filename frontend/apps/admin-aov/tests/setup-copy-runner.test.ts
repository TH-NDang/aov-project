import assert from "node:assert/strict"
import { test } from "node:test"
import type { CompetitionPlan, TournamentContent } from "@aov/community-contracts"
import { withGlobals } from "./fixtures/dom"

const { copySetup, missingParts, setupFinished } = await withGlobals(
  { BroadcastChannel: undefined },
  () => import("../src/features/tournaments/model/setup-copy-runner"),
)
type Api = Parameters<typeof copySetup>[0]["api"]

const plan = (over: Partial<CompetitionPlan> = {}): CompetitionPlan => ({
  circuit: "",
  organizer: "",
  timezone: "Asia/Ho_Chi_Minh",
  prizePool: "",
  currency: "VND",
  sourceUrl: "",
  notes: "",
  venues: [],
  entrants: [],
  stages: [],
  playoffSeeds: {},
  matches: [],
  ...over,
})
const line = (teamId: string, playerId: string) => ({ tournamentId: "old", teamId, playerId })

/** Two tournaments in memory, the old one set up; `log` keeps every write with the version it was made at. */
function service(fail: { plan?: boolean; rosters?: boolean; people?: boolean } = {}) {
  const plans: Record<string, CompetitionPlan> = {
    old: plan({ organizer: "Garena", entrants: [{ teamId: "flash", status: "REGISTERED", note: "" }] }),
    new: plan(),
  }
  const records: Record<string, TournamentContent> = {
    old: {
      code: "old",
      name: "Old",
      region: "VN",
      staff: [{ teamId: "flash", pageId: "coach", role: "COACH" }] as TournamentContent["staff"],
      broadcast: [{ pageId: "caster" }] as TournamentContent["broadcast"],
    },
    new: { code: "new", name: "New", region: "VN" },
  }
  const rosters: Record<string, unknown[]> = { old: [line("flash", "adc"), line("other", "mid")], new: [] }
  const log: string[] = []
  let version = 1
  const api = {
    competition: {
      read: async (id: string) => ({ id, version, content: { plan: plans[id] } }),
      save: async (entry: { id: string; version: number }, content: CompetitionPlan) => {
        if (fail.plan) throw new Error("plan")
        log.push(`plan@${entry.version}`)
        plans[entry.id] = content
        version++
      },
    },
    tournament: {
      list: async (_kind: string, _signal: unknown, filters: { tournamentId: string }) =>
        rosters[filters.tournamentId]!.map((content) => ({ content })),
      read: async (_kind: string, id: string) => ({ id, version, content: records[id] }),
      save: async (_kind: string, entry: { id: string; version: number }, content: TournamentContent) => {
        if (fail.people) throw new Error("people")
        log.push(`people@${entry.version}`)
        records[entry.id] = content
      },
      rosterBatch: async (batch: { create?: unknown[] }) => {
        if (fail.rosters) throw new Error("rosters")
        log.push(`rosters ${batch.create?.length}`)
        rosters.new!.push(...(batch.create ?? []))
        version++
      },
    },
  } as unknown as Api
  return { api, log, plans, records, rosters }
}
const everything = new Set(["info", "entrants", "rosters", "stages", "staff", "broadcast"] as const)
const states = (outcomes: Awaited<ReturnType<typeof copySetup>>) =>
  Object.fromEntries(outcomes.map((row) => [row.part, row.state]))

test("a setup is copied plan first, then rosters, then people, each write at the version read just before", async () => {
  const { api, log, plans, records, rosters } = service()
  const outcomes = await copySetup({ targetId: "new", sourceId: "old", parts: everything, api })
  assert.ok(setupFinished(outcomes))
  assert.deepEqual(log, ["plan@1", "rosters 1", "people@3"])
  assert.equal(plans.new!.organizer, "Garena")
  assert.deepEqual(
    rosters.new!.map((row) => (row as { playerId: string }).playerId),
    ["adc"],
    "only players of the teams taken over",
  )
  assert.equal(records.new!.staff?.length, 1)
  assert.equal(records.new!.broadcast?.length, 1)
})

test("without its teams a setup skips rosters and staff and still copies the broadcast crew", async () => {
  const { api, log } = service({ plan: true })
  const outcomes = await copySetup({ targetId: "new", sourceId: "old", parts: everything, api })
  assert.deepEqual(states(outcomes), {
    info: "failed",
    entrants: "failed",
    rosters: "skipped",
    stages: "failed",
    staff: "skipped",
    broadcast: "done",
  })
  assert.deepEqual(log, ["people@1"])
})

test("failed rosters name their reason and leave the other parts copied", async () => {
  const { api } = service({ rosters: true })
  const outcomes = await copySetup({ targetId: "new", sourceId: "old", parts: everything, api })
  const rosters = outcomes.find((row) => row.part === "rosters")!
  assert.equal((rosters.error as Error).message, "rosters")
  assert.deepEqual([rosters.count, rosters.total], [0, 1])
  assert.deepEqual([...missingParts(outcomes)], ["rosters"])
})

test("another try copies only what is missing and repeats no roster line", async () => {
  const failing = service({ people: true })
  const first = await copySetup({ targetId: "new", sourceId: "old", parts: everything, api: failing.api })
  const again = await copySetup({
    targetId: "new",
    sourceId: "old",
    parts: new Set([...missingParts(first), "rosters"]),
    api: failing.api,
  })
  assert.equal(states(again).rosters, "done")
  assert.equal(failing.rosters.new!.length, 1)
  assert.deepEqual(failing.log, ["plan@1", "rosters 1"], "nothing already copied is written again")
})
