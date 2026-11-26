import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { supportedWikiLocale, warehouseListPath, wikiScopeHref, wikiSection } from "../lib/wiki-catalog"
import { catalogContextQuery, regionsQuery } from "./wiki-context-api"
import { localeText, marketName } from "@aov/ui/lib/locale-text"
import { LocaleProvider } from "@aov/ui/hooks/use-locale-text"

export interface WikiRegion {
  code: string
  displayName: string
  productName: string
  defaultLocale: string
  timeZone: string
  available: boolean
  unavailableReason?: string | null
}
/** An interface language of the catalog, as a locale code; the Wiki names languages itself. */
export interface WikiLanguage {
  code: string
}
export interface WikiPatch {
  id: string
  patchId?: string
  seasonId: string
  code: string
  title?: string | null
  rulesetId: string
  ordinal: number
  published: boolean
  regionalDate?: string | null
  unknownDate?: boolean
  isCurrent: boolean
}
export interface WikiSeason {
  id: string
  code: string
  displayName: string
  ordinal: number
  isCurrent: boolean
}
export interface WikiOptions {
  regions: WikiRegion[]
  languages: WikiLanguage[]
  seasons: WikiSeason[]
  patches: WikiPatch[]
  currentSeasonId?: string | null
  currentPatchVariantId?: string | null
  currentRulesetId?: string | null
}
export interface WikiScope {
  region: string
  locale: string
  seasonId: string
  patchVariantId: string
  includeUnscoped: boolean
}
export type CatalogContextResponse = {
  regions: WikiRegion[]
  locales: WikiLanguage[]
  seasons: {
    id: string
    code: string
    name: string
    ordinal: number
    current: boolean
    patches: Omit<WikiPatch, "seasonId" | "isCurrent">[]
  }[]
  current?: { rulesetId?: string | null; seasonId?: string | null; patchVariantId?: string | null }
}

const PREFERENCE_KEY = "aov-wiki:browsing:v1"
const UI_LANGUAGES = new Set(["vi-VN", "en-US"])
export const wikiText = (locale: string, vietnamese: string, english: string) => localeText(locale)(vietnamese, english)

function readPreferences(): { region?: string; locale?: string } {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? "{}")
    if (!value || typeof value !== "object") return {}
    const saved = value as Record<string, unknown>
    return {
      region: typeof saved.region === "string" && /^[A-Z]{2,16}$/.test(saved.region) ? saved.region : undefined,
      locale: typeof saved.locale === "string" && UI_LANGUAGES.has(saved.locale) ? saved.locale : undefined,
    }
  } catch {
    return {}
  }
}
function normalizeOptions(value: CatalogContextResponse): WikiOptions {
  return {
    regions: value.regions,
    languages: value.locales.filter((language) => UI_LANGUAGES.has(language.code)),
    seasons: value.seasons.map((season) => ({
      id: season.id,
      code: season.code,
      displayName: season.name,
      ordinal: season.ordinal,
      isCurrent: season.current,
    })),
    patches: value.seasons.flatMap((season) =>
      season.patches.map((patch) => ({
        ...patch,
        seasonId: season.id,
        isCurrent: patch.id === value.current?.patchVariantId,
      })),
    ),
    currentSeasonId: value.current?.seasonId,
    currentPatchVariantId: value.current?.patchVariantId,
    currentRulesetId: value.current?.rulesetId,
  }
}

/** Markets the API lists that the Wiki does not offer; a request for one reads the default market instead. */
const HIDDEN_MARKETS = new Set(["GLOBAL"])
const DEFAULT_MARKET = "VN"
/** A saved or linked market the Wiki does not offer reads as the default market. */
const offered = (code: string) => (HIDDEN_MARKETS.has(code.toUpperCase()) ? DEFAULT_MARKET : code)

