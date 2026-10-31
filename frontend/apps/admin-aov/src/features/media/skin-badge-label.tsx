import { useQuery } from "@tanstack/react-query"
import { backendRequest } from "@/app/auth/session"
import { useContentLocale } from "../publishing/publication-overview"
import type { Request } from "../publishing/publishing-api"
import { createCharacterImageApi } from "./character-image-api"
import { SkinBadgeArtwork } from "./skin-badge-artwork"

export function SkinBadgeLabel({
  code,
  locale,
  request = backendRequest,
}: {
  code: string | null
  locale?: string
  request?: Request
}) {
  const contentLocale = useContentLocale()
  const language = locale ?? contentLocale
  const result = useQuery({
    queryKey: ["skin-badges", "selected", language, code],
    queryFn: async ({ signal }) => {
      const api = createCharacterImageApi(request)
      const first = await api.badges("", language, code!, 0, signal)
      const items = [...first.items]
      let page = first
      while (!items.some((badge) => badge.code === code) && (page.page + 1) * page.size < page.totalElements) {
        page = await api.badges("", language, code!, page.page + 1, signal)
        items.push(...page.items)
      }
      return { ...first, items }
    },
    enabled: !!code,
    staleTime: 60000,
  })
  const badge = result.data?.items.find((item) => item.code === code)
  if (!code) return <span className="text-xs text-muted-foreground">Chưa gắn nhãn</span>
  if (result.isPending)
    return (
      <span role="status" aria-label="Đang tải nhãn trang phục" className="inline-flex items-center gap-2">
        <span className="size-7 animate-pulse rounded-lg bg-muted" />
        <span className="h-3 w-16 animate-pulse rounded bg-muted" />
      </span>
    )
  if (result.isError && !badge) return <span className="text-xs text-muted-foreground">Không tải được nhãn</span>
  const fallback = badge?.fallbackApplied
    ? badge.actualLocale
      ? `Dùng bản dịch ${badge.actualLocale}`
      : "Chưa có bản dịch"
    : ""
  return (
    <div
      className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm"
      title={[code, fallback, result.isError ? "Không tải được nhãn trang phục" : ""].filter(Boolean).join(" · ")}
    >
      <SkinBadgeArtwork
        compact
        locale={language}
        request={request}
        badge={{
          code,
          displayName: badge?.displayName || code,
          iconAssetId: badge?.iconAssetId ?? null,
          actualLocale: badge?.actualLocale ?? null,
        }}
      />
      <span className="min-w-0 truncate">
        {badge?.displayName && badge.displayName !== badge.code ? badge.displayName : "Chưa đặt tên"}
      </span>
      {fallback && badge?.actualLocale && (
        <span className="shrink-0 text-xs text-muted-foreground">{badge.actualLocale}</span>
      )}
    </div>
  )
}
