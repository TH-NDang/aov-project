import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { Box, control } from "./fields"
import { createPublishingApi } from "./publishing-api"
import type { ImportContext } from "./import-context"
import type { Revision } from "./types"
import type { components } from "./generated/hero-api"

const api = createPublishingApi(backendRequest)

/** The contexts endpoint answers for one season at a time, and a baseline may belong in any of them. */
export async function loadBaselineContexts(request: <T>(path: string) => Promise<T>): Promise<ImportContext[]> {
  const seasons = await request<components["schemas"]["Season"][]>("/admin/seasons")
  const lists = await Promise.all(
    seasons.map((season) => request<ImportContext[]>(`/admin/heroes/import/contexts?seasonId=${season.id}`)),
  )
  return lists.flat()
}

export function BaselineContextForm({
  revision,
  disabled,
  onMove,
  onBusyChange,
}: {
  revision: Revision
  disabled: boolean
  onMove: (revision: Revision) => Promise<void>
  onBusyChange?: (busy: boolean) => void
}) {
  const [contextId, setContextId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const contexts = useQuery({
    queryKey: ["baseline-contexts"],
    queryFn: () => loadBaselineContexts((path) => backendRequest(path)),
  })
  const available = contexts.data?.filter((context) => context.rulesetId === revision.rulesetId) ?? []
  const current = available.find((item) => item.patchVariantId === revision.effectiveFromPatchVariantId)
  const chosen = available.find((item) => item.contextId === contextId)
  return (
    <Box title="Sửa mùa / patch của mốc ban đầu">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (available.some((item) => item.contextId === contextId)) setConfirming(true)
        }}
      >
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Chuyển mốc dữ liệu ban đầu?</AlertDialogTitle>
              <AlertDialogDescription>
                Chuyển sang {chosen?.seasonName} / {chosen?.patchCode}. Giữ nguyên nội dung và ảnh đã nhập.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Quay lại</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setBusy(true)
                  onBusyChange?.(true)
                  setError("")
                  try {
                    const result = await api.send<Revision>(
                      `/admin/heroes/${revision.heroId}/drafts/${revision.id}/baseline-context`,
                      "POST",
                      { expectedVersion: revision.version, contextId },
                    )
                    await onMove(result)
                  } catch (failure) {
                    setError(errorMessage(failure))
                  } finally {
                    setBusy(false)
                    onBusyChange?.(false)
                  }
                }}
              >
                Xác nhận chuyển mốc
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-sm leading-6 text-muted-foreground">
          Dùng khi bản nháp đầu tiên được gắn nhầm mốc. Chỉ áp dụng trước khi có lịch sử đã xuất bản; giữ các phần nội
          dung và ảnh đã gắn.
          {current && ` Đang gắn: ${current.seasonName} / ${current.patchCode}.`}
        </p>
        <label className="grid gap-2 text-sm">
          Mốc dữ liệu đúng
          <select
            className={control}
            value={contextId}
            onChange={(event) => setContextId(event.target.value)}
            required
            disabled={disabled || busy || contexts.isPending}
          >
            <option value="">Chọn mùa và patch</option>
            {available.map((item) => (
              <option key={item.contextId} value={item.contextId}>
                {item.seasonName} / {item.patchCode}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          disabled={disabled || busy || !chosen || chosen.patchVariantId === revision.effectiveFromPatchVariantId}
        >
          <CalendarCog className="size-4" />
          {busy ? "Đang chuyển…" : "Chuyển mốc ban đầu"}
        </Button>
        {(error || contexts.error) && (
          <p role="alert" className="text-sm text-destructive">
            {error || errorMessage(contexts.error)}
          </p>
        )}
      </form>
    </Box>
  )
}
