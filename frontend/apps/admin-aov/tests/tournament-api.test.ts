import assert from "node:assert/strict"
import { test } from "node:test"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { initialGame } from "../src/features/tournaments/tournament-model"

const channelDescriptor = Object.getOwnPropertyDescriptor(globalThis, "BroadcastChannel")
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
const { createTournamentApi, tournamentIssueFields } = await import("../src/features/tournaments/tournament-api")
const { ApiError } = await import("../src/lib/api/errors")
if (channelDescriptor) Object.defineProperty(globalThis, "BroadcastChannel", channelDescriptor)

test("publication errors expose actionable missing paths without parsing an English detail message", () => {
  const problem = {
    status: 422,
    code: "TOURNAMENT_PUBLICATION_INCOMPLETE",
    detail: "Publication is incomplete.",
    missingFields: ["sides[0].participants[0].hero.unavailableInPatch", null, 42],
  }
  assert.deepEqual(tournamentIssueFields(new ApiError(problem)), ["sides[0].participants[0].hero.unavailableInPatch"])
  assert.deepEqual(tournamentIssueFields(new Error("Unavailable")), [])
})

test("admin catalog forwards the game-specific season and patch without mutating recorded choices", async () => {
  const content = initialGame(
    "series",
    { code: "series", tournamentId: "event", teamAId: "blue", teamBId: "red", bestOf: 5 },
    1,
  )
  content.seasonId = "season-3"
  content.patchVariantId = "patch-3"
  content.includeUnscoped = true
  content.sides[0].participants[0].hero = { name: "Manually observed hero" }
  const frozen = JSON.stringify(content)
  const api = createTournamentApi(async (path) => {
    const url = new URL(path, "http://localhost")
    assert.equal(url.pathname, "/admin/catalog")
    assert.equal(url.searchParams.get("seasonId"), "season-3")
    assert.equal(url.searchParams.get("patchVariantId"), "patch-3")
    assert.equal(url.searchParams.get("includeUnscoped"), "true")
    return { heroes: [], items: [], arcana: [], enchantments: [], spells: [] } as never
  })
  await api.catalog(content)
  assert.equal(JSON.stringify(content), frozen)
})

test("a new game sends includeUnscoped, which community-service cannot leave out", () => {
  const content = initialGame(
    "series",
    { code: "series", tournamentId: "event", teamAId: "blue", teamBId: "red", bestOf: 3 },
    1,
  )
  assert.equal(JSON.parse(JSON.stringify(content)).includeUnscoped, false)
})

test("game saves preserve optimistic version, manual references and unknown observations", async () => {
  const content = initialGame(
    "series",
    { code: "series", tournamentId: "event", teamAId: "blue", teamBId: "red", bestOf: 3 },
    2,
  )
  content.sides[0].participants[0].hero = { id: null, name: "New hero not yet public in Wiki" }
  const document: DocumentView<GameContent> = {
    id: "game",
    version: 7,
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    missingFields: [],
    content,
  }
  const calls: { path: string; method?: string; body: unknown }[] = []
  const api = createTournamentApi(async (path, init) => {
    calls.push({ path, method: init?.method, body: JSON.parse(String(init?.body)) })
    return document as never
  })
  await api.save("games", document, content)
  await api.publish(document)
  await api.withdraw(document)
  assert.deepEqual(calls[0], { path: "/admin/games/game", method: "PUT", body: { version: 7, content } })
  assert.deepEqual(calls[1], { path: "/admin/games/game/publish", method: "POST", body: { version: 7 } })
  assert.deepEqual(calls[2], { path: "/admin/games/game/withdraw", method: "POST", body: { version: 7 } })
  assert.equal(content.sides[0].participants[0].arcana.status, "UNKNOWN")
})

test("series game lists request every page under the chosen series only", async () => {
  const seen: string[] = []
  const api = createTournamentApi(async (path) => {
    seen.push(path)
    const url = new URL(path, "http://localhost")
    assert.equal(url.searchParams.get("seriesId"), "series")
    return { items: [{ id: seen.length }], totalElements: 2, page: seen.length - 1, size: 100 } as never
  })
  const rows = await api.list("games", undefined, "series")
  assert.equal(rows.length, 2)
  assert.equal(seen.length, 2)
  assert.ok(seen[1].includes("page=1"))
})

test("roster list requests intersect the selected tournament, team and player without a global membership claim", async () => {
  const api = createTournamentApi(async (path) => {
    const url = new URL(path, "http://localhost")
    assert.equal(url.pathname, "/admin/roster-memberships")
    assert.equal(url.searchParams.get("tournamentId"), "event")
    assert.equal(url.searchParams.get("teamId"), "team")
    assert.equal(url.searchParams.get("playerId"), "player")
    assert.equal(url.searchParams.has("seriesId"), false)
    return { items: [], totalElements: 0, page: 0, size: 100 } as never
  })
  assert.deepEqual(
    await api.list("roster-memberships", undefined, { tournamentId: "event", teamId: "team", playerId: "player" }),
    [],
  )
})

test("record lifecycle requests preserve the reviewed version and keep trash separate from active lists", async () => {
  const calls: { path: string; method?: string; body?: unknown }[] = []
  const api = createTournamentApi(async (path, init) => {
    calls.push({ path, method: init?.method, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) })
    if (path.includes("?")) return { items: [], totalElements: 0, page: 0, size: 100 } as never
    if (path.endsWith("deletion-impact"))
      return { id: "player", version: 7, deletedAt: null, canDelete: true, usages: [] } as never
    return { id: "player", version: 8, deletedAt: "2026-10-27T00:00:00Z" } as never
  })
  await api.list("players")
  await api.list("players", undefined, { state: "DELETED" })
  await api.list("roster-memberships", undefined, { state: "ALL", teamId: "team" })
  await api.deletionImpact("players", "player")
  await api.remove("players", { id: "player", version: 7 })
  await api.restore("players", { id: "player", version: 8 })
  assert.equal(new URL(calls[0].path, "http://localhost").searchParams.has("state"), false)
  assert.equal(new URL(calls[1].path, "http://localhost").searchParams.get("state"), "DELETED")
  assert.equal(new URL(calls[2].path, "http://localhost").searchParams.get("state"), "ALL")
  assert.deepEqual(calls.slice(3), [
    { path: "/admin/players/player/deletion-impact", method: undefined },
    { path: "/admin/players/player/delete", method: "POST", body: { version: 7 } },
    { path: "/admin/players/player/restore", method: "POST", body: { version: 8 } },
  ])
})
