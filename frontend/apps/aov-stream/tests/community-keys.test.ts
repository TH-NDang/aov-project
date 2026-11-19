import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import { communityKeys, refreshPostLists } from "../src/lib/community-keys.ts"

function cacheWith(...keys: readonly (readonly unknown[])[]) {
  const client = new QueryClient()
  for (const key of keys) client.setQueryData(key, { items: [] })
  return client
}

const stale = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated

test("changing a post refreshes the page's post counts, post search and video highlights", async () => {
  const counts = communityKeys.pagePostCount("p1")
  const videos = communityKeys.pagePostCount("p1", "VIDEO")
  const search = communityKeys.postSearch("airi")
  const client = cacheWith(counts, videos, search, communityKeys.videoHighlights)

  await refreshPostLists(client)

  assert.equal(stale(client, counts), true)
  assert.equal(stale(client, videos), true)
  assert.equal(stale(client, search), true)
  assert.equal(stale(client, communityKeys.videoHighlights), true)
})

test("changing a post refreshes the page's posts and the home feed", async () => {
  const posts = communityKeys.pagePosts(1, "p1", false, undefined)
  const feed = communityKeys.feed(true, undefined, 1)
  const client = cacheWith(posts, feed)

  await refreshPostLists(client)

  assert.equal(stale(client, posts), true)
  assert.equal(stale(client, feed), true)
})

test("changing a post leaves page profiles and notifications alone", async () => {
  const page = communityKeys.publicPage("p1")
  const inbox = communityKeys.inbox(1, 10)
  const client = cacheWith(page, inbox)

  await refreshPostLists(client)

  assert.equal(stale(client, page), false)
  assert.equal(stale(client, inbox), false)
})
