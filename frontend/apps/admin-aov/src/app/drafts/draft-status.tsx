import { useState } from "react"
import { Check, HardDrive, LoaderCircle, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { useLocalDraft } from "./use-local-draft"

type DraftStatusValue = Pick<
  ReturnType<typeof useLocalDraft>,
  "ready" | "dirty" | "conflict" | "invalid" | "persistence" | "error" | "discard" | "flush" | "keepMine"
>
export function DraftStatus({ draft, disabled = false }: { draft: DraftStatusValue; disabled?: boolean }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [acting, setActing] = useState(false)
  const run = async (action: () => unknown) => {
    setActing(true)
    try {
      await action()
    } finally {
      setActing(false)
      setConfirmDiscard(false)
    }
  }
  if (!draft.ready)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Đang khôi phục bản nháp…
      </p>
    )
  if (!draft.dirty && !draft.error && draft.persistence === "pending")
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Đang đồng bộ nháp trên thiết bị…
      </p>
    )
  if (!draft.dirty && !draft.error && draft.persistence !== "pending") return null
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-xs" aria-label="Bản nháp trên thiết bị">
      <div role="status" className="flex flex-wrap items-center gap-2">
        {draft.persistence === "pending" ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <HardDrive className="size-3.5" />
        )}
        <span>
          {draft.persistence === "saved"
            ? "Nháp trên thiết bị"
            : draft.persistence === "pending"
              ? "Đang lưu nháp…"
              : "Nháp trong phiên này"}
        </span>
        <span className="text-muted-foreground">Chưa lưu vào backend</span>
        {(draft.dirty || draft.invalid) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || acting}
            onClick={() => setConfirmDiscard(true)}
          >
            <RotateCcw className="size-3" />
            Bỏ bản nháp
          </Button>
        )}
      </div>
      {draft.error && (
        <p role="alert" className="text-destructive">
          {draft.error}{" "}
          <Button
            type="button"
            size="sm"
            variant="link"
            disabled={acting || disabled || draft.invalid}
            onClick={() => void run(draft.flush)}
          >
            Thử lưu nháp lại
          </Button>
        </p>
      )}
      {draft.conflict && (
        <div role="alert" className="space-y-2 text-amber-700 dark:text-amber-300">
          <p>
            Dữ liệu backend đã thay đổi kể từ lúc bắt đầu nháp. Nháp của bạn vẫn được giữ; đối chiếu nội dung trước khi
            lưu.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || acting}
            onClick={() => void run(draft.keepMine)}
          >
            Giữ nháp để tiếp tục chỉnh sửa trên bản mới
          </Button>
        </div>
      )}
      {confirmDiscard && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <span>Bỏ nội dung chưa lưu và dùng dữ liệu backend?</span>
          <Button type="button" size="sm" variant="outline" disabled={acting} onClick={() => setConfirmDiscard(false)}>
            Giữ lại
          </Button>
          <Button type="button" size="sm" disabled={disabled || acting} onClick={() => void run(draft.discard)}>
            <Check className="size-3" />
            Xác nhận bỏ nháp
          </Button>
        </div>
      )}
    </div>
  )
}
