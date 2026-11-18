import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import { invalidateMediaAsset, mediaKeys } from "../src/features/media/api/media-cache"
import { directoryKeys } from "../src/features/community/directory/directory-api"
import { pageKeys } from "../src/features/community/api/page-api"

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
  client.setQueryData([...directoryKeys, "actor", "teams", "", "NAME"], { items: [] })

  await client.invalidateQueries({ queryKey: pageKeys })

  assert.equal(client.getQueryState([...directoryKeys, "actor", "teams", "", "NAME"])?.isInvalidated, true)
})
