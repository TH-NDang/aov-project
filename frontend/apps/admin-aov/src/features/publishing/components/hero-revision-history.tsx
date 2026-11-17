import { HeroOverallAssessment, type HeroAssessment } from "./assessment/hero-overall-assessment"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowRight, ArrowUpRight, ChevronDown, History, Info, RotateCw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { AdminReferenceProvider } from "../../terminology/catalog"
import { createPublishingApi } from "../api/publishing-api"
import { control } from "./fields"
import { usePublicationOverview } from "../api/publication-overview"
import { comparisonFieldLabels } from "../model/assessment/hero-comparison"
import { buildSkillComparison, type CuratedHeroChange } from "../model/skills/hero-skill-comparison"
import { OtherComparisonCard, SkillComparisonCard } from "./assessment/hero-comparison-view"
import { ChangeColorSettings } from "./patch-changes/change-color-preferences"
import type { Content, Revision } from "../api/types"
import { useHeroLocation } from "./use-hero-location"
import { heroLocationId } from "../model/hero-location"
import { CAUSE_NAMES } from "../model/setup/version-causes"

const api = createPublishingApi(backendRequest)
const causeNames: Record<string, string> = CAUSE_NAMES
const stateNames = { DRAFT: "Bản nháp", PUBLISHED: "Đã xuất bản", DISCARDED: "Đã hủy" }
interface ChangeSet extends HeroAssessment {
  heroId: string
  fromHeroRevisionId: string | null
  toHeroRevisionId: string | null
  changes: CuratedHeroChange[]
}

type HeroRevisionHistoryProps = {
  heroId: string
  revision: Revision
  revisions: Revision[]
  locale: string
  content: Content
  onOpenRevision: (revision: Revision) => void
  disabled?: boolean
}

export function HeroRevisionHistory(props: HeroRevisionHistoryProps) {
  return <RevisionHistoryContent key={props.revision.id} {...props} />
}

