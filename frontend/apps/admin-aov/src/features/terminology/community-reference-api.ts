import type { QueryClient } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceSearch, ReferenceSearchPage } from "@aov/ui/lib/entity-rich-text-editor"
import { communityRequest } from "@/app/auth/session"
import type { Request } from "../publishing/publishing-api"
import { ApiError } from "@/lib/api/errors"

export type CommunityReferenceKind = "team" | "player"
export type CommunityReferenceScope = { issuer: string; subject: string; locale: string }
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i
const prefix = ["community", "tournaments", "references"] as const
const pageSize = 20
export const communityReferenceKeys = {
  all: prefix,
  catalog: (issuer: string | undefined, subject: string | undefined) =>
    [...prefix, "catalog", issuer, subject] as const,
  lookup: (scope: CommunityReferenceScope, ids: readonly string[]) =>
    [...prefix, "lookup", scope.issuer, scope.subject, scope.locale, ids] as const,
  search: (
    scope: CommunityReferenceScope,
    owner: string,
    query: string,
    kind: CommunityReferenceKind | undefined,
    page: number,
  ) => [...prefix, "search", scope.issuer, scope.subject, scope.locale, owner, query, kind, page] as const,
}

export function extractCommunityReferenceIds(text: string) {
  const ids = new Set<string>()
  for (const match of text.slice(0, 100000).matchAll(/<ref=(?:team|player):([^<>]+)>[^<>]*<\/ref>/gi)) {
    if (uuid.test(match[1]!)) ids.add(match[1]!)
    if (ids.size >= 500) break
  }
  return [...ids].sort()
}

export function createCommunityReferenceApi(request: Request = communityRequest) {
  const page = async (params: URLSearchParams, signal?: AbortSignal) => {
    const response = await request<ReferenceSearchPage>(`/admin/reference-catalog?${params}`, { signal })
    return { ...response, items: response.items.filter((entity) => entity.kind === "team" || entity.kind === "player") }
  }
  return {
    async catalog(signal?: AbortSignal) {
      const items: EntityReference[] = []
      let totalElements = 0
      for (let current = 0; current < 5; current++) {
        const response = await page(new URLSearchParams({ page: String(current), size: "100" }), signal)
        items.push(...response.items)
        totalElements = response.totalElements
        if (!response.items.length || items.length >= totalElements) break
      }
      return { items, totalElements }
    },
    search(query: string, kind: CommunityReferenceKind | undefined, current: number, signal: AbortSignal) {
      const params = new URLSearchParams({
        q: query.trim().slice(0, 100),
        page: String(current),
        size: String(pageSize),
      })
      if (kind) params.set("kind", kind.toUpperCase())
      return page(params, signal).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 403)
          return { items: [], page: current, size: pageSize, totalElements: 0 }
        throw error
      })
    },
    lookup(ids: readonly string[], signal: AbortSignal) {
      const unique = [...new Set(ids)]
      if (unique.length > 50 || unique.some((id) => !uuid.test(id)))
        throw new RangeError("A community reference lookup accepts at most 50 UUIDs")
      if (!unique.length) return Promise.resolve({ items: [], totalElements: 0, page: 0, size: 50 })
      return page(new URLSearchParams({ ids: unique.join(","), page: "0", size: "50" }), signal)
    },
  }
}
export const communityReferenceApi = createCommunityReferenceApi()

export function createCommunityReferenceSearch(
  client: QueryClient,
  actor: Omit<CommunityReferenceScope, "locale">,
  owner: string,
  api = communityReferenceApi,
) {
  return async (
    { query, locale, page, signal }: Parameters<EntityReferenceSearch>[0],
    kind?: CommunityReferenceKind,
  ) => {
    const scope = { ...actor, locale }
    signal.throwIfAborted()
    const result = await client.fetchQuery({
      queryKey: communityReferenceKeys.search(scope, owner, query, kind, page),
      staleTime: 30000,
      gcTime: 60000,
      retry: false,
      queryFn: ({ signal: cacheSignal }) => api.search(query, kind, page, AbortSignal.any([cacheSignal, signal])),
    })
    signal.throwIfAborted()
    return result
  }
}

/** Combine two paged sources without losing a short page at the boundary. */
export function combineReferenceSearches(
  first: EntityReferenceSearch,
  second: EntityReferenceSearch,
): EntityReferenceSearch {
  return async (request) => {
    const initial = await first({ ...request, page: 0 })
    const offset = request.page * pageSize
    const fromFirst = Math.min(pageSize, Math.max(0, initial.totalElements - offset))
    const items: EntityReference[] = []
    if (fromFirst) {
      const current = request.page === 0 ? initial : await first(request)
      items.push(...current.items.slice(0, fromFirst))
    }
    const secondOffset = Math.max(0, offset - initial.totalElements)
    const secondPage = Math.floor(secondOffset / pageSize)
    const relative = secondOffset % pageSize
    const remaining = pageSize - items.length
    const initialSecond = await second({ ...request, page: remaining ? secondPage : 0 })
    if (remaining) {
      const selected = initialSecond.items.slice(relative, relative + remaining)
      items.push(...selected)
      if (selected.length < remaining && (secondPage + 1) * pageSize < initialSecond.totalElements) {
        const next = await second({ ...request, page: secondPage + 1 })
        items.push(...next.items.slice(0, remaining - selected.length))
      }
    }
    return {
      items,
      page: request.page,
      size: pageSize,
      totalElements: initial.totalElements + initialSecond.totalElements,
    }
  }
}
