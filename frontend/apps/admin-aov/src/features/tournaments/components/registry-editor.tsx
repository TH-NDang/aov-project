import { useEffect, useState, type FormEvent } from "react"
import type {
  DocumentView,
  PlayerContent,
  SeriesContent,
  TeamContent,
  TournamentContent,
} from "@aov/community-contracts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { ClipboardCheck, Info, Save } from "lucide-react"
import { RecordPicker } from "./record-picker"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import { RegistryLogoField } from "./registry-logo"
import { TEAM_REGIONS } from "./team-region"
import { RecordLifecycleActions } from "./record-lifecycle-actions"
import { recordLabel } from "../model/record-lifecycle-model"
import {
  initialRegistryValues,
  registryContent,
  registryFormIssue,
  type RegistryKind,
} from "../model/registry-form-model"
import {
  CAREER_STATUSES,
  COMPETITION_TYPES,
  RESULT_VERIFICATIONS,
  TOURNAMENT_STATUSES,
  TOURNAMENT_TIERS,
  VENUE_MODES,
} from "./tournament-metadata"
import { BEST_OF_CHOICES } from "@/features/esports/model/series-rules"
import { LANE_LABELS, LANE_ORDER } from "@/features/esports/model/labels"

type Content = TeamContent | PlayerContent | TournamentContent | SeriesContent
export const REGISTRY_LABELS: Record<RegistryKind, string> = {
  teams: "đội tuyển",
  players: "tuyển thủ",
  tournaments: "giải đấu",
  series: "trận đấu",
}
type Field = {
  key: string
  label: string
  type?: string
  required?: boolean
  options?: { id: string; name: string }[]
  /** Too many rows to list: picked from the server's ranking instead. */
  picker?: "teams" | "tournaments"
  placeholder?: string
  group?: "extra" | "result"
}

function registryFields(kind: RegistryKind): Field[] {
  const common = [{ key: "code", label: "Mã", required: true, placeholder: "Ví dụ: aog-2026-s4" }]
  if (kind === "teams")
    return [
      ...common,
      { key: "name", label: "Tên đội", required: true },
      { key: "shortName", label: "Tên viết tắt" },
      { key: "aliases", label: "Tên khác", placeholder: "Flash Wolves, tên viết khác" },
      { key: "country", label: "Quốc gia / khu vực", options: TEAM_REGIONS },
      { key: "logoUrl", label: "Đường dẫn logo", type: "url" },
    ]
  if (kind === "players")
    return [
      ...common,
      { key: "nickname", label: "Tên thi đấu", required: true },
      { key: "fullName", label: "Họ tên" },
      { key: "aliases", label: "Tên khác", placeholder: "Tên thi đấu cũ, cách viết khác" },
      { key: "country", label: "Quốc gia / khu vực", options: TEAM_REGIONS },
      { key: "photoUrl", label: "Đường dẫn ảnh", type: "url" },
      { key: "birthDate", label: "Ngày sinh", type: "date" },
      {
        key: "lane",
        label: "Vị trí thường đánh",
        options: LANE_ORDER.map((lane) => ({ id: lane, name: LANE_LABELS[lane].name })),
      },
      {
        key: "careerStatus",
        label: "Trạng thái thi đấu",
        options: Object.entries(CAREER_STATUSES).map(([id, name]) => ({ id, name })),
      },
      { key: "signatureHeroes", label: "Tướng tủ", placeholder: "Capheny, Violet, Elsu" },
    ]
  if (kind === "tournaments")
    return [
      ...common,
      { key: "name", label: "Tên giải", required: true },
      // Set for a qualifier, wildcard, weekly stop or show match: the list then shows it under that main event.
      { key: "parentTournamentId", label: "Thuộc giải chính", picker: "tournaments" },
      {
        key: "region",
        label: "Thị trường",
        required: true,
        options: TEAM_REGIONS,
      },
      { key: "year", label: "Năm", type: "number", group: "extra" },
      { key: "startsOn", label: "Ngày bắt đầu", type: "date" },
      { key: "endsOn", label: "Ngày kết thúc", type: "date" },
      { key: "sourceUrl", label: "Nguồn kiểm chứng", type: "url" },
      { key: "logoUrl", label: "Đường dẫn logo", type: "url" },
      {
        key: "tier",
        label: "Phân hạng theo nguồn",
        group: "extra",
        options: Object.entries(TOURNAMENT_TIERS).map(([id, name]) => ({ id, name })),
      },
      {
        key: "competitionType",
        label: "Loại giải",
        group: "extra",
        options: Object.entries(COMPETITION_TYPES).map(([id, name]) => ({ id, name })),
      },
      {
        key: "venueMode",
        label: "Hình thức thi đấu",
        group: "extra",
        options: Object.entries(VENUE_MODES).map(([id, name]) => ({ id, name })),
      },
      {
        key: "status",
        label: "Trạng thái giải",
        group: "extra",
        options: Object.entries(TOURNAMENT_STATUSES).map(([id, name]) => ({ id, name })),
      },
      { key: "note", label: "Ghi chú", group: "extra" },
      { key: "result.winnerName", label: "Đội vô địch", group: "result" },
      { key: "result.runnerUpName", label: "Á quân", group: "result" },
      { key: "result.winnerScore", label: "Tỷ số vô địch", type: "number", group: "result" },
      { key: "result.runnerUpScore", label: "Tỷ số á quân", type: "number", group: "result" },
      { key: "result.sourceUrl", label: "Nguồn kết quả", type: "url", group: "result" },
      {
        key: "result.verification",
        label: "Mức kiểm chứng",
        group: "result",
        options: Object.entries(RESULT_VERIFICATIONS).map(([id, name]) => ({ id, name })),
      },
      { key: "result.verifiedOn", label: "Ngày đối chiếu", type: "date", group: "result" },
    ]
  return [
    ...common,
    {
      key: "tournamentId",
      label: "Giải đấu",
      required: true,
      picker: "tournaments",
    },
    { key: "name", label: "Tên trận" },
    { key: "stage", label: "Vòng đấu", placeholder: "Ví dụ: Chung kết" },
    {
      key: "teamAId",
      label: "Đội A",
      required: true,
      picker: "teams",
    },
    {
      key: "teamBId",
      label: "Đội B",
      required: true,
      picker: "teams",
    },
    {
      key: "bestOf",
      label: "Thể thức",
      required: true,
      options: BEST_OF_CHOICES.map((value) => ({ id: String(value), name: `BO${value}` })),
    },
    {
      key: "repeatPicksAllowed",
      label: "Luật chọn lại tướng",
      options: [
        { id: "", name: "Không được chọn lại tướng đã dùng" },
        { id: "true", name: "Được chọn lại tướng" },
      ],
    },
    { key: "scheduledAt", label: "Lịch thi đấu", type: "datetime-local" },
    { key: "sourceUrl", label: "Link video / nguồn", type: "url" },
    { key: "note", label: "Ghi chú" },
    { key: "result.scoreA", label: "Tỷ số đội A", type: "number", group: "result" },
    { key: "result.scoreB", label: "Tỷ số đội B", type: "number", group: "result" },
    { key: "result.sourceUrl", label: "Nguồn kết quả", type: "url", group: "result" },
    {
      key: "result.verification",
      label: "Mức kiểm chứng",
      group: "result",
      options: Object.entries(RESULT_VERIFICATIONS).map(([id, name]) => ({ id, name })),
    },
    { key: "result.verifiedOn", label: "Ngày đối chiếu", type: "date", group: "result" },
  ]
}

