import { AlertTriangle, ExternalLink } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { CopyButton } from "@/components/copy-button"
import {
  captureImageTitle,
  captureLinkHints,
  captureLinkLabels,
  captureSourcePath,
  type CaptureGroup,
  type CaptureImage,
} from "../../model/captures/patch-capture-model"

/** What the open picture is: how sure its link to the item is, what was read from it, its review notes and its file. */
export function CaptureDetails({
  group,
  image,
  url,
}: {
  group: CaptureGroup
  image: CaptureImage
  url: string | undefined
}) {
  return (
    <div className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-label min-w-0 break-words">{captureImageTitle(group, image)}</h3>
        <Badge
          variant={image.link === "REVIEWED" ? "secondary" : "outline"}
          title={captureLinkHints[image.link]}
          className={cn(image.link !== "REVIEWED" && "border-(--aov-warning)/40 text-(--aov-warning)")}
        >
          {captureLinkLabels[image.link]}
        </Badge>
      </div>
      {image.reading && (
        <p className="type-body">
          {image.card ? `Đọc từ thẻ số ${image.card}: ` : "Đọc được: "}
          <span className="font-semibold">{image.reading}</span>
        </p>
      )}
      <p className="type-meta">{captureLinkHints[image.link]}</p>
      {image.notes.length > 0 && (
        <div
          aria-label="Ghi chú rà soát"
          className="space-y-2 rounded-lg border border-(--aov-warning)/25 bg-(--aov-warning-soft) p-3 text-xs leading-5 [overflow-wrap:anywhere]"
        >
          {image.notes.map((note) => (
            <p key={note} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-(--aov-warning)" />
              {note}
            </p>
          ))}
        </div>
      )}
      <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
        <code className="min-w-0 flex-1 truncate font-mono" title={captureSourcePath(image)}>
          {image.fileName}
        </code>
        <CopyButton value={captureSourcePath(image)} label="Sao chép đường dẫn tệp nguồn" />
        {url ? (
          <Button variant="ghost" size="icon-xs" asChild>
            <a href={url} target="_blank" rel="noreferrer" aria-label="Mở ảnh gốc trong thẻ mới">
              <ExternalLink />
            </a>
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" disabled aria-label="Mở ảnh gốc trong thẻ mới">
            <ExternalLink />
          </Button>
        )}
      </div>
    </div>
  )
}
