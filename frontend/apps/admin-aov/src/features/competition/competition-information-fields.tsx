import { useState, type ReactNode } from "react"
import { Banknote, Clock3, Link2, MapPin, Pencil, Plus, Trash2, Trophy, type LucideIcon } from "lucide-react"
import type { CompetitionPlan } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { Textarea } from "@aov/ui/components/textarea"
import { Field, Section } from "@/features/community/components/profile-form-primitives"
import { CompetitionChoiceField } from "./competition-choice-field"
import { CompetitionEditSheet } from "./competition-edit-sheet"
import { PageReferencePicker } from "@/features/community/components/page-reference-picker"
import {
  circuitOptions,
  cityOptions,
  competitionTimezoneOptions,
  currencyOptions,
  textOptions,
  venueStageOptions,
} from "./competition-field-options"
import { NativeSelect } from "@/components/native-select"

const detailKeys = ["sourceUrl", "prizePool", "currency", "timezone", "notes"] as const
type Details = Pick<CompetitionPlan, (typeof detailKeys)[number]>
type Venue = CompetitionPlan["venues"][number]

function sourceHost(value: string) {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) ? url.hostname : null
  } catch {
    return null
  }
}

function SummaryDetail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="type-meta">{label}</p>
        <p className={`type-body mt-1 break-words ${value ? "" : "text-muted-foreground"}`}>
          {value || "Chưa bổ sung"}
        </p>
      </div>
    </div>
  )
}

