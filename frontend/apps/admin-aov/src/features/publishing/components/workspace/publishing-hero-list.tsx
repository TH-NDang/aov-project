import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { FileUp, Plus } from "lucide-react"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { PageHeader } from "@/components/page-header"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import { catalogScopePatch, resolveCatalogScope, type CatalogFilter } from "@/lib/catalog-scope"
import type { Skill } from "@/lib/hero-types"
import { useContentLocale, usePublicationOverview } from "../../api/publication-overview"
import { usePatchCaptureWorkspace } from "../../api/use-patch-captures"
import { heroLocationId } from "../../model/hero-location"
import { HeroCatalog } from "../catalog/hero-catalog"
import { useCatalogScopePreference } from "../catalog/catalog-scope-memory"
import { HeroTimeline } from "./hero-timeline"
import { PublishingFrame } from "./publishing-frame"
import { useHeroLocation } from "./use-hero-location"

const api = createPublishingApi(backendRequest)
const noSkills: Skill[] = []

/** The list of heroes for the season and patch the address names, or else the scope this editor last chose. */
export function PublishingHeroList() {
  const canWrite = (useSession().actor?.capabilities ?? []).includes("hero:write")
  const { params: urlParams, update: updateLocation } = useHeroLocation()
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null)
  const requestedFilter: CatalogFilter = {
    seasonId: heroLocationId(urlParams.get("season")),
    variantId: heroLocationId(urlParams.get("patch")),
  }
  const overview = usePublicationOverview()
  const preferred = useCatalogScopePreference(overview.data, requestedFilter, true)
  const filter = overview.data ? resolveCatalogScope(overview.data, preferred) : requestedFilter
  const setFilter = (next: CatalogFilter) =>
    updateLocation(catalogScopePatch(overview.data ? resolveCatalogScope(overview.data, next) : next))
  useEffect(() => {
    if (
      overview.data &&
      (filter.variantId !== requestedFilter.variantId || filter.seasonId !== requestedFilter.seasonId)
    )
      updateLocation(catalogScopePatch({ seasonId: filter.seasonId, variantId: filter.variantId }))
  }, [
    overview.data,
    filter.variantId,
    filter.seasonId,
    requestedFilter.variantId,
    requestedFilter.seasonId,
    updateLocation,
  ])
  const displayLocale = useContentLocale()
  const rulesets = useQuery({ queryKey: publishingKeys.rulesets, queryFn: api.rulesets })
  const regions = useQuery({ queryKey: publishingKeys.regions, queryFn: api.regions })
  // No hero is open, so the capture panel stays idle; the frame still hands it to the page.
  const captures = usePatchCaptureWorkspace({
    heroId: "",
    heroName: "",
    patchCode: undefined,
    skills: noSkills,
    locale: displayLocale,
    ready: false,
    focus: "",
  })

  return (
    <PublishingFrame detail={false} captures={captures} className="@container min-w-0">
      <PageHeader
        title="Tướng"
        search={<div ref={setSearchSlot} className="contents" />}
        actions={
          canWrite ? (
            <PageActionsMenu label="Tạo và nhập tướng">
              <DropdownMenuItem asChild>
                <Link to="/hero/new">
                  <Plus />
                  Tạo tướng
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/hero/import">
                  <FileUp />
                  Nhập tướng
                </Link>
              </DropdownMenuItem>
            </PageActionsMenu>
          ) : undefined
        }
      />
      {[rulesets.error, regions.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {overview.data ? (
        <HeroTimeline data={overview.data} rulesetId="" value={filter} onChange={setFilter} />
      ) : (
        <p role={overview.error ? "alert" : "status"}>
          {overview.error ? errorMessage(overview.error) : "Đang tải mùa và patch…"}
        </p>
      )}
      {overview.data && (
        <HeroCatalog
          ruleset=""
          locale={displayLocale}
          overview={overview.data}
          filter={filter}
          searchSlot={searchSlot}
        />
      )}
    </PublishingFrame>
  )
}
