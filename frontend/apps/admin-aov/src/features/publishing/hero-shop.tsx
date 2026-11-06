import { useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ChevronDown, Pencil, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import {
  createPublishingApi,
  type HeroAvailability,
  type HeroShopPrice,
  type SkinAcquisition,
  type SkinMethod,
} from "./publishing-api"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"

const api = createPublishingApi(backendRequest)

/** The shop is read for one market so far; the data is kept per market so others can follow. */
const SHOP_REGION = "VN"
const shopKey = (heroId: string) => ["hero-shop", heroId, SHOP_REGION]

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

const amount = (value: number | null | undefined) => (value == null ? "—" : value.toLocaleString("vi-VN"))
const capturedDate = (value: string | null | undefined) => (value ? formatCalendarDate(value) : null)
const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value))
const control = "h-9 w-full rounded-md border bg-background px-2.5 text-sm disabled:opacity-50"
const today = () => new Date().toLocaleDateString("en-CA")

export function useHeroShop(heroId?: string) {
  return useQuery({
    queryKey: shopKey(heroId ?? ""),
    queryFn: () => api.shop(heroId!, SHOP_REGION),
    enabled: !!heroId,
    staleTime: 60000,
    retry: false,
  })
}

function ReviewMark() {
  return (
    <span
      className="type-meta inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
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
    meta: { successMessage: "Đã lưu giá tướng." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: shopKey(heroId) })
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
  return (
    <section className={className} aria-label="Giá tướng">
      <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
        <h3 className="type-section-title flex items-center gap-2">
          <Gold className="size-4 text-muted-foreground" />
          Giá tướng
        </h3>
        {canWrite && !editing && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Chỉnh sửa giá tướng"
            title="Chỉnh sửa giá tướng"
            onClick={open}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </div>
      {editing ? (
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="Trạng thái">
            <select
              className={control}
              value={form.availability}
              onChange={(event) => setForm({ ...form, availability: event.target.value as HeroAvailability })}
            >
              {Object.entries(availabilityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              Lưu
            </Button>
          </div>
        </form>
      ) : price ? (
        <div className="space-y-2">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <dt className="type-meta">Giá vàng</dt>
              <dd className="type-section-title tabular-nums">{amount(price.goldPrice)}</dd>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <dt className="type-meta">Quân huy</dt>
              <dd className="type-section-title tabular-nums">{amount(price.voucherPrice)}</dd>
            </div>
          </dl>
          <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{availabilityLabels[price.availability]}</span>
            {capturedDate(price.capturedOn) && <span>Từ {capturedDate(price.capturedOn)}</span>}
            {price.needsReview && <ReviewMark />}
          </p>
          {price.note && <p className="type-meta">{price.note}</p>}
          <PriceHistory heroId={heroId} rows={shop.data?.priceHistory ?? []} canWrite={canWrite} />
        </div>
      ) : (
        <p className="type-meta">{shop.isError ? "Chưa tải được giá tướng." : "Chưa có giá ở thị trường Việt Nam."}</p>
      )}
    </section>
  )
}

/** The hero's earlier prices, so an old value can be read together with the day it held. */
function PriceHistory({ heroId, rows, canWrite }: { heroId: string; rows: HeroShopPrice[]; canWrite: boolean }) {
  const client = useQueryClient()
  const remove = useMutation({
    mutationFn: (capturedOn: string) => api.deleteShopPrice(heroId, SHOP_REGION, capturedOn),
    meta: { successMessage: "Đã xóa mốc giá." },
    onSuccess: () => client.invalidateQueries({ queryKey: shopKey(heroId) }),
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
            {row.needsReview && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-label="Cần xem lại" />}
            {canWrite && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Xóa mốc giá ${capturedDate(row.capturedOn)}`}
                title="Xóa mốc này nếu ghi nhầm"
                disabled={remove.isPending}
                onClick={() => {
                  if (row.capturedOn) remove.mutate(row.capturedOn)
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

/** How a skin is obtained, editable in place from its card. */
export function SkinAcquisitionRow({
  heroId,
  skinKey,
  value,
  history = [],
  canWrite,
}: {
  heroId: string
  skinKey: string
  value?: SkinAcquisition
  /** Every dated step of this skin, newest first. */
  history?: SkinAcquisition[]
  canWrite: boolean
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    method: "VOUCHER" as SkinMethod,
    voucherPrice: "",
    eventName: "",
    capturedOn: "",
    needsReview: false,
    note: "",
  })
  const remove = useMutation({
    mutationFn: (capturedOn: string) => api.deleteSkinAcquisition(heroId, skinKey, SHOP_REGION, capturedOn),
    meta: { successMessage: "Đã xóa mốc cách nhận." },
    onSuccess: () => client.invalidateQueries({ queryKey: shopKey(heroId) }),
  })
  const save = useMutation({
    mutationFn: () =>
      api.saveSkinAcquisition(heroId, skinKey, SHOP_REGION, {
        method: form.method,
        voucherPrice: numberOrNull(form.voucherPrice),
        eventName: form.eventName.trim() || null,
        capturedOn: form.capturedOn || null,
        needsReview: form.needsReview,
        note: form.note.trim() || null,
      }),
    meta: { successMessage: "Đã lưu cách nhận trang phục." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: shopKey(heroId) })
      setOpen(false)
    },
  })
  const start = (next: boolean) => {
    if (next) {
      setForm({
        method: value?.method ?? "VOUCHER",
        voucherPrice: value?.voucherPrice?.toString() ?? "",
        eventName: value?.eventName ?? "",
        capturedOn: value?.capturedOn ?? today(),
        needsReview: value?.needsReview ?? false,
        note: value?.note ?? "",
      })
      save.reset()
    }
    setOpen(next)
  }
  return (
    <div className="flex min-h-8 items-center gap-2 border-t pt-2">
      <span className="min-w-0 flex-1">
        <span className="type-body block truncate font-medium" title={value ? skinAcquisitionText(value) : undefined}>
          {value ? skinAcquisitionText(value) : <span className="text-muted-foreground">Chưa rõ cách nhận</span>}
        </span>
        {value?.needsReview && <ReviewMark />}
      </span>
      {canWrite && (
        <Popover open={open} onOpenChange={start}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Chỉnh sửa cách nhận trang phục"
              title="Chỉnh sửa cách nhận trang phục"
            >
              <Pencil className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                save.mutate()
              }}
            >
              <Field label="Cách nhận">
                <select
                  className={control}
                  value={form.method}
                  onChange={(event) => setForm({ ...form, method: event.target.value as SkinMethod })}
                >
                  {Object.entries(methodLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.method === "VOUCHER" && (
                <Field label="Giá gốc (quân huy)">
                  <Input
                    inputMode="numeric"
                    type="number"
                    min={0}
                    value={form.voucherPrice}
                    onChange={(event) => setForm({ ...form, voucherPrice: event.target.value })}
                  />
                </Field>
              )}
              {form.method === "EVENT" && (
                <Field label="Tên sự kiện">
                  <Input
                    value={form.eventName}
                    maxLength={200}
                    onChange={(event) => setForm({ ...form, eventName: event.target.value })}
                  />
                </Field>
              )}
              <Field label="Áp dụng từ ngày">
                <Input
                  type="date"
                  required
                  value={form.capturedOn}
                  onChange={(event) => setForm({ ...form, capturedOn: event.target.value })}
                />
              </Field>
              <Field label="Ghi chú nội bộ">
                <Input
                  value={form.note}
                  maxLength={500}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </Field>
              {history.length > 1 && (
                <ul className="grid gap-1 border-t pt-2" aria-label="Các mốc cách nhận">
                  {history.map((row) => (
                    <li key={row.capturedOn} className="type-meta flex items-center gap-2">
                      <span className="w-20 shrink-0 tabular-nums">{capturedDate(row.capturedOn)}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{skinAcquisitionText(row)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label={`Xóa mốc ${capturedDate(row.capturedOn)}`}
                        title="Xóa mốc này nếu ghi nhầm"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (row.capturedOn) remove.mutate(row.capturedOn)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
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
                  onClick={() => setOpen(false)}
                  disabled={save.isPending}
                >
                  Hủy
                </Button>
                <Button type="submit" size="sm" disabled={save.isPending}>
                  Lưu
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

/** A line above the skins counting how they are obtained, so gaps show without opening each card. */
export function SkinAcquisitionSummary({ rows, total }: { rows: SkinAcquisition[]; total: number }) {
  if (!rows.length) return null
  const count = (method: SkinMethod) => rows.filter((row) => row.method === method).length
  const review = rows.filter((row) => row.needsReview).length
  const missing = total - rows.length
  const parts: [string, number][] = [
    ["quân huy", count("VOUCHER")],
    ["sự kiện", count("EVENT")],
    ["chưa mở", count("NOT_OPEN")],
    ["cách khác", count("OTHER") + count("UNKNOWN")],
    ["chưa rõ cách nhận", Math.max(0, missing)],
  ]
  return (
    <p className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1">
      {parts
        .filter(([, value]) => value > 0)
        .map(([label, value]) => (
          <span key={label}>
            <span className="font-semibold text-foreground tabular-nums">{value}</span> {label}
          </span>
        ))}
      {review > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          {review} cần xem lại
        </span>
      )}
    </p>
  )
}