function useWikiState() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = wikiSection(pathname, params.get("tab"))
  const [preferences] = useState(readPreferences)
  const implied = useMemo(
    () => ({ region: offered(preferences.region || DEFAULT_MARKET), locale: supportedWikiLocale(preferences.locale) }),
    [preferences],
  )
  const region = offered(params.get("region") || implied.region)
  const requestedLocale = params.get("locale") || preferences.locale
  const locale = supportedWikiLocale(requestedLocale)
  const seasonId = params.get("season") ?? ""
  const patchVariantId = params.get("patch") ?? ""
  const includeUnscoped = params.get("unscoped") === "1"
  useEffect(() => {
    if (!params.has("locale") || params.get("locale") === locale) return
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set("locale", locale)
        return next
      },
      { replace: true },
    )
  }, [params, locale, setParams])
  useEffect(() => {
    if (!params.has("region") || params.get("region") === region) return
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set("region", region)
        return next
      },
      { replace: true },
    )
  }, [params, region, setParams])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const markets = useQuery(regionsQuery)
  const context = useQuery({ ...catalogContextQuery(region, locale), select: normalizeOptions })
  useEffect(() => {
    if (!markets.data?.some((market) => market.code === region && market.available) || !UI_LANGUAGES.has(locale)) return
    try {
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ region, locale }))
    } catch {
      /* Preferences are optional when storage is unavailable. */
    }
  }, [region, locale, markets.data])

  const setRegion = useCallback(
    (value: string) => {
      if (!markets.data?.some((market) => market.code === value && market.available)) return
      const next = new URLSearchParams(params)
      next.set("region", value)
      next.set("locale", locale)
      for (const key of [
        "season",
        "patch",
        "unscoped",
        "hero",
        "revision",
        "q",
        "group",
        "role",
        "position",
        "rarity",
        "skill",
      ])
        next.delete(key)
      void navigate({ pathname: warehouseListPath(pathname), search: `?${next}` })
    },
    [locale, markets.data, navigate, params, pathname],
  )
  const setLocale = useCallback(
    (value: string) => {
      if (!UI_LANGUAGES.has(value)) return
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set("region", region)
        next.set("locale", value)
        return next
      })
    },
    [region, setParams],
  )
  const setScope = useCallback(
    (value: { seasonId: string; patchVariantId: string; includeUnscoped?: boolean }) => {
      const next = new URLSearchParams(params)
      if (value.seasonId) next.set("season", value.seasonId)
      else next.delete("season")
      if (value.patchVariantId) next.set("patch", value.patchVariantId)
      else next.delete("patch")
      if (value.includeUnscoped !== undefined) {
        if (value.includeUnscoped) next.set("unscoped", "1")
        else next.delete("unscoped")
      }
      // An open armory entry may not exist in the new version, so it closes.
      void navigate({ pathname: warehouseListPath(pathname), search: `?${next}` })
    },
    [navigate, params, pathname],
  )
  const href = useCallback(
    (path: string) =>
      wikiScopeHref(path, { region, locale, seasonId, patchVariantId, includeUnscoped, section, implied }),
    [region, locale, seasonId, patchVariantId, includeUnscoped, section, implied],
  )
  const marketList = markets.data ?? context.data?.regions
  const regions = useMemo(
    () =>
      (marketList ?? [])
        .filter((market) => !HIDDEN_MARKETS.has(market.code))
        .map((market) => ({
          ...market,
          displayName: marketName(market.code, locale, market.displayName),
        })),
    [marketList, locale],
  )
  return {
    region,
    section,
    locale,
    implied,
    seasonId,
    patchVariantId,
    includeUnscoped,
    setRegion,
    setLocale,
    setScope,
    href,
    options: context.data,
    optionsPending: context.isPending,
    optionsError: context.error,
    retryOptions: context.refetch,
    regions,
    regionsPending: markets.isPending,
    regionsError: markets.error,
    retryRegions: markets.refetch,
  }
}
const WikiContext = createContext<ReturnType<typeof useWikiState> | null>(null)
export function WikiContextProvider({ children }: { children: ReactNode }) {
  const state = useWikiState()
  return (
    <WikiContext.Provider value={state}>
      <LocaleProvider locale={state.locale}>{children}</LocaleProvider>
    </WikiContext.Provider>
  )
}
export function useWikiContext() {
  const context = useContext(WikiContext)
  if (!context) throw new Error("WikiContextProvider is required.")
  return context
}

/**
 * The Wiki's one way to write interface text in the reader's language: `const text = useWikiText()`, then
 * `text(vietnamese, english)`. Code outside components calls `wikiText(locale, vietnamese, english)`.
 */
export function useWikiText() {
  const { locale } = useWikiContext()
  return useMemo(() => localeText(locale), [locale])
}
