import { useQuery } from "@tanstack/react-query"
import { ExternalLink, Link2, RefreshCw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { createPublishingApi } from "./publishing-api"
import { sourceHttpUrl } from "./hero-source-review"
import type { AssetDetail } from "./types"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { MediaSourceEditor } from "../media/media-source-editor"

const api = createPublishingApi(backendRequest)

/** Asset-wide and current-version sources describe the image being displayed. */
export function currentImageSources(asset: AssetDetail | undefined) {
  return currentMediaSources(asset?.provenance ?? [], asset?.currentVersionId)
}

export function HeroImageSource({ assetId }: { assetId: string | null | undefined }) {
  const asset = useQuery({
    queryKey: ["hero-content-asset", assetId],
    queryFn: () => api.asset(assetId!),
    enabled: !!assetId,
    staleTime: 60000,
  })
  if (!assetId) return null
  const sources = currentImageSources(asset.data)
  return (
    <div className="min-w-0 space-y-2 border-t pt-3 text-xs" aria-label="Nguồn ảnh">
      <p className="flex items-center gap-1.5 font-medium">
        <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        Nguồn ảnh
      </p>
      {asset.isPending ? (
        <p className="text-muted-foreground" role="status">
          Đang tải nguồn ảnh…
        </p>
      ) : asset.isError ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground">Chưa tải được nguồn ảnh.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void asset.refetch()}>
            <RefreshCw className="size-3.5" />
            Tải lại nguồn ảnh
          </Button>
        </div>
      ) : sources.length ? (
        <ul className="space-y-3">
          {sources.map((source) => {
            const url = sourceHttpUrl(source.url)
            return (
              <li key={source.id} className="min-w-0 space-y-1.5 break-words">
                <p className="font-medium leading-5">{source.label.trim() || "Nguồn chưa đặt tên"}</p>
                <p className="text-muted-foreground">Chủ sở hữu / credit: {source.ownerName || "Chưa xác nhận"}</p>
                {sourceHttpUrl(source.contactUrl) && (
                  <a
                    href={sourceHttpUrl(source.contactUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Liên hệ bên cung cấp
                  </a>
                )}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="inline-flex max-w-full items-start gap-1.5 rounded-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <ExternalLink aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 break-all leading-5">{url}</span>
                  </a>
                )}
                {source.note && (
                  <p className="whitespace-pre-wrap break-words leading-5 text-muted-foreground">{source.note}</p>
                )}
                {!url && !source.note && <p className="text-muted-foreground">Chưa có link hoặc ghi chú.</p>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="leading-5 text-muted-foreground">Chưa ghi nhận nguồn cho ảnh này.</p>
      )}
      {asset.data?.currentVersionId && (
        <MediaSourceEditor
          key={`${assetId}:${asset.data.currentVersionId}`}
          assetId={assetId}
          versionId={asset.data.currentVersionId}
        />
      )}
    </div>
  )
}
