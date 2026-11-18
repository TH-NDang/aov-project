import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CircleAlert, LoaderCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { useTournamentAccess } from "../../esports/data/use-esports-data"
import type { Asset } from "../../publishing/api/types"
import { LibraryImage } from "./image-library-presentation"
import { invalidateMediaAsset } from "../api/media-cache"
import { deleteMediaAsset, deletionKey, readDeletionReferences, readMediaDeletion } from "../model/media-deletion"

export function ImageDeleteAction({
  asset,
  label,
  versionCount,
  disabled,
  onBusyChange,
  onDeleted,
}: {
  asset: Asset
  label: string
  versionCount: number
  disabled?: boolean
  onBusyChange: (busy: boolean) => void
  onDeleted: () => void
}) {
  const client = useQueryClient()
  const writable = !!useSession().actor?.capabilities.includes("media:write")
  const access = useTournamentAccess()
  const permitted = writable && access.canRead && access.canWrite
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const sending = useRef(false)
  const handled = useRef(false)
  useEffect(() => {
    setConfirmed(false)
  }, [asset.version])
  const status = useQuery({
    queryKey: deletionKey(asset.id),
    queryFn: ({ signal }) => readMediaDeletion(asset.id, signal),
    enabled: writable && (open || asset.state === "BLOCKED"),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      open && (busy || (query.state.data && query.state.data.state !== "COMPLETE" && !query.state.data.lastError))
        ? 2000
        : false,
  })
  const references = useQuery({
    queryKey: ["media-deletion-references", asset.id],
    queryFn: ({ signal }) => readDeletionReferences(asset.id, signal),
    enabled: open && permitted && status.isSuccess && status.data === null,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const progress = status.data
  const resuming = !!progress && progress.state !== "COMPLETE"
  const checking = status.isPending || status.isFetching || (!progress && references.isFetching)
  const checkError = status.error || (!progress && references.error)
  const linked = !progress && (references.data ?? 0) > 0
  const ready =
    permitted &&
    !busy &&
    !checking &&
    !checkError &&
    (resuming || (status.isSuccess && references.isSuccess && references.data === 0 && confirmed && !!reason.trim()))

  useEffect(() => {
    if (progress?.state !== "COMPLETE" || handled.current) return
    handled.current = true
    onBusyChange(false)
    setOpen(false)
    toast.success("Đã xóa ảnh và dọn bản lưu đệm.")
    void invalidateMediaAsset(client, asset.id)
    onDeleted()
  }, [progress, client, asset.id, onBusyChange, onDeleted])

  async function remove() {
    if (!ready || sending.current) return
    sending.current = true
    setBusy(true)
    onBusyChange(true)
    setError("")
    try {
      const result = await deleteMediaAsset(
        asset.id,
        progress?.expectedVersion ?? asset.version,
        resuming ? "Tiếp tục yêu cầu xóa ảnh đã xác nhận." : reason,
      )
      await client.cancelQueries({ queryKey: deletionKey(asset.id) })
      client.setQueryData(deletionKey(asset.id), result)
    } catch (cause) {
      setError(errorMessage(cause))
      setConfirmed(false)
      await status.refetch()
      await references.refetch()
      await invalidateMediaAsset(client, asset.id)
    } finally {
      sending.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  if (!writable) return null
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-meta flex-1">
          {resuming ? "Yêu cầu xóa chưa hoàn tất." : "Chỉ xóa ảnh không còn được sử dụng."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled || busy}
          onClick={() => {
            setOpen(true)
            setError("")
            setConfirmed(false)
          }}
        >
          <Trash2 aria-hidden className="size-4" />
          {resuming ? "Tiếp tục xóa" : "Xóa ảnh"}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!sending.current) setOpen(value)
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto"
          showCloseButton={!busy}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{resuming ? "Tiếp tục xóa ảnh" : "Xóa ảnh vĩnh viễn?"}</DialogTitle>
            <DialogDescription>
              {resuming
                ? "Tiến trình trước đã được lưu. Bạn có thể tiếp tục để hoàn tất việc xóa ảnh."
                : "Tất cả phiên bản của ảnh và bản lưu đệm sẽ bị xóa. Không thể khôi phục ảnh sau thao tác này."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
            <LibraryImage url={asset.currentUrl} className="size-14" />
            <div className="min-w-0">
              <p className="type-body break-words">{label}</p>
              <p className="type-meta">
                {versionCount} phiên bản · {asset.id.slice(0, 8)}
              </p>
            </div>
          </div>
          {access.me.isPending && (
            <p role="status" className="type-body">
              Đang kiểm tra quyền…
            </p>
          )}
          {!access.me.isPending && !permitted && (
            <p role="alert" className="type-body text-destructive">
              {access.me.isError
                ? "Chưa kết nối được dịch vụ quản lý thi đấu. Hãy kiểm tra lại."
                : "Cần quyền chỉnh sửa ảnh và quyền đọc, chỉnh sửa thi đấu để kiểm tra liên kết trước khi xóa."}
            </p>
          )}
          {permitted && checking && !busy && (
            <p role="status" className="type-body flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Đang kiểm tra tiến trình và nơi sử dụng…
            </p>
          )}
          {linked && (
            <p
              role="alert"
              className="type-body rounded-lg border border-(--aov-warning)/30 bg-(--aov-warning-soft) p-3"
            >
              Ảnh còn {references.data} liên kết, bao gồm bản nháp, lịch sử hoặc mục trong thùng rác. Gỡ liên kết trước
              khi xóa.
            </p>
          )}
          {progress && progress.state !== "COMPLETE" && (
            <div role="status" className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="type-body flex items-center gap-2">
                <Check aria-hidden className="size-4 text-(--aov-success)" />
                Đã ghi nhận yêu cầu và khóa ảnh để xóa
              </p>
              <p className="type-body">
                {progress.state === "ORIGIN_DELETED"
                  ? "Đã xóa các phiên bản ảnh khỏi kho."
                  : "Đang chờ hoàn tất xóa các phiên bản ảnh."}
              </p>
              <p className="type-meta">
                {progress.state === "ORIGIN_DELETED"
                  ? "Còn bước dọn bản ảnh lưu đệm."
                  : "Tiến trình được lưu ngay cả khi bạn tải lại trang."}
              </p>
            </div>
          )}
          {!progress && !linked && permitted && !checking && !checkError && references.isSuccess && (
            <p className="type-body flex items-center gap-2 text-(--aov-success)">
              <Check aria-hidden className="size-4" />
              Ảnh không còn liên kết sử dụng.
            </p>
          )}
          {!progress && (
            <>
              <label className="grid gap-2">
                <span className="type-label">
                  Lý do xóa{" "}
                  <span aria-hidden className="text-destructive">
                    *
                  </span>
                </span>
                <textarea
                  aria-label="Lý do xóa"
                  required
                  maxLength={2000}
                  rows={3}
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: Ảnh tải thử không còn sử dụng"
                  className="type-body w-full resize-y rounded-md border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </label>
              <label className="type-body flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={confirmed}
                  disabled={busy}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                Tôi hiểu ảnh sẽ bị xóa vĩnh viễn.
              </label>
            </>
          )}
          {(checkError || error || progress?.lastError) && (
            <p role="alert" className="type-body flex items-start gap-2 text-destructive">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {checkError
                ? "Chưa xác minh được trạng thái ảnh. Kiểm tra kết nối và bảo đảm cả hai dịch vụ máy chủ đã cập nhật, rồi thử lại."
                : error || "Lần xóa trước chưa hoàn tất. Bạn có thể tiếp tục từ tiến trình đã lưu."}
            </p>
          )}
          {busy && (
            <p role="status" className="type-body flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              {progress?.state === "ORIGIN_DELETED" ? "Đang dọn bản ảnh lưu đệm…" : "Đang xử lý yêu cầu xóa ảnh…"}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {resuming ? "Đóng" : "Hủy"}
            </Button>
            {(checkError || linked || access.me.isError) && (
              <Button
                variant="outline"
                disabled={busy || checking}
                onClick={() => {
                  void access.me.refetch()
                  void status.refetch()
                  void references.refetch()
                }}
              >
                Kiểm tra lại
              </Button>
            )}
            <Button variant="destructive" disabled={!ready} onClick={() => void remove()}>
              {busy ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden className="size-4" />
              )}
              {busy ? "Đang xóa…" : resuming ? "Tiếp tục xóa" : "Xóa vĩnh viễn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
