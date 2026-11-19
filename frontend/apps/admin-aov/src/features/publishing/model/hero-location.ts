import type { PublishBlockerKey } from "./publish-rules"
import type { Section } from "@/lib/hero-types"

export type HeroContentTab = "overview" | "skills" | "evaluation" | "skins" | "media" | "videos"
export type HeroWorkspaceView = "overview" | "translations" | "history"
const heroKeys = [
  "hero",
  "revision",
  "view",
  "tab",
  "skill",
  "skillLayout",
  "skin",
  "section",
  "translationKey",
  "translationField",
  "locale",
  "readLocale",
  "target",
  "source",
  "compare",
  "diff",
  "changes",
  "atPatch",
  "anchorRevision",
  "fix",
] as const
const contentTabs: HeroContentTab[] = ["overview", "skills", "evaluation", "skins", "media", "videos"]
const sections: Section[] = ["PROFILE", "OVERVIEW_RATINGS", "COMBAT_STATS", "SKILLS", "SKINS", "MEDIA_BINDINGS"]
const locales = ["vi-VN", "en-US", "th-TH", "zh-TW", "id-ID"]
const localeValue = (value: string | null, fallback: string) => (value && locales.includes(value) ? value : fallback)

export const heroLocationId = (value: string | null) =>
  value && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) ? value : ""

export function readHeroLocation(params: URLSearchParams, translationMode = false, defaultLocale = "vi-VN") {
  const view = params.get("view")
  const tab = params.get("tab")
  const section = params.get("section")
  // The content sections share one page now, so `view=skills` still opens that page on its section.
  const contentView = contentTabs.includes(view as HeroContentTab) ? (view as HeroContentTab) : null
  return {
    // The old by-patch and versions tabs now live in the history view, so their links still land there.
    view: (contentView || view === "translations" || view === "history" || view === "patch" || view === "versions"
      ? contentView
        ? "overview"
        : view === "patch" || view === "versions"
          ? "history"
          : view
      : translationMode
        ? "translations"
        : "overview") as HeroWorkspaceView,
    tab: (contentTabs.includes(tab as HeroContentTab) ? tab : (contentView ?? "overview")) as HeroContentTab,
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

const fixTabs: Partial<Record<PublishBlockerKey, HeroContentTab>> = {
  SKILLS: "skills",
  SKINS: "skins",
  MEDIA_BINDINGS: "media",
}

/** Opens a draft on the part a publish blocker points at; the workspace reads `fix` once and drops it. */
export function heroFixLocation(params: URLSearchParams, heroId: string, revisionId: string, key: PublishBlockerKey) {
  return patchHeroLocation(openHeroLocation(params, heroId, revisionId), {
    view: "overview",
    tab: fixTabs[key],
    section: key === "PATCH" ? null : key,
    fix: key,
  })
}

/** Opens a hero where the data a missing source image would check is shown: a skill on its own, the rest on the overview. */
export function heroSourceLocation(
  params: URLSearchParams,
  heroId: string,
  revisionId: string | undefined,
  item: { area: "OVERVIEW" | "STATS" | "SKILL"; skillKey?: string },
) {
  const skill = item.area === "SKILL" ? heroLocationId(item.skillKey ?? null) : ""
  return patchHeroLocation(openHeroLocation(params, heroId, revisionId), {
    view: "overview",
    tab: item.area === "SKILL" ? "skills" : "overview",
    skill,
  })
}

/** Keep the working context while dropping identities that belong to the previous hero. */
export function switchHeroLocation(params: URLSearchParams, heroId: string, revisionId?: string) {
  return patchHeroLocation(params, {
    hero: heroId,
    revision: revisionId,
    compare: null,
    diff: null,
    changes: null,
    skill: null,
    skin: null,
    translationKey: null,
    translationField: null,
    anchorRevision: null,
  })
}

export function heroPageLocation(heroId: string, params: URLSearchParams, revisionId?: string) {
  const next = new URLSearchParams()
  for (const key of heroKeys) {
    if (key !== "hero" && params.has(key)) next.set(key, params.get(key)!)
  }
  if (params.has("ruleset")) next.set("ruleset", params.get("ruleset")!)
  if (revisionId) next.set("revision", revisionId)
  const query = next.toString()
  return `/hero/${encodeURIComponent(heroId)}${query ? `?${query}` : ""}`
}
