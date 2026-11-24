import { queryOptions } from "@tanstack/react-query"
import type { ReferenceKind, ReferenceNames, ReferencePreview } from "@aov/community-contracts"
import type { RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import type { WikiMode } from "./reference-model"
import { communityRequest, wikiPublicRequest } from "./stream-api"

/** Every query key of references in texts; reads and invalidation both use these. */
export const referenceKeys = {
  names: ["references"] as const,
  people: ["references", "people"] as const,
  preview: (kind: ReferenceKind, id: string) => ["references", "preview", kind, id] as const,
  wiki: (locale: string) => ["references", "wiki", locale] as const,
  modes: ["references", "modes"] as const,
}

/** Lists change with a publication; an hour-old one still finds its names, so a page never waits for a newer one. */
const LIST = { staleTime: 5 * 60_000, gcTime: 60 * 60_000, retry: 1, refetchOnWindowFocus: false } as const

/** Circuits, organizations, published competitions and their teams. */
export const referenceNamesQuery = queryOptions({
  ...LIST,
  queryKey: referenceKeys.names,
  queryFn: ({ signal }) => communityRequest<ReferenceNames>("/references", { signal }),
  meta: { storedAnswer: "stream-references@1" },
})

/** Players and personnel, three quarters of all names: read only for a text that may name one. */
export const referencePeopleQuery = queryOptions({
  ...LIST,
  queryKey: referenceKeys.people,
  queryFn: ({ signal }) => communityRequest<ReferenceNames>("/references/people", { signal }),
  meta: { storedAnswer: "stream-reference-people@1" },
})

export const referencePreviewQuery = (kind: ReferenceKind, id: string) =>
  queryOptions({
    queryKey: referenceKeys.preview(kind, id),
    queryFn: ({ signal }) =>
      communityRequest<ReferencePreview>(`/references/${kind}/${encodeURIComponent(id)}`, { signal }),
    staleTime: 5 * 60_000,
    retry: 1,
  })

/** The Wiki's own reference catalog, as its pages read it. */
export const wikiCatalogQuery = (locale: string) =>
  queryOptions({
    ...LIST,
    queryKey: referenceKeys.wiki(locale),
    queryFn: async ({ signal }) =>
      (
        await wikiPublicRequest<{ settings: RichTextSettings }>(
          `/reference-catalog?${new URLSearchParams({ region: "VN", locale })}`,
          { signal },
        )
      ).settings.entities,
    meta: { storedAnswer: "stream-wiki-references@1" },
  })

export const wikiModesQuery = queryOptions({
  ...LIST,
  queryKey: referenceKeys.modes,
  queryFn: async ({ signal }) => (await wikiPublicRequest<{ items: WikiMode[] }>("/game-modes", { signal })).items,
  meta: { storedAnswer: "stream-wiki-modes@1" },
})
