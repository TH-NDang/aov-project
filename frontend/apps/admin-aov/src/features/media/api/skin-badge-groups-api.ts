import type { Request } from "@/lib/api/publishing-api"
import type { PageSlice } from "@/lib/hero-types"
import type { SkinBadgeRecord } from "./character-image-api"
import type { components } from "../../publishing/generated/hero-api"

type Schemas = components["schemas"]
export type BadgeGroupKind = Schemas["SkinBadgeGroupCreate"]["kind"]
export type BadgeGroupTranslation = Schemas["SkinBadgeGroupTranslation"]
export type BadgeGroup = Schemas["SkinBadgeGroupView"]
export type BadgeGroupInput = Schemas["SkinBadgeGroupCreate"]
export const badgeGroupLabel = (group: BadgeGroup) => group.displayName || (group.id ? group.code : "Chưa phân nhóm")
export const badgeGroupKindLabels: Record<BadgeGroupKind, string> = { RANK: "Bậc", THEME: "Sự kiện / chủ đề" }
export const badgeGroupKey = (group: Pick<BadgeGroup, "id">) => group.id ?? "__ungrouped"
export const badgeGroupKeys = {
  groups: ["skin-badges", "groups"] as const,
  list: (locale: string, q: string) => ["skin-badges", "groups", locale, q.trim()] as const,
  badges: (groupId: string | null, rulesetId: string, locale: string, q: string) =>
    ["skin-badges", "group-items", groupId, rulesetId, locale, q.trim()] as const,
}
export function createSkinBadgeGroupsApi(request: Request) {
  return {
    groups: (locale: string, q = "", page = 0, signal?: AbortSignal) => {
      const params = new URLSearchParams({ locale, q: q.trim(), page: String(page), size: "20" })
      return request<PageSlice<BadgeGroup>>(`/admin/skin-badge-groups?${params}`, { signal })
    },
    badges: (groupId: string | null, rulesetId: string, locale: string, q: string, page = 0, signal?: AbortSignal) => {
      const params = new URLSearchParams({ locale, q: q.trim(), page: String(page), size: "20" })
      if (rulesetId) params.set("rulesetId", rulesetId)
      if (groupId) params.set("groupId", groupId)
      else params.set("ungrouped", "true")
      return request<PageSlice<SkinBadgeRecord>>(`/admin/skin-badges?${params}`, { signal })
    },
    save: (input: BadgeGroupInput, group: BadgeGroup | null) =>
      request<BadgeGroup>(`/admin/skin-badge-groups${group ? `/${group.id}` : ""}`, {
        method: group ? "PUT" : "POST",
        body: JSON.stringify(
          group ? { expectedVersion: group.version, kind: input.kind, translations: input.translations } : input,
        ),
      }),
    moveBadge: (badge: SkinBadgeRecord, groupId: string | null) =>
      request<SkinBadgeRecord>(`/admin/skin-badges/${badge.id}/group`, {
        method: "PUT",
        body: JSON.stringify({ expectedVersion: badge.version, groupId }),
      }),
  }
}
