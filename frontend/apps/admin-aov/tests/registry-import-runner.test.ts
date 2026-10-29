import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView } from "@aov/community-contracts"
import {
  parseRegistryImport,
  type ImportContent,
  type ImportKind,
} from "../src/features/tournaments/registry-import-model"

const channelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
const { prepareRegistryImport, runRegistryImport, RegistryImportFailure } =
  await import("../src/features/tournaments/registry-import-runner")
if (channelDescriptor) Object.defineProperty(globalThis, "BroadcastChannel", channelDescriptor)
type Api = NonNullable<Parameters<typeof prepareRegistryImport>[1]>
type Row = DocumentView<ImportContent>
function document(id: string, content: object, deleted = false): Row {
  return {
    id,
    version: 5,
    createdAt: "",
    updatedAt: "",
    missingFields: [],
    deletedAt: deleted ? "2026-10-27T00:00:00Z" : null,
    content: content as ImportContent,
  }
}
function fakeApi(seed: Partial<Record<ImportKind, Row[]>> = {}) {
  const records: Record<ImportKind, Row[]> = {
    teams: [],
    players: [],
    tournaments: [],
    "roster-memberships": [],
    series: [],
    ...structuredClone(seed),
  }
  const writes: { kind: ImportKind; type: string; id: string; version: number }[] = []
  let serial = 0
  const find = (kind: ImportKind, id: string) => {
    const value = records[kind].find((entry) => entry.id === id)
    assert.ok(value, id)
    return value
  }
  const api = {
    list: async (kind: ImportKind, _signal: unknown, filters: unknown) => {
      assert.deepEqual(filters, { state: "ALL" })
      return structuredClone(records[kind])
    },
    read: async (kind: ImportKind, id: string) => structuredClone(find(kind, id)),
    restore: async (kind: ImportKind, entry: Row) => {
      const stored = find(kind, entry.id)
      assert.equal(entry.version, stored.version)
      assert.ok(stored.deletedAt)
      writes.push({ kind, type: "restore", id: stored.id, version: entry.version })
      stored.version++
      stored.deletedAt = null
      return { id: stored.id, version: stored.version, deletedAt: null }
    },
    save: async (kind: ImportKind, entry: Row, content: ImportContent) => {
      const stored = find(kind, entry.id)
      assert.equal(entry.version, stored.version)
      assert.equal(stored.deletedAt, null)
      writes.push({ kind, type: "save", id: stored.id, version: entry.version })
      stored.version++
      stored.content = structuredClone(content)
      return structuredClone(stored)
    },
    create: async (kind: ImportKind, content: ImportContent) => {
      const stored = document(`created-${++serial}`, content)
      writes.push({ kind, type: "create", id: stored.id, version: 0 })
      records[kind].push(stored)
      return structuredClone(stored)
    },
  } as unknown as Api
  return { api, records, writes }
}
const payload = () =>
  parseRegistryImport(
    JSON.stringify({
      schemaVersion: 1,
      scope: { eventCode: "event" },
      teams: [{ content: { code: "blue", name: "Blue", logoUrl: null } }, { content: { code: "red", name: "Red" } }],
      players: [{ content: { code: "player", nickname: "Player", fullName: null, photoUrl: null } }],
      tournament: { content: { code: "event", name: "Event", region: "VN", logoUrl: null } },
      rosters: [
        {
          teamCode: "blue",
          playerCode: "player",
          content: { lane: null, status: "UNKNOWN", verification: "UNVERIFIED" },
        },
      ],
      series: [
        {
          tournamentCode: "event",
          teamACode: "blue",
          teamBCode: "red",
          content: {
            code: "final",
            bestOf: 7,
            result: {
              scoreA: 4,
              scoreB: 0,
              sourceUrl: "https://source.example/final",
              verification: "SECONDARY_CAPTURE",
            },
          },
        },
      ],
    }),
  )

test("preview performs no writes; import restores only payload matches, preserves media, resolves UUIDs and resumes idempotently", async () => {
  const { api, records, writes } = fakeApi({
    teams: [
      document("blue-id", { code: "blue", name: "Old Blue", logoUrl: "https://img.example/blue.webp" }),
      document("red-id", { code: "red", name: "Old Red" }, true),
      document("unrelated", { code: "outside", name: "Other" }, true),
    ],
    players: [
      document(
        "player-id",
        {
          code: "player",
          nickname: "Old Player",
          fullName: "Unsourced old name",
          photoUrl: "https://img.example/player.webp",
        },
        true,
      ),
    ],
    tournaments: [
      document(
        "event-id",
        { code: "event", name: "Old Event", region: "VN", logoUrl: "https://img.example/event.webp" },
        true,
      ),
    ],
    "roster-memberships": [
      document(
        "membership-id",
        {
          tournamentId: "event-id",
          teamId: "blue-id",
          playerId: "player-id",
          lane: "MID",
          status: "UNKNOWN",
          verification: "UNVERIFIED",
        },
        true,
      ),
    ],
  })
  const plan = payload()
  const preview = await prepareRegistryImport(plan, api)
  assert.deepEqual(writes, [])
  assert.equal(preview.filter((entry) => entry.operation === "restore").length, 4)
  assert.equal(preview.find((entry) => entry.row.kind === "roster-memberships")?.operation, "restore")
  assert.deepEqual(await runRegistryImport(plan, { api }), { completed: 6, stopped: false })
  assert.equal(
    (records.teams.find((entry) => entry.id === "blue-id")!.content as { logoUrl: string }).logoUrl,
    "https://img.example/blue.webp",
  )
  assert.equal((records.players[0].content as { photoUrl: string }).photoUrl, "https://img.example/player.webp")
  assert.equal((records.players[0].content as { fullName: unknown }).fullName, null)
  assert.equal((records.tournaments[0].content as { logoUrl: string }).logoUrl, "https://img.example/event.webp")
  assert.ok(records.teams.find((entry) => entry.id === "unrelated")?.deletedAt)
  const member = records["roster-memberships"][0]
  assert.equal(member.id, "membership-id")
  assert.equal((member.content as { teamId: string }).teamId, "blue-id")
  assert.deepEqual(
    writes.filter((entry) => entry.id === "membership-id").map((entry) => [entry.type, entry.version]),
    [
      ["restore", 5],
      ["save", 6],
    ],
  )
  assert.equal((records.series[0].content as { teamBId: string }).teamBId, "red-id")
  const written = writes.length
  assert.deepEqual(await runRegistryImport(plan, { api }), { completed: 6, stopped: false })
  assert.equal(writes.length, written)
  assert.ok((await prepareRegistryImport(plan, api)).every((entry) => entry.operation === "skip"))
})

