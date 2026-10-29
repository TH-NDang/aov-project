import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowUpRight, LoaderCircle, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@aov/ui/components/alert-dialog"
import { useSession } from "@/app/auth/auth-gate"
import { ApiError } from "@/lib/api/errors"
import { lifecycleErrorUsages, lifecycleUsages } from "./record-lifecycle-model"
import { tournamentApi, tournamentError, tournamentKeys, type RecordKind } from "./tournament-api"

export function RecordUsageList({
  usages,
  onNavigate,
}: {
  usages: ReturnType<typeof lifecycleUsages>
  onNavigate?: () => void
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
            <Link to={usage.path} onClick={onNavigate}>
              Mở
              <ArrowUpRight size={12} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

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
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const client = useQueryClient()
  const impact = useQuery({
    queryKey: [...tournamentKeys.all, "deletion-impact", actorKey, kind, entry.id, entry.version],
    queryFn: ({ signal }) => tournamentApi.deletionImpact(kind, entry.id, signal),
    enabled: open && !entry.deletedAt,
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: () => (entry.deletedAt ? tournamentApi.restore(kind, entry) : tournamentApi.remove(kind, entry)),
  })
  const usages = error ? lifecycleErrorUsages(error) : lifecycleUsages(impact.data?.usages)
  const stale =
    !entry.deletedAt &&
    ((impact.data && impact.data.version !== entry.version) ||
      (error instanceof ApiError && error.status === 409 && error.code !== "TOURNAMENT_RECORD_IN_USE"))
  const blocked = !impact.data?.canDelete || !!usages.length || !!stale
  async function run() {
    if (disabled || mutation.isPending || (!entry.deletedAt && (impact.isFetching || impact.isError || blocked))) return
    setError(null)
    onBusyChange?.(true)
    try {
      await mutation.mutateAsync()
      await client.invalidateQueries({
        queryKey: tournamentKeys.all,
        predicate: (query) => query.queryKey[2] !== "deletion-impact",
      })
      setOpen(false)
      onChanged()
    } catch (cause) {
      setError(cause)
    } finally {
      onBusyChange?.(false)
    }
  }
  if (entry.deletedAt)
    return (
      <div className="tournament-restore-action">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || mutation.isPending}
          onClick={() => void run()}
        >
          {mutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}Khôi phục
        </Button>
        {!!error && (
          <div className="tournament-error" role="alert">
            {tournamentError(error)}
            <RecordUsageList usages={usages} onNavigate={onNavigate} />
          </div>
        )}
      </div>
    )
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) {
          setOpen(value)
          if (value) setError(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className="tournament-delete-trigger text-destructive"
          disabled={disabled}
          aria-label={`Xóa ${name}`}
          title={disabled ? "Lưu hoặc bỏ thay đổi trước khi xóa" : `Xóa ${name}`}
        >
          <Trash2 size={14} />
          {!compact && "Xóa mục này"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Mục được chuyển vào thùng rác và có thể khôi phục. Dữ liệu liên quan và lịch sử không bị xóa theo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {impact.isPending ? (
          <p className="tournament-muted" role="status">
            Đang kiểm tra liên kết…
          </p>
        ) : impact.isError ? (
          <div className="tournament-error" role="alert">
            {tournamentError(impact.error)}
            <button type="button" onClick={() => void impact.refetch()}>
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {(!impact.data?.canDelete || !!usages.length) && (
              <p className="tournament-record-blocked">
                <AlertTriangle size={15} />
                Cần xử lý các liên kết này trước.
              </p>
            )}
            <RecordUsageList
              usages={usages}
              onNavigate={() => {
                setOpen(false)
                onNavigate?.()
              }}
            />
            {usages.some((usage) => usage.type === "PUBLICATION_HISTORY") && (
              <p className="tournament-muted">
                Ván đã từng xuất bản cần giữ lịch sử. Bạn có thể gỡ bản công khai để sửa lại.
              </p>
            )}
            {stale && (
              <p className="tournament-error" role="alert">
                Mục đã thay đổi. Đóng phần chỉnh sửa và tải lại trước khi xóa.
              </p>
            )}
          </>
        )}
        {!!error && (
          <p className="tournament-error" role="alert">
            {tournamentError(error)}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Giữ lại</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={disabled || mutation.isPending || impact.isFetching || impact.isError || blocked}
            onClick={() => void run()}
          >
            {mutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Chuyển vào
            thùng rác
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
