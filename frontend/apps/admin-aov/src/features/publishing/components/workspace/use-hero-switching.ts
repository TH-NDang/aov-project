import { useEffect, useEffectEvent } from "react"
import { useLocation, useNavigate } from "react-router"
import { replacingPageTab } from "@/app/layout/page-tabs"
import type { HeroForms } from "@/lib/api/publishing-api"
import type { CatalogFilter } from "@/lib/catalog-scope"
import type { HeroRow, Revision } from "@/lib/hero-types"
import type { PublicationOverview } from "../../api/publication-overview"
import { defaultFormOf } from "../../model/hero-forms-model"
import { heroLocationId, heroPageLocation, switchHeroLocation } from "../../model/hero-location"
import { switchedHeroRevision } from "../../model/hero-workspace-model"

/**
 * Moves the page to another hero, or to another form of the same hero. In the drawer only the address changes; on the
 * hero's own page the page changes with it.
 */
export function useHeroSwitching({
  heroId,
  busy,
  drawer,
  revision,
  urlParams,
  overview,
  filter,
  forms,
  openedWithoutRevision,
}: {
  heroId: string
  busy: boolean
  drawer: boolean
  revision: Revision | undefined
  urlParams: URLSearchParams
  overview: PublicationOverview | undefined
  filter: CatalogFilter
  forms: HeroForms | undefined
  openedWithoutRevision: boolean
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function switchHero(next: HeroRow) {
    if (busy || next.id === heroId) return
    // A hero that holds forms opens on its default form; its shared part is edited from there.
    if (next.formIds?.length) return switchForm(next.formIds[0])
    const rulesetId = revision?.rulesetId || heroLocationId(urlParams.get("ruleset"))
    const selected = switchedHeroRevision(next, overview, filter, rulesetId)
    const params = switchHeroLocation(urlParams, next.id, selected?.id)
    if (drawer) void navigate({ search: `?${params}` }, { preventScrollReset: true })
    else void navigate(heroPageLocation(next.id, params), { preventScrollReset: false })
  }

  /** Opens another form of the same hero; each form is a hero of its own, so its newest revision opens (ADR-024). */
  function switchForm(nextId: string, replace = false) {
    if (busy || nextId === heroId) return
    const params = switchHeroLocation(urlParams, nextId)
    params.delete("revision")
    if (drawer) void navigate({ search: `?${params}` }, { preventScrollReset: true, replace })
    else
      void navigate(heroPageLocation(nextId, params), {
        preventScrollReset: true,
        replace,
        state: replace ? replacingPageTab(pathname) : undefined,
      })
  }

  // Opening the hero that holds forms lands on its default form, as the Wiki does. A link to one of its revisions, such
  // as the shared part's own page or a row of the readiness overview, still opens it.
  const defaultForm = defaultFormOf(forms, heroId)
  const openDefaultForm = useEffectEvent((formId: string) => switchForm(formId, true))
  useEffect(() => {
    if (openedWithoutRevision && defaultForm) openDefaultForm(defaultForm)
  }, [openedWithoutRevision, defaultForm])

  return { switchHero, switchForm }
}
