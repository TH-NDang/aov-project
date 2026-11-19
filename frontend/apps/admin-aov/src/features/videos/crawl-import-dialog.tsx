import { useEffect, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, FileUp, Loader2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Checkbox } from "@aov/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { Progress } from "@aov/ui/components/progress"
import { errorMessage } from "@/lib/api/errors"
import { batches, planCrawlImport, readCrawlFile, type CrawlFiles } from "./crawl-import"
import { videoApi, videoKeys } from "./video-api"
import type { VideoSubject } from "./video-model"

const BATCH_SIZE = 200

interface Outcome {
  created: number
  skipped: number
  rejected: string[]
}

/**
 * Reads the crawl's JSON files in the browser and shows what would happen before anything is sent. The backend skips rows
 * that exist already, so the same files can be imported again after the crawl grows.
 */
export function CrawlImportDialog({
  open,
  onClose,
  subjects,
  subjectSummary,
}: {
  open: boolean
  onClose: () => void
  subjects: readonly VideoSubject[]
  subjectSummary: string
}) {
  const cache = useQueryClient()
  const [files, setFiles] = useState<CrawlFiles>({})
  const [names, setNames] = useState<string[]>([])
  const [fileError, setFileError] = useState("")
  const [includeSuggestions, setIncludeSuggestions] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (open) return
    setFiles({})
    setNames([])
    setFileError("")
    setProgress(0)
    setOutcome(null)
  }, [open])

  const plan = useMemo(
    () => planCrawlImport(files, subjects, { includeSuggestions }),
    [files, includeSuggestions, subjects],
  )

  const read = async (list: File[]) => {
    setFileError("")
    setOutcome(null)
    let next = files
    const added: string[] = []
    for (const file of list) {
      try {
        next = readCrawlFile(JSON.parse(await file.text()), next)
        added.push(file.name)
      } catch (error) {
        setFileError(`${file.name}: ${error instanceof Error ? error.message : "Không đọc được tệp."}`)
      }
    }
    setFiles(next)
    setNames((current) => [...new Set([...current, ...added])])
  }

  const run = useMutation({
    mutationFn: async () => {
      const result: Outcome = { created: 0, skipped: 0, rejected: [] }
      const parts = batches(plan.rows, BATCH_SIZE)
      for (const [index, part] of parts.entries()) {
        const response = await videoApi.importBatch(part)
        result.created += response.created
        result.skipped += response.skipped
        for (const rejected of response.rejected)
          result.rejected.push(`${part[rejected.index]?.title ?? rejected.index}: ${rejected.reason}`)
        setProgress(Math.round(((index + 1) / parts.length) * 100))
      }
      return result
    },
    onSuccess: setOutcome,
    onSettled: () => cache.invalidateQueries({ queryKey: videoKeys.lists }),
    meta: { silent: true },
  })

  const counts = plan.counts
  const publishing = counts.skinPublished + counts.storyPublished
  const reviewing = counts.skinDraft + counts.storyDraft + counts.suggestions
  const hasFiles = names.length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !run.isPending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập dữ liệu thu thập</DialogTitle>
          <DialogDescription>
            Chọn các tệp skins.json, stories.json và (không bắt buộc) hero-videos.json trong analysis/results/catalog
            của repo lienquan-youtube-crawl. Dữ liệu được so khớp với {subjectSummary} rồi mới gửi đi.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm hover:bg-muted">
          <FileUp className="size-4" />
          {hasFiles ? names.join(", ") : "Chọn tệp JSON"}
          <input
            type="file"
            accept=".json,application/json"
            multiple
            className="sr-only"
            disabled={run.isPending}
            onChange={(event) => {
              void read([...(event.target.files ?? [])])
              event.target.value = ""
            }}
          />
        </label>
        {fileError && (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        )}

        {files.heroVideos && (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={includeSuggestions}
              disabled={run.isPending}
              onCheckedChange={(checked) => setIncludeSuggestions(checked === true)}
            />
            <span className="grid gap-0.5">
              <span>Thêm cả video giới thiệu và hướng dẫn tướng</span>
              <span className="type-meta">Phân loại tự động chưa đủ chắc, nên chúng vào mục Chờ duyệt.</span>
            </span>
          </label>
        )}

        {hasFiles && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-[1fr_auto_1fr_auto]">
            <dt>Trang phục hiện ngay</dt>
            <dd className="text-right tabular-nums">{counts.skinPublished}</dd>
            <dt>Trang phục chờ duyệt</dt>
            <dd className="text-right tabular-nums">{counts.skinDraft}</dd>
            <dt>Cốt truyện hiện ngay</dt>
            <dd className="text-right tabular-nums">{counts.storyPublished}</dd>
            <dt>Cốt truyện chờ duyệt</dt>
            <dd className="text-right tabular-nums">{counts.storyDraft}</dd>
            <dt>Giới thiệu, hướng dẫn chờ duyệt</dt>
            <dd className="text-right tabular-nums">{counts.suggestions}</dd>
            <dt>Bỏ qua (sự kiện, nhạc, giải trí…)</dt>
            <dd className="text-right tabular-nums">{counts.ignoredTypes}</dd>
            <dt>Truyện chưa rõ tướng</dt>
            <dd className="text-right tabular-nums">{counts.storiesWithoutHero}</dd>
            <dt>Không khớp được</dt>
            <dd className="text-right tabular-nums">{plan.unmatched.length}</dd>
          </dl>
        )}

        {plan.unmatched.length > 0 && (
          <details className="rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer">Xem {plan.unmatched.length} mục không khớp (không được nhập)</summary>
            <ul className="mt-2 grid max-h-48 gap-1 overflow-y-auto">
              {plan.unmatched.map((entry) => (
                <li key={`${entry.kind}:${entry.source}`} className="flex justify-between gap-3">
                  <span className="truncate">{entry.kind === "HERO" ? `Tướng ${entry.source}` : entry.source}</span>
                  <span className="type-meta shrink-0 tabular-nums">{entry.videos} video</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {run.isPending && <Progress value={progress} aria-label="Tiến độ nhập" />}
        {run.error && (
          <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
            {errorMessage(run.error)}
          </p>
        )}
        {outcome && (
          <div className="rounded-lg border p-3 text-sm" role="status">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Đã thêm {outcome.created} video, bỏ qua {outcome.skipped} video đã có.
            </p>
            {outcome.rejected.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">{outcome.rejected.length} dòng bị từ chối</summary>
                <ul className="mt-1 grid gap-1">
                  {outcome.rejected.slice(0, 50).map((line) => (
                    <li key={line} className="type-meta">
                      {line}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={run.isPending}>
            {outcome ? "Đóng" : "Hủy"}
          </Button>
          <Button
            type="button"
            disabled={!plan.rows.length || run.isPending || !!outcome}
            onClick={() => {
              setProgress(0)
              run.mutate()
            }}
          >
            {run.isPending && <Loader2 className="size-4 animate-spin" />}
            Nhập {publishing + reviewing} video
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