test("missing or deleted parents outside the payload fail preview without restoring extra records", async () => {
  const { api, writes } = fakeApi({
    teams: [document("blue", { code: "blue", name: "Blue" }, true), document("red", { code: "red", name: "Red" })],
    tournaments: [document("event", { code: "event", name: "Event", region: "VN" })],
  })
  const plan = payload()
  plan.rows = plan.rows.filter((row) => row.kind === "series")
  await assert.rejects(prepareRegistryImport(plan, api), /blue.*mục cha/)
  assert.deepEqual(writes, [])
})

test("first failure stops later writes and rerun matches completed rows instead of duplicating them", async () => {
  const { api, writes } = fakeApi()
  const create = api.create
  let fail = true
  api.create = async (kind, content) => {
    if (kind === "players" && fail) throw new Error("Temporary failure")
    return create(kind, content)
  }
  const plan = payload()
  await assert.rejects(
    runRegistryImport(plan, { api }),
    (error: unknown) => error instanceof RegistryImportFailure && error.completed === 2 && error.row.kind === "players",
  )
  assert.deepEqual(
    writes.map((entry) => entry.kind),
    ["teams", "teams"],
  )
  fail = false
  await runRegistryImport(plan, { api })
  assert.equal(writes.filter((entry) => entry.kind === "teams" && entry.type === "create").length, 2)
  assert.equal(writes.filter((entry) => entry.kind === "players").length, 1)
})

test("pause is observed between complete records and a changed post-restore version stops before save", async () => {
  const first = fakeApi()
  let stop = false
  assert.deepEqual(
    await runRegistryImport(payload(), {
      api: first.api,
      shouldStop: () => stop,
      onProgress: () => {
        stop = true
      },
    }),
    { completed: 1, stopped: true },
  )
  assert.equal(first.writes.length, 1)
  const second = fakeApi({ teams: [document("blue", { code: "blue", name: "Old Blue" }, true)] })
  const read = second.api.read
  second.api.read = async (kind, id) => {
    const entry = await read(kind, id)
    if (!entry.deletedAt) entry.version++
    return entry
  }
  await assert.rejects(
    runRegistryImport(payload(), { api: second.api }),
    (error: unknown) => error instanceof RegistryImportFailure && error.completed === 0,
  )
  assert.deepEqual(
    second.writes.map((entry) => entry.type),
    ["restore"],
  )
})

test("backend defaults and omitted nullable result fields do not cause repeated updates", async () => {
  const { api, writes } = fakeApi({
    teams: [document("blue-id", { code: "blue", name: "Blue", aliases: [], logoUrl: null })],
    tournaments: [
      document("event-id", {
        code: "event",
        name: "Event",
        region: "VN",
        tier: "UNKNOWN",
        competitionType: "UNKNOWN",
        venueMode: "UNKNOWN",
        status: "UNKNOWN",
      }),
    ],
  })
  const plan = parseRegistryImport(
    JSON.stringify({
      schemaVersion: 1,
      teams: [{ content: { code: "blue", name: "Blue", aliases: null, logoUrl: null } }],
      tournament: {
        content: {
          code: "event",
          name: "Event",
          region: "VN",
          tier: null,
          competitionType: null,
          venueMode: null,
          status: null,
        },
      },
    }),
  )
  assert.ok((await prepareRegistryImport(plan, api)).every((entry) => entry.operation === "skip"))
  await runRegistryImport(plan, { api })
  assert.deepEqual(writes, [])
  const results = fakeApi({
    teams: [document("blue", { code: "blue", name: "Blue" }), document("red", { code: "red", name: "Red" })],
    tournaments: [document("event", { code: "event", name: "Event", region: "VN" })],
    series: [
      document("final", {
        code: "final",
        tournamentId: "event",
        teamAId: "blue",
        teamBId: "red",
        bestOf: 7,
        result: {
          scoreA: 4,
          scoreB: 0,
          sourceUrl: "https://source.example/final",
          verification: "UNVERIFIED",
          verifiedOn: null,
        },
      }),
    ],
  })
  const seriesPlan = parseRegistryImport(
    JSON.stringify({
      schemaVersion: 1,
      series: [
        {
          tournamentCode: "event",
          teamACode: "blue",
          teamBCode: "red",
          content: {
            code: "final",
            bestOf: 7,
            result: { scoreA: 4, scoreB: 0, sourceUrl: "https://source.example/final", verification: null },
          },
        },
      ],
    }),
  )
  assert.equal((await prepareRegistryImport(seriesPlan, results.api))[0].operation, "skip")
  await runRegistryImport(seriesPlan, { api: results.api })
  assert.deepEqual(results.writes, [])
})
