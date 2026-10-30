import { useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { getSession, subscribeSession } from "@/app/auth/session"
import { referenceCatalogApi, referenceCatalogKeys } from "@/features/terminology/reference-api"
import { useRecords } from "@/features/esports/data/use-esports-data"

/** Page tab label with the hero's name, read from the same reference catalog cache the pages use. */
export function HeroCrumb({ heroId, fallback }: { heroId?: string; fallback: string }) {
  const session = useSyncExternalStore(subscribeSession, getSession, getSession)
  const catalog = useQuery({
    queryKey: referenceCatalogKeys.catalog(session.actor?.issuer, session.actor?.subject, ""),
    queryFn: ({ signal }) => referenceCatalogApi.list("", signal),
    enabled: !!session.actor && !!heroId,
    staleTime: 300000,
    retry: false,
  })
  const hero = catalog.data?.find((entry) => entry.kind === "hero" && (entry.heroId ?? entry.id) === heroId)
  const name = hero?.translations.find((text) => text.locale === "vi-VN")?.name ?? hero?.translations[0]?.name
  return <>{name ?? fallback}</>
}

/** Page tab label with the tournament's name once the tournament list is loaded. */
export function TournamentCrumb({ tournamentId, fallback }: { tournamentId?: string; fallback: string }) {
  const tournaments = useRecords("tournaments")
  const tournament = tournaments.data?.find((entry) => entry.id === tournamentId)
  return <>{tournament?.content.name ?? fallback}</>
}
