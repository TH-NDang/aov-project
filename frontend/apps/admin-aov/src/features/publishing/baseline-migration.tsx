import { invalidateHeroCatalogs } from "./publishing-cache"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarCog } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@aov/ui/components/alert-dialog"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, type Request } from "./publishing-api"
import type { HeroRow, Revision } from "./types"
import type { ImportContext } from "./import-context"

export function BaselineMigration({
  context,
  request,
  onBusyChange,
  onMoved,
}: {
  context: ImportContext
  request: Request
  onBusyChange: (busy: boolean) => void
  onMoved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const api = createPublishingApi(request)
  const cache = useQueryClient()
  const candidates = useQuery({
    queryKey: ["baseline-migration", context.contextId],
    enabled: open,
    queryFn: async () => {
      const heroes: HeroRow[] = []
      let page = 0
      for (;;) {
        const slice = await api.heroes(page++)
        heroes.push(...slice.items)
        if (page * slice.size >= slice.totalElements) break
      }
      return heroes.flatMap((hero) =>
        hero.revisions
          .filter(
            (revision) =>
              revision.rulesetId === context.rulesetId &&
              revision.state === "DRAFT" &&
              revision.cause === "DATA_BASELINE" &&
              !revision.sourceRevisionId &&
              revision.effectiveFromPatchVariantId !== context.patchVariantId &&
              !hero.revisions.some((other) => other.rulesetId === context.rulesetId && other.state === "PUBLISHED"),
          )
          .map((revision) => ({ hero, revision })),
      )
    },
  })
  return (
    <details className="mx-5 mt-5 rounded-xl border p-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium">
        Sửa mốc cho các bản nháp ban đầu đã nhập trước đây
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="leading-6 text-muted-foreground">
          Nếu trước đây bạn chọn nhầm mùa / patch, có thể chuyển các bản nháp ban đầu về mốc đang chọn rồi kiểm tra
          import lại. Chỉ áp dụng cho tướng chưa có bản đã xuất bản; giữ các ảnh và nội dung đã nhập.
        </p>
        {candidates.isPending ? (
          <p role="status">Đang kiểm tra các bản nháp…</p>
        ) : (
          <p>
            <strong>{candidates.data?.length ?? 0}</strong> bản nháp có thể chuyển về{" "}
            <strong>
              {context.seasonName} / {context.patchCode}
            </strong>
            .
          </p>
        )}
        <Button variant="outline" disabled={busy || !candidates.data?.length} onClick={() => setConfirming(true)}>
          <CalendarCog className="size-4" />
          Chuyển các mốc ban đầu
        </Button>
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Chuyển {candidates.data?.length ?? 0} mốc dữ liệu ban đầu?</AlertDialogTitle>
              <AlertDialogDescription>
                Đưa các bản nháp về {context.seasonName} / {context.patchCode}. Giữ nguyên nội dung và ảnh đã nhập. Chỉ
                tiếp tục khi đây là mốc đúng của dữ liệu cũ.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Quay lại</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const rows = candidates.data ?? []
                  setBusy(true)
                  onBusyChange(true)
                  setErrors([])
                  const failures: string[] = []
                  let completed = 0
                  try {
                    for (const [index, { hero, revision }] of rows.entries()) {
                      setProgress(`Đang chuyển ${hero.code} · ${index + 1}/${rows.length}`)
                      try {
                        const moved = await api.send<Revision>(
                          `/admin/heroes/${hero.id}/drafts/${revision.id}/baseline-context`,
                          "POST",
                          { expectedVersion: revision.version, contextId: context.contextId },
                        )
                        cache.removeQueries({ queryKey: ["publishing-preview", hero.id, moved.id] })
                        completed++
                      } catch (failure) {
                        failures.push(`${hero.code}: ${errorMessage(failure)}`)
                      }
                    }
                    await invalidateHeroCatalogs(cache)
                    await cache.invalidateQueries({ queryKey: ["baseline-migration"] })
                    await cache.invalidateQueries({ queryKey: ["publishing-revisions"] })
                    setProgress(
                      `Đã chuyển ${completed}/${rows.length} bản nháp. Kiểm tra lại bản xem trước import để dùng phiên bản mới.`,
                    )
                    setErrors(failures)
                    onMoved()
                  } finally {
                    setBusy(false)
                    onBusyChange(false)
                  }
                }}
              >
                Xác nhận chuyển mốc
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {progress && <p role="status">{progress}</p>}
        {candidates.error && (
          <p role="alert" className="text-destructive">
            {errorMessage(candidates.error)}
          </p>
        )}
        {errors.length > 0 && (
          <details className="text-destructive">
            <summary>{errors.length} bản chưa chuyển được</summary>
            <ul className="mt-2 space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </details>
  )
}
