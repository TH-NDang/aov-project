import { useState, type MouseEvent, type ReactNode } from "react"
import { useHref, useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowUpRight } from "lucide-react"
import type { RecordDeletionImpact } from "@aov/community-contracts"
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

export type LifecycleEntry = { id: string; version: number; deletedAt?: string | null }
export type LifecycleCallbacks = {
  onChanged: () => void
  onNavigate?: () => void
  onBusyChange?: (busy: boolean) => void
}
type Usages = ReturnType<typeof lifecycleUsages>

/** A plain click opens the link inside the app; a click with a modifier keeps the browser's own, such as a new tab. */
const plainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/**
 * What still uses a record, each with a link to it. The list also sits in the shared question, which is mounted
 * outside the router, so it takes the app root and a way to open a path instead of drawing router links.
 */
function RecordUsageList({ usages, root, onOpen }: { usages: Usages; root: string; onOpen: (path: string) => void }) {
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

/** Whether a checked record must stay: something holds it, or it is no longer the version on screen. */
export const deletionBlocked = (impact: RecordDeletionImpact, version: number) =>
  !impact.canDelete || !!lifecycleUsages(impact.usages).length || impact.version !== version

/** Asks the service what still uses a record, afresh each time. */
export function useDeletionCheck() {
  const { actor } = useSession()
  const actorKey = `${actor?.issuer ?? ""}:${actor?.subject ?? ""}`
  const client = useQueryClient()
  return (kind: RecordKind, entry: LifecycleEntry) =>
    client.fetchQuery({
      queryKey: tournamentKeys.deletionImpact(actorKey, kind, entry.id, entry.version),
      queryFn: ({ signal }) => tournamentApi.deletionImpact(kind, entry.id, signal),
      staleTime: 0,
      retry: false,
    })
}

/**
 * Moves a record to the trash or back, for a button or a menu item. Deleting first asks the service what still uses
 * the record, then asks the editor with that list; the question cannot be accepted while something blocks the
 * deletion. `failure` is what went wrong, drawn where the caller has room for it.
 */
export function useRecordLifecycle(kind: RecordKind, { onChanged, onNavigate, onBusyChange }: LifecycleCallbacks) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const root = useHref("/").replace(/\/$/, "")
  const check = useDeletionCheck()
  const [error, setError] = useState<unknown>(null)
  const [checking, setChecking] = useState(false)
  const mutation = useMutation({
    mutationFn: (entry: LifecycleEntry) =>
      entry.deletedAt ? tournamentApi.restore(kind, entry) : tournamentApi.remove(kind, entry),
    meta: { silent: true },
  })
  const busy = checking || mutation.isPending

  const open = (path: string) => {
    cancelConfirm()
    onNavigate?.()
    void navigate(path)
  }
  const list = (usages: Usages) => <RecordUsageList usages={usages} root={root} onOpen={open} />

  async function write(entry: LifecycleEntry) {
    setError(null)
    onBusyChange?.(true)
    try {
      await mutation.mutateAsync(entry)
      await client.invalidateQueries({ queryKey: tournamentKeys.all, predicate: exceptDeletionImpact })
      toast.success(entry.deletedAt ? "Đã khôi phục." : "Đã xóa.")
      onChanged()
    } catch (cause) {
      setError(cause)
    } finally {
      onBusyChange?.(false)
    }
  }

  async function remove(entry: LifecycleEntry, name: string) {
    if (busy) return
    setError(null)

    let impact: RecordDeletionImpact
    setChecking(true)
    try {
      impact = await check(kind, entry)
    } catch (cause) {
      setError(cause)
      return
    } finally {
      setChecking(false)
    }

    const accepted = await confirmAction({
      title: `Xóa ${name}?`,
      description: "Mục được chuyển vào thùng rác và có thể khôi phục. Dữ liệu liên quan và lịch sử không bị xóa theo.",
      details: <DeletionImpact impact={impact} version={entry.version} list={list} />,
      confirmLabel: "Chuyển vào thùng rác",
      cancelLabel: "Giữ lại",
      confirmDisabled: deletionBlocked(impact, entry.version),
    })
    if (accepted) await write(entry)
  }

  const failure: ReactNode = error ? (
    <div className="tournament-error" role="alert">
      {tournamentError(error)}
      {list(lifecycleErrorUsages(error))}
    </div>
  ) : null
  return { busy, writing: mutation.isPending, remove, restore: write, failure }
}
