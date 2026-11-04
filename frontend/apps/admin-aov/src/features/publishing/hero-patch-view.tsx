import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CircleCheck, CircleDashed, FilePlus2, Sparkles } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { ChangeLines, SourceBadge, type RecordedChangeSet } from "./patch-change-lines"
import {
  PROVENANCE_LABELS,
  UNIT_LABELS,
  directionText,
  skillFieldLabel,
  statLabel,
  type HeroPatchView as PatchView,
  type Provenance,
} from "./patch-change-model"
import { RecordPatchNotesSheet } from "./patch-notes-sheet"
import { localized } from "./hero-content"
import { usePublicationOverview } from "./publication-overview"
import { type Content, type Revision } from "./types"
import { HeroRoleBadge } from "./hero-classification-badges"
import { useHeroLocation } from "./use-hero-location"
import { control } from "./fields"
import { patchViewAnchors, selectedPatchAnchor, patchViewRequest } from "./patch-view-anchor"
import { formatPatchValue } from "./patch-value"
import { skillLabel } from "./hero-skills"
import { compareSkillRanks } from "./skill-rank-values"
import { SkillRankValues } from "./skill-rank-table"

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

function ProvenanceTag({ value, patch }: { value: Provenance; patch?: string | null }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", provenanceTone[value])}>
      <ProvenanceIcon value={value} />
      {PROVENANCE_LABELS[value]}
      {value === "DERIVED" && patch ? ` · ${patch}` : ""}
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
  const skillName = (key: string) => {
    const skill = content.SKILLS?.skills.find((entry) => entry.skillKey === key)
    return skill ? `${skillLabel(skill)} · ${localized(skill.translations, locale)?.name ?? key}` : key
  }
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
  return (
    <div className="space-y-4" aria-label="Dữ liệu tướng theo patch">
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

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold">Thay đổi ở {variant.patchCode}</h3>
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

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Dữ liệu tại {variant.patchCode}</h3>
          {data && (
            <Badge variant={data.anchor.direction === "EXACT" ? "secondary" : "outline"}>
              {data.anchor.direction === "EXACT"
                ? "Đã quan sát"
                : data.anchor.direction === "NONE"
                  ? "Chưa có"
                  : "Suy ra"}
            </Badge>
          )}
        </div>
        <label className="grid gap-1.5 text-sm">
          <span>Mốc dữ liệu dùng để suy ra</span>
          <select
            className={control}
            value={anchor?.id ?? "auto"}
            onChange={(event) => update({ anchorRevision: event.target.value })}
          >
            <option value="auto">Tự động theo patch đang xem</option>
            {anchors.map((item) => (
              <option key={item.id} value={item.id}>
                {patchCode(item.effectiveFromPatchVariantId)} · Bản {item.revisionNo}
                {item.cause === "DATA_BASELINE" ? " · Mốc nhập ban đầu" : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Mặc định dùng mốc nhập ban đầu mới nhất đã xuất bản. Bản nháp chưa được dùng để suy ra lịch sử.
          </span>
        </label>
        {view.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tính dữ liệu…
          </p>
        ) : view.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(view.error)}
          </p>
        ) : data ? (
          <>
            <p className="text-sm text-muted-foreground">
              {directionText(data.anchor.direction, patchCode(data.anchor.patchVariantId))}
              {data.anchor.direction !== "EXACT" && data.anchor.direction !== "NONE"
                ? " Dòng chưa xác minh là giá trị giữ nguyên từ bản đó."
                : ""}
            </p>
            {data.stats.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Chỉ số</th>
                      <th className="px-3 py-2 text-right font-medium">Giá trị</th>
                      <th className="px-3 py-2 text-right font-medium">Mỗi cấp</th>
                      <th className="px-3 py-2 font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.stats.map((stat) => (
                      <tr key={stat.statKey}>
                        <td className="px-3 py-1.5">{statLabel(stat.statKey)}</td>
                        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                          {stat.baseValue ?? "—"}
                          {stat.baseValue !== null ? (UNIT_LABELS[stat.unit] ?? "") : ""}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">
                          {stat.growthPerLevel ?? "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <ProvenanceTag value={stat.provenance} patch={patchCode(stat.patchVariantId)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.roles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Vai trò</span>
                {data.roles.map((role) => (
                  <HeroRoleBadge key={role.roleCode} role={role.roleCode}>
                    <ProvenanceIcon value={role.provenance} />
                  </HeroRoleBadge>
                ))}
              </div>
            )}
            {data.skillFields.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Kỹ năng đã ghi trong ghi chú</span>
                <ul className="divide-y rounded-lg border text-sm">
                  {data.skillFields.map((field) => {
                    const skill = content.SKILLS?.skills.find((entry) => entry.skillKey === field.skillKey)
                    const ranks = compareSkillRanks(null, field.value, skill, skill)
                    return (
                      <li key={`${field.skillKey}:${field.fieldKey}`} className="flex flex-wrap gap-x-3 gap-y-1 p-2.5">
                        <span className="font-medium">
                          {skillName(field.skillKey)} · {skillFieldLabel(field.fieldKey)}
                        </span>
                        {!ranks && (
                          <span className="min-w-0 flex-1 whitespace-pre-wrap">
                            {formatPatchValue(field.value ?? "—")}
                          </span>
                        )}
                        <ProvenanceTag value={field.provenance} patch={patchCode(field.patchVariantId)} />
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
                  })}
                </ul>
              </div>
            )}
          </>
        ) : null}
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
    </div>
  )
}
