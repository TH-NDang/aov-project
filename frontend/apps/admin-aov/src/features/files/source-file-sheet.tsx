import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Replace, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmAction } from "@/components/confirm-dialog"
import { CopyButton } from "@/components/copy-button"
import { useIsWide } from "@/hooks/use-media-query"
import { deleteSourceFile, downloadLink, refreshSourceFiles, useSourceFile, useSourceLinks } from "./files-api"
import { CATEGORY_LABELS, fileKind, formatStorage } from "./files-format"
import { sha256Hex, sourceContentType, uploadSourceFile } from "./source-upload"

/** What kind of record keeps a file as evidence, as the owner modules report it (ADR-030 section 7). */
const USAGE_LABELS: Record<string, string> = {
  BUILD_CAPTURE: "Lần chụp build đề cử",
  RANKING_SNAPSHOT: "Bản chụp xếp hạng",
}

/** One private file: preview, size, where it is used, and deliberate actions with a confirmation. */
export function SourceFileSheet({
  fileId,
  writable,
  onClose,
}: {
  fileId: string | null
  writable: boolean
  onClose: () => void
}) {
  const wide = useIsWide()
  const client = useQueryClient()
  const file = useSourceFile(fileId)
  const details = file.data
  const image = details?.contentType.startsWith("image/") ? [details.sha256] : []
  const links = useSourceLinks(image)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const download = async () => {
    if (!details) return
    const link = await downloadLink(details.id)
    window.location.assign(link.url)
  }

  const replace = async (picked: File) => {
    if (!details) return
    const contentType = sourceContentType(picked.name)
    if (!contentType) {
      setError("Loại tệp này không được lưu trong kho riêng tư.")
      return
    }
    const accepted = await confirmAction({
      title: "Thay tệp này?",
      description: `${details.path}: ${formatStorage(details.sizeBytes)} → ${picked.name}, ${formatStorage(picked.size)}. Đường dẫn trỏ sang dữ liệu tệp mới; dữ liệu tệp cũ còn lại cho tới khi được dọn như dữ liệu tệp mồ côi.`,
      confirmLabel: "Thay tệp",
    })
    if (!accepted) return
    setBusy("replace")
    setError(null)
    try {
      await uploadSourceFile({
        collectionId: details.collection.id,
        path: details.path,
        file: picked,
        sha256: await sha256Hex(picked),
        contentType,
        replace: { fileId: details.id, expectedVersion: details.version },
      })
      await refreshSourceFiles(client)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thay được tệp.")
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!details) return
    const used = details.usages.length > 0
    const accepted = await confirmAction({
      title: "Bỏ tệp khỏi bộ?",
      description: used
        ? `${details.path} vẫn là ảnh dẫn chứng của ${details.usages.length} bản ghi. Bỏ khỏi bộ không xóa dữ liệu tệp, nên bản ghi vẫn xem được ảnh.`
        : `${details.path} rời khỏi bộ. Dữ liệu tệp vẫn nằm trên R2 cho tới khi được dọn như dữ liệu tệp mồ côi.`,
      confirmLabel: "Bỏ khỏi bộ",
    })
    if (!accepted) return
    setBusy("remove")
    try {
      await deleteSourceFile(details)
      await refreshSourceFiles(client)
      onClose()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={fileId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(520px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle className="pr-8 break-all">{details?.path.split("/").pop() ?? "Tệp nguồn"}</SheetTitle>
          <SheetDescription>
            {details ? `${CATEGORY_LABELS[details.collection.category]} · ${details.collection.label}` : "Đang tải…"}
          </SheetDescription>
        </SheetHeader>
        {file.isLoadingError && (
          <p role="alert" className="px-4 type-body text-destructive">
            Không đọc được tệp này; có thể tệp đã bị bỏ khỏi bộ.
          </p>
        )}
        {details && (
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 pb-6">
            {links.data?.[details.sha256] ? (
              <a href={links.data[details.sha256].url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={links.data[details.sha256].url}
                  alt={details.path}
                  className="max-h-[50vh] w-full rounded-lg bg-[var(--aov-raised)] object-contain"
                />
              </a>
            ) : (
              image.length > 0 && <div className="h-48 animate-pulse rounded-lg bg-[var(--aov-raised)]" aria-hidden />
            )}

            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2">
              <dt className="type-label">Đường dẫn</dt>
              <dd className="type-body break-all">{details.path}</dd>
              <dt className="type-label">Loại</dt>
              <dd className="type-body">{fileKind(details.contentType)}</dd>
              <dt className="type-label">Dung lượng</dt>
              <dd className="type-body tabular-nums">{formatStorage(details.sizeBytes)}</dd>
              <dt className="type-label">SHA-256</dt>
              <dd className="flex min-w-0 items-center gap-1">
                <code className="truncate type-meta">{details.sha256}</code>
                <CopyButton value={details.sha256} label="Chép SHA-256" />
              </dd>
              <dt className="type-label">Lưu lúc</dt>
              <dd className="type-body">
                <LocalTime value={details.createdAt} />
              </dd>
            </dl>

            <section className="grid gap-2" aria-label="Nơi dùng">
              <h3 className="type-label">Nơi dùng</h3>
              {details.usages.length === 0 ? (
                <p className="type-meta">Chưa bản ghi nào dùng tệp này làm dẫn chứng.</p>
              ) : (
                <ul className="grid gap-1">
                  {details.usages.map((usage) => (
                    <li key={`${usage.ownerType}-${usage.ownerId}-${usage.role}`} className="type-body">
                      {USAGE_LABELS[usage.ownerType] ?? usage.ownerType} <code>{usage.ownerName ?? usage.ownerId}</code>
                    </li>
                  ))}
                </ul>
              )}
              {details.otherPlaces.length > 0 && (
                <>
                  <h3 className="mt-2 type-label">Cùng dữ liệu tệp ở</h3>
                  <ul className="grid gap-1">
                    {details.otherPlaces.map((place) => (
                      <li key={place.fileId} className="type-meta break-all">
                        {place.collectionCode} / {place.path}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {error && (
              <p role="alert" className="type-body text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void download()}>
                <Download />
                Tải về
              </Button>
              {writable && (
                <>
                  <Button variant="outline" disabled={busy !== null} onClick={() => picker.current?.click()}>
                    <Replace />
                    {busy === "replace" ? "Đang thay…" : "Thay tệp"}
                  </Button>
                  <Button variant="outline" disabled={busy !== null} onClick={() => void remove()}>
                    <Trash2 />
                    Bỏ khỏi bộ
                  </Button>
                  <input
                    ref={picker}
                    type="file"
                    hidden
                    onChange={(event) => {
                      const picked = event.target.files?.[0]
                      event.target.value = ""
                      if (picked) void replace(picked)
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
