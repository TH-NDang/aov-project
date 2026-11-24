import { useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ReferenceName } from "@aov/community-contracts"
import { publicSiteUrl } from "@aov/ui/lib/public-site-url"
import { runningTextReferences } from "@aov/ui/lib/running-text"
import { useResolvedTheme } from "@/app/theme"
import { publicSite } from "@/features/community/api/page-api"
import { createStreamIconResolver } from "./stream-icons"
import { streamCatalogQuery, streamModesQuery, streamNamesQuery, streamPeopleQuery } from "./stream-reference-api"

/** Players and personnel have no pictures; the mark of their kind stands for them. */
const withLogo = (name: ReferenceName) => ({ ...name, iconAssetId: name.id })

/** What Stream recognizes in a text, read from the same public lists. Names of the game join when the Wiki answers. */
export function useStreamReferences(locale: string) {
  const names = useQuery(streamNamesQuery)
  const people = useQuery(streamPeopleQuery)
  const catalog = useQuery(streamCatalogQuery(locale))
  const modes = useQuery(streamModesQuery)
  const references = useMemo(
    () =>
      names.data &&
      runningTextReferences({
        names: [...names.data.items.map(withLogo), ...(people.data?.items ?? [])],
        catalog: catalog.data ?? [],
        modes: modes.data ?? [],
        locale,
        streamUrl: publicSite,
        wikiUrl: publicSiteUrl(import.meta.env?.VITE_WIKI_URL, 5173, window.location.origin),
      }),
    [names.data, people.data, catalog.data, modes.data, locale],
  )
  const failed = [names, people, catalog, modes].filter((query) => query.isError)
  const client = useQueryClient()
  const darkTheme = useResolvedTheme() === "dark"
  const resolveIcon = useMemo(() => createStreamIconResolver(client, darkTheme), [client, darkTheme])

  return {
    references,
    resolveIcon,
    loading: names.isPending || people.isPending,
    failed: failed.length > 0,
    retry: () => void Promise.all(failed.map((query) => query.refetch())),
  }
}
