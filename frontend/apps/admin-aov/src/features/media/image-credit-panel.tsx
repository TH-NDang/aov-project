import { Link } from "react-router"
import { CircleAlert, Copyright, ExternalLink, PencilLine } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { PageReference } from "@/features/community/page-reference"
import { creditHttpUrl, type MediaCredit } from "@aov/ui/lib/media-credit"
import { primarySource, sourceGap, sourceGapHints, sourceGapLabels, visibleSources } from "./media-source-gaps"

/** Who owns an image and where it came from, shown under the large view of an image. */
export function ImageCreditPanel({
  sources,
  assetId,
  className,
}: {
  sources: readonly MediaCredit[]
  /** Links to the image library entry, where the source can be corrected. */
  assetId?: string | null
  className?: string
}) {
  const shown = visibleSources(sources)
  const gap = sourceGap(sources)
  const main = primarySource(shown)
  const others = shown.filter((source) => source !== main && source.label.trim())
  const owner = main?.ownerName?.trim()
  const url = creditHttpUrl(main?.url)
  const contact = creditHttpUrl(main?.contactUrl)
  return (
    <section
      aria-label="Nguồn và ghi công ảnh"
      className={cn(
        "space-y-2 rounded-lg border p-3 text-sm",
        gap === "none" ? "bg-muted/30" : "border-amber-500/40 bg-amber-500/10",
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="type-meta">Thuộc về</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-semibold break-words">
            {owner ? (
              <>
                <Copyright aria-hidden className="size-4 shrink-0" />
                {main?.ownerPageId ? <PageReference id={main.ownerPageId} label={owner} /> : owner}
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                {gap === "missing-owner" ? "Chưa ghi chủ sở hữu" : sourceGapLabels[gap]}
              </span>
            )}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="type-meta">Lấy từ</p>
          <p className="mt-0.5 break-words">
            {main?.label || <span className="text-muted-foreground">Chưa có nguồn</span>}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink aria-hidden className="size-3" />
                Xem nguồn
              </a>
            )}
          </p>
        </div>
      </div>
      {main?.relatedPageId && (
        <div className="type-body">
          <span className="text-muted-foreground">Nội dung liên quan: </span>
          <PageReference id={main.relatedPageId} />
        </div>
      )}
      {gap !== "none" && <p className="text-xs text-amber-800 dark:text-amber-200">{sourceGapHints[gap]}</p>}
      {(contact || others.length > 0 || assetId) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
          {others.length > 0 && <span>Nguồn khác: {others.map((source) => source.label).join(" · ")}</span>}
          {contact && (
            <a href={contact} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Liên hệ bên cung cấp
            </a>
          )}
          {assetId && (
            <Link
              to={`/files?asset=${encodeURIComponent(assetId)}`}
              className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
            >
              <PencilLine aria-hidden className="size-3" />
              {gap === "none" ? "Xem trong Quản lý tệp" : "Bổ sung trong Quản lý tệp"}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
