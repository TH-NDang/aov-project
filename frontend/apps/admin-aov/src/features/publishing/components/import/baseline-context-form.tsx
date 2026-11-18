import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarCog } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { confirmAction } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { Box } from "../editing/fields"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import type { ImportContext } from "./import-context"
import type { Revision } from "@/lib/hero-types"
import type { components } from "../../generated/hero-api"
import { NativeSelect } from "@/components/native-select"

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
  const contexts = useQuery({
    queryKey: publishingKeys.baselineContexts,
    queryFn: () => loadBaselineContexts((path) => backendRequest(path)),
  })
  const available = contexts.data?.filter((context) => context.rulesetId === revision.rulesetId) ?? []
  const current = available.find((item) => item.patchVariantId === revision.effectiveFromPatchVariantId)
  const chosen = available.find((item) => item.contextId === contextId)
  return (
    <Box title="Đổi patch của bản nhập dữ liệu">
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!chosen) return

          const accepted = await confirmAction({
            title: "Đổi patch của bản nhập dữ liệu?",
            description: `Chuyển sang ${chosen.seasonName} / ${chosen.patchCode}. Giữ nguyên nội dung và ảnh đã nhập.`,
            confirmLabel: "Đổi patch",
            cancelLabel: "Quay lại",
          })
          if (!accepted) return

          setBusy(true)
          onBusyChange?.(true)
          setError("")
          try {
            const result = await api.send<Revision>(
              `/admin/heroes/${revision.heroId}/drafts/${revision.id}/baseline-context`,
              "POST",
              { expectedVersion: revision.version, contextId: chosen.contextId },
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
        <p className="text-sm leading-6 text-muted-foreground">
          Dùng khi dữ liệu nhập lần đầu bị gắn nhầm patch. Chỉ đổi được khi tướng chưa có bản nào đã xuất bản; nội dung
          và ảnh giữ nguyên.
          {current && ` Đang gắn: ${current.seasonName} / ${current.patchCode}.`}
        </p>
        <label className="grid gap-2 text-sm">
          Patch đúng
          <NativeSelect
            className="w-full"
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
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          disabled={disabled || busy || !chosen || chosen.patchVariantId === revision.effectiveFromPatchVariantId}
        >
          <CalendarCog className="size-4" />
          {busy ? "Đang đổi…" : "Đổi patch"}
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
