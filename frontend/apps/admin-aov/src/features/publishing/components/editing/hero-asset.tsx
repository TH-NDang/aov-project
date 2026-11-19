import { PageReference } from "@/features/community/components/page-reference"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Image } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { ImagePreview } from "@/components/image-preview"
import type { LightboxImage } from "@/components/image-lightbox"
import { heroContentAssetQuery } from "../../model/assets/hero-content-asset"
import { ImageCredit } from "@aov/ui/components/image-credit"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { ImageCreditPanel } from "../../../media/components/library/image-credit-panel"
import { creditSummary, visibleSources } from "../../../media/model/media-source-gaps"

export function HeroAsset({
  id,
  alt = "",
  className = "",
  preview = false,
  naturalAspectRatio,
  frameAspectRatio,
  gallery,
}: {
  id?: string | null
  alt?: string
  className?: string
  preview?: boolean
  /** Use the intrinsic image ratio, with this fallback while loading or when missing. */
  naturalAspectRatio?: number
  /** Reserve a stable frame before the image loads, without cropping its contents. */
  frameAspectRatio?: number
  /** Open the large view among related images instead of alone. */
  gallery?: { images: LightboxImage[]; index: number }
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const asset = useQuery({ ...heroContentAssetQuery(id ?? ""), enabled: !!id })
  const sources = asset.data?.currentUrl
    ? visibleSources(currentMediaSources(asset.data.provenance ?? [], asset.data.currentVersionId))
    : []
  const url = asset.data?.currentUrl
  const shown = !!url && failedUrl !== url
  const thumbnail = (
    <div
      // A picture stands on its own, without a frame. Only an empty, failed or still loading slot gets a tinted
      // ground, and an empty or failed one an outline too, so a missing picture still shows where it belongs.
      className={cn(
        "@container overflow-hidden rounded-xl",
        !shown ? "border bg-muted/40" : loadedUrl !== url && "bg-muted/40",
        className,
      )}
      style={frameAspectRatio ? { aspectRatio: frameAspectRatio } : undefined}
      // Hovering any image tells who owns it, without opening it.
      title={asset.data?.currentUrl ? creditSummary(sources) : undefined}
    >
      {shown ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className={cn(
            "size-full object-cover",
            frameAspectRatio && "object-contain",
            naturalAspectRatio && "block h-auto w-full object-contain",
          )}
          style={naturalAspectRatio ? { aspectRatio: `auto ${naturalAspectRatio}` } : undefined}
          onLoad={() => setLoadedUrl(url)}
          onError={() => setFailedUrl(url)}
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
  const credit = asset.data?.currentUrl ? (
    <ImageCredit
      renderPageReference={(id, label) => <PageReference id={id} label={label} />}
      sources={sources}
      manageHref={`/files?asset=${encodeURIComponent(asset.data.id)}`}
      flagMissing
    />
  ) : null
  return preview && asset.data?.currentUrl && failedUrl !== asset.data.currentUrl ? (
    <ImagePreview
      src={asset.data.currentUrl}
      alt={alt || "Ảnh"}
      // The preview frame takes the thumbnail's size, so its corner controls sit on the image itself.
      className={className}
      overlay={credit}
      title={creditSummary(sources)}
      meta={<ImageCreditPanel sources={sources} assetId={asset.data.id} />}
      gallery={gallery}
    >
      {thumbnail}
    </ImagePreview>
  ) : (
    thumbnail
  )
}
