import { GitCompareArrows } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { sameDraftValue } from "@/app/drafts/draft-store"
import { AdminEntityText } from "../terminology/catalog"
import { comparisonFieldLabels, comparisonImages, comparisonValue } from "./hero-comparison"
import { HeroAsset } from "./hero-asset"
import type { HeroWorkingCopy } from "./hero-working-copy"
import { skillFieldLabel } from "./skill-field-labels"
import { SkillRankComparison } from "./skill-rank-table"
import { compareSkillRanks } from "./skill-rank-values"
import { SECTIONS } from "./types"

type Row = { label: string; field: string; before: unknown; after: unknown }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const fieldLabels: Record<string, string> = {
  ...comparisonFieldLabels,
  bindings: "Ảnh đang dùng",
  sources: "Nguồn tham khảo",
  sourceUrl: "URL nguồn",
  observedAt: "Ngày giờ ghi nhận",
  verificationState: "Đối chiếu nguồn",
  note: "Ghi chú",
  derived: "Giá trị suy ra",
  scaleCode: "Thang đánh giá",
  skinKey: "Khóa trang phục",
}
const identities: Record<string, string> = {
  skills: "skillKey",
  skins: "skinKey",
  translations: "locale",
  values: "statKey",
  effects: "effectType",
}

function itemLabel(item: unknown, locale: string, index: number): string {
  if (record(item)) {
    if (Array.isArray(item.translations)) {
      const texts = item.translations.filter(record)
      const name = texts.find((t) => t.locale === locale && t.name)?.name ?? texts.find((t) => t.name)?.name
      if (typeof name === "string") return name
    }
    if (typeof item.locale === "string") return item.locale
    if (typeof item.statKey === "string") return fieldLabels[item.statKey] ?? item.statKey
    if (typeof item.label === "string" && item.label) return item.label
    if (typeof item.effectType === "string") return fieldLabels[item.effectType] ?? skillFieldLabel(item.effectType)
  }
  return `Mục ${index + 1}`
}

/** Match identified rows before comparing fields so removing a skill does not rename the following ones. */
function changedRows(before: unknown, after: unknown, locale: string): Row[] {
  const rows: Row[] = []
  function visit(left: unknown, right: unknown, field: string, path: string[]) {
    if (sameDraftValue(left, right)) return
    if ((record(left) || left == null) && (record(right) || right == null) && (record(left) || record(right))) {
      const a = record(left) ? left : {}
      const b = record(right) ? right : {}
      const keys = new Set([...Object.keys(a), ...Object.keys(b)])
      if (keys.size) {
        for (const key of keys) visit(a[key], b[key], key, [...path, fieldLabels[key] ?? skillFieldLabel(key)])
        return
      }
    }
    if ((Array.isArray(left) || left == null) && (Array.isArray(right) || right == null)) {
      const a: unknown[] = Array.isArray(left) ? left : []
      const b: unknown[] = Array.isArray(right) ? right : []
      if ([...a, ...b].some(record)) {
        const key = identities[field]
        const identified =
          key &&
          [a, b].every(
            (items) =>
              items.every((item) => record(item) && typeof item[key] === "string") &&
              new Set(items.map((item) => (item as Record<string, unknown>)[key])).size === items.length,
          )
        const index = (items: unknown[]) =>
          new Map(
            items.map((item, i) => [
              identified && record(item) ? String(item[key]) : String(i),
              { item, name: itemLabel(item, locale, i) },
            ]),
          )
        const prev = index(a)
        const next = index(b)
        const oldOrder = [...prev.keys()].filter((id) => next.has(id))
        const newOrder = [...next.keys()].filter((id) => prev.has(id))
        if (!sameDraftValue(oldOrder, newOrder))
          rows.push({
            label: [...path, "Thứ tự"].join(" · "),
            field: "displayOrder",
            before: oldOrder.map((id) => prev.get(id)!.name),
            after: newOrder.map((id) => next.get(id)!.name),
          })
        for (const id of new Set([...prev.keys(), ...next.keys()])) {
          const oldItem = prev.get(id)
          const newItem = next.get(id)
          visit(oldItem?.item, newItem?.item, field, [...path, (newItem ?? oldItem)!.name])
        }
        return
      }
    }
    rows.push({ label: path.join(" · ") || "Nội dung", field, before: left, after: right })
  }
  visit(before, after, "", [])
  return rows
}

function Value({ value, field }: { value: unknown; field: string }) {
  const images = comparisonImages(value, field)
  if (images.length)
    return images.map(({ id }, i) => (
      <HeroAsset key={i} id={id} alt={fieldLabels[field] ?? "Ảnh"} className="size-14" preview />
    ))
  if (value === undefined) return <span className="text-muted-foreground">Chưa có</span>
  if (field === "verificationState") return value === "VERIFIED" ? "Đã đối chiếu" : "Chưa đối chiếu"
  return <AdminEntityText text={comparisonValue(value, field) || "Trống"} />
}

function Changes({ before, after, locale }: { before: HeroWorkingCopy; after: HeroWorkingCopy; locale: string }) {
  return SECTIONS.map(([section, , name]) => {
    const rows = changedRows(before.content[section], after.content[section], locale)
    for (const key of section === "PROFILE" ? (["PROFILE", "PROFILE_LORE"] as const) : ([section] as const)) {
      if (before.notes[key] !== after.notes[key])
        rows.push({
          label: key === "PROFILE_LORE" ? "Ghi chú thay đổi cốt truyện" : "Ghi chú thay đổi",
          field: "note",
          before: before.notes[key],
          after: after.notes[key],
        })
    }
    if (!rows.length) return null
    return (
      <section key={section} className="min-w-0 space-y-2" aria-label={name}>
        <h3 className="type-section-title">{name}</h3>
        <div className="divide-y rounded-lg border">
          {rows.map((row, i) => {
            const ranks = row.field === "display_values" && compareSkillRanks(row.before, row.after)
            return (
              <div key={i} className="space-y-2 p-3">
                <h4 className="type-label break-words">{row.label}</h4>
                {ranks ? (
                  <SkillRankComparison label={row.label} data={ranks} locale={locale} />
                ) : (
                  <dl className="grid gap-2 @min-[440px]:grid-cols-2">
                    {(["before", "after"] as const).map((side) => (
                      <div key={side} className="min-w-0 rounded-md bg-muted/35 p-2.5">
                        <dt className="type-meta mb-1">{side === "before" ? "Trước" : "Sau"}</dt>
                        <dd className="type-body whitespace-pre-wrap [overflow-wrap:anywhere]">
                          <Value value={row[side]} field={row.field} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  })
}

export function HeroDraftChanges({
  before,
  after,
  locale,
  name,
  revisionNo,
}: {
  before: HeroWorkingCopy
  after: HeroWorkingCopy
  locale: string
  name: string
  revisionNo: number
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="mt-2 w-full">
          <GitCompareArrows />
          Xem thay đổi
        </Button>
      </SheetTrigger>
      <SheetContent className="@container w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b pr-12">
          <SheetTitle>Thay đổi trong nháp · {name}</SheetTitle>
          <SheetDescription>
            Bản #{revisionNo} · Trước là dữ liệu đã lưu trên máy chủ. Sau là nội dung nháp trên thiết bị.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <Changes before={before} after={after} locale={locale} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
