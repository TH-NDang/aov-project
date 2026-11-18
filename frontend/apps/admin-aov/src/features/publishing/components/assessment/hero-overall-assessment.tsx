import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage, isApiError } from "@/lib/api/errors"
import { ChangeKindSelect } from "../patch-changes/change-kind-select"
import { ChangeKindBadge } from "../patch-changes/hero-change-badges"
import { publishingKeys } from "../../api/publishing-api"

export interface HeroAssessment {
  id: string
  overallKind?: string | null
  assessmentVersion?: number
  introducesHero?: boolean
}
const options = [
  ["BUFF", "Tăng sức mạnh"],
  ["NERF", "Giảm sức mạnh"],
  ["ADJUSTMENT", "Điều chỉnh"],
  ["REWORK", "Làm lại"],
  ["FIX", "Sửa lỗi"],
  ["RELEASE", "Ra mắt"],
  ["OTHER", "Khác"],
] as const

/** The release assessment belongs only to the change set that introduced the hero, so other heroes never offer it. */
function optionsFor(change: HeroAssessment) {
  return change.introducesHero || change.overallKind === "RELEASE"
    ? options
    : options.filter(([kind]) => kind !== "RELEASE")
}

function useAssessment(change: HeroAssessment) {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: publishingKeys.allPatchChanges }),
      client.invalidateQueries({ queryKey: publishingKeys.heroes }),
    ])
  return useMutation({
    mutationFn: async (kind: string) => {
      await backendRequest(`/admin/hero-changes/${change.id}/assessment`, {
        method: "PUT",
        body: JSON.stringify({ kind, expectedVersion: change.assessmentVersion ?? 0 }),
      })
      await refresh()
    },
    // Someone else saved first: show their assessment so the editor decides again from it.
    onError: (error) => isApiError(error, "HERO_PATCH_CHANGE_CONFLICT") && refresh(),
  })
}

/** Says what went wrong with this assessment; the shared messages describe whole change sets. */
function assessmentError(error: unknown, kind: string | undefined, heroName?: string) {
  const hero = heroName ? ` của ${heroName}` : ""
  if (isApiError(error, "HERO_PATCH_CHANGE_CONFLICT"))
    return `Đánh giá${hero} vừa được người khác lưu. Bảng đã hiện đánh giá mới; chọn lại nếu vẫn muốn đổi.`
  if (isApiError(error, "HERO_INVALID_CONTENT") && kind === "RELEASE")
    return "Chỉ chọn Ra mắt khi thay đổi này được đánh dấu là tướng mới ra mắt ở patch này."
  return `Chưa lưu được đánh giá${hero}: ${errorMessage(error)}`
}

export function HeroOverallAssessment({ change }: { change: HeroAssessment }) {
  const canWrite = useSession().actor?.capabilities.includes("patch:write")
  const [value, setValue] = useState(change.overallKind ?? "")
  const mutation = useAssessment(change)
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
            options={optionsFor(change)}
            value={value as (typeof options)[number][0] | ""}
            onChange={setValue}
            disabled={mutation.isPending}
          />
          <Button
            size="sm"
            disabled={!value || value === change.overallKind || mutation.isPending}
            onClick={() => mutation.mutate(value)}
          >
            Lưu đánh giá
          </Button>
        </div>
      )}
      {mutation.error && (
        <p role="alert" className="text-xs text-destructive">
          {assessmentError(mutation.error, mutation.variables)}
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

/**
 * The overall assessment chosen straight from a patch's change table: picking a kind saves it, so a whole patch can
 * be assessed from the official reasons without opening each hero.
 */
export function InlineAssessment({ change, heroName }: { change: HeroAssessment; heroName: string }) {
  const mutation = useAssessment(change)
  return (
    <div className="grid min-w-40 gap-1">
      <ChangeKindSelect
        ariaLabel={`Đánh giá tổng thể ${heroName}`}
        className="w-44"
        placeholder="Chưa đánh giá"
        options={optionsFor(change)}
        value={(change.overallKind ?? "") as (typeof options)[number][0] | ""}
        onChange={(kind) => kind && kind !== change.overallKind && mutation.mutate(kind)}
        disabled={mutation.isPending}
      />
      {mutation.error && (
        <p role="alert" className="type-meta text-destructive">
          {assessmentError(mutation.error, mutation.variables, heroName)}
        </p>
      )}
    </div>
  )
}
