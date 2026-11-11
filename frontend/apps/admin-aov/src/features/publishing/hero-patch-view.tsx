import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, CircleCheck, CircleDashed, FilePlus2, Sparkles } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { ChangeLines, SourceBadge, type RecordedChangeSet } from "./patch-change-lines"
import {
  UNIT_LABELS,
  directionBadge,
  directionText,
  provenanceText,
  skillFieldLabel,
  statLabel,
  type Direction,
  type HeroPatchView as PatchView,
  type Provenance,
} from "./patch-change-model"
import { CAUSE_NAMES } from "./version-causes"
import { RecordPatchNotesSheet } from "./patch-notes-sheet"
import { usePublicationOverview } from "./publication-overview"
import { type Content, type Revision } from "./types"
import { useHeroLocation } from "./use-hero-location"
import { control } from "./fields"
import { patchViewAnchors, selectedPatchAnchor, patchViewRequest } from "./patch-view-anchor"
import { formatPatchValue } from "./patch-value"
import { SkillChangeList } from "./skill-change-list"
import { compareSkillRanks } from "./skill-rank-values"
import { SkillRankValues } from "./skill-rank-table"
import { formatStatReading } from "./stat-reading"

const provenanceTone: Record<Provenance, string> = {
  OBSERVED: "text-emerald-700 dark:text-emerald-300",
  DERIVED: "text-sky-700 dark:text-sky-300",
  CARRIED: "text-muted-foreground",
}
const ProvenanceIcon = ({ value }: { value: Provenance }) =>
  value === "OBSERVED" ? (
    <CircleCheck className="size-3.5" />
  ) : value === "DERIVED" ? (
    <Sparkles className="size-3.5" />
  ) : (
    <CircleDashed className="size-3.5" />
  )

function ProvenanceTag({
  value,
  direction,
  patch,
  anchorPatch,
}: {
  value: Provenance
  direction: Direction
  patch: string | null
  anchorPatch: string | null
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", provenanceTone[value])}
      title={value === "CARRIED" ? "Chưa có ghi chú nào xác nhận số này ở patch đang xem." : undefined}
    >
      <ProvenanceIcon value={value} />
      {provenanceText(value, direction, patch, anchorPatch)}
    </span>
  )
}

