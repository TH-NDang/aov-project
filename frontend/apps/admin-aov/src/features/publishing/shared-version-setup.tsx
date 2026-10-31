import { scheduleDate, parseScheduleDate, scheduleDateText } from "./schedule-date"
import { useState } from "react"
import { CalendarDays, Clock, Plus } from "lucide-react"
import { Calendar } from "@aov/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { useIsWide } from "@/hooks/use-media-query"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { control } from "./fields"
import { defaultRulesetId, hasRulesetChoice } from "./default-ruleset"
import { DataLanguage } from "./data-language"
import { usePublicationOverview, type PublicationOverview, type Variant } from "./publication-overview"
import { z } from "zod"
import { useDraftForm } from "@/app/drafts/use-draft-form"
import { useLocalDraft } from "@/app/drafts/use-local-draft"
import { DraftStatus } from "@/app/drafts/draft-status"

const patchDraftSchema = z.object({
  seasonId: z.string(),
  rulesetId: z.string(),
  locale: z.string(),
  before: z.string(),
  code: z.string(),
  title: z.string(),
  summary: z.string(),
})
const dateDraftSchema = z.object({ text: z.string(), withTime: z.boolean(), time: z.string() })
type DateDraft = z.infer<typeof dateDraftSchema>
const scheduleDraftSchema = z.object({
  regionId: z.string(),
  dates: z.record(z.string(), dateDraftSchema),
  sources: z.record(z.string(), z.string()),
})
function dateDraft(initial?: string | null): DateDraft {
  const date = initial ? new Date(initial.length === 10 ? `${initial}T00:00:00` : initial) : undefined
  return {
    text: scheduleDateText(date),
    withTime: !!initial && initial.length > 10,
    time:
      date && initial && initial.length > 10
        ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
        : "",
  }
}

