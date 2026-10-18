import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ImageOff, LoaderCircle } from "lucide-react"
import { backendRequest } from "@/app/auth/session"
import { ImagePreview } from "@/components/image-preview"
import { createPublishingApi, type Request } from "../publishing/publishing-api"
import type { SkinBadgeRecord } from "./character-image-api"

export function SkinBadgeArtwork({
  badge,
  locale,
  request = backendRequest,
  compact = false,
}: {
  badge: Pick<SkinBadgeRecord, "iconAssetId" | "displayName" | "code" | "actualLocale">
  locale: string
  request?: Request
  compact?: boolean
}) {
  const id = badge.iconAssetId
  const language = badge.actualLocale ?? locale
  const name = badge.displayName || badge.code
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const asset = useQuery({
    queryKey: ["hero-content-asset", id],
    queryFn: () => createPublishingApi(request).asset(id!),
    enabled: !!id,
    staleTime: 60000,
  })
  const url = asset.data?.currentUrl
  const failed = asset.isError || (!!url && failedUrl === url)
  const loading = !!id && asset.isPending
  const alt = `Biểu tượng nhãn ${name} · ${language}`
  const status = failed ? "Không tải được ảnh" : loading ? "Đang tải ảnh" : "Chưa có ảnh"
  const size = compact ? "h-7 max-w-20" : "h-11 max-w-28"
  const thumbnail = (
    <span
      className={`inline-flex ${size} items-center justify-center overflow-hidden rounded-md border bg-muted/30`}
      style={{
        backgroundImage: "repeating-conic-gradient(var(--muted) 0% 25%, transparent 0% 50%)",
        backgroundSize: "12px 12px",
      }}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className={`block h-auto w-auto object-contain ${compact ? "max-h-7 max-w-20" : "max-h-11 max-w-28"}`}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span
          role="img"
          aria-label={`${status} cho nhãn ${name} · ${language}`}
          title={`${status} · ${language}`}
          className={`flex ${compact ? "size-7" : "size-11"} items-center justify-center text-muted-foreground`}
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ImageOff className="size-4" />}
        </span>
      )}
    </span>
  )
  return url && !failed ? (
    <ImagePreview src={url} alt={alt} className={`${size} shrink-0 rounded-lg`} showHint={!compact}>
      {thumbnail}
    </ImagePreview>
  ) : (
    <span className={`${size} shrink-0`}>{thumbnail}</span>
  )
}
