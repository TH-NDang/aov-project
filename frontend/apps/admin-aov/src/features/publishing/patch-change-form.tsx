import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2 } from "lucide-react"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { Box } from "./fields"
import { ChangeLines, SourceBadge, type RecordedChangeSet } from "./patch-change-lines"
import { PatchChangeEditor } from "./patch-change-editor"
import { suggestedRows } from "./patch-change-model"
import { createPublishingApi, heroPreviewKey } from "./publishing-api"
import type { Revision } from "./types"

const api = createPublishingApi(backendRequest)

/**
 * Records the gameplay change of a published GAME_PATCH revision. Rows start from the differences between the source
 * and this snapshot; the editor only picks each row's kind and removes cosmetic rows.
 */
export function PatchChangeForm({ revision, locale }: { revision: Revision; locale: string }) {
  const variantId = revision.effectiveFromPatchVariantId!
  const [savedId, setSavedId] = useState<string | null>(null)
  const changes = useQuery({
    queryKey: ["patch-changes", variantId, locale],
    queryFn: () =>
      backendRequest<RecordedChangeSet[]>(
        `/admin/patch-variants/${variantId}/hero-changes?locale=${encodeURIComponent(locale)}`,
      ),
    staleTime: 30000,
  })
  const after = useQuery({
    queryKey: heroPreviewKey(revision.heroId, revision.id),
    queryFn: () => api.read(revision.heroId, revision.id),
    staleTime: 60000,
  })
  const before = useQuery({
    queryKey: heroPreviewKey(revision.heroId, revision.sourceRevisionId ?? ""),
    queryFn: () => api.read(revision.heroId, revision.sourceRevisionId!),
    enabled: !!revision.sourceRevisionId,
    staleTime: 60000,
  })
  const recorded = changes.data?.find((change) => change.heroId === revision.heroId)
  const rows = useMemo(
    () => (after.data ? suggestedRows(before.data?.content ?? null, after.data.content, locale) : []),
    [after.data, before.data, locale],
  )
  const loading = changes.isPending || after.isPending || (!!revision.sourceRevisionId && before.isPending)
  const failure = changes.error ?? after.error ?? before.error

  return (
    <Box title="Ghi lịch sử thay đổi gameplay">
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang đối chiếu với bản nguồn…
        </p>
      ) : failure ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ) : recorded ? (
        <div className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {savedId === recorded.id ? "Đã ghi lịch sử thay đổi." : "Patch này đã có lịch sử thay đổi của tướng."}
            <SourceBadge change={recorded} />
          </p>
          <ChangeLines changes={recorded.changes} content={after.data?.content} locale={locale} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {rows.length
              ? `Đã lấy ${rows.length} khác biệt giữa bản nguồn và bản này. Chọn tính chất cho từng dòng, bỏ dòng không phải thay đổi cân bằng.`
              : "Không thấy khác biệt chỉ số, vai trò hay mô tả kỹ năng. Thêm dòng nếu patch có thay đổi khác."}
          </p>
          <PatchChangeEditor
            source="SNAPSHOT"
            heroId={revision.heroId}
            variantId={variantId}
            locale={locale}
            reference={after.data?.content ?? null}
            fromRevisionId={revision.sourceRevisionId}
            toRevisionId={revision.id}
            initialRows={rows}
            onSaved={setSavedId}
          />
        </div>
      )}
    </Box>
  )
}