/** A hero's gameplay data at any patch of its ruleset, with the change recorded at that patch. */
export function HeroPatchTimeline({
  heroId,
  revision,
  revisions,
  content,
  locale,
  canRecord,
}: {
  heroId: string
  revision: Revision
  revisions: Revision[]
  content: Content
  locale: string
  canRecord: boolean
}) {
  const overview = usePublicationOverview()
  const { params, update } = useHeroLocation()
  const [recording, setRecording] = useState(false)
  const seasons = overview.data?.seasons ?? []
  const variants = [...(overview.data?.variants ?? [])]
    .filter((variant) => variant.rulesetId === revision.rulesetId)
    .sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  const requested = params.get("atPatch")
  const variant =
    variants.find((item) => item.id === requested) ??
    variants.find((item) => item.id === revision.effectiveFromPatchVariantId) ??
    variants[0]
  const patchCode = (id: string | null | undefined) => variants.find((item) => item.id === id)?.patchCode ?? null
  const anchors = patchViewAnchors(revisions, heroId, revision.rulesetId, variants)
  const anchor = selectedPatchAnchor(anchors, params.get("anchorRevision"))
  const request = patchViewRequest(heroId, variant?.id ?? "", anchor?.id ?? null)
  const view = useQuery({
    queryKey: request.queryKey,
    queryFn: () => backendRequest<PatchView>(request.path),
    enabled: !!variant,
    staleTime: 30000,
  })
  const changes = useQuery({
    queryKey: ["patch-changes", variant?.id, locale],
    queryFn: () =>
      backendRequest<RecordedChangeSet[]>(
        `/admin/patch-variants/${variant!.id}/hero-changes?locale=${encodeURIComponent(locale)}`,
      ),
    enabled: !!variant,
    staleTime: 30000,
  })
  const recorded = changes.data?.find((change) => change.heroId === heroId)
  const sourceUrl =
    overview.data?.releases.find((release) => release.variantId === variant?.id && release.sourceUrl)?.sourceUrl ?? ""

  if (overview.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Đang tải danh sách patch…
      </p>
    )
  if (!variant)
    return <p className="rounded-xl border p-6 text-sm text-muted-foreground">Bộ quy tắc này chưa có patch nào.</p>

  const data = view.data
  const direction = data?.anchor.direction ?? "NONE"
  const anchorPatch = patchCode(data?.anchor.patchVariantId)
  const carried =
    !!data && [...data.stats, ...data.skillFields].some((row) => row.provenance === "CARRIED") && direction !== "EXACT"
  // Choosing another version to work from is rarely needed, so it stays folded unless a link already chose one.
  const anchorPicker = (
    <details className="group/anchor" open={params.has("anchorRevision") || undefined}>
      <summary className="type-meta inline-flex cursor-pointer list-none items-center gap-1 hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open/anchor:rotate-90" />
        Tính từ bản khác
      </summary>
      <label className="mt-2 grid gap-1.5">
        <span className="type-label">Bản dùng để tính</span>
        <select
          className={control}
          value={anchor?.id ?? "auto"}
          onChange={(event) => update({ anchorRevision: event.target.value })}
        >
          <option value="auto">Bản đã xuất bản gần patch này nhất</option>
          {anchors.map((item) => (
            <option key={item.id} value={item.id}>
              {patchCode(item.effectiveFromPatchVariantId)} · Bản {item.revisionNo} · {CAUSE_NAMES[item.cause]}
            </option>
          ))}
        </select>
        <span className="type-meta">
          Mặc định tính từ bản nhập dữ liệu mới nhất đã xuất bản. Bản nháp không được dùng.
        </span>
      </label>
    </details>
  )
  return (
    // One framed block, like the version and the comparison around it: a title, the patches to choose from, then what
    // changed at the chosen one and, set apart on a tint instead of a dividing line, its data.
    <section className="space-y-5 rounded-xl border p-4" aria-label="Dữ liệu tướng theo patch">
      <div className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="type-section-title">Theo patch</h2>
          <p className="type-meta">Chọn một patch để xem tướng đổi gì ở patch đó và chỉ số, kỹ năng lúc ấy.</p>
        </div>
        <nav aria-label="Chọn patch" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {variants.map((item) => {
            const season = seasons.find((entry) => entry.id === item.seasonId)
            const active = item.id === variant.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => update({ atPatch: item.id })}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-left transition-colors",
                  active ? "border-primary bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <span className="block text-xs text-muted-foreground">{season?.displayName ?? "Chưa gắn mùa"}</span>
                <span className="block text-sm font-medium">{item.patchCode}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="type-label">Thay đổi ở {variant.patchCode}</h3>
            {recorded ? (
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge change={recorded} />
                {recorded.summary && <span className="text-sm text-muted-foreground">{recorded.summary}</span>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa ghi nhận thay đổi của tướng ở patch này.
                {canRecord ? " Có thể ghi trực tiếp từ ghi chú cập nhật, không cần dữ liệu của patch." : ""}
              </p>
            )}
          </div>
          {!recorded && canRecord && (
            <Button size="sm" onClick={() => setRecording(true)}>
              <FilePlus2 className="size-4" />
              Ghi từ ghi chú cập nhật
            </Button>
          )}
        </div>
        {changes.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(changes.error)}
          </p>
        )}
        {recorded && <ChangeLines changes={recorded.changes} content={content} heroId={heroId} locale={locale} />}
      </section>

      <section className="space-y-3 rounded-lg bg-muted/25 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="type-label">Chỉ số và kỹ năng ở {variant.patchCode}</h3>
          {data && (
            <Badge variant={data.anchor.direction === "EXACT" ? "secondary" : "outline"}>
              {directionBadge(data.anchor.direction, anchorPatch)}
            </Badge>
          )}
        </div>
        {view.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tính dữ liệu…
          </p>
        ) : view.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(view.error)}
          </p>
        ) : data ? (
          <p className="type-body text-muted-foreground">
            {directionText(data.anchor.direction, anchorPatch)}
            {carried ? ` Dòng “Giữ từ ${anchorPatch ?? "bản gốc"}” chưa có ghi chú nào xác nhận ở patch này.` : ""}
          </p>
        ) : null}
        {/* Stays mounted while a new choice loads, so it neither jumps nor folds itself again. */}
        {anchorPicker}
        {data && (
          <>
            {data.stats.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Chỉ số</th>
                      <th className="px-3 py-2 text-right font-medium">Giá trị</th>
                      <th className="px-3 py-2 text-right font-medium">Mỗi cấp</th>
                      <th className="px-3 py-2 font-medium">Số này lấy từ đâu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.stats.map((stat) => (
                      <tr key={stat.statKey}>
                        <td className="px-3 py-1.5">{statLabel(stat.statKey)}</td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {stat.percentValue != null ? (
                            formatStatReading(stat.baseValue, stat.percentValue)
                          ) : (
                            <>
                              {stat.baseValue ?? "—"}
                              {stat.baseValue !== null ? (UNIT_LABELS[stat.unit] ?? "") : ""}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                          {stat.growthPerLevel ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <ProvenanceTag
                            value={stat.provenance}
                            direction={direction}
                            patch={patchCode(stat.patchVariantId)}
                            anchorPatch={anchorPatch}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Roles are left out: a patch never changes them, so here they would only repeat today's (ADR-016). */}
            {data.skillFields.length > 0 && (
              <div className="space-y-1.5">
                <span className="type-label">Kỹ năng có thay đổi đã ghi</span>
                <SkillChangeList
                  entries={data.skillFields}
                  skillKeyOf={(field) => field.skillKey}
                  skills={content.SKILLS?.skills}
                  heroId={heroId}
                  locale={locale}
                  renderRow={(field, skill) => {
                    const ranks = compareSkillRanks(null, field.value, skill, skill)
                    return (
                      <li
                        key={`${field.skillKey}:${field.fieldKey}`}
                        className="type-body flex flex-wrap gap-x-3 gap-y-1 py-2.5"
                      >
                        <span className="font-medium">{skillFieldLabel(field.fieldKey)}</span>
                        {!ranks && (
                          <span className="min-w-0 flex-1 whitespace-pre-wrap">
                            {formatPatchValue(field.value ?? "—")}
                          </span>
                        )}
                        <ProvenanceTag
                          value={field.provenance}
                          direction={direction}
                          patch={patchCode(field.patchVariantId)}
                          anchorPatch={anchorPatch}
                        />
                        {ranks && (
                          <div className="mt-2 w-full min-w-0">
                            <SkillRankValues
                              locale={locale}
                              columns={ranks.columns}
                              values={ranks.after}
                              summary={ranks.summary.after}
                              label={skillFieldLabel(field.fieldKey)}
                            />
                          </div>
                        )}
                      </li>
                    )
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>
      <RecordPatchNotesSheet
        open={recording}
        onOpenChange={setRecording}
        variantId={variant.id}
        patchLabel={variant.patchCode}
        rulesetId={revision.rulesetId}
        locale={locale}
        heroId={heroId}
        defaultSourceUrl={sourceUrl ?? ""}
      />
    </section>
  )
}
