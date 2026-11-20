import { useState, type ReactNode } from "react"
import { Check, GitCompareArrows, HardDrive, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import type { useLocalDraft } from "./use-local-draft"

type DraftStatusValue = Pick<
  ReturnType<typeof useLocalDraft>,
  "ready" | "dirty" | "conflict" | "invalid" | "persistence" | "error" | "discard" | "flush" | "keepMine"
>
/**
 * Where a record's draft stands, in words and an icon: restoring, saving, kept on this device, in conflict, or simply
 * changed. `hidden` when there is nothing worth showing.
 */
export function draftStatusSummary(
  draft: DraftStatusValue,
  {
    sections,
    changed = sections,
    alwaysShown = false,
  }: {
    /** Parts that exist only on this device so far. */
    sections: number
    /** Parts that differ at all, saved or not. */
    changed?: number
    /** For a record that is itself a draft, whose saved changes are worth showing with nothing left to save. */
    alwaysShown?: boolean
  },
) {
  const warning = draft.conflict || draft.invalid || !!draft.error
  const pending = !draft.ready || draft.persistence === "pending"
  const idle = !warning && !pending && !draft.dirty
  const label = idle
    ? "Thay đổi trong bản nháp"
    : draft.conflict
      ? "Xung đột bản nháp"
      : warning
        ? "Lỗi bản nháp"
        : !draft.ready
          ? "Đang khôi phục nháp"
          : pending
            ? "Đang lưu nháp"
            : draft.persistence === "saved"
              ? "Nháp trên thiết bị"
              : "Nháp trong phiên này"
  const description = sections
    ? `${label} · ${sections} phần chưa lưu`
    : changed
      ? `${label} · ${changed} phần đã đổi`
      : label
  return {
    hidden: idle && !alwaysShown,
    warning,
    pending,
    label,
    description,
    changed,
    Icon: warning ? TriangleAlert : pending ? LoaderCircle : idle ? GitCompareArrows : HardDrive,
  }
}

export type DraftStatusSummary = ReturnType<typeof draftStatusSummary>

/** The row of a ⋯ menu that names where the draft stands and opens its sheet. */
export function DraftStatusMenuItem({ summary, onOpen }: { summary: DraftStatusSummary; onOpen: () => void }) {
  const { Icon } = summary
  return (
    <DropdownMenuItem
      aria-label={summary.description}
      className={summary.warning ? "text-(--aov-warning) focus:text-(--aov-warning)" : undefined}
      onSelect={onOpen}
    >
      <Icon aria-hidden className={summary.pending && !summary.warning ? "animate-spin" : undefined} />
      <span className="min-w-0 flex-1 truncate">{summary.label}</span>
      {!summary.warning && summary.changed > 0 && (
        <span className="type-meta shrink-0 tabular-nums">{summary.changed}</span>
      )}
    </DropdownMenuItem>
  )
}

/**
 * The draft's state with its actions (discard what is unsaved, retry, keep mine), then what changed. A sheet rather than
 * a popover, so it reads well on a phone, where it rises from the bottom.
 */
export function DraftStatusSheet({
  open,
  onOpenChange,
  draft,
  disabled,
  alwaysShown = false,
  discardLabel,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: DraftStatusValue
  disabled: boolean
  alwaysShown?: boolean
  discardLabel?: string
  children?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" fitContent className="w-full gap-0 overflow-y-auto sm:max-w-sm">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="type-section-title">Bản nháp</SheetTitle>
          <SheetDescription className="type-meta">
            Những gì đã đổi so với bản gốc, và nháp trên thiết bị này.
          </SheetDescription>
        </SheetHeader>
        <div aria-label="Trạng thái bản nháp" className="space-y-2 p-3 pb-6">
          <DraftStatus draft={draft} disabled={disabled} discardLabel={discardLabel} />
          {draft.ready && (draft.dirty || alwaysShown) && !draft.invalid && children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function DraftStatus({
  draft,
  disabled = false,
  discardLabel = "Bỏ bản nháp",
}: {
  draft: DraftStatusValue
  disabled?: boolean
  discardLabel?: string
}) {
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
        <span className="text-muted-foreground">Chưa lưu lên máy chủ</span>
        {(draft.dirty || draft.invalid) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || acting}
            onClick={() => setConfirmDiscard(true)}
          >
            <RotateCcw className="size-3" />
            {discardLabel}
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
        <div role="alert" className="space-y-2 text-(--aov-warning)">
          <p>
            Dữ liệu trên máy chủ đã thay đổi kể từ lúc bắt đầu nháp. Nháp của bạn vẫn được giữ; đối chiếu nội dung trước
            khi lưu.
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
          <span>Bỏ nội dung chưa lưu và dùng dữ liệu đã lưu trên máy chủ?</span>
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
