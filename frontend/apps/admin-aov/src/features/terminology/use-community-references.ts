import { useId, useMemo, useSyncExternalStore } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { referenceSearchGroup, type EntityReferenceSearch } from "@aov/ui/lib/entity-rich-text-editor"
import { getSession, subscribeSession } from "@/app/auth/session"
import {
  communityReferenceApi,
  communityReferenceKeys,
  combineReferenceSearches,
  createCommunityReferenceSearch,
  extractCommunityReferenceIds,
} from "./community-reference-api"
import { useSkillReferenceSearch } from "./use-skill-references"

const empty: EntityReference[] = []
const collect = (queries: readonly { data?: { items: EntityReference[] } }[]) =>
  queries.flatMap((entry) => entry.data?.items ?? empty)

/** Saved identity tokens are resolved independently of the first catalog page. */
export function useCommunityReferences(text: string, locale: string): EntityReference[] {
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const chunks = useMemo(() => {
    const ids = extractCommunityReferenceIds(text)
    return Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => ids.slice(index * 50, index * 50 + 50))
  }, [text])
  const scope = { issuer: session.actor?.issuer ?? "", subject: session.actor?.subject ?? "", locale }
  return useQueries({
    queries: chunks.map((ids) => ({
      queryKey: communityReferenceKeys.lookup(scope, ids),
      queryFn: ({ signal }: { signal: AbortSignal }) => communityReferenceApi.lookup(ids, signal),
      enabled: !!session.actor,
      staleTime: 30000,
      gcTime: 60000,
      retry: false,
    })),
    combine: collect,
  })
}

export function useReferenceSearch(rulesetId = ""): EntityReferenceSearch {
  const client = useQueryClient()
  const owner = useId()
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const skillSearch = useSkillReferenceSearch(rulesetId)
  return useMemo(() => {
    if (!session.actor) return async ({ page }) => ({ items: [], page, size: 20, totalElements: 0 })
    const community = createCommunityReferenceSearch(
      client,
      { issuer: session.actor.issuer, subject: session.actor.subject },
      owner,
    )
    const available =
      (search: EntityReferenceSearch): EntityReferenceSearch =>
      async (request) => {
        try {
          return await search(request)
        } catch {
          request.signal.throwIfAborted()
          return { items: [], page: request.page, size: 20, totalElements: 0 }
        }
      }
    const combined = combineReferenceSearches(
      available(skillSearch),
      available((request) => community(request)),
    )
    return async (request) => {
      const { kind, needle } = referenceSearchGroup(request.query)
      if (kind === "team" || kind === "player") return community({ ...request, query: needle }, kind)
      if (kind && kind !== "skill") return { items: [], page: request.page, size: 20, totalElements: 0 }
      return kind === "skill" ? skillSearch(request) : combined(request)
    }
  }, [client, owner, skillSearch, session.actor?.issuer, session.actor?.subject])
}