function RegistryForm({
  kind,
  entry,
  teams,
  tournamentId,
  defaults,
  onSaved,
  onBusyChange,
}: {
  kind: RegistryKind
  entry?: DocumentView<Content>
  teams: DocumentView<TeamContent>[]
  tournamentId?: string
  defaults?: Record<string, string>
  onSaved: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const [initial] = useState(() => initialRegistryValues(entry, kind, tournamentId, defaults))
  const [values, setValues] = useState(initial)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      const fields = registryContent(
        kind,
        values,
        registryFields(kind).map((field) => field.key),
      )
      // The form only knows its own fields; what other screens edit stays on the record.
      const kept = entry && kind === "tournaments" ? (entry.content as TournamentContent) : null
      const content = kept
        ? ({
            ...fields,
            localCurrency: kept.localCurrency,
            placements: kept.placements,
            awards: kept.awards,
            links: kept.links,
          } as Content)
        : fields
      if (entry) await tournamentApi.save(kind, entry, content)
      else await tournamentApi.create(kind, content)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  // Parts do not nest: a tournament that has parts of its own cannot be made a part of another one.
  const ownParts = useQuery({
    queryKey: [...tournamentKeys.all, "parts", entry?.id],
    queryFn: ({ signal }) => tournamentApi.tournamentParts(entry!.id, signal),
    enabled: kind === "tournaments" && !!entry,
    staleTime: 30_000,
  })
  const ownPartCount = ownParts.data?.length ?? 0
  const busy = mutation.isPending || uploading || lifecycleBusy
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])
  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError("")
    const issue = registryFormIssue(kind, values)
    if (issue) {
      setError(issue)
      return
    }
    void mutation
      .mutateAsync()
      .then(onSaved)
      .catch((error) => setError(tournamentError(error)))
  }
  const fields = registryFields(kind)
  function renderField(field: Field) {
    const mainEvent = field.key === "parentTournamentId"
    return (
      <label key={field.key}>
        <span>
          {field.label}
          {field.required && <b aria-hidden="true"> *</b>}
          {mainEvent && ownPartCount > 0 && ` · giải này đang có ${ownPartCount} phần nên không thuộc giải khác`}
        </span>
        {field.picker ? (
          <RecordPicker
            kind={field.picker}
            label={field.label}
            value={values[field.key] ?? ""}
            required={field.required}
            context={
              field.picker === "teams"
                ? { tournamentId: values.tournamentId || undefined }
                : mainEvent
                  ? { level: "MAIN" }
                  : undefined
            }
            exclude={mainEvent && entry ? [entry.id] : undefined}
            disabled={mainEvent && ownPartCount > 0}
            onChange={(id) => setValues((current) => ({ ...current, [field.key]: id }))}
          />
        ) : field.options ? (
          <select
            aria-label={field.label}
            value={values[field.key] ?? ""}
            required={field.required}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
          >
            <option value="">Chọn {field.label.toLocaleLowerCase()}</option>
            {field.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            {values[field.key] && !field.options.some((option) => option.id === values[field.key]) && (
              <option value={values[field.key]}>{values[field.key]} · giá trị hiện có</option>
            )}
          </select>
        ) : field.key === "note" ? (
          <textarea
            value={values[field.key] ?? ""}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            maxLength={2000}
          />
        ) : (
          <Input
            type={field.type ?? "text"}
            list={
              ["result.winnerName", "result.runnerUpName"].includes(field.key)
                ? "tournament-result-team-names"
                : undefined
            }
            min={field.key.endsWith("Score") ? 0 : undefined}
            max={field.key.endsWith("Score") ? 99 : undefined}
            value={values[field.key] ?? ""}
            required={field.required}
            placeholder={field.placeholder}
            maxLength={field.key === "code" ? 100 : field.key === "aliases" ? 2000 : field.type === "url" ? 2048 : 200}
            pattern={field.key === "code" ? "[a-z0-9]+(?:-[a-z0-9]+)*" : undefined}
            title={field.key === "code" ? "Dùng chữ thường không dấu, số và dấu gạch nối." : undefined}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
          />
        )}
      </label>
    )
  }
  return (
    <form className="tournament-registry-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        {kind !== "series" && (
          <RegistryLogoField
            kind={kind}
            value={(kind === "players" ? values.photoUrl : values.logoUrl) ?? ""}
            name={(kind === "players" ? values.nickname : values.name) ?? ""}
            onChange={(url) =>
              setValues((current) => ({ ...current, [kind === "players" ? "photoUrl" : "logoUrl"]: url }))
            }
            onBusyChange={setUploading}
          />
        )}
        {fields.filter((field) => !["logoUrl", "photoUrl"].includes(field.key) && !field.group).map(renderField)}
        {(kind === "tournaments" || kind === "series") && (
          <>
            {kind === "tournaments" && (
              <details className="tournament-registry-extra">
                <summary>
                  <Info size={14} />
                  Thông tin bổ sung
                </summary>
                <div>{fields.filter((field) => field.group === "extra").map(renderField)}</div>
              </details>
            )}
            <details
              className="tournament-registry-extra"
              open={!!(entry?.content as TournamentContent | undefined)?.result}
            >
              <summary>
                <ClipboardCheck size={14} />
                Kết quả và kiểm chứng
              </summary>
              <div>{fields.filter((field) => field.group === "result").map(renderField)}</div>
              <datalist id="tournament-result-team-names">
                {teams.map((team) => (
                  <option key={team.id} value={team.content.name} />
                ))}
              </datalist>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setValues((current) =>
                    Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("result."))),
                  )
                }
              >
                Xóa kết quả
              </Button>
            </details>
          </>
        )}
      </fieldset>
      {error && (
        <p className="tournament-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        <Save size={15} />
        {mutation.isPending ? "Đang lưu…" : entry ? "Lưu thay đổi" : "Tạo mới"}
      </Button>
      {entry && (
        <div className="tournament-record-lifecycle">
          <RecordLifecycleActions
            kind={kind}
            entry={entry}
            name={recordLabel(kind, entry.content)}
            disabled={busy || dirty}
            onChanged={onSaved}
            onNavigate={onSaved}
            onBusyChange={setLifecycleBusy}
          />
        </div>
      )}
    </form>
  )
}

export function RegistryEditor({
  kind,
  entry,
  open,
  onClose,
  teams,
  tournamentId,
  defaults,
}: {
  kind: RegistryKind
  entry?: DocumentView<Content>
  open: boolean
  onClose: () => void
  teams: DocumentView<TeamContent>[]
  tournamentId?: string
  /** Values a new record starts from; ignored when an existing record is edited. */
  defaults?: Record<string, string>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} onOpenChange={(value) => !value && !busy && onClose()}>
      <SheetContent
        className="tournament-registry-sheet"
        showCloseButton={!busy}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <SheetTitle>
          {entry ? "Sửa" : "Tạo"} {REGISTRY_LABELS[kind]}
        </SheetTitle>
        <SheetDescription>
          Thông tin đội, tuyển thủ và giải được giữ lại trong bản công khai của từng ván khi xuất bản.
        </SheetDescription>
        <RegistryForm
          key={`${kind}-${entry?.id ?? "new"}-${entry?.version ?? 0}`}
          {...{ kind, entry, teams, tournamentId, defaults }}
          onSaved={onClose}
          onBusyChange={setBusy}
        />
      </SheetContent>
    </Sheet>
  )
}