function RevisionHistoryContent({
  heroId,
  revision,
  revisions,
  locale,
  content: _content,
  onOpenRevision,
  disabled = false,
}: HeroRevisionHistoryProps) {
  const { params, update: updateLocation } = useHeroLocation()
  const mode = params.get("diff") === "split" ? "split" : "inline"
  const overview = usePublicationOverview()
  const chosenSource = heroLocationId(params.get("compare"))
  const sourceId =
    chosenSource &&
    revisions.some(
      (item) =>
        item.id === chosenSource &&
        item.id !== revision.id &&
        item.rulesetId === revision.rulesetId &&
        item.state !== "DISCARDED",
    )
      ? chosenSource
      : (revision.sourceRevisionId ?? "")
  const comparison = useQuery({
    queryKey: ["hero-comparison", heroId, revision.id, revision.version, sourceId],
    queryFn: () => api.comparison(heroId, revision.id, sourceId || undefined),
    staleTime: 30000,
  })
  const curated = useQuery({
    queryKey: ["patch-changes", revision.effectiveFromPatchVariantId, locale],
    queryFn: () =>
      backendRequest<ChangeSet[]>(
        `/admin/patch-variants/${revision.effectiveFromPatchVariantId}/hero-changes?locale=${encodeURIComponent(locale)}`,
      ),
    enabled:
      comparison.data?.status === "AVAILABLE" &&
      revision.cause === "GAME_PATCH" &&
      revision.state === "PUBLISHED" &&
      !!revision.effectiveFromPatchVariantId,
    staleTime: 30000,
    retry: false,
  })
  const recorded = curated.data?.find(
    (item) =>
      item.heroId === heroId &&
      item.toHeroRevisionId === comparison.data?.to.id &&
      item.fromHeroRevisionId === comparison.data?.from?.id,
  )
  const grouped = useMemo(
    () =>
      comparison.data
        ? buildSkillComparison(comparison.data, locale, recorded?.changes)
        : { skills: [], otherChanges: [] },
    [comparison.data, locale, recorded?.changes],
  )
  const candidates = useMemo(
    () =>
      revisions
        .filter((item) => item.rulesetId === revision.rulesetId && item.state !== "DISCARDED")
        .sort((a, b) => b.revisionNo - a.revisionNo),
    [revisions, revision.rulesetId],
  )
  const patchName = (item: Revision) =>
    overview.data?.variants.find((variant) => variant.id === item.effectiveFromPatchVariantId)?.patchCode ??
    "Chưa gắn patch"
  const revisionName = (item: Revision) => `${patchName(item)} · #${item.revisionNo} · ${stateNames[item.state]}`
  const sections = [
    ...new Set([...(grouped.skills.length ? ["skills"] : []), ...grouped.otherChanges.map((change) => change.section)]),
  ]
  const section = sections.includes(params.get("changes") ?? "") ? params.get("changes")! : ""
  const skills = !section || section === "skills" ? grouped.skills : []
  const otherChanges = grouped.otherChanges.filter((change) => !section || change.section === section)
  return (
    <AdminReferenceProvider locale={locale}>
      <div className="@container space-y-4" aria-label="Lịch sử và so sánh tướng">
        <section className="py-4">
          <p className="type-meta mb-3 flex items-center gap-1.5">
            <Info className="size-3.5 shrink-0" />
            Nhãn gameplay chỉ lấy từ thay đổi đã biên tập cho đúng cặp phiên bản.
          </p>
          <div className="grid items-end gap-3 @min-[620px]:grid-cols-[1fr_auto_1fr]">
            <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">
              Bản đối chiếu
              <select
                aria-label="Bản đối chiếu"
                className={`${control} text-foreground`}
                value={sourceId}
                onChange={(event) => updateLocation({ compare: event.target.value, changes: null })}
              >
                <option value="">
                  {revision.sourceRevisionId ? "Tự động: bản trước đó" : "Chưa có bản đối chiếu"}
                </option>
                {candidates
                  .filter((item) => item.id !== revision.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {revisionName(item)}
                    </option>
                  ))}
              </select>
            </label>
            <ArrowRight className="mb-3 hidden size-4 text-muted-foreground @min-[620px]:block" />
            <div className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">
              <span>Bản đang mở</span>
              <div className="flex min-h-10 items-center rounded-md border bg-muted/20 px-3 py-2 text-sm text-foreground">
                {revisionName(revision)}
              </div>
            </div>
          </div>
          {disabled && (
            <p className="mt-3 text-xs text-(--aov-warning)">
              Bạn đang có chỉnh sửa. Lưu nội dung để đưa các thay đổi đó vào phần so sánh.
            </p>
          )}
        </section>
        {comparison.isPending ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            Đang đối chiếu dữ liệu…
          </p>
        ) : comparison.isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">
            <p>{errorMessage(comparison.error)}</p>
            <Button className="mt-3" variant="outline" onClick={() => void comparison.refetch()}>
              <RotateCw className="mr-2 size-4" />
              Thử lại
            </Button>
          </div>
        ) : comparison.data?.status === "BASELINE_ONLY" ? (
          <div className="rounded-xl border border-dashed bg-muted/15 p-6">
            <Badge variant="secondary">{CAUSE_NAMES.DATA_BASELINE}</Badge>
            <h4 className="mt-3 font-semibold">Chưa đủ dữ liệu để xác định phần thay đổi</h4>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Bản đầu tiên ghi lại trạng thái tướng tại một thời điểm. Khi bổ sung bản của mùa hoặc patch trước, bạn có
              thể chọn làm bản đối chiếu.
            </p>
          </div>
        ) : (
          <section className="space-y-4" aria-label="Thay đổi đã gom theo kỹ năng">
            {recorded && (
              <HeroOverallAssessment key={`${recorded.id}-${recorded.assessmentVersion}`} change={recorded} />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {skills.length > 0 && <Badge variant="secondary">{skills.length} kỹ năng</Badge>}
                {otherChanges.length > 0 && <Badge variant="outline">{otherChanges.length} mục khác</Badge>}
                <select
                  aria-label="Lọc phần thay đổi"
                  className={cn(control, "w-auto max-w-48")}
                  value={section}
                  onChange={(event) => updateLocation({ changes: event.target.value })}
                >
                  <option value="">Tất cả nội dung</option>
                  {sections.map((key) => (
                    <option key={key} value={key}>
                      {comparisonFieldLabels[key] ?? key}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ChangeColorSettings />
                <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Kiểu xem mô tả">
                  {(
                    [
                      ["inline", "Trong dòng"],
                      ["split", "Hai cột"],
                    ] as const
                  ).map(([key, title]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={mode === key ? "secondary" : "ghost"}
                      aria-pressed={mode === key}
                      onClick={() => updateLocation({ diff: key })}
                    >
                      {title}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {curated.isError && (
              <p role="status" className="text-xs text-muted-foreground">
                Chưa tải được phân loại gameplay. Các chỉ số trước và sau vẫn được đối chiếu từ bản đã lưu.
              </p>
            )}
            {!skills.length && !otherChanges.length && (
              <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                Không có khác biệt trong phần đã chọn.
              </p>
            )}
            {skills.map((group) => (
              <SkillComparisonCard key={group.skillKey} group={group} mode={mode} heroId={heroId} />
            ))}
            {otherChanges.map((change) => (
              <OtherComparisonCard
                key={`${change.section}:${change.path}`}
                change={change}
                comparison={comparison.data!}
                locale={locale}
                mode={mode}
              />
            ))}
          </section>
        )}
        <details className="group/history admin-section">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium">
            <History className="size-4" /> Các bản dữ liệu ({candidates.length})
            <ChevronDown className="ml-auto size-4 transition-transform group-open/history:rotate-180" />
          </summary>
          <ol className="divide-y border-t px-4">
            {candidates.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {patchName(item)} <span className="text-muted-foreground">· #{item.revisionNo}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {causeNames[item.cause] ?? item.cause} · {stateNames[item.state]}
                  </p>
                </div>
                {item.id === revision.id ? (
                  <Badge variant="secondary">Đang xem</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onOpenRevision(item)}
                    aria-label={`Mở phiên bản ${item.revisionNo}`}
                  >
                    <ArrowUpRight className="mr-1 size-4" />
                    Mở
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </AdminReferenceProvider>
  )
}
