import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, RotateCcw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { overviewKey, type Variant } from "./publication-overview"
export function PatchDataReview({ variant }: { variant: Variant }) {
  const cache = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const canWrite = useSession().actor?.capabilities.includes("patch:write") ?? false
  const complete = variant.dataReviewState === "COMPLETE"
  const mutation = useMutation({
    mutationFn: () =>
      backendRequest(`/admin/patch-variants/${variant.id}/data-review`, {
        method: "PUT",
        body: JSON.stringify({
          state: complete ? "IN_PROGRESS" : "COMPLETE",
          expectedVersion: variant.dataReviewVersion ?? 0,
        }),
      }),
    onSuccess: async () => {
      setConfirm(false)
      await cache.invalidateQueries({ queryKey: overviewKey })
    },
  })
  return (
    <div className="m-3 space-y-2 rounded-lg bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4" />
        <span className="font-medium">{complete ? "Đã hoàn tất nhập liệu" : "Đang nhập và rà soát dữ liệu"}</span>
        {canWrite && variant.status === "PUBLISHED" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={mutation.isPending}
            onClick={() => (complete ? mutation.mutate() : setConfirm(!confirm))}
          >
            {complete ? (
              <>
                <RotateCcw className="size-3.5" />
                Mở lại rà soát
              </>
            ) : (
              "Xác nhận hoàn tất"
            )}
          </Button>
        )}
      </div>
      {confirm && (
        <div role="alert" className="space-y-2">
          <p>
            Xác nhận đã nhập và rà soát đủ thay đổi của patch trong tất cả nhóm dữ liệu? Timeline từng nhóm sẽ ẩn mốc
            không có thay đổi.
          </p>
          <Button type="button" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            Đã rà soát đủ · Hoàn tất
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Hủy
          </Button>
        </div>
      )}
      {mutation.error && (
        <p role="alert" className="text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
    </div>
  )
}
