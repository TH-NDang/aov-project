import { useEffect, useState, type FormEvent } from "react"
import type { DocumentView, SeriesContent, TournamentContent } from "@aov/community-contracts"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { ClipboardCheck, Info, Save } from "lucide-react"
import { CreateTournamentSheet } from "./create-tournament-sheet"
import { RecordPicker } from "./record-picker"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import { RegistryLogoField } from "./registry-logo"
import { TEAM_REGIONS } from "./team-region"
import { RecordLifecycleActions } from "./record-lifecycle-actions"
import { recordLabel } from "../model/record-lifecycle-model"
import {
  initialRegistryValues,
  keptSeriesFields,
  keptTournamentFields,
  registryContent,
  registryFormIssue,
} from "../model/registry-form-model"
import {
  COMPETITION_TYPES,
  RESULT_VERIFICATIONS,
  TOURNAMENT_STATUSES,
  TOURNAMENT_TIERS,
  VENUE_MODES,
} from "./tournament-metadata"
import { BEST_OF_CHOICES } from "@/features/esports/model/series-rules"
import { NativeSelect } from "@/components/native-select"

/** The records this editor creates and edits; a team and its players are edited from the workspace Teams step. */
type EditorKind = "tournaments" | "series"
type Content = TournamentContent | SeriesContent
const REGISTRY_LABELS: Record<EditorKind, string> = {
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

function registryFields(kind: EditorKind): Field[] {
  const code = { key: "code", label: "Mã", required: true, placeholder: "Ví dụ: aog-2026-s4" }
  if (kind === "tournaments")
    return [
      { key: "name", label: "Tên giải", required: true },
      code,
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
      { key: "logoDarkUrl", label: "Đường dẫn logo nền tối", type: "url" },
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
    ]
  return [
    code,
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
  tournamentId,
  defaults,
  onSaved,
  onBusyChange,
}: {
  kind: EditorKind
  entry?: DocumentView<Content>
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
      ) as Content
      const content = !entry
        ? fields
        : kind === "tournaments"
          ? keptTournamentFields(fields as TournamentContent, entry.content as TournamentContent)
          : keptSeriesFields(fields as SeriesContent, entry.content as SeriesContent)
      if (entry) await tournamentApi.save(kind, entry, content)
      else await tournamentApi.create(kind, content)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  // Parts do not nest: a tournament that has parts of its own cannot be made a part of another one.
  const ownParts = useQuery({
    queryKey: tournamentKeys.ownParts(entry?.id),
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
          <NativeSelect
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
          </NativeSelect>
        ) : field.key === "note" ? (
          <textarea
            value={values[field.key] ?? ""}
            onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
            maxLength={2000}
          />
        ) : (
          <Input
            type={field.type ?? "text"}
            min={field.key.endsWith("Score") ? 0 : undefined}
            max={field.key.endsWith("Score") ? 99 : undefined}
            value={values[field.key] ?? ""}
            required={field.required}
            placeholder={field.placeholder}
            maxLength={field.key === "code" ? 100 : field.type === "url" ? 2048 : 200}
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
        {kind === "tournaments" && (
          <RegistryLogoField
            kind={kind}
            value={values.logoUrl ?? ""}
            name={values.name ?? ""}
            onChange={(url) => setValues((current) => ({ ...current, logoUrl: url }))}
            onBusyChange={setUploading}
          />
        )}
        {kind === "tournaments" && (
          <RegistryLogoField
            kind={kind}
            dark
            value={values.logoDarkUrl ?? ""}
            name={values.name ?? ""}
            onChange={(url) => setValues((current) => ({ ...current, logoDarkUrl: url }))}
            onBusyChange={setUploading}
          />
        )}
        {fields
          .filter((field) => field.key !== "logoUrl" && field.key !== "logoDarkUrl" && !field.group)
          .map(renderField)}
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
            {kind === "series" && (
              <details
                className="tournament-registry-extra"
                open={!!(entry?.content as SeriesContent | undefined)?.result}
              >
                <summary>
                  <ClipboardCheck size={14} />
                  Kết quả và kiểm chứng
                </summary>
                <div>{fields.filter((field) => field.group === "result").map(renderField)}</div>
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
            )}
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

/** Edits a tournament or a match, and creates a match; a new tournament has a form of its own. */
export function RegistryEditor({
  kind,
  entry,
  open,
  onClose,
  tournamentId,
  defaults,
}: {
  kind: EditorKind
  entry?: DocumentView<Content>
  open: boolean
  onClose: () => void
  tournamentId?: string
  /** Values a new record starts from; ignored when an existing record is edited. */
  defaults?: Record<string, string>
}) {
  const [busy, setBusy] = useState(false)
  if (kind === "tournaments" && !entry) return open ? <CreateTournamentSheet {...{ defaults, onClose }} /> : null
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
          {...{ kind, entry, tournamentId, defaults }}
          onSaved={onClose}
          onBusyChange={setBusy}
        />
      </SheetContent>
    </Sheet>
  )
}