export function SharedPatchSetup({
  onDone,
  initialSeasonId = "",
  initialRulesetId = "",
}: {
  onDone: () => void
  initialSeasonId?: string
  initialRulesetId?: string
}) {
  const overview = usePublicationOverview()
  const cache = useQueryClient()
  const { form, draft } = useDraftForm({
    form: "patch:create",
    initialValue: {
      seasonId: initialSeasonId,
      rulesetId: initialRulesetId,
      locale: "vi-VN",
      before: "",
      code: "",
      title: "",
      summary: "",
    },
    schema: patchDraftSchema,
  })
  const seasonId = form.watch("seasonId")
  // With one ruleset the form never asks; the default ruleset is used.
  const rulesetId = form.watch("rulesetId") || defaultRulesetId(overview.data?.rulesets)
  const locale = form.watch("locale")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = form.getValues()
        setBusy(true)
        setError("")
        try {
          await backendRequest("/admin/season-patches", {
            method: "POST",
            body: JSON.stringify({
              seasonId,
              rulesetId,
              beforeVariantId: f.before || null,
              patch: {
                code: f.code,
                translations: [{ locale, title: f.title, summary: f.summary, description: null }],
              },
            }),
          })
          await draft.discard()
          await cache.invalidateQueries({ queryKey: ["publication-overview"] })
          await cache.invalidateQueries({ queryKey: ["publishing-patches"] })
          onDone()
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setBusy(false)
        }
      }}
    >
      <DraftStatus draft={draft} disabled={busy} />
      <fieldset disabled={busy || !overview.data || !draft.ready || draft.invalid} className="grid gap-4">
        <label className="grid gap-1 text-sm">
          Mùa
          <select
            className={control}
            required
            value={seasonId}
            onChange={(e) => {
              form.setValue("seasonId", e.target.value)
              form.setValue("before", "")
            }}
          >
            <option value="">Chọn mùa</option>
            {overview.data?.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </label>
        {hasRulesetChoice(overview.data?.rulesets) && (
          <label className="grid gap-1 text-sm">
            Bộ quy tắc
            <select
              className={control}
              required
              value={rulesetId}
              onChange={(e) => {
                form.setValue("rulesetId", e.target.value)
                form.setValue("before", "")
              }}
            >
              {overview.data?.rulesets.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm">
          Vị trí
          <select {...form.register("before")} className={control}>
            <option value="">Cuối mùa đã chọn</option>
            {overview.data?.variants
              .filter((v) => v.seasonId === seasonId && v.rulesetId === rulesetId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  Chèn trước {v.patchCode}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Mã patch
          <input
            {...form.register("code")}
            className={control}
            required
            maxLength={64}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
          />
        </label>
        <DataLanguage value={locale} onChange={(value) => form.setValue("locale", value)} />
        <label className="grid gap-1 text-sm">
          Tiêu đề
          <input {...form.register("title")} className={control} required maxLength={200} />
        </label>
        <label className="grid gap-1 text-sm">
          Tóm tắt
          <textarea {...form.register("summary")} className={control} maxLength={20000} />
        </label>
        <Button>Tạo patch</Button>
      </fieldset>
      {(error || overview.error) && (
        <p role="alert" className="text-destructive">
          {error || errorMessage(overview.error)}
        </p>
      )}
    </form>
  )
}

export function SeasonScheduleForm({ seasonId, data }: { seasonId: string; data: PublicationOverview }) {
  return <ScheduleForm endpoint={`/admin/seasons/${seasonId}/schedules`} data={data} seasonId={seasonId} />
}
export function PatchReleaseForm({ variant, data }: { variant: Variant; data: PublicationOverview }) {
  const cache = useQueryClient()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const canPublish = useSession().actor?.capabilities.includes("patch:publish")
  if (!canPublish) return null
  if (variant.status !== "PUBLISHED")
    return (
      <div className="p-4">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError("")
            try {
              await backendRequest(`/admin/patch-variants/${variant.id}/publish`, { method: "POST" })
              await cache.invalidateQueries({ queryKey: ["publication-overview"] })
            } catch (cause) {
              setError(errorMessage(cause))
            } finally {
              setBusy(false)
            }
          }}
        >
          Xuất bản patch để lên lịch
        </Button>
        {error && <p role="alert">{error}</p>}
      </div>
    )
  return (
    <ScheduleForm
      endpoint={`/admin/patch-variants/${variant.id}/releases`}
      data={data}
      seasonId={variant.seasonId}
      patch
    />
  )
}
function ScheduleForm({
  endpoint,
  data,
  seasonId,
  patch = false,
}: {
  endpoint: string
  data: PublicationOverview
  seasonId: string | null
  patch?: boolean
}) {
  const cache = useQueryClient()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const wide = useIsWide()
  const canWrite = useSession().actor?.capabilities.includes(patch ? "patch:publish" : "patch:write")
  const dates: Record<string, DateDraft> = {}
  const sources: Record<string, string> = {}
  if (patch) {
    for (const release of data.releases.filter(
      (item) => item.variantId === endpoint.split("/")[3] && item.status !== "CANCELLED",
    )) {
      dates[`${release.regionId}:start`] = dateDraft(release.effectiveOn ?? release.effectiveAt)
      sources[release.regionId] = release.sourceUrl ?? ""
    }
  } else {
    for (const schedule of data.seasonSchedules.filter((item) => item.seasonId === seasonId)) {
      dates[`${schedule.regionId}:start`] = dateDraft(schedule.startsOn ?? schedule.startsAt)
      dates[`${schedule.regionId}:end`] = dateDraft(schedule.endsOn ?? schedule.endsAt)
    }
  }
  const draft = useLocalDraft({
    form: `schedule:${endpoint}`,
    initialValue: { regionId: "", dates, sources },
    schema: scheduleDraftSchema,
    enabled: !!canWrite,
  })
  const regionId = draft.value.regionId
  const setRegionId = (regionId: string) => draft.update({ ...draft.value, regionId })
  const setDateDraft = (name: string, value: DateDraft) =>
    draft.update({ ...draft.value, dates: { ...draft.value.dates, [`${regionId}:${name}`]: value } })
  if (!canWrite) return null
  const existing = !patch
    ? data.seasonSchedules.find((s) => s.seasonId === seasonId && s.regionId === regionId)
    : undefined
  return (
    <div className="p-4">
      <Button
        variant="outline"
        onClick={() => {
          setError("")
          setOpen(true)
        }}
      >
        <Plus className="size-4" />
        Thiết lập lịch thị trường
      </Button>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value)
        }}
      >
        <SheetContent
          side={wide ? "right" : "bottom"}
          className={wide ? "w-[min(480px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
        >
          <SheetHeader>
            <SheetTitle>{patch ? "Lịch phát hành patch" : "Lịch mùa theo thị trường"}</SheetTitle>
            <SheetDescription>
              {patch
                ? "Ghi nhận ngày patch được phát hành tại thị trường đã chọn."
                : "Chọn ngày bắt đầu; có thể bổ sung ngày kết thúc sau."}
            </SheetDescription>
          </SheetHeader>
          <form
            className="overflow-y-auto px-4 pb-6 grid gap-6"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!draft.ready || draft.invalid || draft.conflict || busy) return
              const f = new FormData(e.currentTarget)
              if (!regionId || !f.get("start")) {
                setError("Vui lòng chọn thị trường và ngày bắt đầu.")
                return
              }
              setBusy(true)
              setError("")
              try {
                const start = scheduleDate(String(f.get("start")), String(f.get("startTime") || ""))
                const end =
                  patch || !f.get("end") ? null : scheduleDate(String(f.get("end")), String(f.get("endTime") || ""))
                const body = patch
                  ? {
                      regionId,
                      seasonId,
                      effectiveAt: start.at,
                      effectiveOn: start.on,
                      sourceUrl: f.get("source") || null,
                    }
                  : {
                      regionId,
                      startsAt: start.at,
                      startsOn: start.on,
                      endsAt: end?.at ?? null,
                      endsOn: end?.on ?? null,
                    }
                await backendRequest(endpoint, { method: "POST", body: JSON.stringify(body) })
                const savedDates = { [`${regionId}:start`]: dateDraft(start.on ?? start.at) }
                if (!patch) savedDates[`${regionId}:end`] = dateDraft(end?.on ?? end?.at)
                const savedSources = patch ? { [regionId]: String(f.get("source") || "") } : {}
                draft.rebase(
                  {
                    regionId: "",
                    dates: { ...draft.value.dates, ...savedDates },
                    sources: { ...draft.value.sources, ...savedSources },
                  },
                  { regionId: "", dates: { ...dates, ...savedDates }, sources: { ...sources, ...savedSources } },
                )
                await cache.invalidateQueries({ queryKey: ["publication-overview"] })
                await cache.invalidateQueries({ queryKey: ["authoring-contexts"] })
                setOpen(false)
              } catch (cause) {
                setError(errorMessage(cause))
              } finally {
                setBusy(false)
              }
            }}
          >
            <DraftStatus draft={draft} disabled={busy} />
            <div className="grid gap-2 text-sm">
              <span>Thị trường</span>
              <Select
                value={regionId}
                onValueChange={setRegionId}
                required
                disabled={busy || !draft.ready || draft.invalid || draft.conflict}
              >
                <SelectTrigger className="w-full" aria-label="Thị trường">
                  <SelectValue placeholder="Chọn thị trường" />
                </SelectTrigger>
                <SelectContent>
                  {data.markets
                    .filter((m) => m.available)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <ScheduleDateField
              key={`${regionId}-start-${open}`}
              name="start"
              label={patch ? "Ngày phát hành" : "Bắt đầu mùa"}
              disabled={busy || !draft.ready || draft.invalid || draft.conflict || !regionId}
              value={draft.value.dates[`${regionId}:start`] ?? dateDraft(existing?.startsOn ?? existing?.startsAt)}
              onChange={(value) => setDateDraft("start", value)}
            />
            {!patch && (
              <ScheduleDateField
                key={`${regionId}-end-${open}`}
                name="end"
                label="Kết thúc mùa"
                disabled={busy || !draft.ready || draft.invalid || draft.conflict || !regionId}
                optional
                value={draft.value.dates[`${regionId}:end`] ?? dateDraft(existing?.endsOn ?? existing?.endsAt)}
                onChange={(value) => setDateDraft("end", value)}
              />
            )}
            {patch && (
              <label className="grid gap-2 text-sm">
                Nguồn cập nhật
                <input
                  name="source"
                  type="url"
                  className={control}
                  disabled={busy || !draft.ready || draft.invalid || draft.conflict || !regionId}
                  placeholder="https://…"
                  value={draft.value.sources[regionId] ?? ""}
                  onChange={(event) =>
                    draft.update({
                      ...draft.value,
                      sources: { ...draft.value.sources, [regionId]: event.target.value },
                    })
                  }
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button disabled={busy || !draft.ready || draft.invalid || draft.conflict}>
                {busy ? "Đang lưu…" : "Lưu lịch"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ScheduleDateField({
  name,
  label,
  disabled,
  optional = false,
  value: draft,
  onChange,
}: {
  name: string
  label: string
  disabled: boolean
  optional?: boolean
  value: DateDraft
  onChange: (value: DateDraft) => void
}) {
  const date = parseScheduleDate(draft.text)
  const text = draft.text
  const [month, setMonth] = useState(date ?? new Date())
  const [open, setOpen] = useState(false)
  const withTime = draft.withTime
  const value = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : ""
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> · Tùy chọn</span>}
      </legend>
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-2">
        <input
          className={control}
          aria-label={label}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          required={!optional}
          value={text}
          maxLength={10}
          onChange={(event) => {
            const next = event.target.value
            const parsed = parseScheduleDate(next)
            onChange({ ...draft, text: next })
            if (parsed) setMonth(parsed)
            event.currentTarget.setCustomValidity(
              next && !parsed ? "Nhập ngày hợp lệ theo dd/mm/yyyy (2000–2100)." : "",
            )
          }}
          onBlur={() => {
            if (date) onChange({ ...draft, text: scheduleDateText(date) })
          }}
          ref={(node) => {
            node?.setCustomValidity(text && !date ? "Nhập ngày hợp lệ theo dd/mm/yyyy (2000–2100)." : "")
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={`Mở lịch ${label.toLowerCase()}`}
              disabled={disabled}
            >
              <CalendarDays className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              month={month}
              onMonthChange={setMonth}
              onSelect={(day) => {
                onChange({ ...draft, text: scheduleDateText(day) })
                if (day) setMonth(day)
                setOpen(false)
              }}
              captionLayout="dropdown"
              startMonth={new Date(2000, 0)}
              endMonth={new Date(2100, 11)}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!date || disabled}
          onClick={() => onChange({ ...draft, withTime: !withTime })}
        >
          <Clock className="size-4" />
          {withTime ? "Bỏ giờ" : "Thêm giờ"}
        </Button>
        {optional && date && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange({ text: "", withTime: false, time: "" })
            }}
          >
            Xóa ngày
          </Button>
        )}
      </div>
      {withTime && date && (
        <label className="grid gap-2 text-sm">
          Giờ ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          <input
            name={`${name}Time`}
            type="text"
            inputMode="numeric"
            placeholder="HH:mm"
            pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
            maxLength={5}
            required
            className={control}
            aria-label={`Giờ ${label.toLowerCase()}`}
            value={draft.time}
            onChange={(event) => onChange({ ...draft, time: event.target.value })}
          />
        </label>
      )}
      {optional && (
        <p className="text-xs text-muted-foreground">
          Để trống nếu chưa biết. Khi chỉ chọn ngày, ngày kết thúc được tính trọn ngày.
        </p>
      )}
    </fieldset>
  )
}
