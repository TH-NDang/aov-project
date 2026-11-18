import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { readImportZip } from "../../model/import/import-archive"
import { indexImportFiles, normalizeImportPath } from "../../model/import/import-files"
import { resumeUploadSession, uploadSessionsPath, type UploadSession } from "./import-upload-session"
import { useBackgroundTasks } from "@/app/background-tasks"
import { confirmAction } from "@/components/confirm-dialog"
import { publishingKeys } from "@/lib/api/publishing-api"

export function ImportUploadRecovery({
  disabled,
  onBusyChange,
}: {
  disabled: boolean
  onBusyChange: (busy: boolean) => void
}) {
  const cache = useQueryClient()
  const sessions = useQuery({
    queryKey: publishingKeys.uploadSessions,
    queryFn: () => backendRequest<UploadSession[]>(uploadSessionsPath),
    enabled: !disabled,
  })
  const [active, setActive] = useState<UploadSession | null>(null)
  const [files, setFiles] = useState(new Map<string, File>())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const { updateTask } = useBackgroundTasks()
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [busy])
  async function selectFiles(selected: File[]) {
    setBusy(true)
    setError("")
    try {
      const index =
        selected.length === 1 && /\.zip$/i.test(selected[0].name)
          ? await readImportZip(selected[0])
          : indexImportFiles(selected)
      // Folder pickers strip the wrapper; ZIPs and folder drops can retain it.
      const resolved = new Map(index)
      for (const image of Object.values(active?.state.images ?? {})) {
        // Links and absolute paths, such as a session saved before the resources folder left the app, match no file.
        if (image.completed || image.source.startsWith("https:") || image.source.startsWith("/")) continue
        const path = normalizeImportPath(`${active!.state.base ? `${active!.state.base}/` : ""}${image.source}`)
        if (resolved.has(path)) continue
        const candidates = [...index].filter(([key]) => path.endsWith(`/${key}`) || key.endsWith(`/${path}`))
        if (candidates.length === 1) resolved.set(path, candidates[0][1])
      }
      setFiles(resolved)
      setMessage(`Đã chọn ${index.size} tệp. Chỉ ảnh còn thiếu sẽ được tải lên.`)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  async function resume() {
    if (!active) return
    setBusy(true)
    setError("")
    try {
      await resumeUploadSession(backendRequest, active, files, (completed, total, description) => {
        setMessage(description)
        updateTask({
          id: "hero-import",
          title: "Nhập tướng",
          path: "/hero/import",
          status: "running",
          completed,
          total,
          description,
        })
      })
      setActive(null)
      setFiles(new Map())
      setMessage("Đã gửi đến máy chủ. Bạn có thể đóng trang.")
      updateTask({
        id: "hero-import",
        title: "Nhập tướng",
        path: "/hero/import",
        status: "completed",
        completed: 1,
        total: 1,
        description: "Đã gửi đến máy chủ",
      })
      await cache.invalidateQueries({ queryKey: publishingKeys.allImportJobs })
    } catch (cause) {
      setError(errorMessage(cause))
      updateTask({
        id: "hero-import",
        title: "Nhập tướng",
        path: "/hero/import",
        status: "error",
        completed: 0,
        total: 1,
        description: "Tải lên tạm dừng · có thể tiếp tục",
      })
    } finally {
      setBusy(false)
      await cache.invalidateQueries({ queryKey: publishingKeys.uploadSessions })
    }
  }
  async function discard(session: UploadSession) {
    if (
      !(await confirmAction({
        title: "Bỏ phiên tải lên này?",
        description: "Các ảnh đã tải vẫn ở thư viện media; dữ liệu tướng chưa được nhập sẽ không tiếp tục.",
        confirmLabel: "Bỏ phiên tải lên",
        cancelLabel: "Giữ phiên tải lên",
      }))
    )
      return
    setBusy(true)
    setError("")
    try {
      await backendRequest(`${uploadSessionsPath}/${session.id}`, { method: "DELETE" })
      if (active?.id === session.id) {
        setActive(null)
        setFiles(new Map())
      }
      await cache.invalidateQueries({ queryKey: publishingKeys.uploadSessions })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  if (!sessions.data?.length && !active && !sessions.error && !message) return null
  return (
    <section className="space-y-3 admin-section py-5" aria-label="Khôi phục tải lên">
      <h2 className="type-section-title">Tải lên đang dở</h2>
      <p className="text-sm text-muted-foreground">
        Ảnh đã hoàn tất được giữ trên máy chủ. Chọn lại folder/ZIP ban đầu nếu còn ảnh chưa tải; không cần ánh xạ lại.
      </p>
      {sessions.error && <p role="alert">Không tải được các phiên upload: {errorMessage(sessions.error)}</p>}
      {sessions.data?.map((session) => (
        <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
          <div>
            <p className="text-sm font-medium">{session.state.label}</p>
            <p className="text-xs text-muted-foreground">
              {Object.values(session.state.images).filter((image) => image.completed).length}/
              {Object.keys(session.state.images).length} ảnh đã hoàn tất
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy || disabled}
              onClick={() => {
                setActive(structuredClone(session))
                setFiles(new Map())
                setError("")
                setMessage("")
              }}
            >
              Tiếp tục tải lên
            </Button>
            <Button variant="ghost" disabled={busy || disabled} onClick={() => void discard(session)}>
              Bỏ phiên
            </Button>
          </div>
        </div>
      ))}
      {active && (
        <fieldset disabled={busy || disabled} className="space-y-3 rounded-lg bg-muted/30 p-3">
          <p className="text-sm font-medium">{active.state.label}</p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              Chọn lại thư mục
              <input
                type="file"
                multiple
                {...{ webkitdirectory: "" }}
                onChange={(event) => {
                  void selectFiles(Array.from(event.target.files ?? []))
                  event.target.value = ""
                }}
                className="block max-w-full"
              />
            </label>
            <label className="text-sm">
              Hoặc ZIP
              <input
                type="file"
                accept=".zip"
                onChange={(event) => {
                  void selectFiles(Array.from(event.target.files ?? []))
                  event.target.value = ""
                }}
                className="block max-w-full"
              />
            </label>
          </div>
          <Button onClick={() => void resume()}>Tiếp tục phiên đã lưu</Button>
        </fieldset>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
