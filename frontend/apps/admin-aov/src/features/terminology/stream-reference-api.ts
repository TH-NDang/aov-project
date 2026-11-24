import { queryOptions } from "@tanstack/react-query"
import type { ReferenceKind, ReferenceNames, ReferencePreview } from "@aov/community-contracts"
import type { RichTextSettings } from "@aov/ui/lib/entity-rich-text"
import type { WikiMode } from "@aov/ui/lib/running-text-names"
import { backendRequest, communityRequest } from "@/app/auth/session"

/** The public lists Stream finds names in; an unpublished record is in none of them. */
export const streamReferenceKeys = {
  names: ["stream-references", "names"] as const,
  people: ["stream-references", "people"] as const,
  catalog: (locale: string) => ["stream-references", "catalog", locale] as const,
  modes: ["stream-references", "modes"] as const,
  preview: (kind: ReferenceKind, id: string) => ["stream-references", "preview", kind, id] as const,
}

const LIST = { staleTime: 60_000, retry: 1 } as const

/** Circuits, organizations, published competitions and their teams. */
export const streamNamesQuery = queryOptions({
  ...LIST,
  queryKey: streamReferenceKeys.names,
  queryFn: ({ signal }) => communityRequest<ReferenceNames>("/references", { signal }),
})

/** Players and personnel. */
export const streamPeopleQuery = queryOptions({
  ...LIST,
  queryKey: streamReferenceKeys.people,
  queryFn: ({ signal }) => communityRequest<ReferenceNames>("/references/people", { signal }),
})

/** What a reader sees of a record before opening it, its logo among it. */
export const streamPreviewQuery = (kind: ReferenceKind, id: string) =>
  queryOptions({
    queryKey: streamReferenceKeys.preview(kind, id),
    queryFn: ({ signal }) =>
      communityRequest<ReferencePreview>(`/references/${kind}/${encodeURIComponent(id)}`, { signal }),
    staleTime: 5 * 60_000,
    retry: 1,
  })

/** The Wiki's published catalog, which Stream links game entries from. */
export const streamCatalogQuery = (locale: string) =>
  queryOptions({
    ...LIST,
    queryKey: streamReferenceKeys.catalog(locale),
    queryFn: async ({ signal }) =>
      (
        await backendRequest<{ settings: RichTextSettings }>(
          `/reference-catalog?${new URLSearchParams({ region: "VN", locale })}`,
          { signal },
        )
      ).settings.entities,
  })

export const streamModesQuery = queryOptions({
  ...LIST,
  queryKey: streamReferenceKeys.modes,
  queryFn: async ({ signal }) => (await backendRequest<{ items: WikiMode[] }>("/game-modes", { signal })).items,
})
