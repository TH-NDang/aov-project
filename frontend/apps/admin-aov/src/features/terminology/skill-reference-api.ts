import type { QueryClient } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceSearch, ReferenceSearchPage } from "@aov/ui/lib/entity-rich-text-editor"
import { backendRequest } from "@/app/auth/session"
import type { Request } from "../publishing/publishing-api"

export interface SkillReferenceScope {
  issuer: string
  subject: string
  rulesetId: string
  locale: string
}

const staleTime = 30000
const gcTime = 60000
const prefix = ["reference-catalog", "skills"] as const
const configured = new WeakSet<QueryClient>()
function configureCache(client: QueryClient) {
  if (configured.has(client)) return
  client.setQueryDefaults(prefix, { staleTime, gcTime, retry: false })
  configured.add(client)
}
const scopeKey = (scope: SkillReferenceScope) => [scope.issuer, scope.subject, scope.rulesetId, scope.locale] as const
export const skillReferenceKeys = {
  all: prefix,
  entry: (scope: SkillReferenceScope, id: string) => [...prefix, "entry", ...scopeKey(scope), id] as const,
  search: (scope: SkillReferenceScope, owner: string, query: string, page: number) =>
    [...prefix, "search", ...scopeKey(scope), owner, query, page] as const,
}

export function createSkillReferenceApi(request: Request = backendRequest) {
  const params = (locale: string, rulesetId: string) => {
    const values = new URLSearchParams({ locale })
    if (rulesetId) values.set("rulesetId", rulesetId)
    return values
  }
  return {
    search(query: string, locale: string, rulesetId: string, page: number, signal: AbortSignal) {
      const values = params(locale, rulesetId)
      values.set("q", query.trim().slice(0, 100))
      values.set("page", String(page))
      values.set("size", "20")
      return request<ReferenceSearchPage>(`/admin/reference-skills?${values}`, { signal })
    },
    lookup(ids: readonly string[], locale: string, rulesetId: string, signal: AbortSignal) {
      const unique = [...new Set(ids)]
      if (unique.length > 50) throw new RangeError("A skill reference lookup accepts at most 50 IDs")
      if (!unique.length) return Promise.resolve({ items: [], page: 0, size: 20, totalElements: 0 })
      const values = params(locale, rulesetId)
      values.set("ids", unique.join(","))
      return request<ReferenceSearchPage>(`/admin/reference-skills?${values}`, { signal })
    },
  }
}

export const skillReferenceApi = createSkillReferenceApi()
type SkillReferenceApi = ReturnType<typeof createSkillReferenceApi>
type Waiter = {
  id: string
  signal: AbortSignal
  resolve: (value: EntityReference | null) => void
  reject: (error: unknown) => void
  done: boolean
  cancel: () => void
  abortBatch?: () => void
}
const pending = new WeakMap<QueryClient, Map<string, Waiter[]>>()

function abortReason(signal: AbortSignal) {
  return signal.reason ?? new DOMException("The request was cancelled", "AbortError")
}

function finish(waiter: Waiter, value: EntityReference | null, error?: unknown) {
  if (waiter.done) return
  waiter.done = true
  waiter.signal.removeEventListener("abort", waiter.cancel)
  if (error !== undefined) waiter.reject(error)
  else waiter.resolve(value)
}

/** Coalesce independent query observers without letting one cancelled reader abort the others. */
function batchLookup(
  client: QueryClient,
  scope: SkillReferenceScope,
  id: string,
  signal: AbortSignal,
  api: SkillReferenceApi,
) {
  if (signal.aborted) return Promise.reject(abortReason(signal))
  let queues = pending.get(client)
  if (!queues) {
    queues = new Map()
    pending.set(client, queues)
  }
  const key = JSON.stringify(scopeKey(scope))
  let queue = queues.get(key)
  if (!queue) {
    queue = []
    queues.set(key, queue)
    const current = queue
    const scopes = queues
    queueMicrotask(() => {
      scopes.delete(key)
      const active = current.filter((waiter) => !waiter.done)
      const ids = [...new Set(active.map((waiter) => waiter.id))]
      for (let from = 0; from < ids.length; from += 50) {
        const chunk = ids.slice(from, from + 50)
        const selected = new Set(chunk)
        const waiters = active.filter((waiter) => selected.has(waiter.id))
        const controller = new AbortController()
        for (const waiter of waiters)
          waiter.abortBatch = () => {
            if (waiters.every((reader) => reader.done)) controller.abort()
          }
        void api
          .lookup(chunk, scope.locale, scope.rulesetId, controller.signal)
          .then((page) => {
            const found = new Map(
              page.items
                .filter((entity) => entity.kind === "skill" && selected.has(entity.id))
                .map((entity) => [entity.id, entity]),
            )
            for (const waiter of waiters) finish(waiter, found.get(waiter.id) ?? null)
          })
          .catch((error: unknown) => {
            for (const waiter of waiters) finish(waiter, null, error)
          })
      }
    })
  }
  const currentQueue = queue
  return new Promise<EntityReference | null>((resolve, reject) => {
    const waiter: Waiter = {
      id,
      signal,
      resolve,
      reject,
      done: false,
      cancel: () => {
        finish(waiter, null, abortReason(signal))
        waiter.abortBatch?.()
      },
    }
    signal.addEventListener("abort", waiter.cancel, { once: true })
    currentQueue.push(waiter)
  })
}

export function skillReferenceEntryOptions(
  client: QueryClient,
  scope: SkillReferenceScope,
  id: string,
  api: SkillReferenceApi = skillReferenceApi,
) {
  configureCache(client)
  return {
    queryKey: skillReferenceKeys.entry(scope, id),
    queryFn: ({ signal }: { signal: AbortSignal }) => batchLookup(client, scope, id, signal, api),
    staleTime,
    gcTime,
    retry: false as const,
  }
}

/** Search keys belong to one editor; only the resulting immutable identities are shared with other readers. */
export function createSkillReferenceSearch(
  client: QueryClient,
  session: Omit<SkillReferenceScope, "locale">,
  owner: string,
  api: SkillReferenceApi = skillReferenceApi,
): EntityReferenceSearch {
  configureCache(client)
  return async ({ query, locale, page, signal }) => {
    signal.throwIfAborted()
    const scope = { ...session, locale }
    const normalized = query.trim().slice(0, 100)
    const result = await client.fetchQuery({
      queryKey: skillReferenceKeys.search(scope, owner, normalized, page),
      staleTime,
      gcTime,
      retry: false,
      queryFn: async ({ signal: cacheSignal }) => {
        const combined = AbortSignal.any([cacheSignal, signal])
        const result = await api.search(normalized, locale, session.rulesetId, page, combined)
        combined.throwIfAborted()
        for (const entity of result.items) {
          if (entity.kind === "skill") client.setQueryData(skillReferenceKeys.entry(scope, entity.id), entity)
        }
        return result
      },
    })
    signal.throwIfAborted()
    return result
  }
}
