import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { selfProfile, userKeys } from "../users/user-api"

import type { components } from "./generated/hero-api"
export type Market = components["schemas"]["PublicationMarket"]
export type Season = components["schemas"]["PublicationSeason"]
export type Variant = components["schemas"]["PublicationVariant"]
export type Release = components["schemas"]["PublicationRelease"]
export type PublicationOverview = components["schemas"]["PublicationOverview"]
export const overviewKey = ["publication-overview"] as const
export function usePublicationOverview(enabled = true) {
  return useQuery({
    queryKey: overviewKey,
    queryFn: () => backendRequest<PublicationOverview>("/admin/publication-overview"),
    refetchInterval: 60000,
    enabled,
  })
}
function useContentProfile() {
  const { actor } = useSession()
  const profile = useQuery({
    queryKey: [...userKeys.self, actor?.issuer, actor?.subject],
    queryFn: ({ signal }) => selfProfile(signal),
    enabled: !!actor,
  })
  return profile.data
}
export function useContentLocale() {
  return useContentProfile()?.locale || "vi-VN"
}
export function useContentTimeZone() {
  return useContentProfile()?.timeZone
}
export const phaseLabels: Record<string, string> = {
  RECORDED: "Đã ghi nhận",
  AWAITING_CONFIRMATION: "Chờ xác nhận áp dụng",
  CURRENT: "Đang áp dụng",
  UPCOMING: "Sắp tới",
  PAST: "Đã áp dụng",
  ENDED: "Đã kết thúc",
  DRAFT: "Bản nháp",
  CANCELLED: "Đã hủy",
  PUBLISHED: "Đã xuất bản",
}
export { dateLabel } from "./schedule-date"
