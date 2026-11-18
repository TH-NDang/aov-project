import { useState, type MouseEvent, type ReactNode } from "react"
import { useHref, useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowUpRight, LoaderCircle, RotateCcw, Trash2 } from "lucide-react"
import type { RecordDeletionImpact } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { cancelConfirm, confirmAction } from "@/components/confirm-dialog"
import { lifecycleErrorUsages, lifecycleUsages } from "../model/record-lifecycle-model"
import {
  exceptDeletionImpact,
  tournamentApi,
  tournamentError,
  tournamentKeys,
  type RecordKind,
} from "../api/tournament-api"
import { toast } from "sonner"

type Usages = ReturnType<typeof lifecycleUsages>

/** A plain click opens the link inside the app; a click with a modifier keeps the browser's own, such as a new tab. */
const plainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/**
 * What still uses a record, each with a link to it. The list also sits in the shared question, which is mounted
 * outside the router, so it takes the app root and a way to open a path instead of drawing router links.
 */
export function RecordUsageList({
  usages,
  root,
  onOpen,
}: {
  usages: Usages
  root: string
  onOpen: (path: string) => void
}) {
  return (
    <ul className="tournament-record-usages">
      {usages.map((usage, index) => (
        <li key={`${usage.type}-${index}`}>
          <span>
            {usage.label}
            <b>{usage.count}</b>
          </span>
          {usage.path && (
            <a
              href={`${root}${usage.path}`}
              onClick={(event) => {
                if (!plainClick(event)) return
                event.preventDefault()
                onOpen(usage.path!)
              }}
            >
              Mở
              <ArrowUpRight size={12} />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

/** The answer of the deletion check, shown in the question before a record goes to the trash. */
function DeletionImpact({
  impact,
  version,
  list,
}: {
  impact: RecordDeletionImpact
  version: number
  list: (usages: Usages) => ReactNode
}) {
  const usages = lifecycleUsages(impact.usages)
  return (
    <div className="grid gap-2">
      {(!impact.canDelete || !!usages.length) && (
        <p className="tournament-record-blocked">
          <AlertTriangle size={15} />
          Cần xử lý các liên kết này trước.
        </p>
      )}
      {list(usages)}
      {usages.some((usage) => usage.type === "PUBLICATION_HISTORY") && (
        <p className="tournament-muted">
          Ván đã từng xuất bản cần giữ lịch sử. Bạn có thể gỡ bản công khai để sửa lại.
        </p>
      )}
      {impact.version !== version && (
        <p className="tournament-error" role="alert">
          Mục đã thay đổi. Đóng phần chỉnh sửa và tải lại trước khi xóa.
        </p>
      )}
    </div>
  )
}

/**
 * Moves a record to the trash or back. Deleting first asks the service what still uses the record, then asks the
 * editor with that list; the question cannot be accepted while something blocks the deletion.
 */
export function RecordLifecycleActions({
  kind,
  entry,
  name,
  disabled = false,
  compact = false,
  onChanged,
  onNavigate,
  onBusyChange,
}: {
  kind: RecordKind
  entry: { id: string; version: number; deletedAt?: string | null }
  name: string
  disabled?: boolean
  compact?: boolean
  onChanged: () => void
  onNavigate?: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const { actor } = useSession()
  const actorKey = `${actor?.issuer ?? ""}:${actor?.subject ?? ""}`
  const client = useQueryClient()
  const navigate = useNavigate()
  const root = useHref("/").replace(/\/$/, "")
  const [error, setError] = useState<unknown>(null)
  const [checking, setChecking] = useState(false)
  const mutation = useMutation({
    mutationFn: () => (entry.deletedAt ? tournamentApi.restore(kind, entry) : tournamentApi.remove(kind, entry)),
    meta: { silent: true },
  })
  const busy = checking || mutation.isPending

  const open = (path: string) => {
    cancelConfirm()
    onNavigate?.()
    void navigate(path)
  }
  const list = (usages: Usages) => <RecordUsageList usages={usages} root={root} onOpen={open} />

  async function write() {
    setError(null)
    onBusyChange?.(true)
    try {
      await mutation.mutateAsync()
      await client.invalidateQueries({ queryKey: tournamentKeys.all, predicate: exceptDeletionImpact })
      toast.success(entry.deletedAt ? "Đã khôi phục." : "Đã xóa.")
      onChanged()
    } catch (cause) {
      setError(cause)
    } finally {
      onBusyChange?.(false)
    }
  }

  async function remove() {
    if (disabled || busy) return
    setError(null)

    let impact: RecordDeletionImpact
    setChecking(true)
    try {
      impact = await client.fetchQuery({
        queryKey: tournamentKeys.deletionImpact(actorKey, kind, entry.id, entry.version),
        queryFn: ({ signal }) => tournamentApi.deletionImpact(kind, entry.id, signal),
        staleTime: 0,
        retry: false,
      })
    } catch (cause) {
      setError(cause)
      return
    } finally {
      setChecking(false)
    }

    const blocked = !impact.canDelete || !!lifecycleUsages(impact.usages).length || impact.version !== entry.version
    const accepted = await confirmAction({
      title: `Xóa ${name}?`,
      description: "Mục được chuyển vào thùng rác và có thể khôi phục. Dữ liệu liên quan và lịch sử không bị xóa theo.",
      details: <DeletionImpact impact={impact} version={entry.version} list={list} />,
      confirmLabel: "Chuyển vào thùng rác",
      cancelLabel: "Giữ lại",
      confirmDisabled: blocked,
    })
    if (accepted) await write()
  }

  const failure = !!error && (
    <div className="tournament-error" role="alert">
      {tournamentError(error)}
      {list(lifecycleErrorUsages(error))}
    </div>
  )
  if (entry.deletedAt)
    return (
      <div className="tournament-restore-action">
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => void write()}>
          {mutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}Khôi phục
        </Button>
        {failure}
      </div>
    )
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className="tournament-delete-trigger text-destructive"
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-label={`Xóa ${name}`}
        title={disabled ? "Lưu hoặc bỏ thay đổi trước khi xóa" : `Xóa ${name}`}
        onClick={() => void remove()}
      >
        {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {!compact && "Xóa mục này"}
      </Button>
      {failure}
    </>
  )
}
