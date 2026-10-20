import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { Request } from "../src/features/publishing/publishing-api"

const originalChannel = globalThis.BroadcastChannel
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: undefined })
const { createReferenceCatalogApi, referenceCatalogKeys, invalidateReferenceCatalog } =
  await import("../src/features/terminology/reference-api")
const { invalidateHeroCatalogs } = await import("../src/features/publishing/publishing-cache")
const { invalidateWarehouseCatalogs } = await import("../src/features/warehouse/warehouse-api")
Object.defineProperty(globalThis, "BroadcastChannel", { configurable: true, writable: true, value: originalChannel })

const entities: EntityReference[] = [
  {
    id: "hero-id",
    kind: "hero",
    iconAssetId: "head-id",
    translations: [
      { locale: "vi-VN", name: "Airi", aliases: [], description: "Ninja rồng" },
      { locale: "en-US", name: "Airi", aliases: [], description: "Dragon ninja" },
    ],
    destinations: { admin: "/hero/hero-id?revision=draft-id" },
  },
  ...(["item", "enchantment", "arcana", "spell"] as const).map((kind) => ({
    id: `${kind}-id`,
    kind,
    iconAssetId: `${kind}-icon`,
    autoMatch: false,
    translations: [{ locale: "vi-VN", name: kind, aliases: [], description: "" }],
  })),
]

test("reference catalog needs one compact request for all domains and preserves translations and asset IDs", async () => {
  const calls: { path: string; signal?: AbortSignal | null }[] = []
  const request: Request = async <T>(path: string, init?: RequestInit) => {
    calls.push({ path, signal: init?.signal })
    return { rulesetId: "standard", items: entities } as T
  }
  const api = createReferenceCatalogApi(request)
  const abort = new AbortController()
  assert.deepEqual(await api.list("", abort.signal), entities)
  assert.deepEqual(calls, [{ path: "/admin/reference-catalog", signal: abort.signal }])
  await api.list("c8d51323-aa2c-4685-bc73-48a62697afef")
  assert.equal(calls[1].path, "/admin/reference-catalog?rulesetId=c8d51323-aa2c-4685-bc73-48a62697afef")
  assert.equal(calls.length, 2, "No hero previews, ruleset catalogs or media metadata are fetched")
})

test("concurrent consumers share one request while accounts and rulesets have distinct cache entries", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300000 } } })
  let requests = 0
  const api = createReferenceCatalogApi(async <T>() => {
    requests++
    await Promise.resolve()
    return { items: entities } as T
  })
  const read = (issuer: string, subject: string, ruleset: string) =>
    client.fetchQuery({
      queryKey: referenceCatalogKeys.catalog(issuer, subject, ruleset),
      queryFn: ({ signal }) => api.list(ruleset, signal),
    })
  try {
    await Promise.all([read("realm", "editor", "standard"), read("realm", "editor", "standard")])
    await read("realm", "editor", "standard")
    assert.equal(requests, 1)
    await read("realm", "editor", "regional")
    await read("realm", "other-editor", "standard")
    await read("other-realm", "editor", "standard")
    assert.equal(requests, 4)
  } finally {
    client.clear()
  }
})

test("hero and warehouse changes invalidate compact references without expiring unrelated assets", async () => {
  const client = new QueryClient()
  const keys = [
    referenceCatalogKeys.catalog("realm", "editor", "standard"),
    referenceCatalogKeys.catalog("realm", "editor", "regional"),
  ]
  try {
    for (const refresh of [invalidateHeroCatalogs, invalidateWarehouseCatalogs]) {
      for (const key of keys) client.setQueryData(key, entities)
      client.setQueryData(["publishing-asset", "head-id"], { currentUrl: "/head.webp" })
      await refresh(client)
      for (const key of keys) assert.equal(client.getQueryState(key)?.isInvalidated, true)
      assert.equal(client.getQueryState(["publishing-asset", "head-id"])?.isInvalidated, false)
    }
  } finally {
    client.clear()
  }
})

test("invalidation cancels an older active catalog read before refreshing it", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const key = referenceCatalogKeys.catalog("realm", "editor", "standard")
  client.setQueryData(key, entities)
  let reads = 0
  let oldSignal: AbortSignal | undefined
  let finishOld: ((value: EntityReference[]) => void) | undefined
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: ({ signal }) => {
      reads++
      if (reads === 1) {
        oldSignal = signal
        return new Promise<EntityReference[]>((resolve) => {
          finishOld = resolve
        })
      }
      return Promise.resolve([{ ...entities[0], translations: [{ ...entities[0].translations[0], name: "Updated" }] }])
    },
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await invalidateReferenceCatalog(client)
    assert.equal(oldSignal?.aborted, true)
    assert.equal(reads, 2)
    finishOld?.(entities)
    await Promise.resolve()
    assert.equal(client.getQueryData<EntityReference[]>(key)?.[0].translations[0].name, "Updated")
  } finally {
    unsubscribe()
    client.clear()
  }
})
