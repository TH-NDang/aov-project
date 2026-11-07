import { GitCompareArrows } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@aov/ui/components/sheet"
import { sameDraftValue } from "@/app/drafts/draft-store"
import { AdminEntityText } from "../terminology/catalog"
import { comparisonFieldLabels, comparisonImages, comparisonValue } from "./hero-comparison"
import { HeroAsset } from "./hero-asset"
import { comparableSection, sameHeroSection, type HeroWorkingCopy } from "./hero-working-copy"
import type { HeroDraftChangeSet } from "./publishing-api"
import { skillFieldLabel } from "./skill-field-labels"
import { SkillRankComparison } from "./skill-rank-table"
import { compareSkillRanks } from "./skill-rank-values"
import { statReadingChange, type StatNumbers } from "./stat-reading"
import { SECTIONS, type Section } from "./types"

type Row = { label: string; field: string; before: unknown; after: unknown }
type SectionRows = { section: Section; name: string; rows: Row[] }
type SectionValues = Partial<Record<Section, unknown>>
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
export function changedRows(before: unknown, after: unknown, locale: string): Row[] {
  const rows: Row[] = []
  function visit(left: unknown, right: unknown, field: string, path: string[]) {
    if (sameDraftValue(left, right) || (left == null && right == null)) return
    if ((record(left) || left == null) && (record(right) || right == null) && (record(left) || record(right))) {
      const a = record(left) ? left : {}
      const b = record(right) ? right : {}
      const keys = new Set([...Object.keys(a), ...Object.keys(b)])
      const statKey = a.statKey ?? b.statKey
      const reading =
        typeof statKey === "string" ? statReadingChange(statKey, a as StatNumbers, b as StatNumbers) : null
      if (reading) {
        keys.delete("baseValue")
        keys.delete("percentValue")
        if (reading.before !== reading.after)
          rows.push({
            label: [...path, fieldLabels.baseValue].join(" · "),
            field: "baseValue",
            before: reading.before,
            after: reading.after,
          })
      }
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

function sectionRows(before: SectionValues, after: SectionValues, locale: string): SectionRows[] {
  return SECTIONS.map(([section, , name]) => ({
    section,
    name,
    rows: changedRows(
      comparableSection(section, before[section] as never),
      comparableSection(section, after[section] as never),
      locale,
    ),
  }))
}

function unsavedRows(before: HeroWorkingCopy, after: HeroWorkingCopy, locale: string): SectionRows[] {
  const sections = sectionRows(before.content, after.content, locale)
  for (const item of sections)
    for (const key of item.section === "PROFILE" ? (["PROFILE", "PROFILE_LORE"] as const) : ([item.section] as const))
      if (before.notes[key] !== after.notes[key])
        item.rows.push({
          label: key === "PROFILE_LORE" ? "Ghi chú thay đổi cốt truyện" : "Ghi chú thay đổi",
          field: "note",
          before: before.notes[key],
          after: after.notes[key],
        })
  return sections
}

/** Which sections the saved draft has changed. */
export function savedHeroSections(changes: { before: SectionValues; after: SectionValues }): Section[] {
  return SECTIONS.map(([key]) => key).filter(
    (key) => !sameHeroSection(key, (changes.before[key] ?? null) as never, (changes.after[key] ?? null) as never),
  )
}

function Value({ value, field }: { value: unknown; field: string }) {
  const images = comparisonImages(value, field)
  if (images.length)
    return images.map(({ id }, i) => (
      <HeroAsset key={i} id={id} alt={fieldLabels[field] ?? "Ảnh"} className="size-14" preview />
    ))
  if (value === undefined || value === null) return <span className="text-muted-foreground">Chưa có</span>
  if (field === "verificationState") return value === "VERIFIED" ? "Đã đối chiếu" : "Chưa đối chiếu"
  return <AdminEntityText text={comparisonValue(value, field) || "Trống"} />
}

function Changes({ sections, locale }: { sections: SectionRows[]; locale: string }) {
  return sections
    .filter(({ rows }) => rows.length > 0)
    .map(({ section, name, rows }) => (
      <section key={section} className="min-w-0 space-y-2" aria-label={name}>
        <h4 className="type-label">{name}</h4>
        <div className="divide-y rounded-lg border">
          {rows.map((row, i) => {
            const ranks = row.field === "display_values" && compareSkillRanks(row.before, row.after)
            return (
              <div key={i} className="space-y-2 p-3">
                <h5 className="type-meta break-words">{row.label}</h5>
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
    ))
}

const namesOf = (sections: SectionRows[]) =>
  sections
    .filter(({ rows }) => rows.length > 0)
    .map(({ name }) => name)
    .join(", ")

/** Everything this draft has changed: what is still only on this device, and what is already saved to the draft. */
export function HeroDraftChanges({
  before,
  after,
  saved,
  savedFailed,
  locale,
  name,
  revisionNo,
}: {
  before: HeroWorkingCopy
  after: HeroWorkingCopy
  saved?: HeroDraftChangeSet
  savedFailed: boolean
  locale: string
  name: string
  revisionNo: number
}) {
  const unsaved = unsavedRows(before, after, locale)
  const stored = saved ? sectionRows(saved.before, saved.after, locale) : []
  const hasUnsaved = unsaved.some(({ rows }) => rows.length > 0)
  const hasStored = stored.some(({ rows }) => rows.length > 0)
  return (
    <div className="mt-2 space-y-2">
      <p className="type-meta px-1">
        {savedFailed
          ? "Chưa tải được phần đã lưu của bản nháp."
          : !saved
            ? "Đang đọc phần đã lưu của bản nháp…"
            : hasStored
              ? `Đã lưu trong bản nháp: ${namesOf(stored)}.`
              : "Bản nháp chưa có thay đổi đã lưu."}
      </p>
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full">
            <GitCompareArrows />
            Xem thay đổi
          </Button>
        </SheetTrigger>
        <SheetContent className="@container w-full gap-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b pr-12">
            <SheetTitle>Thay đổi trong nháp · {name}</SheetTitle>
            <SheetDescription>Bản #{revisionNo}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            {hasUnsaved && (
              <section className="space-y-3" aria-label="Chưa lưu">
                <div>
                  <h3 className="type-section-title">Chưa lưu</h3>
                  <p className="type-meta">Trước là dữ liệu đã lưu trên máy chủ. Sau là nội dung trên thiết bị này.</p>
                </div>
                <Changes sections={unsaved} locale={locale} />
              </section>
            )}
            {hasStored && saved && (
              <section className="space-y-3" aria-label="Đã lưu vào bản nháp">
                <div>
                  <h3 className="type-section-title">Đã lưu vào bản nháp</h3>
                  <p className="type-meta">
                    {saved.source ? (
                      `So với bản #${saved.source.revisionNo}, bản dùng để tạo bản nháp này.`
                    ) : (
                      <>
                        So với nội dung lúc bắt đầu bản nháp,{" "}
                        <LocalTime value={saved.startedAt} format={{ dateStyle: "short", timeStyle: "short" }} />.
                      </>
                    )}
                  </p>
                </div>
                <Changes sections={stored} locale={locale} />
              </section>
            )}
            {!hasUnsaved && !hasStored && (
              <p role="status" className="type-body text-muted-foreground">
                {savedFailed
                  ? "Chưa tải được phần đã lưu của bản nháp. Hãy thử lại sau."
                  : saved
                    ? "Bản nháp này chưa có thay đổi nào."
                    : "Đang đọc phần đã lưu của bản nháp…"}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
