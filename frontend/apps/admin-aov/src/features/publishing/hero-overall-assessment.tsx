import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { ChangeKindSelect } from "./change-kind-select"
import { ChangeKindBadge } from "./hero-change-badges"

export interface HeroAssessment {
  id: string
  overallKind?: string | null
  assessmentVersion?: number
}
const options = [
  ["BUFF", "Tăng sức mạnh"],
  ["NERF", "Giảm sức mạnh"],
  ["ADJUSTMENT", "Điều chỉnh"],
  ["REWORK", "Làm lại"],
  ["FIX", "Sửa lỗi"],
  ["OTHER", "Khác"],
] as const
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
        Chọn một đánh giá cho toàn bộ tướng trong patch này. Các nhãn trên từng kỹ năng và chỉ số mô tả thay đổi cụ thể.
      </p>
      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <ChangeKindSelect
            ariaLabel="Đánh giá tổng thể tướng"
            className="min-w-44"
            placeholder="Chọn đánh giá"
            options={options}
            value={value as (typeof options)[number][0] | ""}
            onChange={setValue}
            disabled={mutation.isPending}
          />
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
