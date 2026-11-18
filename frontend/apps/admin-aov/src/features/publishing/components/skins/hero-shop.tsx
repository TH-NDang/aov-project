import { useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ChevronDown, ChevronRight, Gem, Pencil, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { confirmAction } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import {
  createPublishingApi,
  type HeroAvailability,
  type HeroShopPrice,
  type SkinAcquisition,
  type SkinMethod,
  publishingKeys,
} from "../../api/publishing-api"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { captureGroupKeys } from "../../model/captures/patch-capture-model"
import { PatchCaptureLink } from "../captures/patch-capture-panel"
import { formatGameNumber } from "@aov/ui/lib/game-number"
import { NativeSelect } from "@/components/native-select"

const api = createPublishingApi(backendRequest)

/** The shop is read for one market so far; the data is kept per market so others can follow. */
const SHOP_REGION = "VN"

const availabilityLabels: Record<HeroAvailability, string> = {
  ON_SALE: "Đang bán",
  NOT_OPEN: "Chưa mở",
  COMING_SOON: "Sắp ra mắt",
  UNKNOWN: "Chưa rõ",
}
const methodLabels: Record<SkinMethod, string> = {
  VOUCHER: "Quân huy",
  EVENT: "Sự kiện",
  NOT_OPEN: "Chưa mở",
  OTHER: "Cách khác",
  UNKNOWN: "Chưa rõ",
}

/** Gold and vouchers are figures of the game, written as the game writes them. */
const amount = (value: number | null | undefined) => (value == null ? "—" : formatGameNumber(value))
const capturedDate = (value: string | null | undefined) => (value ? formatCalendarDate(value) : null)
const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value))
const today = () => new Date().toLocaleDateString("en-CA")

export function useHeroShop(heroId?: string) {
  return useQuery({
    queryKey: publishingKeys.shop(heroId ?? "", SHOP_REGION),
    queryFn: () => api.shop(heroId!, SHOP_REGION),
    enabled: !!heroId,
    staleTime: 60000,
    retry: false,
  })
}

export function ReviewMark() {
  return (
    <span
      className="type-meta inline-flex items-center gap-1 text-(--aov-warning)"
      title="Chưa hiện ra Wiki cho tới khi xác nhận"
    >
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      Cần xem lại
    </span>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="type-label">{label}</span>
      {children}
    </label>
  )
}

