import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import { invalidateMediaAsset, mediaKeys } from "../src/features/media/api/media-cache"
import { pageKeys } from "../src/features/community/api/page-api"
import { withGlobals } from "./fixtures/dom"

test("every view of a changed image refreshes, including views nobody listed", async () => {
  const client = new QueryClient()
  for (const view of ["detail", "content", "managed", "avatar", "contact"] as const)
    client.setQueryData(mediaKeys.assetView("head", view), { currentUrl: "/v1.webp" })
  client.setQueryData(mediaKeys.assetView("other", "content"), { currentUrl: "/other.webp" })

  await invalidateMediaAsset(client, "head")

  for (const view of ["detail", "content", "managed", "avatar", "contact"] as const)
    assert.equal(client.getQueryState(mediaKeys.assetView("head", view))?.isInvalidated, true, view)
  assert.equal(client.getQueryState(mediaKeys.assetView("other", "content"))?.isInvalidated, false)
})

test("saving a community profile refreshes the directory lists", async () => {
  const client = new QueryClient()
  const teams = pageKeys.directory.teams("actor", "", "", "NAME")
  client.setQueryData(teams, { items: [] })

  await client.invalidateQueries({ queryKey: pageKeys.all })

  assert.equal(client.getQueryState(teams)?.isInvalidated, true)
})

test("saving a tournament record refreshes everything but the deletion checks", async () => {
  // The session behind these APIs opens a channel between tabs when it loads; a test needs none.
  const [{ exceptDeletionImpact, tournamentKeys }, { competitionKeys }] = await withGlobals(
    { BroadcastChannel: undefined },
    () =>
      Promise.all([
        import("../src/features/tournaments/api/tournament-api"),
        import("../src/features/competition/competition-api"),
      ]),
  )
  const client = new QueryClient()
  const games = tournamentKeys.seriesGames("actor", "series")
  const plan = competitionKeys.plan("actor", "cup")
  const impact = tournamentKeys.deletionImpact("actor", "players", "player", 7)
  const context = tournamentKeys.catalogContext("VN", "vi-VN")
  for (const key of [games, plan, impact, context]) client.setQueryData(key, {})

  await client.invalidateQueries({ queryKey: tournamentKeys.all, predicate: exceptDeletionImpact })

  assert.equal(client.getQueryState(games)?.isInvalidated, true)
  assert.equal(client.getQueryState(plan)?.isInvalidated, true, "plans sit under the tournament keys")
  assert.equal(client.getQueryState(impact)?.isInvalidated, false)
  assert.equal(client.getQueryState(context)?.isInvalidated, false, "the Wiki seasons are not tournament data")
})
