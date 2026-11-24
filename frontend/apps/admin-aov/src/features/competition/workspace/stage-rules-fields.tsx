import { useQuery } from "@tanstack/react-query"
import {
  DRAFT_RULES,
  SIDE_SELECTIONS,
  type CompetitionStage,
  type DraftRule,
  type SideSelection,
  type StagePatch,
} from "@aov/community-contracts"
import { CalendarDays, CopyPlus, Link2, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { confirmAction } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { Field } from "@/features/community/components/profile-form-primitives"
import { wikiPatchApi, wikiPatchKeys, type WikiPatch, type WikiSeason } from "../wiki-patch-api"
import {
  DRAFT_RULE_HINTS,
  DRAFT_RULE_NAMES,
  SIDE_SELECTION_NAMES,
  linkWikiPatch,
  patchLineIsEmpty,
  patchLineTitle,
  patchesPlayed,
  sameDayWikiPatch,
  wikiPatchLabel,
  withPatchLines,
} from "./stage-rules"

const MAX_PATCHES = 30
const blankLine = (): StagePatch => ({
  label: "",
  releasedOn: null,
  name: "",
  patchId: null,
  seasonId: null,
  seasonName: null,
  sourceUrl: "",
  note: "",
})

/** The rules a stage is played under and the game updates it was played on, linked to the Wiki where it can be. */
export function StageRulesFields({
  stage,
  region,
  days,
  others = [],
  disabled,
  onChange,
}: {
  stage: CompetitionStage
  region: string
  /** The days the stage's first and last matches are played, which the Wiki's patches are read for. */
  days?: { first: string; last: string }
  /** Stages whose updates can be copied. */
  others?: CompetitionStage[]
  disabled: boolean
  onChange: (value: CompetitionStage) => void
}) {
  const wikiPatches = useQuery({
    queryKey: wikiPatchKeys.patches(region),
    queryFn: () => wikiPatchApi.patches(region),
    staleTime: 5 * 60_000,
  })
  const seasons = useQuery({ queryKey: wikiPatchKeys.seasons(), queryFn: wikiPatchApi.seasons, staleTime: 5 * 60_000 })
  const lines = stage.patches ?? []
  const played = days && wikiPatches.data ? patchesPlayed(wikiPatches.data, days, lines) : []
  const addLines = (added: StagePatch[]) =>
    onChange({ ...stage, patches: withPatchLines(lines, added).slice(0, MAX_PATCHES) })
  const setLine = (index: number, line: StagePatch) =>
    onChange({ ...stage, patches: lines.map((row, at) => (at === index ? line : row)) })
  const removeLine = async (index: number) => {
    const line = lines[index]!
    const confirmed = await confirmAction({
      title: `Bỏ phiên bản ${patchLineTitle(line)}?`,
      description: "Dòng này bị gỡ khỏi giai đoạn khi bạn lưu bản nháp.",
      confirmLabel: "Bỏ phiên bản",
    })
    if (confirmed) onChange({ ...stage, patches: lines.filter((_, at) => at !== index) })
  }

  return (
    <>
      <fieldset className="space-y-3">
        <legend className="type-label text-muted-foreground">Luật thi đấu</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="type-label">Cấm chọn</span>
            <NativeSelect
              className="w-full"
              disabled={disabled}
              value={stage.draftRule ?? ""}
              onChange={(event) => onChange({ ...stage, draftRule: (event.target.value || null) as DraftRule | null })}
            >
              <option value="">Chưa ghi</option>
              {DRAFT_RULES.map((rule) => (
                <option key={rule} value={rule}>
                  {DRAFT_RULE_NAMES[rule]}
                </option>
              ))}
            </NativeSelect>
            {stage.draftRule && <span className="type-meta">{DRAFT_RULE_HINTS[stage.draftRule]}</span>}
          </label>
          <label className="grid gap-2">
            <span className="type-label">Chọn bên</span>
            <NativeSelect
              className="w-full"
              disabled={disabled}
              value={stage.sideSelection ?? ""}
              onChange={(event) =>
                onChange({ ...stage, sideSelection: (event.target.value || null) as SideSelection | null })
              }
            >
              <option value="">Chưa ghi</option>
              {SIDE_SELECTIONS.map((rule) => (
                <option key={rule} value={rule}>
                  {SIDE_SELECTION_NAMES[rule]}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <label className="grid gap-2">
          <span className="type-label">Luật khác</span>
          <Textarea
            rows={2}
            maxLength={2000}
            disabled={disabled}
            value={stage.rulesNote ?? ""}
            onChange={(event) => onChange({ ...stage, rulesNote: event.target.value })}
          />
        </label>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="type-label text-muted-foreground">Phiên bản</legend>
        {wikiPatches.isError && (
          <p className="type-meta text-(--aov-warning)">
            Chưa đọc được danh sách patch của Wiki. Vẫn ghi được ngày và bài cập nhật chính thức.
          </p>
        )}
        {lines.map((line, index) => (
          <PatchLineFields
            key={index}
            line={line}
            wikiPatches={wikiPatches.data ?? []}
            seasons={seasons.data ?? []}
            disabled={disabled}
            onChange={(value) => setLine(index, value)}
            onRemove={() => void removeLine(index)}
          />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || lines.length >= MAX_PATCHES}
            onClick={() => onChange({ ...stage, patches: [...lines, blankLine()] })}
          >
            <Plus aria-hidden /> Thêm phiên bản
          </Button>
          {played.length > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              title={played.map(wikiPatchLabel).join(", ")}
              onClick={() => addLines(played.map((patch) => linkWikiPatch(blankLine(), patch)))}
            >
              <CalendarDays aria-hidden /> Thêm {played.length} patch theo ngày đấu
            </Button>
          )}
          {others
            .filter((other) => other.patches?.length)
            .map((other) => (
              <Button
                key={other.code}
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  addLines(
                    other.patches!.filter(
                      (line) =>
                        !lines.some(
                          (own) =>
                            (own.patchId && own.patchId === line.patchId) ||
                            (own.releasedOn && own.releasedOn === line.releasedOn),
                        ),
                    ),
                  )
                }
              >
                <CopyPlus aria-hidden /> Chép từ {other.name}
              </Button>
            ))}
        </div>
      </fieldset>
    </>
  )
}

function PatchLineFields({
  line,
  wikiPatches,
  seasons,
  disabled,
  onChange,
  onRemove,
}: {
  line: StagePatch
  wikiPatches: WikiPatch[]
  seasons: WikiSeason[]
  disabled: boolean
  onChange: (value: StagePatch) => void
  onRemove: () => void
}) {
  const suggestion = sameDayWikiPatch(line, wikiPatches)
  const linked = wikiPatches.find((patch) => patch.id === line.patchId)
  const ordered = [...seasons].sort((a, b) => b.ordinal - a.ordinal)
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="type-label">{patchLineTitle(line, linked)}</span>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
          <Trash2 aria-hidden /> Bỏ
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label="Áp dụng"
          placeholder="Tuần 1, Tuần 2–4, Playoffs"
          maxLength={200}
          disabled={disabled}
          value={line.label ?? ""}
          onChange={(event) => onChange({ ...line, label: event.target.value })}
        />
        <Field
          label="Ngày cập nhật"
          type="date"
          disabled={disabled}
          value={line.releasedOn ?? ""}
          onChange={(event) => onChange({ ...line, releasedOn: event.target.value || null })}
        />
        <Field
          label="Tên bản cập nhật"
          maxLength={300}
          disabled={disabled}
          value={line.name ?? ""}
          onChange={(event) => onChange({ ...line, name: event.target.value })}
        />
        <label className="grid gap-2">
          <span className="type-label">Patch trong Wiki</span>
          <NativeSelect
            className="w-full"
            disabled={disabled}
            value={line.patchId ?? ""}
            onChange={(event) =>
              onChange(
                linkWikiPatch(
                  line,
                  wikiPatches.find((patch) => patch.id === event.target.value),
                ),
              )
            }
          >
            <option value="">Chưa có trong Wiki</option>
            {line.patchId && !linked && <option value={line.patchId}>Patch đã liên kết</option>}
            {wikiPatches.map((patch) => (
              <option key={patch.id} value={patch.id}>
                {wikiPatchLabel(patch)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-2">
          <span className="type-label">Mùa trong Wiki</span>
          <NativeSelect
            className="w-full"
            disabled={disabled}
            value={line.seasonId ?? ""}
            onChange={(event) => {
              const season = seasons.find((entry) => entry.id === event.target.value)
              onChange({ ...line, seasonId: season?.id ?? null, seasonName: season?.displayName ?? null })
            }}
          >
            <option value="">{line.seasonName && !line.seasonId ? line.seasonName : "Chưa chọn"}</option>
            {ordered.map((season) => (
              <option key={season.id} value={season.id}>
                {season.displayName}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Field
          label="Bài cập nhật chính thức"
          type="url"
          placeholder="https://…"
          maxLength={2000}
          disabled={disabled}
          value={line.sourceUrl ?? ""}
          onChange={(event) => onChange({ ...line, sourceUrl: event.target.value.trim() })}
        />
      </div>
      <Field
        label="Ngoại lệ"
        placeholder="Ví dụ: Evita được phép dùng"
        maxLength={2000}
        disabled={disabled}
        value={line.note ?? ""}
        onChange={(event) => onChange({ ...line, note: event.target.value })}
      />
      {suggestion && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-(--aov-info-soft) px-3 py-2">
          <span className="type-body">Wiki đã có patch cùng ngày: {wikiPatchLabel(suggestion)}.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(linkWikiPatch(line, suggestion))}
          >
            <Link2 aria-hidden /> Liên kết
          </Button>
        </div>
      )}
      {patchLineIsEmpty(line) && (
        <p className="type-meta text-(--aov-warning)">
          Cần chọn patch trong Wiki, ngày cập nhật hoặc bài cập nhật chính thức.
        </p>
      )}
    </div>
  )
}
