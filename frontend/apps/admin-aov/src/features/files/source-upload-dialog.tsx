import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, CircleAlert, FilePlus2, LoaderCircle } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { errorMessage } from "@/lib/api/errors"
import { useIsWide } from "@/hooks/use-media-query"
import { control } from "../publishing/components/editing/fields"
import { estimateUpload, refreshSourceFiles, type SourceCollection, type StorageEstimate } from "./files-api"
import { formatCount, formatShare, formatStorage, LEVEL_COLORS, LEVEL_LABELS } from "./files-format"
import {
  joinPath,
  MAX_BROWSER_UPLOAD_BYTES,
  safeFileName,
  sha256Hex,
  sourceContentType,
  uploadSourceFile,
} from "./source-upload"

type Status = "hashing" | "ready" | "uploading" | "stored" | "uploaded" | "failed" | "refused"

interface Picked {
  file: File
  name: string
  contentType: string | null
  sha256?: string
  status: Status
  message?: string
}

/**
 * Uploads files into one collection. Before anything is written it shows what the batch adds: new files, bytes, R2
 * operations and the storage after the upload against the free tier (ADR-030 section 10).
 */
export function SourceUploadDialog({
  open,
  collection,
  onClose,
}: {
  open: boolean
  collection: SourceCollection
  onClose: () => void
}) {
  const wide = useIsWide()
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(560px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle>Tải tệp lên bộ "{collection.label}"</SheetTitle>
          <SheetDescription>
            Ảnh, JSON, CSV, Markdown, văn bản và ZIP, tối đa {formatStorage(MAX_BROWSER_UPLOAD_BYTES)} mỗi tệp. Bộ lớn
            hơn đẩy bằng công cụ đồng bộ dòng lệnh.
          </SheetDescription>
        </SheetHeader>
        {open && <UploadForm collection={collection} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function UploadForm({ collection, onClose }: { collection: SourceCollection; onClose: () => void }) {
  const client = useQueryClient()
  const [folder, setFolder] = useState("")
  const [picked, setPicked] = useState<Picked[]>([])
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const accepted = picked.filter((item) => item.status !== "refused")
  const hashing = picked.some((item) => item.status === "hashing")
  const done =
    picked.length > 0 && picked.every((item) => ["stored", "uploaded", "failed", "refused"].includes(item.status))

  const choose = async (files: File[]) => {
    const next: Picked[] = files.map((file) => {
      const contentType = sourceContentType(file.name)
      const refused = !contentType
        ? "Loại tệp không được lưu trong kho riêng tư."
        : file.size > MAX_BROWSER_UPLOAD_BYTES
          ? "Quá lớn để tải trong trình duyệt; dùng công cụ đồng bộ."
          : undefined
      return {
        file,
        name: safeFileName(file.name),
        contentType,
        status: refused ? "refused" : "hashing",
        message: refused,
      }
    })
    setPicked(next)
    setEstimate(null)
    for (const [index, item] of next.entries()) {
      if (item.status !== "hashing") continue
      const sha256 = await sha256Hex(item.file)
      setPicked((current) => current.map((entry, at) => (at === index ? { ...entry, sha256, status: "ready" } : entry)))
    }
  }

  // The estimate is asked once every accepted file has its hash, so known bytes are recognized.
  useEffect(() => {
    const ready = picked.filter((item) => item.status === "ready" && item.sha256)
    if (ready.length === 0 || hashing || running || done) return
    let cancelled = false
    setEstimateError(null)
    estimateUpload(
      "SOURCES",
      ready.map((item) => ({ sha256: item.sha256, sizeBytes: item.file.size })),
    )
      .then((result) => !cancelled && setEstimate(result))
      .catch((cause) => !cancelled && setEstimateError(errorMessage(cause)))
    return () => {
      cancelled = true
    }
  }, [picked, hashing, running, done])

  const upload = async () => {
    setRunning(true)
    for (const [index, item] of picked.entries()) {
      if (item.status !== "ready" || !item.sha256 || !item.contentType) continue
      setPicked((current) => current.map((entry, at) => (at === index ? { ...entry, status: "uploading" } : entry)))
      try {
        const result = await uploadSourceFile({
          collectionId: collection.id,
          path: joinPath(folder, item.name),
          file: item.file,
          sha256: item.sha256,
          contentType: item.contentType,
        })
        setPicked((current) =>
          current.map((entry, at) =>
            at === index ? { ...entry, status: result.stored ? "stored" : "uploaded" } : entry,
          ),
        )
      } catch (cause) {
        setPicked((current) =>
          current.map((entry, at) =>
            at === index ? { ...entry, status: "failed", message: errorMessage(cause) } : entry,
          ),
        )
      }
    }
    setRunning(false)
    await refreshSourceFiles(client)
  }

  return (
    <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 pb-6">
      <label className="grid gap-1.5">
        <span className="type-label">Thư mục trong bộ</span>
        <input
          className={control}
          value={folder}
          disabled={running}
          placeholder="raw/shop/2026-09-16 (để trống: gốc của bộ)"
          onChange={(event) => setFolder(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={running} onClick={() => input.current?.click()}>
          <FilePlus2 />
          Chọn tệp
        </Button>
        <span className="type-meta">
          {picked.length === 0
            ? "Chưa chọn tệp nào."
            : `${formatCount(accepted.length)} tệp, ${formatStorage(accepted.reduce((sum, item) => sum + item.file.size, 0))}`}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            event.target.value = ""
            if (files.length) void choose(files)
          }}
        />
      </div>

      {picked.length > 0 && (
        <ul className="grid gap-1" aria-label="Tệp đã chọn">
          {picked.map((item, index) => (
            <li key={`${item.name}-${index}`} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-2">
              <StatusIcon status={item.status} />
              <span className="grid min-w-0">
                <span className="truncate type-body">{joinPath(folder, item.name)}</span>
                {item.message && <span className="type-meta text-destructive">{item.message}</span>}
                {item.status === "stored" && <span className="type-meta">Đã có trên R2, chỉ thêm vào bộ</span>}
              </span>
              <span className="type-meta tabular-nums">{formatStorage(item.file.size)}</span>
            </li>
          ))}
        </ul>
      )}

      {estimate && !done && <EstimatePanel estimate={estimate} />}
      {estimateError && (
        <p role="alert" className="type-body text-destructive">
          Không ước lượng được: {estimateError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {done ? (
          <Button onClick={onClose}>Đóng</Button>
        ) : (
          <Button
            disabled={running || hashing || !estimate || accepted.every((item) => item.status !== "ready")}
            onClick={() => void upload()}
          >
            {running ? "Đang tải lên…" : `Tải lên ${formatCount(accepted.length)} tệp`}
          </Button>
        )}
      </div>
    </div>
  )
}

function EstimatePanel({ estimate }: { estimate: StorageEstimate }) {
  const colors = LEVEL_COLORS[estimate.level]
  return (
    <section
      aria-label="Ước lượng trước khi tải"
      className="grid gap-1.5 rounded-lg border p-3"
      style={{ background: estimate.level === "OK" ? undefined : colors.track }}
    >
      <h3 className="type-label">Ước lượng trước khi tải</h3>
      <p className="type-body tabular-nums">
        {formatCount(estimate.newFiles)} tệp mới · {formatStorage(estimate.newBytes)} · {formatCount(estimate.classA)}{" "}
        thao tác lớp A · {formatCount(estimate.classB)} lớp B
      </p>
      {estimate.knownFiles > 0 && (
        <p className="type-meta">
          {formatCount(estimate.knownFiles)} tệp đã có trên R2 ({formatStorage(estimate.knownBytes)}): chỉ thêm vào bộ,
          không tốn dung lượng.
        </p>
      )}
      <p className="type-body tabular-nums">
        Sau khi tải: {formatStorage(estimate.storageBytesAfter)}, {formatShare(estimate.storageShareAfter)} mức miễn phí
        · <span style={{ color: colors.ink }}>{LEVEL_LABELS[estimate.level]}</span>
      </p>
    </section>
  )
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "hashing" || status === "uploading")
    return <LoaderCircle aria-label="Đang xử lý" className="size-4 motion-safe:animate-spin" />
  if (status === "stored" || status === "uploaded")
    return <CheckCircle2 aria-label="Xong" className="size-4 text-[var(--aov-success)]" />
  if (status === "failed" || status === "refused")
    return <CircleAlert aria-label="Lỗi" className="size-4 text-destructive" />
  return <span aria-label="Sẵn sàng" className="mt-1.5 size-2 rounded-full bg-[var(--aov-line-strong)]" />
}
