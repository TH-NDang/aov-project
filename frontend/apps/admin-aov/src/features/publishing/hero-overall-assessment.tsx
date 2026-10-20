import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { control } from "./fields"
import { ChangeKindBadge } from "./hero-change-badges"

export interface HeroAssessment {
  id: string
  overallKind?: string | null
  assessmentVersion?: number
}
const options = {
  BUFF: "Tăng sức mạnh",
  NERF: "Giảm sức mạnh",
  ADJUSTMENT: "Cân bằng",
  REWORK: "Làm lại",
  FIX: "Sửa lỗi",
  OTHER: "Khác",
}
export function HeroOverallAssessment({ change }: { change: HeroAssessment }) {
  const client = useQueryClient()
  const canWrite = useSession().actor?.capabilities.includes("patch:write")
  const [value, setValue] = useState(change.overallKind ?? "")
  const mutation = useMutation({
    mutationFn: async () => {
      await backendRequest(`/admin/hero-changes/${change.id}/assessment`, {
        method: "PUT",
        body: JSON.stringify({ kind: value, expectedVersion: change.assessmentVersion ?? 0 }),
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ["patch-changes"] }),
        client.invalidateQueries({ queryKey: ["publishing-heroes"] }),
        client.invalidateQueries({ queryKey: ["hero-timeline"] }),
      ])
    },
  })
  return (
    <section className="space-y-3 rounded-xl border bg-muted/15 p-4" aria-label="Đánh giá tổng thể tướng trong patch">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Tổng thể tướng trong patch</h3>
        {change.overallKind ? (
          <ChangeKindBadge kind={change.overallKind} />
        ) : (
          <span className="text-xs text-muted-foreground">Chưa đánh giá</span>
        )}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Đánh giá riêng cho toàn bộ tướng. Các nhãn tăng/giảm trên từng kỹ năng và chỉ số được giữ độc lập.
      </p>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Đánh giá tổng thể tướng"
            className={control + " w-auto min-w-44"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={mutation.isPending}
          >
            <option value="">Chọn đánh giá</option>
            {Object.entries(options).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!value || value === change.overallKind || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Lưu đánh giá
          </Button>
        </div>
      )}
      {mutation.error && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-xs text-primary">
          Đã lưu đánh giá tổng thể.
        </p>
      )}
    </section>
  )
}
