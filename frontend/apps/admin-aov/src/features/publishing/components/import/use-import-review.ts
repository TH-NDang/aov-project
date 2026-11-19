import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { errorMessage } from "@/lib/api/errors"
import { type Request, publishingKeys } from "@/lib/api/publishing-api"
import type {
  ImportActivity,
  ImportEntry as Entry,
  ImportField as Field,
  ImportPolicy as Policy,
  HeroImportInput as Input,
  HeroImportPlan as Plan,
} from "../../model/import/hero-import-types"
import { matchesImportFilter } from "../../model/import/hero-import-model"
import type { Relation, RelationField, RelationMapping } from "../../model/import/import-relations"
import type { ImportContext } from "./import-context"
import { checkImportRow } from "./import-row-check"
import { createUploadSession, resumeUploadSession, type UploadSession } from "./import-upload-session"

/**
 * The last two steps of an import: checking every row with the server, choosing the rows to keep, and sending them
 * with their pictures as one job. A send that was not confirmed is kept, so sending again repeats the same job.
 */
export function useImportReview({
  request,
  context,
  locale,
  files,
  base,
  fileName,
  rows,
  idColumn,
  mode,
  fields,
  relationFields,
  mapping,
  relations,
  policies,
  setBusy,
  setError,
  setProgress,
  setActivity,
  setStep,
}: {
  request: Request
  context: ImportContext | null
  locale: string
  files: Map<string, File>
  base: string
  fileName: string
  rows: Record<string, unknown>[]
  idColumn: string
  mode: Input["mode"]
  fields: Field[] | undefined
  relationFields: Record<Relation, RelationField[]> | undefined
  mapping: Record<string, string>
  relations: Record<Relation, RelationMapping>
  policies: Record<string, Policy>
  setBusy: (busy: boolean) => void
  setError: (message: string) => void
  setProgress: (progress: string) => void
  setActivity: (activity: ImportActivity) => void
  setStep: (step: number) => void
}) {
  const cache = useQueryClient()
  const [filter, setFilter] = useState("ALL")
  const [entries, setEntries] = useState<Entry[]>([])
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set())
  const [expandedImages, setExpandedImages] = useState<Set<number>>(new Set())
  const [pendingTransfer, setPendingTransfer] = useState(false)
  useEffect(() => {
    if (!pendingTransfer) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [pendingTransfer])
  const submission = useRef<UploadSession | null>(null)
  const [awaitingRetry, setAwaitingRetry] = useState(false)

  async function preview() {
    if (!context) return
    setBusy(true)
    setError("")
    setEntries([])
    setExpandedEntries(new Set())
    setExpandedImages(new Set())
    setActivity({ status: "running", description: "Đang kiểm tra dữ liệu", completed: 0, total: rows.length })
    const next: Entry[] = []
    const seen = new Set<string>()
    try {
      for (const row of rows) {
        setProgress(`Đang kiểm tra ${next.length + 1}/${rows.length}`)
        const { code, entry } = await checkImportRow({
          row,
          idColumn,
          seen,
          context,
          mode,
          locale,
          fields: fields ?? [],
          relationFields,
          mapping,
          relations,
          policies,
          files,
          base,
          preview: (input) =>
            request<Plan>("/admin/heroes/import/preview", { method: "POST", body: JSON.stringify(input) }),
        })
        next.push(entry)
        setActivity({
          status: "running",
          description: `Đang kiểm tra: ${code}`,
          completed: next.length,
          total: rows.length,
        })
      }
      setEntries(next)
      setFilter("ALL")
      setStep(3)
      setActivity({
        status: "review",
        description: `Chờ duyệt ${next.length} tướng`,
        completed: next.length,
        total: rows.length,
      })
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    setPendingTransfer(true)
    setBusy(true)
    setError("")
    const selected = entries.filter((entry) => entry.selected && entry.plan && !entry.result)
    const total = selected.length
    setActivity({ status: "running", description: "Đang chuẩn bị nhập", completed: 0, total })
    try {
      if (!submission.current) {
        submission.current = await createUploadSession(
          selected.map(({ input, imageUrls, relatedImages }) => ({ input, imageUrls, relatedImages })),
          files,
          base,
          `${fileName} · ${context?.seasonName} / ${context?.patchCode}`,
        )
      }
      await resumeUploadSession(request, submission.current, files, (completed, total, description) => {
        setProgress(description)
        setActivity({ status: "running", description, completed, total })
      })
      setPendingTransfer(false)
      setAwaitingRetry(false)
      const codes = new Set(submission.current.state.entries.map((entry) => entry.input.code))
      setEntries((current) =>
        current.map((entry) =>
          codes.has(entry.input.code)
            ? { ...entry, result: "Đã gửi đến máy chủ", selected: false, error: undefined }
            : entry,
        ),
      )
      submission.current = null
      setActivity({
        status: "completed",
        description: "Đã gửi đến máy chủ · xem tiến trình bên dưới",
        completed: total,
        total,
      })
      await cache.invalidateQueries({ queryKey: publishingKeys.allImportJobs })
    } catch (cause) {
      setAwaitingRetry(!!submission.current)
      setError(errorMessage(cause))
      setActivity({
        status: "error",
        description: submission.current
          ? "Chưa xác nhận đã nhận tác vụ. Gửi lại để kiểm tra."
          : "Chuẩn bị nhập thất bại",
        completed: 0,
        total,
      })
    } finally {
      setBusy(false)
      await cache.invalidateQueries({ queryKey: publishingKeys.uploadSessions })
    }
  }

  /** A new source starts over: no plans, and no send waiting to be confirmed. */
  function forgetSubmission() {
    setPendingTransfer(false)
    submission.current = null
  }

  return {
    filter,
    setFilter,
    entries,
    setEntries,
    expandedEntries,
    setExpandedEntries,
    expandedImages,
    setExpandedImages,
    pendingTransfer,
    awaitingRetry,
    selectedCount: entries.filter((entry) => entry.selected).length,
    shown: entries.filter((entry) => matchesImportFilter(entry, filter)),
    preview,
    apply,
    forgetSubmission,
  }
}

export type ImportReview = ReturnType<typeof useImportReview>
