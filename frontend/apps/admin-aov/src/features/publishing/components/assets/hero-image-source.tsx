import { PageReference } from "@/features/community/components/page-reference"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CircleAlert, Copyright, ExternalLink, Info, RefreshCw, UserRound } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { getSession } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { heroContentAssetQuery } from "../../model/assets/hero-content-asset"
import { sourceHttpUrl } from "../../model/import/hero-source-review"
import type { AssetDetail } from "../../api/types"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { ImageDetailSheet } from "../../../media/components/image-detail-sheet"
import {
  ownerCandidate,
  primarySource,
  sourceGap,
  sourceGapLabels,
  sourceOrigin,
  visibleSources,
} from "../../../media/model/media-source-gaps"

/** Asset-wide and current-version sources describe the image being displayed. */
export function currentImageSources(asset: AssetDetail | undefined) {
  return currentMediaSources(asset?.provenance ?? [], asset?.currentVersionId)
}

/** Who owns the image first, then where it came from; the image sheet completes a missing owner. */
export function HeroImageSource({ assetId }: { assetId: string | null | undefined }) {
  const [detail, setDetail] = useState<"view" | "owner" | "new" | null>(null)
  const asset = useQuery({ ...heroContentAssetQuery(assetId ?? ""), enabled: !!assetId })
  if (!assetId) return null

  const writable = !!getSession().actor?.capabilities.includes("media:write")

  const shown = visibleSources(currentImageSources(asset.data))
  const main = primarySource(shown)
  const sources = main ? [main, ...shown.filter((source) => source !== main)] : shown
  const gap = sourceGap(shown)
  const ownerless = gap === "none" ? undefined : ownerCandidate(shown)
  return (
    <div
      className={cn(
        "min-w-0 space-y-2 rounded-lg border p-3 text-sm",
        asset.isSuccess && gap !== "none" ? "border-(--aov-warning)/40 bg-(--aov-warning-soft)" : "bg-muted/20",
      )}
      aria-label="Nguồn ảnh"
    >
      {asset.isPending ? (
        <p className="type-meta" role="status">
          Đang tải nguồn ảnh…
        </p>
      ) : asset.isError ? (
        <div className="space-y-1.5">
          <p className="type-meta">Chưa tải được nguồn ảnh.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void asset.refetch()}>
            <RefreshCw className="size-3.5" />
            Tải lại nguồn ảnh
          </Button>
        </div>
      ) : sources.length ? (
        <ul className="space-y-3 divide-y">
          {sources.map((source) => {
            const url = sourceHttpUrl(source.url)
            const contact = sourceHttpUrl(source.contactUrl)
            const owner = source.ownerName?.trim()
            const missing = sourceGap([source])
            return (
              <li key={source.id} className="min-w-0 space-y-1 break-words pt-3 first:pt-0">
                {source.relatedPageId && (
                  <p>
                    <PageReference id={source.relatedPageId} label="Nội dung liên quan" />
                  </p>
                )}
                {owner ? (
                  <p className="flex items-start gap-1.5 font-semibold">
                    <Copyright aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {source.ownerPageId ? <PageReference id={source.ownerPageId} label={owner} /> : owner}
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 font-semibold text-(--aov-warning)">
                    <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {missing === "unverified" ? sourceGapLabels.unverified : "Chưa ghi chủ sở hữu"}
                  </p>
                )}
                <p className="type-meta">
                  Lấy từ: {sourceOrigin(source) || "Nguồn chưa đặt tên"}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      title={url}
                      className="ml-2 inline-flex items-center gap-1 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <ExternalLink aria-hidden="true" className="size-3" />
                      Xem nguồn
                    </a>
                  )}
                  {contact && (
                    <a
                      href={contact}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-primary hover:underline"
                    >
                      Liên hệ
                    </a>
                  )}
                </p>
                {source.note && (
                  <p className="type-meta line-clamp-2 whitespace-pre-wrap" title={source.note}>
                    {source.note}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="flex items-start gap-1.5 font-semibold text-(--aov-warning)">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Chưa ghi nhận nguồn cho ảnh này.
        </p>
      )}
      {asset.isSuccess &&
        (writable && gap !== "none" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setDetail(ownerless ? "owner" : "new")}
          >
            <UserRound className="size-3.5" />
            {ownerless ? "Bổ sung chủ sở hữu" : "Bổ sung nguồn"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 h-8 text-muted-foreground"
            onClick={() => setDetail("view")}
          >
            <Info className="size-3.5" />
            Chi tiết nguồn
          </Button>
        ))}
      {/* Editing needs room, so it happens in the image sheet rather than under a narrow thumbnail. */}
      {detail && (
        <SourceSheet
          assetId={assetId}
          writable={writable}
          startWith={detail === "view" ? null : detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

/** Mounted only while open, so the viewport check runs only when the sheet is shown. */
function SourceSheet(props: Omit<Parameters<typeof ImageDetailSheet>[0], "wide">) {
  const wide = useIsWide()
  return <ImageDetailSheet {...props} wide={wide} />
}
