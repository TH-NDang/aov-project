import { createPublishingApi, type Request } from "../publishing/publishing-api"
import type { Bindings, ImageOption, MediaRole, PageSlice, Preview, Revision, Skins } from "../publishing/types"

export interface CharacterImageEntry {
  ownerType: "HERO" | "SKIN"
  skinKey: string | null
  name: string
  assetId: string | null
  label: string | null
  main: boolean
  rarityCode: string | null
}
export interface CharacterImageGroup {
  heroId: string
  code: string
  name: string
  actualLocale: string | null
  revision: Revision
  entries: CharacterImageEntry[]
}
export type BadgeKind = "UNKNOWN" | "RARITY" | "EVENT"
export interface SkinBadgeTranslation {
  locale: string
  displayName: string
  iconAssetId: string | null
}
export interface SkinBadgeRecord {
  id: string
  code: string
  kind: BadgeKind
  version: number
  translations: SkinBadgeTranslation[]
  displayName: string
  iconAssetId: string | null
  actualLocale: string | null
  fallbackApplied: boolean
  skinCount: number
  groupId?: string | null
}
export interface BadgeSkin {
  heroId: string
  heroCode: string
  heroName: string
  skinKey: string
  skinName: string
  revisionId: string
  artAssetId: string | null
}
export interface BadgeInput {
  code?: string
  regionCode?: string
  kind: BadgeKind
  translations: SkinBadgeTranslation[]
  expectedVersion?: number
}
export const characterImageKeys = {
  all: ["character-images"] as const,
  list: (rulesetId: string, role: MediaRole, locale: string, q: string) =>
    ["character-images", rulesetId, role, locale, q.trim()] as const,
  badges: ["skin-badges"] as const,
  badgeList: (rulesetId: string, locale: string, q: string) =>
    ["skin-badges", "list", rulesetId, locale, q.trim()] as const,
  badgeSkins: (id: string, rulesetId: string, locale: string) =>
    ["skin-badges", "skins", id, rulesetId, locale] as const,
}
export function createCharacterImageApi(request: Request) {
  const params = (values: Record<string, string | number>) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (String(value).trim()) query.set(key, String(value).trim())
    return query
  }
  return {
    groups: (rulesetId: string, role: MediaRole, locale: string, q: string, page = 0, signal?: AbortSignal) =>
      request<PageSlice<CharacterImageGroup>>(
        `/admin/hero-media?${params({ rulesetId, role, locale, q, page, size: 20 })}`,
        { signal },
      ),
    badges: (rulesetId: string, locale: string, q: string, page = 0, signal?: AbortSignal) =>
      request<PageSlice<SkinBadgeRecord>>(`/admin/skin-badges?${params({ rulesetId, locale, q, page, size: 20 })}`, {
        signal,
      }),
    badgeSkins: (id: string, rulesetId: string, locale: string, page = 0, signal?: AbortSignal) =>
      request<PageSlice<BadgeSkin>>(`/admin/skin-badges/${id}/skins?${params({ rulesetId, locale, page, size: 20 })}`, {
        signal,
      }),
    saveBadge: (value: BadgeInput, badge?: SkinBadgeRecord | null) =>
      request<SkinBadgeRecord>(`/admin/skin-badges${badge ? `/${badge.id}` : ""}`, {
        method: badge ? "PUT" : "POST",
        body: JSON.stringify(
          badge ? { expectedVersion: badge.version, kind: value.kind, translations: value.translations } : value,
        ),
      }),
    ...createPublishingApi(request),
  }
}

function optionsWith(
  options: ImageOption[] | undefined,
  previousMain: string | null | undefined,
  assetId: string,
  label: string | null,
) {
  const result = (options ?? []).map((option) => ({ ...option }))
  if (previousMain && !result.some((option) => option.assetId === previousMain))
    result.push({ assetId: previousMain, label: null })
  const existing = result.find((option) => option.assetId === assetId)
  if (existing) {
    if (label !== null) existing.label = label
  } else result.push({ assetId, label })
  return result
}

/** Change one image slot while retaining every other image, translation and source in the section. */
export function imageSectionChange(
  preview: Preview,
  entry: Pick<CharacterImageEntry, "ownerType" | "skinKey">,
  role: MediaRole,
  assetId: string,
  label: string | null,
  main: boolean,
): { section: "MEDIA_BINDINGS"; value: Bindings } | { section: "SKINS"; value: Skins } {
  if (entry.ownerType === "HERO") {
    const current = preview.content.MEDIA_BINDINGS ?? { bindings: {}, images: {}, sources: [] }
    return {
      section: "MEDIA_BINDINGS",
      value: {
        ...current,
        bindings: main ? { ...current.bindings, [role]: assetId } : { ...current.bindings },
        images: {
          ...current.images,
          [role]: optionsWith(current.images?.[role], current.bindings[role], assetId, label),
        },
      },
    }
  }
  const current = preview.content.SKINS
  if (!current?.skins.some((skin) => skin.skinKey === entry.skinKey))
    throw new Error("The selected skin no longer exists in this revision.")
  const field = role === "HEAD" ? "headAssetId" : role === "PORTRAIT" ? "portraitAssetId" : "artAssetId"
  return {
    section: "SKINS",
    value: {
      ...current,
      skins: current.skins.map((skin) =>
        skin.skinKey !== entry.skinKey
          ? skin
          : {
              ...skin,
              ...(main ? { [field]: assetId } : {}),
              images: { ...skin.images, [role]: optionsWith(skin.images?.[role], skin[field], assetId, label) },
            },
      ),
    },
  }
}
