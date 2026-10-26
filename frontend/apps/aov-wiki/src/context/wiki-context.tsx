import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { supportedWikiLocale } from "../lib/wiki-catalog"

export interface WikiRegion {
  code: string
  displayName: string
  productName: string
  defaultLocale: string
  timeZone: string
  available: boolean
  unavailableReason?: string | null
}
export interface WikiLanguage {
  code: string
  name: string
  nativeName?: string
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
type CatalogContextResponse = {
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

const COPY: Record<string, [string, string]> = {
  home: ["Trang chủ", "Home"],
  contents: ["Mục lục", "Contents"],
  openContents: ["Mở mục lục", "Open contents"],
  application: ["Chọn ứng dụng", "Choose application"],
  more: ["Thêm", "More"],
  close: ["Đóng", "Close"],
  market: ["Thị trường dữ liệu", "Game market"],
  language: ["Ngôn ngữ", "Language"],
  retry: ["Thử lại", "Retry"],
  loading: ["Đang tải…", "Loading…"],
  unavailable: ["Chưa hỗ trợ", "Unavailable"],
  comingSoon: ["Sắp có", "Coming soon"],
  marketError: ["Chưa tải được thị trường.", "Markets could not be loaded."],
  marketNote: [
    "Thị trường và ngôn ngữ hiển thị được chọn độc lập.",
    "Game market and display language are independent.",
  ],
  characters: ["Sổ tay nhân vật", "Character handbook"],
  heroes: ["Danh sách tướng", "Heroes"],
  skins: ["Trang phục", "Skins"],
  warehouse: ["Kho trang bị", "Armory"],
  items: ["Trang bị", "Equipment"],
  enchantments: ["Phù hiệu", "Enchantments"],
  arcana: ["Bảng ngọc", "Arcana"],
  spells: ["Phụ trợ", "Talents"],
  map: ["Bản đồ", "Maps"],
  mode: ["Chế độ chơi", "Game modes"],
  backHome: ["Về trang chủ", "Back home"],
  search: ["Tìm kiếm", "Search"],
  searchHeroes: ["Tìm tướng", "Search heroes"],
  searchSkins: ["Tìm trang phục", "Search skins"],
  searchWarehouse: ["Tìm trong kho trang bị", "Search the armory"],
  utilities: ["Tiện ích", "Utilities"],
  account: ["Tài khoản", "Account"],
  feedback: ["Phản hồi vấn đề", "Report an issue"],
  signInNote: ["Đăng nhập để lưu nội dung yêu thích", "Sign in to save your favorites"],
}
const PREFERENCE_KEY = "aov-wiki:browsing:v1"
const UI_LANGUAGES = new Set(["vi-VN", "en-US"])
export const wikiText = (locale: string, vietnamese: string, english: string) =>
  locale.startsWith("en") ? english : vietnamese

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
async function readPublic<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/wiki/v1${path}`, { signal, credentials: "omit" })
  if (!response.ok) throw new Error("Wiki browsing options are unavailable.")
  return response.json()
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

function useWikiState() {
  const [params, setParams] = useSearchParams()
  const [preferences] = useState(readPreferences)
  const region = params.get("region") || preferences.region || "VN"
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
    document.documentElement.lang = locale
  }, [locale])
  const markets = useQuery({
    queryKey: ["wiki", "regions"],
    queryFn: ({ signal }) => readPublic<WikiRegion[]>("/regions", signal),
    staleTime: 300_000,
    retry: 1,
  })
  const context = useQuery({
    queryKey: ["wiki", "catalog-context", region, locale],
    queryFn: async ({ signal }) =>
      normalizeOptions(
        await readPublic<CatalogContextResponse>(`/catalog-context?${new URLSearchParams({ region, locale })}`, signal),
      ),
    staleTime: 60_000,
    retry: 1,
  })
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
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set("region", value)
        next.set("locale", locale)
        for (const key of [
          "season",
          "patch",
          "unscoped",
          "item",
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
        return next
      })
    },
    [locale, markets.data, setParams],
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
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (value.seasonId) next.set("season", value.seasonId)
        else next.delete("season")
        if (value.patchVariantId) next.set("patch", value.patchVariantId)
        else next.delete("patch")
        if (value.includeUnscoped !== undefined) {
          if (value.includeUnscoped) next.set("unscoped", "1")
          else next.delete("unscoped")
        }
        next.delete("item")
        return next
      })
    },
    [setParams],
  )
  const href = useCallback(
    (path: string) => {
      if (!path.startsWith("/") || path.startsWith("//")) return path
      const target = new URL(path, "https://wiki.invalid")
      const values = { region, locale, season: seasonId, patch: patchVariantId, unscoped: includeUnscoped ? "1" : "" }
      for (const [key, value] of Object.entries(values))
        if (value && (key === "region" || key === "locale" || !target.searchParams.has(key)))
          target.searchParams.set(key, value)
      return `${target.pathname}${target.search}${target.hash}`
    },
    [region, locale, seasonId, patchVariantId, includeUnscoped],
  )
  const t = useCallback((key: string) => COPY[key]?.[locale.startsWith("en") ? 1 : 0] ?? key, [locale])
  return {
    region,
    locale,
    seasonId,
    patchVariantId,
    includeUnscoped,
    setRegion,
    setLocale,
    setScope,
    href,
    t,
    options: context.data,
    optionsPending: context.isPending,
    optionsError: context.error,
    retryOptions: context.refetch,
    regions: markets.data ?? context.data?.regions ?? [],
    regionsPending: markets.isPending,
    regionsError: markets.error,
    retryRegions: markets.refetch,
  }
}
const WikiContext = createContext<ReturnType<typeof useWikiState> | null>(null)
export function WikiContextProvider({ children }: { children: ReactNode }) {
  const state = useWikiState()
  return <WikiContext.Provider value={state}>{children}</WikiContext.Provider>
}
export function useWikiContext() {
  const context = useContext(WikiContext)
  if (!context) throw new Error("WikiContextProvider is required.")
  return context
}
