import { useEffect, useId, useRef, useState } from "react"
import { useBlocker } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Check, FileJson, LoaderCircle, Pause, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
import {
  importCounts,
  MAX_REGISTRY_IMPORT_BYTES,
  parseRegistryImport,
  type ImportKind,
  type RegistryImport,
} from "./registry-import-model"
import {
  prepareRegistryImport,
  RegistryImportFailure,
  runRegistryImport,
  type ImportOperation,
  type ImportProgress,
  type PreparedImportRow,
} from "./registry-import-runner"
import { tournamentError, tournamentIssueFields, tournamentKeys } from "./tournament-api"

const OPERATIONS: Record<ImportOperation, string> = {
  create: "Tạo mới",
  update: "Cập nhật",
  restore: "Khôi phục / cập nhật",
  skip: "Đã khớp",
}

export function RegistryImportSheet({ onClose }: { onClose: () => void }) {
  const inputId = useId()
  const client = useQueryClient()
  const [fileName, setFileName] = useState("")
  const [plan, setPlan] = useState<RegistryImport | null>(null)
  const [preview, setPreview] = useState<PreparedImportRow[] | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [filter, setFilter] = useState<ImportKind | "all">("all")
  const [error, setError] = useState<unknown>(null)
  const [finished, setFinished] = useState(false)
  const [paused, setPaused] = useState(false)
  const stop = useRef(false)
  const preparingController = useRef<AbortController | null>(null)
  const blocker = useBlocker(running)
  useEffect(() => () => preparingController.current?.abort(), [])
  useEffect(() => {
    if (!running) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [running])
  async function readFile(file: File) {
    preparingController.current?.abort()
    const controller = new AbortController()
    preparingController.current = controller
    setPreparing(true)
    setFileName(file.name)
    setPlan(null)
    setPreview(null)
    setProgress(null)
    setError(null)
    setFinished(false)
    setPaused(false)
    setFilter("all")
    try {
      if (file.size > MAX_REGISTRY_IMPORT_BYTES) throw new Error("File JSON không được lớn hơn 1 MB.")
      const imported = parseRegistryImport(await file.text())
      const prepared = await prepareRegistryImport(imported, undefined, controller.signal)
      if (!controller.signal.aborted) {
        setPlan(imported)
        setPreview(prepared)
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause)
    } finally {
      if (!controller.signal.aborted) setPreparing(false)
    }
  }
  async function start() {
    if (!plan || !preview || running) return
    stop.current = false
    setRunning(true)
    setError(null)
    setFinished(false)
    setPaused(false)
    setProgress({ completed: 0, total: plan.rows.length })
    try {
      const result = await runRegistryImport(plan, { shouldStop: () => stop.current, onProgress: setProgress })
      setFinished(!result.stopped)
      setPaused(result.stopped)
    } catch (cause) {
      setError(cause)
    } finally {
      await client.invalidateQueries({
        queryKey: tournamentKeys.all,
        predicate: (query) => query.queryKey[2] !== "deletion-impact",
      })
      setRunning(false)
    }
  }
  const counts = plan ? importCounts(plan.rows) : []
  const failed = error instanceof RegistryImportFailure ? error : null
  const cause = failed?.cause ?? error
  const issues = tournamentIssueFields(cause)
  const rows = preview?.filter((entry) => filter === "all" || entry.row.kind === filter) ?? []
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open && !running) onClose()
        }}
      >
        <SheetContent
          className="registry-import-sheet"
          showCloseButton={!running}
          onEscapeKeyDown={(event) => running && event.preventDefault()}
          onPointerDownOutside={(event) => running && event.preventDefault()}
        >
          <SheetTitle className="flex items-center gap-2">
            <FileJson size={20} />
            Nhập dữ liệu giải đấu
          </SheetTitle>
          <SheetDescription>
            JSON · tối đa 1 MB. Giữ trang mở khi nhập; không tự xuất bản hoặc tạo ván đấu.
          </SheetDescription>
          <label className="registry-import-file" htmlFor={inputId}>
            <Upload size={19} />
            <span>
              <strong>{fileName || "Chọn file JSON"}</strong>
              <small>Đội, tuyển thủ, giải, đội hình hoặc trận đấu</small>
            </span>
            <input
              id={inputId}
              aria-label="Chọn file nhập dữ liệu"
              type="file"
              accept=".json,application/json"
              disabled={running || preparing}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void readFile(file)
              }}
            />
          </label>
          {preparing && (
            <p className="tournament-muted flex items-center gap-2" role="status">
              <LoaderCircle size={15} className="animate-spin" />
              Đang đối chiếu cả dữ liệu đang dùng và thùng rác…
            </p>
          )}
          {plan && preview && (
            <>
              <div className="registry-import-counts" aria-label="Số mục sẽ nhập">
                <strong>{plan.rows.length} mục</strong>
                {counts.map((entry) => (
                  <span key={entry.kind}>
                    {entry.label}
                    <b>{entry.count}</b>
                  </span>
                ))}
                {!!plan.skipped && <small>Bỏ qua {plan.skipped} mục chưa sẵn sàng</small>}
              </div>
              <p className="registry-import-policy">
                Chỉ khôi phục mục có trong file. Giữ logo/ảnh đã có khi file để trống; các trường khác dùng giá trị được
                cung cấp. Có thể nhập lại cùng file để tiếp tục.
              </p>
              <div className="registry-import-operation-counts">
                {Object.entries(OPERATIONS).map(([operation, label]) => {
                  const count = preview.filter((entry) => entry.operation === operation).length
                  return count ? (
                    <span key={operation} data-operation={operation}>
                      {label}
                      <b>{count}</b>
                    </span>
                  ) : null
                })}
              </div>
              <div className="registry-import-filters" aria-label="Lọc bản xem trước">
                <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                  Tất cả
                </button>
                {counts.map((entry) => (
                  <button
                    key={entry.kind}
                    type="button"
                    aria-pressed={filter === entry.kind}
                    onClick={() => setFilter(entry.kind)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              <ul className="registry-import-preview" aria-label="Các mục sẽ nhập">
                {rows.map(({ row, operation }) => (
                  <li key={`${row.kind}:${row.key}`}>
                    <div>
                      <strong>{row.label}</strong>
                      <small>{row.key}</small>
                    </div>
                    <span data-operation={operation}>{OPERATIONS[operation]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {progress && (
            <section className="registry-import-progress" aria-live="polite">
              <div>
                <strong>
                  {finished ? "Đã nhập xong" : paused ? "Đã tạm dừng" : error ? "Đã dừng tại lỗi" : "Đang nhập"}
                </strong>
                <span>
                  {progress.completed} / {progress.total}
                </span>
              </div>
              <progress max={progress.total} value={progress.completed} />
              {progress.row && (
                <small>
                  {progress.row.label} · {progress.operation ? OPERATIONS[progress.operation] : ""}
                </small>
              )}
            </section>
          )}
          {!!error && (
            <div className="tournament-error" role="alert">
              {failed && (
                <strong>
                  {failed.row.label} ({failed.row.key})<br />
                </strong>
              )}
              {tournamentError(cause)}
              {!!issues.length && (
                <ul>
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <footer className="registry-import-footer">
            {running ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  stop.current = true
                  setPaused(true)
                }}
                disabled={paused}
              >
                <Pause size={14} />
                {paused ? "Đang dừng sau mục này…" : "Tạm dừng"}
              </Button>
            ) : (
              <Button type="button" disabled={!preview || preparing || finished} onClick={() => void start()}>
                {finished ? <Check size={15} /> : <Upload size={15} />}
                {finished ? "Đã hoàn tất" : progress ? "Nhập lại để tiếp tục" : "Bắt đầu nhập"}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={running} onClick={onClose}>
              Đóng
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đang nhập dữ liệu</AlertDialogTitle>
            <AlertDialogDescription>
              Tạm dừng sau mục đang xử lý rồi đóng. Các mục đã nhập được giữ lại; nhập lại file sẽ đối chiếu để tiếp
              tục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset()
              }}
            >
              Ở lại
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stop.current = true
                setPaused(true)
                if (blocker.state === "blocked") blocker.reset()
              }}
            >
              Tạm dừng
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
