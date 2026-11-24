import { useEffect, useState, type FormEvent } from "react"
import type { DocumentView, PlayerContent, TeamContent } from "@aov/community-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Save } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Field } from "@/features/community/components/profile-form-primitives"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import { editedRecordContent, initialRegistryValues, registryFormIssue } from "../model/registry-form-model"
import { RegistryLogoField } from "./registry-logo"
import { TEAM_REGIONS } from "./team-region"
import { CAREER_STATUSES } from "./tournament-metadata"
import { NativeSelect } from "@/components/native-select"
import { LANE_LABELS, LANE_ORDER } from "@/lib/lanes"

type RecordKind = "teams" | "players"
type RecordField = {
  key: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  options?: { id: string; name: string }[]
}

/** What the sheet lets an editor change on a team or a player; the code and every other field stay as they are. */
export const RECORD_FIELDS: Record<RecordKind, RecordField[]> = {
  teams: [
    { key: "name", label: "Tên đội", required: true },
    { key: "shortName", label: "Tên viết tắt" },
    { key: "aliases", label: "Tên khác", placeholder: "Flash Wolves, tên viết khác" },
    { key: "country", label: "Quốc gia / khu vực", options: TEAM_REGIONS },
    { key: "logoUrl", label: "Logo" },
    { key: "logoDarkUrl", label: "Logo nền tối" },
  ],
  players: [
    { key: "nickname", label: "Tên thi đấu", required: true },
    { key: "fullName", label: "Họ tên" },
    { key: "aliases", label: "Tên khác", placeholder: "Tên thi đấu cũ, cách viết khác" },
    { key: "country", label: "Quốc gia / khu vực", options: TEAM_REGIONS },
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
  ],
}

/** One team or player record, edited on purpose: changes stay local until Save, and Cancel asks the sheet first. */
export function TeamRecordForm({
  kind,
  entry,
  onSaved,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  kind: RecordKind
  entry: DocumentView<TeamContent> | DocumentView<PlayerContent>
  onSaved: () => void
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
}) {
  const [initial] = useState(() => initialRegistryValues(entry, kind))
  const [values, setValues] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [issue, setIssue] = useState("")
  const client = useQueryClient()
  const fields = RECORD_FIELDS[kind]
  const save = useMutation({
    meta: { silent: true },
    mutationFn: async (): Promise<void> => {
      const keys = fields.map((field) => field.key)
      if (kind === "teams") {
        const team = entry as DocumentView<TeamContent>
        await tournamentApi.save("teams", team, editedRecordContent(kind, team, values, keys))
        return
      }
      const player = entry as DocumentView<PlayerContent>
      await tournamentApi.save("players", player, editedRecordContent(kind, player, values, keys))
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      onSaved()
    },
  })
  const busy = save.isPending || uploading
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const problem = registryFormIssue(kind, values)
    setIssue(problem ?? "")
    if (!problem) save.mutate()
  }

  return (
    <form className="space-y-4 rounded-lg border bg-muted/30 p-3" onSubmit={submit}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        {/* A player has no picture: the service keeps none. */}
        {kind === "teams" && (
          <div className="sm:col-span-2">
            <RegistryLogoField
              kind={kind}
              value={values.logoUrl ?? ""}
              name={values.name ?? ""}
              onChange={(url) => set("logoUrl", url)}
              onBusyChange={setUploading}
            />
          </div>
        )}
        {kind === "teams" && (
          <div className="sm:col-span-2">
            <RegistryLogoField
              kind={kind}
              dark
              value={values.logoDarkUrl ?? ""}
              usual={values.logoUrl}
              name={values.name ?? ""}
              onChange={(url) => set("logoDarkUrl", url)}
              onBusyChange={setUploading}
            />
          </div>
        )}
        {fields
          .filter((field) => field.key !== "logoUrl" && field.key !== "logoDarkUrl")
          .map((field) =>
            field.options ? (
              <label key={field.key} className="grid min-w-0 gap-2">
                <span className="type-label">{field.label}</span>
                <NativeSelect
                  className="w-full"
                  value={values[field.key] ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                >
                  <option value="">Chưa chọn</option>
                  {field.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : (
              <Field
                key={field.key}
                label={field.required ? `${field.label} *` : field.label}
                type={field.type ?? "text"}
                required={field.required}
                maxLength={field.key === "aliases" || field.key === "signatureHeroes" ? 2000 : 200}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(event) => set(field.key, event.target.value)}
              />
            ),
          )}
      </fieldset>
      {(issue || save.isError) && (
        <p className="type-body text-destructive" role="alert">
          {issue || tournamentError(save.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !dirty}>
          <Save aria-hidden />
          {save.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  )
}
