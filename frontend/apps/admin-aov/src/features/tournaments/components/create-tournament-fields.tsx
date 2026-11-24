import { useState } from "react"
import { Info } from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { NativeSelect } from "@/components/native-select"
import type { CreateForm, CreateKey } from "../model/create-tournament-model"
import { tournamentSlug } from "../model/season-name"
import { RecordPicker } from "./record-picker"
import { RegistryLogoField } from "./registry-logo"
import { TEAM_REGIONS } from "./team-region"
import { COMPETITION_TYPES, TOURNAMENT_STATUSES, TOURNAMENT_TIERS, VENUE_MODES } from "./tournament-metadata"

type Props = { form: CreateForm; onChange: (key: CreateKey, value: string) => void }

const CODE_HINT = "Tên có chữ không phải Latin. Hãy tự đặt mã bằng chữ thường không dấu, số và gạch nối."

function TextField({
  form,
  onChange,
  name,
  label,
  required,
  ...props
}: Props & { name: CreateKey; label: string; required?: boolean } & Omit<
    React.ComponentProps<typeof Input>,
    "form" | "name" | "onChange" | "value"
  >) {
  return (
    <label>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      <Input
        {...props}
        required={required}
        value={form.values[name]}
        onChange={(event) => onChange(name, event.target.value)}
      />
    </label>
  )
}

function ChoiceField({
  form,
  onChange,
  name,
  label,
  options,
  required,
}: Props & { name: CreateKey; label: string; options: Record<string, string>; required?: boolean }) {
  return (
    <label>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      <NativeSelect
        aria-label={label}
        required={required}
        value={form.values[name]}
        onChange={(event) => onChange(name, event.target.value)}
      >
        {!form.values[name] && <option value="">Chọn {label.toLocaleLowerCase()}</option>}
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </NativeSelect>
    </label>
  )
}

const REGIONS = Object.fromEntries(TEAM_REGIONS.map((region) => [region.id, region.name]))

/** What identifies a new tournament, its name first; the code, year and status follow it until written by hand. */
export function CreateTournamentFields({ form, onChange }: Props) {
  const { values, typed } = form
  const codeByHand = !!values.name.trim() && tournamentSlug(values.name) === null && !typed.has("code")
  const field = { form, onChange }
  return (
    <>
      <div className="col-span-full grid">
        <TextField {...field} name="name" label="Tên giải" required maxLength={200} autoFocus />
      </div>
      <div className="col-span-full grid gap-1.5">
        <TextField
          {...field}
          name="code"
          label="Mã"
          required
          maxLength={100}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          title="Dùng chữ thường không dấu, số và dấu gạch nối."
          aria-describedby={codeByHand ? "create-code-hint" : undefined}
        />
        {codeByHand && (
          <p id="create-code-hint" className="type-meta">
            {CODE_HINT}
          </p>
        )}
      </div>
      <TextField {...field} name="startsOn" label="Ngày bắt đầu" type="date" />
      <TextField {...field} name="endsOn" label="Ngày kết thúc" type="date" min={values.startsOn || undefined} />
      <ChoiceField {...field} name="region" label="Thị trường" options={REGIONS} required />
      <ChoiceField {...field} name="status" label="Trạng thái giải" options={TOURNAMENT_STATUSES} />
      <ChoiceField {...field} name="tier" label="Phân hạng" options={TOURNAMENT_TIERS} />
      <ChoiceField {...field} name="competitionType" label="Loại giải" options={COMPETITION_TYPES} />
      <label className="col-span-full">
        <span>Thuộc giải chính</span>
        <RecordPicker
          kind="tournaments"
          label="Thuộc giải chính"
          placeholder="Không, đây là giải chính"
          value={values.parentTournamentId}
          context={{ level: "MAIN" }}
          onChange={(id) => onChange("parentTournamentId", id)}
        />
      </label>
    </>
  )
}

/** Logos, source and the rest, folded away: most tournaments are created without them. */
export function CreateTournamentExtra({
  form,
  onChange,
  onBusyChange,
}: Props & { onBusyChange: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const field = { form, onChange }
  const logo = (dark: boolean) => (
    <RegistryLogoField
      kind="tournaments"
      dark={dark}
      value={dark ? form.values.logoDarkUrl : form.values.logoUrl}
      usual={dark ? form.values.logoUrl : undefined}
      name={form.values.name}
      onChange={(url) => onChange(dark ? "logoDarkUrl" : "logoUrl", url)}
      onBusyChange={onBusyChange}
    />
  )
  return (
    <details
      className="tournament-registry-extra"
      open={open}
      onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}
    >
      <summary>
        <Info size={14} />
        Logo và thông tin bổ sung
      </summary>
      {open && (
        <div>
          {logo(false)}
          {logo(true)}
          <TextField {...field} name="year" label="Năm" type="number" min={2015} max={2100} />
          <ChoiceField {...field} name="venueMode" label="Hình thức thi đấu" options={VENUE_MODES} />
          <div className="col-span-full grid">
            <TextField {...field} name="sourceUrl" label="Nguồn kiểm chứng" type="url" maxLength={2048} />
          </div>
          <label className="col-span-full">
            <span>Ghi chú</span>
            <textarea
              maxLength={2000}
              value={form.values.note}
              onChange={(event) => onChange("note", event.target.value)}
            />
          </label>
        </div>
      )}
    </details>
  )
}
