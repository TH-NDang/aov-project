import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Image } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { ImagePreview } from "@/components/image-preview"
import { createPublishingApi } from "./publishing-api"

const api = createPublishingApi(backendRequest)

export function HeroAsset({
  id,
  alt = "",
  className = "",
  preview = false,
  naturalAspectRatio,
  frameAspectRatio,
}: {
  id?: string | null
  alt?: string
  className?: string
  preview?: boolean
  /** Use the intrinsic image ratio, with this fallback while loading or when missing. */
  naturalAspectRatio?: number
  /** Reserve a stable frame before the image loads, without cropping its contents. */
  frameAspectRatio?: number
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const asset = useQuery({
    queryKey: ["hero-content-asset", id],
    queryFn: () => api.asset(id!),
    enabled: !!id,
    staleTime: 60000,
  })
  const thumbnail = (
    <div
      className={cn("@container overflow-hidden rounded-xl border bg-muted/40", className)}
      style={frameAspectRatio ? { aspectRatio: frameAspectRatio } : undefined}
    >
      {asset.data?.currentUrl && failedUrl !== asset.data.currentUrl ? (
        <img
          src={asset.data.currentUrl}
          alt={alt}
          loading="lazy"
          className={cn(
            "size-full object-cover",
            frameAspectRatio && "object-contain",
            naturalAspectRatio && "block h-auto w-full object-contain",
          )}
          style={naturalAspectRatio ? { aspectRatio: `auto ${naturalAspectRatio}` } : undefined}
          onError={() => setFailedUrl(asset.data!.currentUrl)}
        />
      ) : (
        <div
          className="flex h-full items-center justify-center gap-2 p-2 text-xs text-muted-foreground"
          style={naturalAspectRatio ? { aspectRatio: naturalAspectRatio } : undefined}
          role="img"
          aria-label={asset.isError || failedUrl ? "Không tải được ảnh" : id ? "Đang tải ảnh" : "Chưa có ảnh"}
        >
          <Image className="size-5" />
          <span className="hidden @min-[120px]:inline">
            {asset.isError || failedUrl ? "Không tải được ảnh" : id ? "Đang tải ảnh…" : "Chưa có ảnh"}
          </span>
        </div>
      )}
    </div>
  )
  return preview && asset.data?.currentUrl && failedUrl !== asset.data.currentUrl ? (
    <ImagePreview
      src={asset.data.currentUrl}
      alt={alt || "Ảnh"}
      className={naturalAspectRatio || frameAspectRatio ? className : undefined}
    >
      {thumbnail}
    </ImagePreview>
  ) : (
    thumbnail
  )
}