export function CompetitionInformationFields({
  plan,
  savedPlan,
  sourceUrl,
  prizeDay,
  disabled,
  actorKey,
  onChange,
}: {
  plan: CompetitionPlan
  savedPlan: CompetitionPlan
  sourceUrl?: string | null
  /** The day whose exchange rate the prize pool reads at. */
  prizeDay?: string | null
  disabled: boolean
  actorKey: string
  onChange: <K extends keyof CompetitionPlan>(key: K, value: CompetitionPlan[K]) => void
}) {
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingVenue, setEditingVenue] = useState<number | null>(null)
  const circuit = circuitOptions.find((option) => option.value === plan.circuit)?.label || plan.circuit
  const timezone = competitionTimezoneOptions.find((option) => option.value === plan.timezone)?.label || plan.timezone
  const host = sourceHost(plan.sourceUrl)
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Section
        title="Hệ thống & thông tin"
        icon={Trophy}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Sửa hệ thống và thông tin giải"
            title="Sửa thông tin"
            onClick={() => setEditingDetails(true)}
          >
            <Pencil size={16} />
          </Button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <PageReferencePicker
              kind="CIRCUIT"
              label="Hệ thống giải"
              value={plan.circuitPageId}
              fallbackName={circuit}
              actorKey={actorKey}
              canWrite={!disabled}
              onSelect={(profile) => {
                onChange("circuitPageId", profile?.id || null)
                onChange("circuit", profile?.content?.name || "")
              }}
            />
          </div>
          <SummaryDetail
            icon={Banknote}
            label="Quỹ giải thưởng"
            value={
              plan.prizePool ? <LocalPrizeText text={plan.prizePool} currency={plan.currency} on={prizeDay} /> : ""
            }
          />
          <SummaryDetail icon={Clock3} label="Múi giờ" value={timezone} />
          <div className="flex min-w-0 items-start gap-3">
            <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="type-meta">Nguồn kiểm chứng</p>
              {host ? (
                <a
                  className="type-body mt-1 block truncate underline underline-offset-4"
                  href={plan.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={plan.sourceUrl}
                >
                  {host}
                </a>
              ) : (
                <p className="type-body mt-1 break-words text-muted-foreground">{plan.sourceUrl || "Chưa bổ sung"}</p>
              )}
            </div>
          </div>
        </div>
        {plan.notes && (
          <p className="type-body whitespace-pre-wrap border-t pt-4 text-muted-foreground">{plan.notes}</p>
        )}
      </Section>
      <Section
        title="Địa điểm thi đấu"
        icon={MapPin}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || plan.venues.length >= 30}
            aria-label="Thêm địa điểm"
            title="Thêm địa điểm"
            onClick={() => setEditingVenue(plan.venues.length)}
          >
            <Plus size={16} />
          </Button>
        }
      >
        {!plan.venues.length && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEditingVenue(0)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted"
          >
            <Plus size={16} /> Thêm địa điểm thi đấu
          </button>
        )}
        <div className="divide-y">
          {plan.venues.map((venue, index) => (
            <div key={index} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span className="type-label flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="type-body break-words">{venue.name || "Chưa đặt tên địa điểm"}</p>
                <p className="type-meta mt-1">{venue.city || "Chưa chọn thành phố"}</p>
                <span className="type-meta mt-2 inline-flex rounded-md bg-muted px-2 py-1">
                  {plan.stages.find((stage) => stage.code === venue.stageCode)?.name ||
                    venue.stageCode ||
                    "Chưa gắn giai đoạn"}
                </span>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                aria-label={`Sửa địa điểm ${venue.name || index + 1}`}
                title="Sửa địa điểm"
                onClick={() => setEditingVenue(index)}
              >
                <Pencil size={16} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                aria-label={`Bỏ địa điểm ${venue.name || index + 1}`}
                title="Bỏ địa điểm"
                onClick={() =>
                  onChange(
                    "venues",
                    plan.venues.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
      </Section>
      {editingDetails && (
        <DetailsDrawer
          initial={plan}
          sourceUrl={sourceUrl}
          disabled={disabled}
          onClose={() => setEditingDetails(false)}
          onApply={(details) => {
            for (const key of detailKeys) onChange(key, details[key])
            setEditingDetails(false)
          }}
        />
      )}
      {editingVenue !== null && (
        <VenueDrawer
          initial={plan.venues[editingVenue]}
          knownVenues={[...savedPlan.venues, ...plan.venues]}
          stages={plan.stages}
          disabled={disabled}
          onClose={() => setEditingVenue(null)}
          onApply={(venue) => {
            onChange(
              "venues",
              editingVenue < plan.venues.length
                ? plan.venues.map((row, index) => (index === editingVenue ? venue : row))
                : [...plan.venues, venue],
            )
            setEditingVenue(null)
          }}
        />
      )}
    </div>
  )
}

function DetailsDrawer({
  initial,
  sourceUrl,
  disabled,
  onApply,
  onClose,
}: {
  initial: Details
  sourceUrl?: string | null
  disabled: boolean
  onApply: (details: Details) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const change = (key: keyof Details, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <CompetitionEditSheet
      title="Hệ thống & thông tin giải"
      disabled={disabled}
      onClose={onClose}
      onApply={() => onApply(draft)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Quỹ giải thưởng"
          inputMode="decimal"
          placeholder="Ví dụ: 6650000000"
          maxLength={300}
          value={draft.prizePool}
          onChange={(event) => change("prizePool", event.target.value)}
        />
        <CompetitionChoiceField
          label="Đơn vị tiền tệ"
          icon={Banknote}
          value={draft.currency}
          options={currencyOptions}
          clearable
          disabled={disabled}
          onChange={(value) => change("currency", value)}
        />
      </div>
      <CompetitionChoiceField
        label="Múi giờ của giải"
        icon={Clock3}
        value={draft.timezone}
        options={competitionTimezoneOptions}
        disabled={disabled}
        onChange={(value) => change("timezone", value)}
      />
      <div className="space-y-2">
        <Field
          label="Nguồn kiểm chứng"
          type="url"
          placeholder="https://…"
          maxLength={2000}
          value={draft.sourceUrl}
          onChange={(event) => change("sourceUrl", event.target.value)}
        />
        {sourceUrl && sourceUrl !== draft.sourceUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => change("sourceUrl", sourceUrl)}
          >
            Dùng nguồn từ thông tin giải
          </Button>
        )}
      </div>
      <label className="grid gap-2">
        <span className="type-label">Giới thiệu & quy định bổ sung</span>
        <Textarea
          rows={5}
          maxLength={20000}
          value={draft.notes}
          onChange={(event) => change("notes", event.target.value)}
        />
      </label>
    </CompetitionEditSheet>
  )
}

function VenueDrawer({
  initial,
  knownVenues,
  stages,
  disabled,
  onApply,
  onClose,
}: {
  initial?: Venue
  knownVenues: Venue[]
  stages: CompetitionPlan["stages"]
  disabled: boolean
  onApply: (venue: Venue) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Venue>(initial || { name: "", city: "", stageCode: "" })
  const cities = textOptions([...knownVenues.map((venue) => venue.city), ...cityOptions.map((option) => option.value)])
  return (
    <CompetitionEditSheet
      title={initial ? "Chỉnh sửa địa điểm" : "Thêm địa điểm"}
      disabled={disabled}
      onClose={onClose}
      onApply={() => onApply(draft)}
    >
      <CompetitionChoiceField
        label="Địa điểm"
        icon={MapPin}
        value={draft.name}
        options={textOptions(knownVenues.map((venue) => venue.name))}
        allowCustom
        clearable
        disabled={disabled}
        placeholder="Chọn hoặc thêm địa điểm"
        onChange={(name) => {
          const known = knownVenues.find((venue) => venue.name === name && venue.city)
          setDraft((current) => ({ ...current, name, ...(!current.city && known ? { city: known.city } : {}) }))
        }}
      />
      <CompetitionChoiceField
        label="Thành phố"
        value={draft.city}
        options={cities}
        allowCustom
        clearable
        maxLength={200}
        disabled={disabled}
        placeholder="Chọn hoặc thêm thành phố"
        onChange={(city) => setDraft((current) => ({ ...current, city }))}
      />
      <label className="grid min-w-0 gap-2">
        <span className="type-label">Giai đoạn</span>
        <NativeSelect
          className="w-full"
          disabled={disabled}
          value={draft.stageCode}
          onChange={(event) => setDraft((current) => ({ ...current, stageCode: event.target.value }))}
        >
          <option value="">Chưa gắn giai đoạn</option>
          {venueStageOptions(stages, draft.stageCode).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {!stages.length && <p className="type-meta">Thêm giai đoạn ở bước Thể thức rồi chọn tại đây.</p>}
    </CompetitionEditSheet>
  )
}