/** What the hero costs. It follows the shop rather than a patch, so saving needs no draft. */
export function HeroShopPanel({
  heroId,
  canWrite,
  className,
}: {
  heroId: string
  canWrite: boolean
  className?: string
}) {
  const client = useQueryClient()
  const shop = useHeroShop(heroId)
  const price = shop.data?.price ?? null
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    availability: "ON_SALE" as HeroAvailability,
    goldPrice: "",
    voucherPrice: "",
    capturedOn: "",
    needsReview: false,
    note: "",
  })
  const save = useMutation({
    mutationFn: () =>
      api.saveShopPrice(heroId, SHOP_REGION, {
        availability: form.availability,
        goldPrice: numberOrNull(form.goldPrice),
        voucherPrice: numberOrNull(form.voucherPrice),
        capturedOn: form.capturedOn || null,
        needsReview: form.needsReview,
        note: form.note.trim() || null,
      }),
    meta: { silent: true, successMessage: "Đã lưu giá tướng." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: publishingKeys.shop(heroId, SHOP_REGION) })
      setEditing(false)
    },
  })
  const open = () => {
    setForm({
      availability: price?.availability ?? "ON_SALE",
      goldPrice: price?.goldPrice?.toString() ?? "",
      voucherPrice: price?.voucherPrice?.toString() ?? "",
      capturedOn: price?.capturedOn ?? today(),
      needsReview: price?.needsReview ?? false,
      note: price?.note ?? "",
    })
    save.reset()
    setEditing(true)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  const Gold = gameplayIcons.coin
  const actions = (
    <span className="inline-flex shrink-0 items-center">
      <PatchCaptureLink groupKey={captureGroupKeys.shopPrice} name="giá tướng" />
      {canWrite && !editing && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Chỉnh sửa giá tướng"
          title="Chỉnh sửa giá tướng"
          onClick={open}
        >
          <Pencil className="size-3.5" />
        </Button>
      )}
    </span>
  )
  // One line under the hero name: each currency as its icon and amount, then since when it holds.
  return (
    <section className={className} aria-label="Giá tướng">
      {editing ? (
        <div className="mt-1 rounded-lg border p-3">
          <p className="type-label mb-3">Giá tướng</p>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Trạng thái">
              <NativeSelect
                className="w-full"
                value={form.availability}
                onChange={(event) => setForm({ ...form, availability: event.target.value as HeroAvailability })}
              >
                {Object.entries(availabilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giá vàng">
                <Input
                  inputMode="numeric"
                  type="number"
                  min={0}
                  value={form.goldPrice}
                  onChange={(event) => setForm({ ...form, goldPrice: event.target.value })}
                />
              </Field>
              <Field label="Quân huy">
                <Input
                  inputMode="numeric"
                  type="number"
                  min={0}
                  value={form.voucherPrice}
                  onChange={(event) => setForm({ ...form, voucherPrice: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Áp dụng từ ngày">
              <Input
                type="date"
                required
                value={form.capturedOn}
                onChange={(event) => setForm({ ...form, capturedOn: event.target.value })}
              />
            </Field>
            <p className="type-meta">
              Giữ ngày cũ để sửa mốc này. Chọn ngày mới để thêm mốc giá, giá cũ vẫn được giữ lại.
            </p>
            <Field label="Ghi chú nội bộ">
              <Input
                value={form.note}
                maxLength={500}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </Field>
            <label className="type-body flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.needsReview}
                onChange={(event) => setForm({ ...form, needsReview: event.target.checked })}
              />
              Cần xem lại, chưa hiện ra Wiki
            </label>
            {save.isError && (
              <p role="alert" className="type-meta text-destructive">
                {errorMessage(save.error)}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={save.isPending}
              >
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                Lưu
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {price ? (
            <>
              <dl className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1.5" title="Giá vàng">
                  <dt>
                    <Gold className="size-4 text-primary" aria-hidden="true" />
                    <span className="sr-only">Giá vàng</span>
                  </dt>
                  <dd className="type-body tabular-nums">
                    <strong className="font-semibold">{amount(price.goldPrice)}</strong>
                  </dd>
                </div>
                <div className="flex items-center gap-1.5" title="Quân huy">
                  <dt>
                    <Gem className="size-4 text-primary" aria-hidden="true" />
                    <span className="sr-only">Quân huy</span>
                  </dt>
                  <dd className="type-body tabular-nums">
                    <strong className="font-semibold">{amount(price.voucherPrice)}</strong>
                  </dd>
                </div>
              </dl>
              {/* A hero on sale needs no label; any other state says why the amounts may not apply. */}
              {price.availability !== "ON_SALE" && (
                <span className="type-meta">{availabilityLabels[price.availability]}</span>
              )}
              {price.needsReview && <ReviewMark />}
              {actions}
            </>
          ) : (
            <>
              <span className="type-meta">
                {shop.isError ? "Chưa tải được giá tướng." : "Chưa có giá ở thị trường Việt Nam."}
              </span>
              {actions}
            </>
          )}
        </div>
      )}
      {!editing && price?.note && <p className="type-meta">{price.note}</p>}
      {!editing && price && <PriceHistory heroId={heroId} rows={shop.data?.priceHistory ?? []} canWrite={canWrite} />}
    </section>
  )
}

/** The hero's earlier prices, so an old value can be read together with the day it held. */
function PriceHistory({ heroId, rows, canWrite }: { heroId: string; rows: HeroShopPrice[]; canWrite: boolean }) {
  const client = useQueryClient()
  const remove = useMutation({
    mutationFn: (capturedOn: string) => api.deleteShopPrice(heroId, SHOP_REGION, capturedOn),
    meta: { successMessage: "Đã xóa mốc giá." },
    onSuccess: () => client.invalidateQueries({ queryKey: publishingKeys.shop(heroId, SHOP_REGION) }),
  })
  if (rows.length < 2) return null
  return (
    <details className="group/history">
      <summary className="type-meta flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open/history:rotate-180" aria-hidden="true" />
        Các mốc giá ({rows.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {rows.map((row) => (
          <li key={row.capturedOn} className="type-meta flex items-center gap-2">
            <span className="w-20 shrink-0 tabular-nums">{capturedDate(row.capturedOn)}</span>
            <span className="min-w-0 flex-1 truncate tabular-nums text-foreground">
              {row.availability === "ON_SALE"
                ? `${amount(row.goldPrice)} vàng · ${amount(row.voucherPrice)} quân huy`
                : availabilityLabels[row.availability]}
            </span>
            {row.needsReview && (
              <AlertTriangle className="size-3.5 shrink-0 text-(--aov-warning)" aria-label="Cần xem lại" />
            )}
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Xóa mốc giá ${capturedDate(row.capturedOn)}`}
                title="Xóa mốc này nếu ghi nhầm"
                disabled={remove.isPending}
                onClick={async () => {
                  if (!row.capturedOn) return

                  const accepted = await confirmAction({
                    title: `Xóa mốc giá ${capturedDate(row.capturedOn)}?`,
                    description: "Mốc này sẽ bị xóa khỏi các mốc giá của tướng và không lấy lại được.",
                    confirmLabel: "Xóa mốc giá",
                  })
                  if (accepted) remove.mutate(row.capturedOn)
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

/** A skin's way of being obtained, written the way a reader would say it. */
export function skinAcquisitionText(row: SkinAcquisition) {
  if (row.method === "VOUCHER") return row.voucherPrice == null ? "Quân huy" : `${amount(row.voucherPrice)} quân huy`
  if (row.method === "EVENT") return row.eventName ? `Sự kiện: ${row.eventName}` : "Nhận từ sự kiện"
  if (row.method === "NOT_OPEN") return "Chưa mở"
  return methodLabels[row.method]
}

/** What the form holds for one skin; the tab keeps it, so moving to another skin never loses what was typed. */
export interface SkinAcquisitionDraft {
  method: SkinMethod
  voucherPrice: string
  eventName: string
  capturedOn: string
  needsReview: boolean
  note: string
}

export const skinAcquisitionDraft = (value?: SkinAcquisition): SkinAcquisitionDraft => ({
  method: value?.method ?? "VOUCHER",
  voucherPrice: value?.voucherPrice?.toString() ?? "",
  eventName: value?.eventName ?? "",
  capturedOn: value?.capturedOn ?? today(),
  needsReview: value?.needsReview ?? false,
  note: value?.note ?? "",
})

export const skinDraftChanged = (draft: SkinAcquisitionDraft, value?: SkinAcquisition) =>
  JSON.stringify(draft) !== JSON.stringify(skinAcquisitionDraft(value))

/** The list price a shop card shows, as read off the screenshot; events and locked cards have none. */
export function readingVoucherPrice(reading: string | undefined) {
  const list = /^([\d.]+) quân huy/.exec(reading ?? "")?.[1]
  return list ? Number(list.replaceAll(".", "")) : null
}

/**
 * How a skin is obtained, written straight on the tab with its dated steps below. A new date adds a step and keeps the
 * old value; the same date corrects that step.
 */
export function SkinAcquisitionEditor({
  heroId,
  skinKey,
  value,
  history = [],
  canWrite,
  draft,
  onDraftChange,
  nextName,
  onNext,
  editing = true,
  onEditingChange,
}: {
  heroId: string
  skinKey: string
  value?: SkinAcquisition
  /** Every dated step of this skin, newest first. */
  history?: SkinAcquisition[]
  canWrite: boolean
  /** Unsaved changes; absent means the form shows what is stored. */
  draft?: SkinAcquisitionDraft
  onDraftChange: (draft: SkinAcquisitionDraft | null) => void
  /** Offers to save and move on, so a run of skins takes one key per skin. */
  nextName?: string
  onNext?: () => void
  /** The form is open; otherwise the stored value reads like any other field, with a pencil beside its heading. */
  editing?: boolean
  onEditingChange?: (editing: boolean) => void
}) {
  const client = useQueryClient()
  const form = draft ?? skinAcquisitionDraft(value)
  const update = (patch: Partial<SkinAcquisitionDraft>) => {
    const next = { ...form, ...patch }
    // Typing a value back to what is stored leaves nothing to lose, so the skin stops reading as unsaved.
    onDraftChange(skinDraftChanged(next, value) ? next : null)
  }
  const remove = useMutation({
    mutationFn: (capturedOn: string) => api.deleteSkinAcquisition(heroId, skinKey, SHOP_REGION, capturedOn),
    meta: { successMessage: "Đã xóa mốc cách nhận." },
    onSuccess: () => client.invalidateQueries({ queryKey: publishingKeys.shop(heroId, SHOP_REGION) }),
  })
  const save = useMutation({
    mutationFn: (_next: boolean) =>
      api.saveSkinAcquisition(heroId, skinKey, SHOP_REGION, {
        method: form.method,
        voucherPrice: form.method === "VOUCHER" ? numberOrNull(form.voucherPrice) : null,
        eventName: form.method === "EVENT" ? form.eventName.trim() || null : null,
        capturedOn: form.capturedOn || null,
        needsReview: form.needsReview,
        note: form.note.trim() || null,
      }),
    meta: { silent: true, successMessage: "Đã lưu cách nhận trang phục." },
    onSuccess: async (_saved, next) => {
      await client.invalidateQueries({ queryKey: publishingKeys.shop(heroId, SHOP_REGION) })
      onDraftChange(null)
      if (next) onNext?.()
      else onEditingChange?.(false)
    },
  })
  const steps = history.length > 1 && (
    <details className="group/history">
      <summary className="type-meta flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open/history:rotate-180" aria-hidden="true" />
        Các mốc cách nhận ({history.length})
      </summary>
      <ul className="mt-2 grid gap-1" aria-label="Các mốc cách nhận">
        {history.map((row) => (
          <li key={row.capturedOn} className="type-meta flex items-center gap-2">
            <span className="w-20 shrink-0 tabular-nums">{capturedDate(row.capturedOn)}</span>
            <span className="min-w-0 flex-1 truncate text-foreground">{skinAcquisitionText(row)}</span>
            {row.needsReview && (
              <AlertTriangle className="size-3.5 shrink-0 text-(--aov-warning)" aria-label="Cần xem lại" />
            )}
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Xóa mốc ${capturedDate(row.capturedOn)}`}
                title="Xóa mốc này nếu ghi nhầm"
                disabled={remove.isPending}
                onClick={async () => {
                  if (!row.capturedOn) return

                  const accepted = await confirmAction({
                    title: `Xóa mốc cách nhận ${capturedDate(row.capturedOn)}?`,
                    description: "Mốc này sẽ bị xóa khỏi các mốc cách nhận của trang phục và không lấy lại được.",
                    confirmLabel: "Xóa mốc",
                  })
                  if (accepted) remove.mutate(row.capturedOn)
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
  if (!canWrite || (!editing && !draft))
    return (
      <div className="grid gap-2">
        <p className="type-section-title">
          {value ? skinAcquisitionText(value) : <span className="text-muted-foreground">Chưa rõ cách nhận</span>}
        </p>
        <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1">
          {capturedDate(value?.capturedOn) && <span>Từ {capturedDate(value?.capturedOn)}</span>}
          {value?.needsReview && <ReviewMark />}
        </p>
        {value?.note && <p className="type-meta">{value.note}</p>}
        {steps}
      </div>
    )
  const changed = skinDraftChanged(form, value)
  const busy = save.isPending
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (changed) save.mutate(false)
      }}
    >
      <div role="group" aria-label="Cách nhận" className="flex flex-wrap gap-1">
        {(Object.entries(methodLabels) as [SkinMethod, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={form.method === key}
            className={cn(
              "type-label h-8 rounded-md border px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              form.method === key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            onClick={() => update({ method: key })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 @min-[420px]/skin-work:grid-cols-2">
        {form.method === "VOUCHER" && (
          <Field label="Giá gốc (quân huy)">
            <Input
              inputMode="numeric"
              type="number"
              min={0}
              value={form.voucherPrice}
              onChange={(event) => update({ voucherPrice: event.target.value })}
            />
          </Field>
        )}
        {form.method === "EVENT" && (
          <Field label="Tên sự kiện">
            <Input
              value={form.eventName}
              maxLength={200}
              onChange={(event) => update({ eventName: event.target.value })}
            />
          </Field>
        )}
        <Field label="Áp dụng từ ngày">
          <Input
            type="date"
            required
            value={form.capturedOn}
            onChange={(event) => update({ capturedOn: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid items-end gap-3 @min-[420px]/skin-work:grid-cols-2">
        <Field label="Ghi chú nội bộ">
          <Input value={form.note} maxLength={500} onChange={(event) => update({ note: event.target.value })} />
        </Field>
        <label className="type-body flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary"
            checked={form.needsReview}
            onChange={(event) => update({ needsReview: event.target.checked })}
          />
          Cần xem lại, chưa hiện ra Wiki
        </label>
      </div>
      {save.isError && (
        <p role="alert" className="type-meta text-destructive">
          {errorMessage(save.error)}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            onDraftChange(null)
            onEditingChange?.(false)
          }}
        >
          Hủy
        </Button>
        <Button type="submit" size="sm" variant={nextName ? "outline" : "default"} disabled={busy || !changed}>
          Lưu
        </Button>
        {nextName && (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            title={changed ? `Lưu rồi mở ${nextName}` : `Mở ${nextName}`}
            onClick={(event) => {
              if (!changed) onNext?.()
              else if (event.currentTarget.form?.reportValidity()) save.mutate(true)
            }}
          >
            {changed ? "Lưu và sang tiếp" : "Sang tiếp"}
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
      {steps}
    </form>
  )
}

/** Which skins still need an editor: the summary doubles as the filter of the skin rail. */
export type SkinWorkFilter = "all" | "review" | "unknown"

export const skinNeedsReview = (row: SkinAcquisition | undefined) => !!row?.needsReview
export const skinIsUnknown = (row: SkinAcquisition | undefined) => !row || row.method === "UNKNOWN"

/** How skins are obtained at a glance; gaps stay one click from being the only skins shown. */
export function SkinAcquisitionSummary({
  rows,
  total,
  filter,
  onFilter,
}: {
  rows: SkinAcquisition[]
  total: number
  filter: SkinWorkFilter
  onFilter: (filter: SkinWorkFilter) => void
}) {
  const count = (method: SkinMethod) => rows.filter((row) => row.method === method).length
  const review = rows.filter(skinNeedsReview).length
  const unknown = total - rows.filter((row) => !skinIsUnknown(row)).length
  const parts: [string, number][] = [
    ["quân huy", count("VOUCHER")],
    ["sự kiện", count("EVENT")],
    ["chưa mở", count("NOT_OPEN")],
    ["cách khác", count("OTHER")],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <FilterTabs label="Lọc trang phục theo việc cần làm">
        <FilterTab active={filter === "all"} count={total} onClick={() => onFilter("all")}>
          Tất cả
        </FilterTab>
        <FilterTab
          active={filter === "review"}
          count={review}
          disabled={!review && filter !== "review"}
          className={review ? "text-(--aov-warning)" : undefined}
          onClick={() => onFilter("review")}
        >
          <AlertTriangle aria-hidden="true" />
          Cần xem lại
        </FilterTab>
        <FilterTab
          active={filter === "unknown"}
          count={unknown}
          disabled={!unknown && filter !== "unknown"}
          onClick={() => onFilter("unknown")}
        >
          Chưa rõ cách nhận
        </FilterTab>
      </FilterTabs>
      {/* Beside the screenshot panel this line would push the form down, and the form matters more there. */}
      <p className="type-meta hidden flex-wrap items-center gap-x-3 gap-y-1 @min-[640px]/skin-tab:flex">
        {parts
          .filter(([, value]) => value > 0)
          .map(([label, value]) => (
            <span key={label}>
              <span className="font-semibold text-foreground tabular-nums">{value}</span> {label}
            </span>
          ))}
      </p>
    </div>
  )
}
