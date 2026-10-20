import type { Section } from "./types"

export type HeroContentTab = "overview" | "skills" | "skins" | "media"
export type HeroWorkspaceView = "overview" | "translations" | "history"
const heroKeys = [
  "hero",
  "revision",
  "view",
  "tab",
  "section",
  "locale",
  "readLocale",
  "target",
  "source",
  "compare",
  "diff",
  "changes",
] as const
const contentTabs: HeroContentTab[] = ["overview", "skills", "skins", "media"]
const sections: Section[] = ["PROFILE", "OVERVIEW_RATINGS", "COMBAT_STATS", "SKILLS", "SKINS", "MEDIA_BINDINGS"]
const locales = ["vi-VN", "en-US", "th-TH", "zh-TW", "id-ID"]
const localeValue = (value: string | null, fallback: string) => (value && locales.includes(value) ? value : fallback)

export const heroLocationId = (value: string | null) =>
  value && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) ? value : ""

export function readHeroLocation(params: URLSearchParams, translationMode = false, defaultLocale = "vi-VN") {
  const view = params.get("view")
  const tab = params.get("tab")
  const section = params.get("section")
  return {
    view: (view === "overview" || view === "translations" || view === "history"
      ? view
      : translationMode
        ? "translations"
        : "overview") as HeroWorkspaceView,
    tab: (contentTabs.includes(tab as HeroContentTab) ? tab : "overview") as HeroContentTab,
    section: (sections.includes(section as Section) ? section : "PROFILE") as Section,
    readLocale: localeValue(
      params.get("readLocale") ?? (!translationMode ? params.get("locale") : null),
      defaultLocale,
    ),
    targetLocale: localeValue(params.get("target") ?? (translationMode ? params.get("locale") : null), "en-US"),
    sourceLocale: localeValue(params.get("source"), "vi-VN"),
  }
}

export function patchHeroLocation(params: URLSearchParams, patch: Record<string, string | null | undefined>) {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "") next.delete(key)
    else next.set(key, value)
  }
  return next
}

export function closeHeroLocation(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  for (const key of heroKeys) next.delete(key)
  return next
}

export function openHeroLocation(params: URLSearchParams, heroId: string, revisionId?: string) {
  return patchHeroLocation(closeHeroLocation(params), { hero: heroId, revision: revisionId })
}

export function heroPageLocation(heroId: string, params: URLSearchParams, revisionId?: string) {
  const next = new URLSearchParams()
  for (const key of heroKeys) {
    if (key !== "hero" && params.has(key)) next.set(key, params.get(key)!)
  }
  if (revisionId) next.set("revision", revisionId)
  const query = next.toString()
  return `/hero/${encodeURIComponent(heroId)}${query ? `?${query}` : ""}`
}
