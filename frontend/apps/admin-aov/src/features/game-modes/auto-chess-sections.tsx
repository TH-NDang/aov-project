import { useMemo, useState, type CSSProperties, type ReactNode } from "react"
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ListPlus,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Switch } from "@aov/ui/components/switch"
import { Textarea } from "@aov/ui/components/textarea"
import { confirmAction } from "@/components/confirm-dialog"
import { AdminDescriptionField } from "../terminology/rich-text-field"
import { ClampedChips, HeroCodePicker, RowMenu, SuggestInput } from "./entry-controls"
import type { GuideContent, GuideLineup } from "./game-mode-api"
import { fixedCodes, named } from "./guide-codes"
import { normalize, slugify } from "@/lib/text"

export type Unit = GuideContent["units"][number]
export type Trait = GuideContent["traits"][number]
type Item = GuideContent["items"][number]
type Blessing = GuideContent["blessings"][number]

export interface SectionProps {
  content: GuideContent
  /** The draft as last saved; its codes no longer follow a name. */
  saved: GuideContent | null
  setContent: (content: GuideContent) => void
  image: (id?: string | null) => string | undefined
  upload: (file: File, label: string) => Promise<string>
}

/** The game's cost colors, so a price reads at a glance like in the guide. */
export const COST_COLOR: Record<number, string> = {
  1: "#9aa4b2",
  2: "#4fbf7a",
  3: "#4f9be0",
  4: "#b46cff",
  5: "#f2b440",
  6: "#e0625a",
}
/** The game's blessing tiers: blue, purple and bronze cards with a brighter title. */
const TIER_COLOR: Record<Blessing["tier"], string> = { NORMAL: "#4fb0ff", EPIC: "#e277ff", LEGENDARY: "#ffab45" }
const TIER_BACKGROUND: Record<Blessing["tier"], string> = {
  NORMAL: "linear-gradient(180deg, #1b3988, #2b5cc4)",
  EPIC: "linear-gradient(180deg, #491c7a, #7f3ca8)",
  LEGENDARY: "linear-gradient(180deg, #5a3110, #96591f)",
}
const TIER_LABEL: Record<Blessing["tier"], string> = {
  NORMAL: "Thường",
  EPIC: "Huyền thoại / Sử thi",
  LEGENDARY: "Truyền thuyết",
}
const LINEUP_TIER_COLOR: Record<string, string> = { S: "#e05555", A: "#e0954a", B: "#d8c35a", C: "#6aa86a" }

const swapAt = <T,>(rows: T[], at: number, next: T) => rows.map((row, index) => (index === at ? next : row))

/** A copy right after the original, with a code nothing else uses yet. */
function duplicateAt<T extends { code: string; name: string }>(rows: T[], at: number): T[] {
  const source = rows[at]
  const taken = new Set(rows.map((row) => row.code))
  const base = source.code.replace(/-\d+$/, "") || "ban-sao"
  let number = 2
  while (taken.has(`${base}-${number}`)) number++
  const copy = { ...source, code: `${base}-${number}`, name: `${source.name} (bản sao)` }
  return [...rows.slice(0, at + 1), copy, ...rows.slice(at + 1)]
}

const moveAt = <T,>(rows: T[], at: number, delta: -1 | 1) => {
  const target = at + delta
  if (target < 0 || target >= rows.length) return rows
  const next = [...rows]
  ;[next[at], next[target]] = [next[target], next[at]]
  return next
}

// ---------------------------------------------------------------------------------------------------------------
// Building blocks

/** One group of related fields with its own heading, so a long form reads as a few short parts. */
export function FormBlock({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-0.5">
        <h3 className="type-label">{title}</h3>
        {hint && <p className="type-meta">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: { value: T; label: ReactNode; color?: string; icon?: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            style={on && option.color ? ({ "--seg": option.color } as CSSProperties) : undefined}
            className={`type-label inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 whitespace-nowrap transition-colors ${
              on
                ? option.color
                  ? "bg-[color-mix(in_srgb,var(--seg)_22%,transparent)] text-foreground ring-1 ring-[var(--seg)]"
                  : "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.icon ??
              (option.color && <span className="size-2 rounded-full" style={{ background: option.color }} />)}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Three values, one per star level, as three boxes instead of a "a/b/c" string. */
function StarInputs({
  label,
  values,
  numeric,
  onChange,
}: {
  label: string
  values: (string | number)[]
  numeric?: boolean
  onChange: (values: (string | number)[]) => void
}) {
  return (
    <div className="grid grid-cols-[minmax(84px,auto)_repeat(3,minmax(0,1fr))] items-center gap-2">
      <span className="type-label">{label}</span>
      {[0, 1, 2].map((at) => (
        <Input
          key={at}
          aria-label={`${label} ${at + 1} sao`}
          inputMode={numeric ? "numeric" : undefined}
          className={numeric ? "text-right tabular-nums" : undefined}
          value={values[at] ?? ""}
          onChange={(event) => {
            const next = [0, 1, 2].map((index) => (index === at ? event.target.value : (values[index] ?? "")))
            const cleaned = next.every((value) => value === "")
              ? []
              : next.map((value) => (numeric ? Number(String(value).replace(/[^\d.-]/g, "")) || 0 : String(value)))
            onChange(cleaned)
          }}
        />
      ))}
    </div>
  )
}

const STAR_HEAD = (
  <div className="grid grid-cols-[minmax(84px,auto)_repeat(3,minmax(0,1fr))] gap-2">
    <span />
    {["★", "★★", "★★★"].map((star) => (
      <span key={star} className="type-meta text-center text-amber-200">
        {star}
      </span>
    ))}
  </div>
)

/** The code shows quietly under the name; changing it renames every place that points at it. */
function CodeLine({
  code,
  onRename,
  editing,
  onEditing,
}: {
  code: string
  onRename: (code: string) => void
  editing: boolean
  onEditing: (editing: boolean) => void
}) {
  const [draft, setDraft] = useState(code)
  if (!editing)
    return (
      <span className="type-meta flex items-center gap-1">
        Mã: <code className="rounded bg-muted px-1.5 py-0.5">{code || "(tự tạo từ tên)"}</code>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Đổi mã"
          title="Đổi mã"
          onClick={() => {
            setDraft(code)
            onEditing(true)
          }}
        >
          <PencilLine />
        </Button>
      </span>
    )
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft) return
        onRename(draft)
        onEditing(false)
      }}
    >
      <Input
        autoFocus
        aria-label="Mã mới"
        className="h-8 max-w-56"
        value={draft}
        onChange={(event) => setDraft(slugify(event.target.value))}
        onKeyDown={(event) => event.key === "Escape" && onEditing(false)}
      />
      <Button type="submit" size="icon-sm" variant="ghost" aria-label="Lưu mã" disabled={!draft}>
        <Check />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Hủy đổi mã" onClick={() => onEditing(false)}>
        <X />
      </Button>
    </form>
  )
}

/** A picture you click to replace; large where the picture is the point of the entry. */
export function IconUpload({
  src,
  onFile,
  size = "md",
  round,
  label = "Đổi ảnh",
  color,
}: {
  src?: string
  onFile: (file: File) => Promise<void>
  size?: "sm" | "md" | "lg"
  round?: boolean
  label?: string
  color?: string
}) {
  const [busy, setBusy] = useState(false)
  const box = { sm: "size-10", md: "size-14", lg: "size-20" }[size]
  return (
    <label
      className={`group relative inline-flex ${box} shrink-0 cursor-pointer items-center justify-center overflow-hidden border-2 bg-muted ${round ? "rounded-full" : "rounded-lg"}`}
      style={{ borderColor: color ?? "var(--border)" }}
      title={label}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Upload className="size-5 text-muted-foreground" />
      )}
      <span className="type-meta absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-white opacity-0 transition-opacity group-hover:opacity-100">
        Đổi
      </span>
      {busy && <span className="absolute inset-0 bg-background/70" />}
      <input
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          setBusy(true)
          try {
            await onFile(file)
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}

function RichField({
  label,
  value,
  onChange,
  short,
  bare,
}: {
  label: string
  value?: string | null
  onChange: (value: string | null) => void
  short?: boolean
  /** Hides the label where the block above already names the field. */
  bare?: boolean
}) {
  // Guide cards show no paragraph types or tables; a short row keeps its formatting in the bar over a selection.
  return (
    <AdminDescriptionField
      label={label}
      locale="vi-VN"
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
      size={short ? "short" : "regular"}
      toolbar={!short}
      paragraphStyles={false}
      exampleTables={false}
      hideLabel={bare}
    />
  )
}

interface ListRow {
  key: string
  index: number
  title: string
  meta?: ReactNode
  icon?: ReactNode
  warn?: boolean
}

/**
 * The list of one kind of entry, grouped, with a search; the selected entry is edited beside it. This keeps every
 * long list to one screen instead of a page of forms.
 */
function MasterDetail({
  title,
  groups,
  selected,
  onSelect,
  onAdd,
  addLabel,
  children,
  footer,
}: {
  title: string
  groups: { key: string; label: ReactNode; rows: ListRow[] }[]
  selected: number
  onSelect: (index: number) => void
  onAdd: () => void
  addLabel: string
  children: ReactNode
  footer?: ReactNode
}) {
  const [search, setSearch] = useState("")
  const needle = normalize(search.trim())
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section className="grid gap-2 rounded-lg border bg-card p-3 lg:sticky lg:top-14">
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-section-title">
            {title} <span className="type-meta">{total}</span>
          </h2>
          <Button type="button" size="sm" variant="outline" onClick={onAdd} title={addLabel}>
            <Plus /> Thêm
          </Button>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Tìm…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="grid max-h-[64vh] gap-3 overflow-y-auto pr-1">
          {groups.map((group) => {
            const rows = group.rows.filter((row) => !needle || normalize(row.title).includes(needle))
            if (!rows.length) return null
            return (
              <section key={group.key} className="grid gap-0.5">
                <h3 className="type-label flex items-center gap-1.5 px-1 py-1">
                  {group.label} <span className="type-meta">{rows.length}</span>
                </h3>
                <ul className="grid gap-0.5">
                  {rows.map((row) => (
                    <li key={row.key}>
                      <button
                        type="button"
                        aria-current={row.index === selected || undefined}
                        onClick={() => onSelect(row.index)}
                        className={`type-body flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/60 ${
                          row.index === selected ? "bg-muted ring-1 ring-primary/50" : ""
                        }`}
                      >
                        {row.icon}
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate">{row.title || "(chưa đặt tên)"}</span>
                          {row.meta && <span className="type-meta truncate">{row.meta}</span>}
                        </span>
                        {row.warn && (
                          <span className="size-2 shrink-0 rounded-full bg-amber-400" title="Còn thiếu dữ liệu" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
        {footer}
      </section>
      <div className="grid min-w-0 gap-3">{children}</div>
    </div>
  )
}

/** The selected entry's picture, name and code, with every other change to it in the "⋯" menu. */
function DetailHeader({
  icon,
  title,
  code,
  onRename,
  onDuplicate,
  onDelete,
  deleteLabel,
}: {
  icon: ReactNode
  title: ReactNode
  code: string
  onRename: (code: string) => void
  onDuplicate: () => void
  onDelete: () => void
  deleteLabel: string
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const editing = renaming === code
  return (
    <header className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      {icon}
      <div className="grid min-w-0 flex-1 gap-1">
        <h2 className="type-section-title truncate">{title}</h2>
        <CodeLine
          code={code}
          onRename={onRename}
          editing={editing}
          onEditing={(open) => setRenaming(open ? code : null)}
        />
      </div>
      <RowMenu
        size="icon"
        label="Tùy chọn khác"
        actions={[
          { label: "Đổi mã", icon: <PencilLine />, onSelect: () => setRenaming(code) },
          { label: "Nhân bản", icon: <Copy />, onSelect: onDuplicate },
          {
            label: "Xóa",
            icon: <Trash2 />,
            destructive: true,
            apart: true,
            onSelect: async () => {
              if (
                await confirmAction({
                  title: deleteLabel,
                  description: "Mục này sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                  confirmLabel: "Xóa",
                })
              )
                onDelete()
            },
          },
        ]}
      />
    </header>
  )
}

const Thumb = ({ src, color, round }: { src?: string; color?: string; round?: boolean }) =>
  src ? (
    <img
      src={src}
      alt=""
      className={`size-8 shrink-0 border-2 object-cover ${round ? "rounded-full" : "rounded-md"}`}
      style={{ borderColor: color ?? "transparent" }}
    />
  ) : (
    <span
      className={`size-8 shrink-0 border-2 bg-muted ${round ? "rounded-full" : "rounded-md"}`}
      style={{ borderColor: color ?? "transparent" }}
    />
  )

// ---------------------------------------------------------------------------------------------------------------
// Renaming keeps every reference

function renameUnit(content: GuideContent, from: string, to: string): GuideContent {
  if (!from || from === to) return content
  return {
    ...content,
    units: content.units.map((unit) => (unit.code === from ? { ...unit, code: to } : unit)),
    lineups: content.lineups.map((lineup) => ({
      ...lineup,
      units: lineup.units.map((unit) => (unit.unitCode === from ? { ...unit, unitCode: to } : unit)),
    })),
  }
}

function renameTrait(content: GuideContent, from: string, to: string): GuideContent {
  if (!from || from === to) return content
  return {
    ...content,
    traits: content.traits.map((trait) => (trait.code === from ? { ...trait, code: to } : trait)),
    units: content.units.map((unit) => ({
      ...unit,
      traitCodes: unit.traitCodes.map((code) => (code === from ? to : code)),
    })),
    lineups: content.lineups.map((lineup) => ({
      ...lineup,
      emblems: lineup.emblems.map((code) => (code === from ? to : code)),
    })),
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Units

const STATS = [
  ["health", "Máu"],
  ["physicalAttack", "Công vật lý"],
  ["armor", "Giáp"],
  ["magicResistance", "Giáp phép"],
] as const

export function UnitsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const unit = content.units[selected]
  const update = (next: Unit) => setContent({ ...content, units: swapAt(content.units, selected, next) })
  const costs = [...new Set(content.units.map((item) => item.cost))].sort((a, b) => a - b)
  const traitOf = new Map(content.traits.map((trait) => [trait.code, trait]))

  return (
    <MasterDetail
      title="Quân cờ"
      addLabel="Thêm quân cờ"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          units: [
            ...content.units,
            {
              code: "",
              name: "",
              cost: 1,
              traitCodes: [],
              complete: false,
              skill: null,
              stats: null,
              portraitAssetId: null,
            },
          ],
        })
        setSelected(content.units.length)
      }}
      groups={costs.map((cost) => ({
        key: String(cost),
        label: (
          <span className="flex items-center gap-1.5" style={{ color: COST_COLOR[cost] }}>
            <span className="size-2 rounded-full bg-current" /> {cost} vàng
          </span>
        ),
        rows: content.units
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.cost === cost)
          .map(({ item, index }) => ({
            key: `${item.code}-${index}`,
            index,
            title: item.name,
            icon: <Thumb src={image(item.portraitAssetId)} color={COST_COLOR[item.cost]} />,
            meta: (
              <span className="flex items-center gap-1">
                {(["FACTION", "CLASS"] as const).map((kind, at) => {
                  const traits = item.traitCodes.filter((code) => traitOf.get(code)?.kind === kind)
                  return traits.length ? (
                    <span key={kind} className="flex items-center gap-1">
                      {at === 1 && item.traitCodes.some((code) => traitOf.get(code)?.kind === "FACTION") && (
                        <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
                      )}
                      {traits.map((code) => (
                        <span key={code} title={`${kind === "FACTION" ? "Phe" : "Nghề"}: ${traitOf.get(code)?.name}`}>
                          <Thumb src={image(traitOf.get(code)?.iconAssetId)} round />
                        </span>
                      ))}
                    </span>
                  ) : null
                })}
              </span>
            ),
            warn: !item.complete,
          })),
      }))}
    >
      {unit ? (
        <>
          <DetailHeader
            icon={
              <IconUpload
                size="lg"
                src={image(unit.portraitAssetId)}
                color={COST_COLOR[unit.cost]}
                label="Ảnh quân cờ"
                onFile={async (file) => update({ ...unit, portraitAssetId: await upload(file, "unit portrait") })}
              />
            }
            title={unit.name || "Quân cờ mới"}
            code={unit.code}
            onRename={(code) => setContent(renameUnit(content, unit.code, code))}
            onDuplicate={() => {
              setContent({ ...content, units: duplicateAt(content.units, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa quân cờ ${unit.name}?`}
            onDelete={() => {
              setContent({ ...content, units: content.units.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-1">
                <span className="type-label">Tên</span>
                <Input value={unit.name} onChange={(event) => update(named(unit, event.target.value, fixed))} />
              </label>
              <div className="grid gap-1">
                <span className="type-label">Tướng trên Wiki (để liên kết)</span>
                <HeroCodePicker
                  value={unit.heroCode ?? null}
                  unitName={unit.name}
                  onChange={(heroCode) => update({ ...unit, heroCode })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <span className="type-label">Giá</span>
                <Segmented
                  label="Giá"
                  value={unit.cost}
                  onChange={(cost) => update({ ...unit, cost })}
                  options={[1, 2, 3, 4, 5, 6].map((cost) => ({ value: cost, label: cost, color: COST_COLOR[cost] }))}
                />
              </div>
              <label className="type-body flex items-center gap-2">
                <Switch checked={unit.complete} onCheckedChange={(complete) => update({ ...unit, complete })} />
                Đã đủ dữ liệu
              </label>
            </div>
          </FormBlock>
          <FormBlock title="Phe/Nghề" hint="Tối đa 3, như trong game.">
            <TraitPicker
              traits={content.traits}
              chosen={unit.traitCodes}
              orderKey={unit.code}
              image={image}
              onChange={(traitCodes) => update({ ...unit, traitCodes })}
            />
          </FormBlock>
          <FormBlock title="Chiêu">
            <div className="flex flex-wrap items-end gap-3">
              <IconUpload
                src={image(unit.skill?.iconAssetId)}
                label="Biểu tượng chiêu"
                onFile={async (file) =>
                  update({
                    ...unit,
                    skill: { values: [], ...unit.skill, iconAssetId: await upload(file, "skill icon") },
                  })
                }
              />
              <label className="grid min-w-48 flex-1 gap-1">
                <span className="type-label">Tên chiêu</span>
                <Input
                  value={unit.skill?.name ?? ""}
                  onChange={(event) =>
                    update({ ...unit, skill: { values: [], ...unit.skill, name: event.target.value || null } })
                  }
                />
              </label>
            </div>
            <RichField
              label="Mô tả chiêu"
              value={unit.skill?.description}
              onChange={(description) => update({ ...unit, skill: { values: [], ...unit.skill, description } })}
            />
            <div className="grid gap-2">
              {STAR_HEAD}
              <StarInputs
                label={unit.skill?.valueLabel || "Giá trị"}
                values={unit.skill?.values ?? []}
                onChange={(values) => update({ ...unit, skill: { ...unit.skill, values: values.map(String) } })}
              />
              <label className="grid grid-cols-[minmax(84px,auto)_minmax(0,1fr)] items-center gap-2">
                <span className="type-meta">Tên giá trị</span>
                <Input
                  placeholder="vd. ST phép"
                  value={unit.skill?.valueLabel ?? ""}
                  onChange={(event) =>
                    update({ ...unit, skill: { values: [], ...unit.skill, valueLabel: event.target.value || null } })
                  }
                />
              </label>
            </div>
          </FormBlock>
          <FormBlock title="Chỉ số theo sao">
            <div className="grid gap-2">
              {STAR_HEAD}
              {STATS.map(([key, label]) => (
                <StarInputs
                  key={key}
                  label={label}
                  numeric
                  values={unit.stats?.[key] ?? []}
                  onChange={(values) =>
                    update({
                      ...unit,
                      stats: {
                        health: [],
                        physicalAttack: [],
                        armor: [],
                        magicResistance: [],
                        ...unit.stats,
                        [key]: values.map(Number),
                      },
                    })
                  }
                />
              ))}
            </div>
          </FormBlock>
          <FormBlock title="Ghi chú biên tập" hint="Hiện cho người đọc dưới dạng lưu ý, ví dụ phần còn thiếu.">
            <Input
              value={unit.note ?? ""}
              onChange={(event) => update({ ...unit, note: event.target.value || null })}
            />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một quân cờ.</p>
      )}
    </MasterDetail>
  )
}

/**
 * Traits as toggles with their icons, factions apart from classes; at most three, the game's limit for one unit. Each
 * kind takes two rows; the chosen ones come first so they stay in view, and "+n" opens the rest in place.
 */
export function TraitPicker({
  traits,
  chosen,
  image,
  onChange,
  orderKey,
  max = 3,
}: {
  traits: GuideContent["traits"]
  chosen: string[]
  image: (id?: string | null) => string | undefined
  onChange: (traitCodes: string[]) => void
  /** The entry being edited; the order is set again only when it changes, so chips do not jump while picking. */
  orderKey?: string
  max?: number
}) {
  const [pinned, setPinned] = useState({ key: orderKey, codes: chosen })
  if (pinned.key !== orderKey) setPinned({ key: orderKey, codes: chosen })
  const full = chosen.length >= max
  return (
    <div className="grid gap-2">
      {(["FACTION", "CLASS"] as const).map((kind) => {
        const ofKind = traits.filter((trait) => trait.kind === kind)
        const ordered = [
          ...ofKind.filter((trait) => pinned.codes.includes(trait.code)),
          ...ofKind.filter((trait) => !pinned.codes.includes(trait.code)),
        ]
        const picked = ofKind.filter((trait) => chosen.includes(trait.code))
        return (
          <div key={kind} className="grid gap-1">
            <span className="type-meta">
              {kind === "FACTION" ? "Phe" : "Nghề"} ·{" "}
              {picked.length ? picked.map((trait) => trait.name).join(", ") : "chưa chọn"}
            </span>
            <ClampedChips>
              {ordered.map((trait) => {
                const on = chosen.includes(trait.code)
                return (
                  <button
                    key={trait.code}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() =>
                      onChange(on ? chosen.filter((code) => code !== trait.code) : [...chosen, trait.code])
                    }
                    className={`type-meta inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 whitespace-nowrap transition-colors disabled:opacity-40 ${
                      on ? "border-primary bg-primary/15 text-foreground" : "hover:border-foreground/40"
                    }`}
                  >
                    <Thumb src={image(trait.iconAssetId)} round />
                    {trait.name}
                  </button>
                )
              })}
            </ClampedChips>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Traits

export function TraitsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const trait = content.traits[selected]
  const update = (next: Trait) => setContent({ ...content, traits: swapAt(content.traits, selected, next) })
  const members = useMemo(() => {
    const map = new Map<string, Unit[]>()
    content.units.forEach((unit) => unit.traitCodes.forEach((code) => map.set(code, [...(map.get(code) ?? []), unit])))
    return map
  }, [content.units])

  return (
    <MasterDetail
      title="Phe/Nghề"
      addLabel="Thêm Phe/Nghề"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          traits: [
            ...content.traits,
            { code: "", kind: "FACTION", name: "", description: null, iconAssetId: null, tiers: [], note: null },
          ],
        })
        setSelected(content.traits.length)
      }}
      groups={(["FACTION", "CLASS"] as const).map((kind) => ({
        key: kind,
        label: kind === "FACTION" ? "Phe" : "Nghề",
        rows: content.traits
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.kind === kind)
          .map(({ item, index }) => ({
            key: `${item.code}-${index}`,
            index,
            title: item.name,
            icon: <Thumb src={image(item.iconAssetId)} round />,
            meta: `${members.get(item.code)?.length ?? 0} quân · mốc ${item.tiers.map((tier) => tier.count).join("/") || "–"}`,
            warn: !item.tiers.length,
          })),
      }))}
    >
      {trait ? (
        <>
          <DetailHeader
            icon={
              <IconUpload
                size="lg"
                round
                src={image(trait.iconAssetId)}
                label="Biểu tượng Phe/Nghề"
                onFile={async (file) => update({ ...trait, iconAssetId: await upload(file, "trait icon") })}
              />
            }
            title={trait.name || "Phe/Nghề mới"}
            code={trait.code}
            onRename={(code) => setContent(renameTrait(content, trait.code, code))}
            onDuplicate={() => {
              setContent({ ...content, traits: duplicateAt(content.traits, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa ${trait.name}?`}
            onDelete={() => {
              setContent({ ...content, traits: content.traits.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-48 flex-1 gap-1">
                <span className="type-label">Tên</span>
                <Input value={trait.name} onChange={(event) => update(named(trait, event.target.value, fixed))} />
              </label>
              <div className="grid gap-1">
                <span className="type-label">Loại</span>
                <Segmented
                  label="Loại"
                  value={trait.kind}
                  onChange={(kind) => update({ ...trait, kind })}
                  options={[
                    { value: "FACTION", label: "Phe" },
                    { value: "CLASS", label: "Nghề" },
                  ]}
                />
              </div>
            </div>
            <RichField
              label="Mô tả chung (tùy chọn)"
              short
              value={trait.description}
              onChange={(description) => update({ ...trait, description })}
            />
          </FormBlock>
          <FormBlock title="Mốc kích hoạt" hint="Số quân cờ khác nhau cần có và hiệu ứng khi đạt mốc.">
            <ol className="grid gap-2">
              {trait.tiers.map((tier, at) => (
                <li key={at} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-2">
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Số quân của mốc ${at + 1}`}
                    className="text-center tabular-nums"
                    value={tier.count}
                    onChange={(event) =>
                      update({
                        ...trait,
                        tiers: swapAt(trait.tiers, at, { ...tier, count: Number(event.target.value) }),
                      })
                    }
                  />
                  <RichField
                    label={`Hiệu ứng mốc ${tier.count}`}
                    short
                    bare
                    value={tier.effect}
                    onChange={(effect) =>
                      update({ ...trait, tiers: swapAt(trait.tiers, at, { ...tier, effect: effect ?? "" }) })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Bỏ mốc ${tier.count}`}
                    onClick={() => update({ ...trait, tiers: trait.tiers.filter((_, index) => index !== at) })}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                update({
                  ...trait,
                  tiers: [...trait.tiers, { count: (trait.tiers.at(-1)?.count ?? 0) + 2, effect: "" }],
                })
              }
            >
              <Plus /> Thêm mốc
            </Button>
          </FormBlock>
          <FormBlock title="Quân cờ thuộc nhóm" hint="Chọn Phe/Nghề ở từng quân cờ để thêm vào đây.">
            <div className="flex flex-wrap gap-2">
              {(members.get(trait.code) ?? []).map((unit) => (
                <span
                  key={unit.code}
                  className="type-meta inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5"
                >
                  <Thumb src={image(unit.portraitAssetId)} color={COST_COLOR[unit.cost]} />
                  {unit.name}
                </span>
              ))}
              {!members.get(trait.code)?.length && <span className="type-meta">Chưa có quân cờ nào.</span>}
            </div>
          </FormBlock>
          <FormBlock title="Ghi chú biên tập">
            <Input
              value={trait.note ?? ""}
              onChange={(event) => update({ ...trait, note: event.target.value || null })}
            />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một Phe/Nghề.</p>
      )}
    </MasterDetail>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Items

function stoneColor(group: { code: string; name: string }) {
  const key = normalize(`${group.code} ${group.name}`)
  // "xanh lam" contains "xanh la", so blue is checked first.
  if (key.includes("xanh lam") || key.includes("xanh duong")) return "#3fa2f0"
  if (key.includes("xanh la")) return "#a9c63b"
  if (key.includes("vang")) return "#f0b232"
  if (key.includes("do")) return "#e2474b"
  return "#9aa4b2"
}

export function ItemsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const item = content.items[selected]
  const update = (next: Item) => setContent({ ...content, items: swapAt(content.items, selected, next) })
  const groups = [...content.itemGroups, { code: "", name: "Chưa có nhóm", slotCount: null, iconAssetId: null }]
  const groupOf = (code?: string | null) => content.itemGroups.find((group) => group.code === code)
  const stone = (group: { code: string; name: string; iconAssetId?: string | null }, size = "size-5") => {
    const src = image(group.iconAssetId)
    return src ? (
      <img src={src} alt="" className={`${size} shrink-0 object-contain`} />
    ) : (
      <span className="size-2.5 shrink-0 rotate-45 rounded-[2px]" style={{ background: stoneColor(group) }} />
    )
  }

  return (
    <MasterDetail
      title="Trang bị"
      addLabel="Thêm trang bị"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          items: [
            ...content.items,
            {
              code: "",
              name: "",
              effect: null,
              groupCode: content.itemGroups[0]?.code ?? null,
              slot: null,
              iconAssetId: null,
            },
          ],
        })
        setSelected(content.items.length)
      }}
      groups={groups.map((group) => ({
        key: group.code || "none",
        label: (
          <span className="flex items-center gap-1.5">
            {stone(group)}
            {group.name}
          </span>
        ),
        rows: content.items
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => (entry.groupCode ?? "") === group.code)
          .sort((a, b) => (a.entry.slot ?? 99) - (b.entry.slot ?? 99))
          .map(({ entry, index }) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            icon: <Thumb src={image(entry.iconAssetId)} color={stoneColor(group)} />,
            meta: entry.effect?.replace(/<[^>]+>/g, "") ?? undefined,
            warn: !entry.effect,
          })),
      }))}
      footer={
        <div className="grid gap-2 border-t pt-2">
          <button
            type="button"
            className="type-label flex items-center justify-between"
            aria-expanded={groupsOpen}
            onClick={() => setGroupsOpen(!groupsOpen)}
          >
            Nhóm trang bị ({content.itemGroups.length})
            <ChevronDown className={`size-4 transition-transform ${groupsOpen ? "rotate-180" : ""}`} />
          </button>
          {groupsOpen && (
            <div className="grid gap-2">
              {content.itemGroups.map((group, at) => (
                <div key={at} className="grid grid-cols-[auto_minmax(0,1fr)_64px_auto] items-center gap-1.5">
                  <IconUpload
                    size="sm"
                    src={image(group.iconAssetId)}
                    color={stoneColor(group)}
                    label={`Ảnh đá của ${group.name || "nhóm"}`}
                    onFile={async (file) => {
                      const iconAssetId = await upload(file, "item group icon")
                      setContent({ ...content, itemGroups: swapAt(content.itemGroups, at, { ...group, iconAssetId }) })
                    }}
                  />
                  <Input
                    aria-label="Tên nhóm"
                    value={group.name}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        itemGroups: swapAt(content.itemGroups, at, named(group, event.target.value, fixed)),
                      })
                    }
                  />
                  <Input
                    aria-label="Số ô"
                    title="Số ô trong game"
                    type="number"
                    value={group.slotCount ?? ""}
                    onChange={(event) =>
                      setContent({
                        ...content,
                        itemGroups: swapAt(content.itemGroups, at, {
                          ...group,
                          slotCount: event.target.value === "" ? null : Number(event.target.value),
                        }),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Bỏ nhóm ${group.name}`}
                    onClick={() =>
                      setContent({ ...content, itemGroups: content.itemGroups.filter((_, index) => index !== at) })
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setContent({
                    ...content,
                    itemGroups: [...content.itemGroups, { code: "", name: "", slotCount: null, iconAssetId: null }],
                  })
                }
              >
                <Plus /> Thêm nhóm
              </Button>
            </div>
          )}
        </div>
      }
    >
      {item ? (
        <>
          <DetailHeader
            icon={
              <IconUpload
                size="lg"
                src={image(item.iconAssetId)}
                color={stoneColor(groupOf(item.groupCode) ?? { code: "", name: "" })}
                label="Biểu tượng trang bị"
                onFile={async (file) => update({ ...item, iconAssetId: await upload(file, "item icon") })}
              />
            }
            title={item.name || "Trang bị mới"}
            code={item.code}
            onRename={(code) => update({ ...item, code })}
            onDuplicate={() => {
              setContent({ ...content, items: duplicateAt(content.items, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa trang bị ${item.name}?`}
            onDelete={() => {
              setContent({ ...content, items: content.items.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input value={item.name} onChange={(event) => update(named(item, event.target.value, fixed))} />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <span className="type-label">Nhóm</span>
                <Segmented
                  label="Nhóm trang bị"
                  value={item.groupCode ?? ""}
                  onChange={(groupCode) => update({ ...item, groupCode: groupCode || null })}
                  options={content.itemGroups.map((group) => ({
                    value: group.code,
                    label: group.name,
                    color: stoneColor(group),
                    icon: image(group.iconAssetId) ? stone(group, "size-4") : undefined,
                  }))}
                />
              </div>
              <label className="grid w-24 gap-1">
                <span className="type-label">Ô số</span>
                <Input
                  type="number"
                  min={1}
                  value={item.slot ?? ""}
                  onChange={(event) =>
                    update({ ...item, slot: event.target.value === "" ? null : Number(event.target.value) })
                  }
                />
              </label>
            </div>
          </FormBlock>
          <FormBlock title="Hiệu ứng">
            <RichField label="Hiệu ứng" bare value={item.effect} onChange={(effect) => update({ ...item, effect })} />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một trang bị.</p>
      )}
    </MasterDetail>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Blessings

/** White drawings on black, screen blended onto the tier's card color like in the game and on the Wiki. */
function BlessingThumb({ src, tier, size = "sm" }: { src?: string; tier: Blessing["tier"]; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden ${size === "lg" ? "size-20 rounded-lg" : "size-8 rounded-md"}`}
      style={{ background: TIER_BACKGROUND[tier], isolation: "isolate" }}
    >
      {src && <img src={src} alt="" className="size-[88%] object-contain mix-blend-screen" />}
    </span>
  )
}

/** The blessing as the reader sees it: the game's card for its tier. */
function BlessingPreview({ blessing, src }: { blessing: Blessing; src?: string }) {
  return (
    <div
      className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-md border border-black/30 px-4 py-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)]"
      style={{ background: TIER_BACKGROUND[blessing.tier], isolation: "isolate" }}
    >
      <span className="grid size-14 place-items-center">
        {src && <img src={src} alt="" className="size-full object-contain mix-blend-screen" />}
      </span>
      <span className="grid gap-0.5">
        <span className="type-section-title" style={{ color: TIER_COLOR[blessing.tier] }}>
          {blessing.name || "Tên chúc phúc"}
        </span>
        <span className="type-body text-white/80">
          {blessing.description?.replace(/<[^>]+>/g, "") || "Mô tả hiện ở đây."}
        </span>
      </span>
    </div>
  )
}

export function BlessingsSection({ content, saved, setContent, image, upload }: SectionProps) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const blessing = content.blessings[selected]
  const update = (next: Blessing) => setContent({ ...content, blessings: swapAt(content.blessings, selected, next) })
  return (
    <MasterDetail
      title="Chúc phúc"
      addLabel="Thêm chúc phúc"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          blessings: [
            ...content.blessings,
            { code: "", tier: "NORMAL", name: "", description: null, iconAssetId: null },
          ],
        })
        setSelected(content.blessings.length)
      }}
      groups={(["NORMAL", "EPIC", "LEGENDARY"] as const).map((tier) => ({
        key: tier,
        label: (
          <span className="flex items-center gap-1.5" style={{ color: TIER_COLOR[tier] }}>
            <span className="size-2 rounded-full bg-current" /> {TIER_LABEL[tier]}
          </span>
        ),
        rows: content.blessings
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => entry.tier === tier)
          .map(({ entry, index }) => ({
            key: `${entry.code}-${index}`,
            index,
            title: entry.name,
            icon: <BlessingThumb src={image(entry.iconAssetId)} tier={entry.tier} />,
            meta: entry.description?.replace(/<[^>]+>/g, "") ?? undefined,
            warn: !entry.description,
          })),
      }))}
    >
      {blessing ? (
        <>
          <DetailHeader
            icon={
              <label className="relative cursor-pointer" title="Đổi biểu tượng">
                <BlessingThumb src={image(blessing.iconAssetId)} tier={blessing.tier} size="lg" />
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) update({ ...blessing, iconAssetId: await upload(file, "blessing icon") })
                  }}
                />
              </label>
            }
            title={blessing.name || "Chúc phúc mới"}
            code={blessing.code}
            onRename={(code) => update({ ...blessing, code })}
            onDuplicate={() => {
              setContent({ ...content, blessings: duplicateAt(content.blessings, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa chúc phúc ${blessing.name}?`}
            onDelete={() => {
              setContent({ ...content, blessings: content.blessings.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Xem trước" hint="Thẻ chúc phúc như người đọc thấy trên Wiki, theo màu bậc trong game.">
            <BlessingPreview blessing={blessing} src={image(blessing.iconAssetId)} />
          </FormBlock>
          <FormBlock title="Thông tin">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input value={blessing.name} onChange={(event) => update(named(blessing, event.target.value, fixed))} />
            </label>
            <div className="grid gap-1">
              <span className="type-label">Bậc</span>
              <Segmented
                label="Bậc"
                value={blessing.tier}
                onChange={(tier) => update({ ...blessing, tier })}
                options={(["NORMAL", "EPIC", "LEGENDARY"] as const).map((tier) => ({
                  value: tier,
                  label: TIER_LABEL[tier],
                  color: TIER_COLOR[tier],
                }))}
              />
            </div>
          </FormBlock>
          <FormBlock title="Mô tả">
            <RichField
              label="Mô tả"
              bare
              value={blessing.description}
              onChange={(description) => update({ ...blessing, description })}
            />
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một chúc phúc.</p>
      )}
    </MasterDetail>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Quests: short rows, edited in place

export function QuestsSection({ content, setContent }: Pick<SectionProps, "content" | "setContent">) {
  const quests = content.quests
  const set = (next: GuideContent["quests"]) => setContent({ ...content, quests: next })
  const update = (at: number, next: GuideContent["quests"][number]) => set(swapAt(quests, at, next))
  const blank = () => {
    const taken = new Set(quests.map((quest) => quest.code))
    let number = quests.length + 1
    while (taken.has(`nhiem-vu-${number}`)) number++
    return { code: `nhiem-vu-${number}`, task: "", reward: null }
  }
  // Rewards written most often come first.
  const rewards = useMemo(() => {
    const counts = new Map<string, number>()
    for (const quest of quests) if (quest.reward) counts.set(quest.reward, (counts.get(quest.reward) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1]).map(([reward]) => reward)
  }, [quests])
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-section-title">
          Nhiệm vụ <span className="type-meta">{quests.length}</span>
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={() => set([...quests, blank()])}>
          <Plus /> Thêm nhiệm vụ
        </Button>
      </div>
      <p className="type-meta">Ô phần thưởng gợi ý các phần thưởng đã ghi; bấm ⋯ để chuyển chỗ, nhân bản hoặc xóa.</p>
      <div className="grid grid-cols-[32px_minmax(0,3fr)_minmax(0,1.4fr)_auto] items-center gap-x-2 gap-y-1.5">
        <span />
        <span className="type-label">Nhiệm vụ</span>
        <span className="type-label">Phần thưởng</span>
        <span />
        {quests.map((quest, at) => (
          <div key={at} className="contents">
            <span className="type-meta grid size-7 place-items-center rounded-full bg-muted">{at + 1}</span>
            <Input
              aria-label={`Nhiệm vụ ${at + 1}`}
              value={quest.task}
              onChange={(event) => update(at, { ...quest, task: event.target.value })}
            />
            <SuggestInput
              label={`Phần thưởng nhiệm vụ ${at + 1}`}
              heading="Phần thưởng đã ghi"
              placeholder="vd. 2 vàng"
              value={quest.reward ?? ""}
              suggestions={rewards}
              onChange={(reward) => update(at, { ...quest, reward: reward || null })}
            />
            <RowMenu
              label={`Tùy chọn cho nhiệm vụ ${at + 1}`}
              actions={[
                {
                  label: "Lên trên",
                  icon: <ArrowUp />,
                  disabled: at === 0,
                  onSelect: () => set(moveAt(quests, at, -1)),
                },
                {
                  label: "Xuống dưới",
                  icon: <ArrowDown />,
                  disabled: at === quests.length - 1,
                  onSelect: () => set(moveAt(quests, at, 1)),
                },
                {
                  label: "Thêm nhiệm vụ bên dưới",
                  icon: <ListPlus />,
                  onSelect: () => set([...quests.slice(0, at + 1), blank(), ...quests.slice(at + 1)]),
                },
                {
                  label: "Nhân bản",
                  icon: <Copy />,
                  onSelect: () =>
                    set([...quests.slice(0, at + 1), { ...quest, code: blank().code }, ...quests.slice(at + 1)]),
                },
                {
                  label: "Xóa",
                  icon: <Trash2 />,
                  destructive: true,
                  apart: true,
                  onSelect: async () => {
                    if (
                      await confirmAction({
                        title: `Xóa nhiệm vụ ${at + 1}?`,
                        description: "Nhiệm vụ sẽ bị xóa khỏi bản nháp. Bạn vẫn có thể bỏ nháp để lấy lại.",
                        confirmLabel: "Xóa",
                      })
                    )
                      set(quests.filter((_, index) => index !== at))
                  },
                },
              ]}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Lineups

const DIFFICULTY_LABEL = { EASY: "Dễ", MEDIUM: "Vừa", HARD: "Khó" } as const
const tierRank = (tier?: string | null) => (tier ? "SABC".indexOf(tier) : 9)

// ---------------------------------------------------------------------------------------------------------------
// Lineup extras: picking items and blessings, in order

interface PickOption {
  code: string
  name: string
  thumb: ReactNode
}

/** A grid of choices in a popover, grouped, each toggled in place; full once `max` are chosen. */
function CodePicker({
  label,
  groups,
  chosen,
  max,
  onToggle,
  iconOnly,
}: {
  label: string
  groups: { key: string; title: ReactNode; options: PickOption[] }[]
  chosen: string[]
  max: number
  onToggle: (code: string) => void
  iconOnly?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {iconOnly ? (
          <Button type="button" size="icon-sm" variant="outline" aria-label={label} title={label}>
            <Plus />
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="justify-self-start">
            <Plus /> {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(440px,92vw)] p-2">
        <p className="type-meta px-1 pb-1">
          Đã chọn {chosen.length}/{max}
        </p>
        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {groups.map((group) =>
            group.options.length ? (
              <section key={group.key} className="grid gap-1">
                <h4 className="type-label flex items-center gap-1.5 px-1">{group.title}</h4>
                <div className="flex flex-wrap gap-1">
                  {group.options.map((option) => {
                    const on = chosen.includes(option.code)
                    return (
                      <button
                        key={option.code}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && chosen.length >= max}
                        title={option.name}
                        onClick={() => onToggle(option.code)}
                        className={`type-meta inline-flex items-center gap-1.5 rounded-md border py-1 pr-2 pl-1 text-foreground transition-colors disabled:opacity-35 ${
                          on ? "border-primary bg-primary/15" : "hover:border-foreground/40"
                        }`}
                      >
                        {option.thumb}
                        <span className="max-w-32 truncate">{option.name}</span>
                        {on && <Check className="size-3.5" />}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null,
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Chosen entries in priority order: a rank, the picture and name, arrows to reorder and a way out. */
function OrderedChips({
  codes,
  describe,
  onChange,
  empty,
}: {
  codes: string[]
  describe: (code: string) => { name: string; thumb: ReactNode }
  onChange: (codes: string[]) => void
  empty: string
}) {
  if (!codes.length) return <p className="type-meta">{empty}</p>
  return (
    <ol className="flex flex-wrap gap-1.5">
      {codes.map((code, at) => {
        const { name, thumb } = describe(code)
        return (
          <li
            key={code}
            className="type-meta inline-flex items-center gap-1 rounded-full border bg-muted/30 py-0.5 pr-1 pl-1"
          >
            <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
              {at + 1}
            </span>
            {thumb}
            <span className="max-w-32 truncate text-foreground">{name}</span>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label={`Đưa ${name} lên trước`}
              disabled={at === 0}
              onClick={() => onChange(moveAt(codes, at, -1))}
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label={`Đưa ${name} ra sau`}
              disabled={at === codes.length - 1}
              onClick={() => onChange(moveAt(codes, at, 1))}
            >
              <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-destructive"
              aria-label={`Bỏ ${name}`}
              onClick={() => onChange(codes.filter((entry) => entry !== code))}
            >
              <X className="size-3.5" />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

const STAGE_LABEL = { EARLY: "Đầu trận", MID: "Giữa trận" } as const

/**
 * The boards a lineup passes through before its late game: pick the units for each stage, starting from the
 * lineup's own units, with a short note on how to play it.
 */
function StageEditor({
  lineup,
  content,
  image,
  update,
}: {
  lineup: GuideLineup
  content: GuideContent
  image: SectionProps["image"]
  update: (next: GuideLineup) => void
}) {
  const [stage, setStage] = useState<"EARLY" | "MID">("EARLY")
  const stages = lineup.stages ?? []
  const current = stages.find((entry) => entry.stage === stage)
  const codes = current?.unitCodes ?? []
  const byCode = new Map(content.units.map((unit) => [unit.code, unit]))
  const write = (next: { unitCodes: string[]; note: string | null } | null) =>
    update({
      ...lineup,
      stages: [
        ...stages.filter((entry) => entry.stage !== stage),
        ...(next && (next.unitCodes.length || next.note) ? [{ stage, ...next }] : []),
      ].sort((a, b) => (a.stage === "EARLY" ? -1 : 1) - (b.stage === "EARLY" ? -1 : 1)),
    })
  const toggle = (code: string) =>
    write({
      unitCodes: codes.includes(code) ? codes.filter((entry) => entry !== code) : [...codes, code].slice(0, 11),
      note: current?.note ?? null,
    })
  const own = lineup.units.map((member) => member.unitCode)
  const others = content.units.filter((unit) => !own.includes(unit.code))
  const tile = (code: string) => {
    const unit = byCode.get(code)
    const on = codes.includes(code)
    return (
      <button
        key={code}
        type="button"
        aria-pressed={on}
        title={unit?.name ?? code}
        onClick={() => toggle(code)}
        className={`grid w-14 justify-items-center gap-0.5 rounded-md p-0.5 ${on ? "bg-primary/15 ring-2 ring-primary" : "opacity-75 hover:opacity-100"}`}
      >
        <Thumb src={image(unit?.portraitAssetId)} color={COST_COLOR[unit?.cost ?? 1]} />
        <span className="type-meta max-w-14 truncate">{unit?.name ?? code}</span>
      </button>
    )
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Giai đoạn"
          value={stage}
          onChange={setStage}
          options={(["EARLY", "MID"] as const).map((value) => ({
            value,
            label: `${STAGE_LABEL[value]} · ${stages.find((entry) => entry.stage === value)?.unitCodes.length ?? 0}`,
          }))}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!own.length}
          onClick={() => write({ unitCodes: own, note: current?.note ?? null })}
        >
          <Copy /> Chép từ đội hình chính
        </Button>
        {current && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => write(null)}>
            <Trash2 /> Bỏ {STAGE_LABEL[stage].toLowerCase()}
          </Button>
        )}
      </div>
      <div className="grid gap-1">
        <span className="type-label">Quân trong đội hình chính</span>
        <div className="flex flex-wrap gap-1">
          {own.length ? own.map(tile) : <span className="type-meta">Chưa có quân cờ nào.</span>}
        </div>
      </div>
      <details className="grid gap-1">
        <summary className="type-label cursor-pointer">Quân khác ({others.length})</summary>
        <div className="mt-1 flex max-h-56 flex-wrap gap-1 overflow-y-auto">
          {others.map((unit) => tile(unit.code))}
        </div>
      </details>
      <label className="grid gap-1">
        <span className="type-label">Ghi chú {STAGE_LABEL[stage].toLowerCase()}</span>
        <Input
          placeholder="vd. Giữ máu, lên cấp sớm"
          value={current?.note ?? ""}
          onChange={(event) => write({ unitCodes: codes, note: event.target.value || null })}
        />
      </label>
    </div>
  )
}

const BOARD_ROWS = [
  ["FRONT", "Hàng trước"],
  ["MIDDLE", "Hàng giữa"],
  ["BACK", "Hàng sau"],
] as const
const BOARD_COLUMNS = [1, 2, 3, 4, 5, 6, 7]
type BoardRow = (typeof BOARD_ROWS)[number][0]
type LineupMember = GuideLineup["units"][number]

const cellKey = (member: LineupMember) => (member.row && member.column ? `${member.row}-${member.column}` : null)

/**
 * The lineup on the game's board: three rows of seven cells, the front row on top toward the opponent. Pick a unit,
 * then a cell; a placed unit's cell takes the picked unit and sends its own unit to the picked one's old place.
 */
function BoardEditor({
  lineup,
  units,
  image,
  update,
}: {
  lineup: GuideLineup
  units: Map<string, GuideContent["units"][number]>
  image: (assetId?: string | null) => string | undefined
  update: (next: GuideLineup) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const placed = new Map<string, LineupMember>()
  for (const member of lineup.units) {
    const key = cellKey(member)
    if (key && !placed.has(key)) placed.set(key, member)
  }
  const bench = lineup.units.filter((member) => {
    const key = cellKey(member)
    return !key || placed.get(key) !== member
  })
  const pickedMember = lineup.units.find((member) => member.unitCode === picked)

  function place(code: string, cell: { row: BoardRow; column: number } | null) {
    const mover = lineup.units.find((member) => member.unitCode === code)
    if (!mover) return
    const occupant = cell ? placed.get(`${cell.row}-${cell.column}`) : undefined
    update({
      ...lineup,
      units: lineup.units.map((member) =>
        member === mover
          ? { ...member, row: cell?.row ?? null, column: cell?.column ?? null }
          : member === occupant && occupant !== mover
            ? { ...member, row: mover.row ?? null, column: mover.column ?? null }
            : member,
      ),
    })
    setPicked(null)
  }

  return (
    <div className="grid gap-3">
      <div className="grid w-full max-w-md gap-1">
        <span className="type-meta text-center">↑ Phía đối thủ</span>
        <div className="grid gap-1 rounded-lg border bg-muted/40 p-2">
          {BOARD_ROWS.map(([row, label]) => (
            <div key={row} className="grid grid-cols-7 gap-1" role="row" aria-label={label}>
              {BOARD_COLUMNS.map((column) => {
                const member = placed.get(`${row}-${column}`)
                const unit = member ? units.get(member.unitCode) : undefined
                const src = image(unit?.portraitAssetId)
                return (
                  <button
                    key={column}
                    type="button"
                    aria-label={`${label}, ô ${column}${unit ? `: ${unit.name}` : ""}`}
                    title={unit ? unit.name : `${label}, ô ${column}`}
                    disabled={!member && !picked && !bench.length}
                    onClick={() => {
                      if (member && picked !== member.unitCode && !picked) return setPicked(member.unitCode)
                      if (member && picked === member.unitCode) return setPicked(null)
                      const code = picked ?? bench[0]?.unitCode
                      if (code) place(code, { row, column })
                    }}
                    className={`relative aspect-square rounded-md border transition-colors ${
                      member
                        ? picked === member.unitCode
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                          : ""
                        : picked
                          ? "border-dashed border-primary bg-primary/10"
                          : "border-dashed bg-background/60 hover:border-foreground/40"
                    }`}
                  >
                    {unit &&
                      (src ? (
                        <img
                          src={src}
                          alt=""
                          className="size-full rounded-md border-2 object-cover"
                          style={{ borderColor: COST_COLOR[unit.cost] }}
                        />
                      ) : (
                        <span className="type-meta grid size-full place-items-center">{unit.name.slice(0, 3)}</span>
                      ))}
                    {member?.carry && (
                      <span className="type-label absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-primary px-1 text-primary-foreground">
                        M
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="type-label">Chưa xếp chỗ</span>
        {bench.map((member) => {
          const unit = units.get(member.unitCode)
          return (
            <button
              key={member.unitCode}
              type="button"
              title={unit?.name ?? member.unitCode}
              aria-pressed={picked === member.unitCode}
              onClick={() => setPicked(picked === member.unitCode ? null : member.unitCode)}
              className={`rounded-md p-0.5 ${picked === member.unitCode ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
            >
              <Thumb src={image(unit?.portraitAssetId)} color={unit ? COST_COLOR[unit.cost] : undefined} />
            </button>
          )
        })}
        {!bench.length && <span className="type-meta">Mọi quân đã có chỗ.</span>}
        {pickedMember && cellKey(pickedMember) && (
          <Button type="button" variant="outline" size="sm" onClick={() => place(pickedMember.unitCode, null)}>
            Bỏ {units.get(pickedMember.unitCode)?.name ?? pickedMember.unitCode} khỏi bàn
          </Button>
        )}
      </div>
    </div>
  )
}

export function LineupsSection({ content, saved, setContent, image }: Omit<SectionProps, "upload">) {
  const [selected, setSelected] = useState(0)
  const fixed = fixedCodes(saved, content)
  const [search, setSearch] = useState("")
  const lineup = content.lineups[selected]
  const update = (next: GuideLineup) => setContent({ ...content, lineups: swapAt(content.lineups, selected, next) })
  const units = new Map(content.units.map((unit) => [unit.code, unit]))
  const traits = new Map(content.traits.map((trait) => [trait.code, trait]))
  const costs = [...new Set(content.units.map((unit) => unit.cost))].sort((a, b) => a - b)
  const needle = normalize(search.trim())
  const itemByCode = new Map(content.items.map((item) => [item.code, item]))
  const blessingByCode = new Map(content.blessings.map((blessing) => [blessing.code, blessing]))
  const itemGroups = [...content.itemGroups, { code: "", name: "Khác", slotCount: null, iconAssetId: null }].map(
    (group) => ({
      key: group.code || "other",
      title: group.name,
      options: content.items
        .filter((item) => (item.groupCode ?? "") === group.code)
        .map((item) => ({
          code: item.code,
          name: item.name,
          thumb: <Thumb src={image(item.iconAssetId)} color={stoneColor(group)} />,
        })),
    }),
  )
  const blessingGroups = (["NORMAL", "EPIC", "LEGENDARY"] as const).map((tier) => ({
    key: tier,
    title: <span style={{ color: TIER_COLOR[tier] }}>{TIER_LABEL[tier]}</span>,
    options: content.blessings
      .filter((blessing) => blessing.tier === tier)
      .map((blessing) => ({
        code: blessing.code,
        name: blessing.name,
        thumb: <BlessingThumb src={image(blessing.iconAssetId)} tier={blessing.tier} />,
      })),
  }))
  const itemThumb = (code: string) => {
    const item = itemByCode.get(code)
    return { name: item?.name ?? code, thumb: <Thumb src={image(item?.iconAssetId)} /> }
  }

  return (
    <MasterDetail
      title="Đội hình đề xuất"
      addLabel="Thêm đội hình"
      selected={selected}
      onSelect={setSelected}
      onAdd={() => {
        setContent({
          ...content,
          lineups: [
            ...content.lineups,
            {
              code: "",
              name: "",
              tier: null,
              difficulty: null,
              summary: null,
              units: [],
              emblems: [],
              blessingCodes: [],
              notes: null,
              stages: [],
              priorityItemCodes: [],
            },
          ],
        })
        setSelected(content.lineups.length)
      }}
      groups={[
        {
          key: "all",
          label: "Hạng S → C, chưa xếp hạng cuối",
          rows: content.lineups
            .map((entry, index) => ({ entry, index }))
            .sort((a, b) => tierRank(a.entry.tier) - tierRank(b.entry.tier))
            .map(({ entry, index }) => ({
              key: `${entry.code}-${index}`,
              index,
              title: entry.name,
              icon: (
                <span
                  className="type-label grid size-8 shrink-0 place-items-center rounded-md"
                  style={{
                    background: LINEUP_TIER_COLOR[entry.tier ?? ""] ?? "var(--muted)",
                    color: entry.tier ? "#120d06" : undefined,
                  }}
                >
                  {entry.tier ?? "–"}
                </span>
              ),
              meta: (
                <span className="flex items-center gap-0.5">
                  {entry.units.slice(0, 8).map((member) => {
                    const src = image(units.get(member.unitCode)?.portraitAssetId)
                    return src ? <img key={member.unitCode} src={src} alt="" className="size-4 rounded-sm" /> : null
                  })}
                </span>
              ),
              warn: !entry.units.length,
            })),
        },
      ]}
    >
      {lineup ? (
        <>
          <DetailHeader
            icon={
              <span
                className="type-page-title grid size-14 place-items-center rounded-lg"
                style={{
                  background: LINEUP_TIER_COLOR[lineup.tier ?? ""] ?? "var(--muted)",
                  color: lineup.tier ? "#120d06" : undefined,
                }}
              >
                {lineup.tier ?? "–"}
              </span>
            }
            title={lineup.name || "Đội hình mới"}
            code={lineup.code}
            onRename={(code) => update({ ...lineup, code })}
            onDuplicate={() => {
              setContent({ ...content, lineups: duplicateAt(content.lineups, selected) })
              setSelected(selected + 1)
            }}
            deleteLabel={`Xóa đội hình ${lineup.name}?`}
            onDelete={() => {
              setContent({ ...content, lineups: content.lineups.filter((_, index) => index !== selected) })
              setSelected(0)
            }}
          />
          <FormBlock title="Thông tin" hint="Hạng là đánh giá biên tập; để trống nếu chưa kiểm chứng trong trận.">
            <label className="grid gap-1">
              <span className="type-label">Tên</span>
              <Input value={lineup.name} onChange={(event) => update(named(lineup, event.target.value, fixed))} />
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div className="grid gap-1">
                <span className="type-label">Hạng</span>
                <Segmented
                  label="Hạng"
                  value={lineup.tier ?? "none"}
                  onChange={(tier) => update({ ...lineup, tier: tier === "none" ? null : tier })}
                  options={[
                    { value: "none" as const, label: "Chưa xếp" },
                    ...(["S", "A", "B", "C"] as const).map((tier) => ({
                      value: tier,
                      label: tier,
                      color: LINEUP_TIER_COLOR[tier],
                    })),
                  ]}
                />
              </div>
              <div className="grid gap-1">
                <span className="type-label">Độ khó</span>
                <Segmented
                  label="Độ khó"
                  value={lineup.difficulty ?? "none"}
                  onChange={(difficulty) =>
                    update({ ...lineup, difficulty: difficulty === "none" ? null : difficulty })
                  }
                  options={[
                    { value: "none" as const, label: "Chưa rõ" },
                    ...(["EASY", "MEDIUM", "HARD"] as const).map((difficulty) => ({
                      value: difficulty,
                      label: DIFFICULTY_LABEL[difficulty],
                    })),
                  ]}
                />
              </div>
            </div>
          </FormBlock>
          <FormBlock
            title={`Quân cờ · ${Math.min(lineup.units.length, 10)}/10${lineup.units.length > 10 ? " + ô thêm" : ""}`}
            hint="Bấm M để đánh dấu chủ lực, + để thêm trang bị cho quân (tối đa 3), bấm quân cờ bên dưới để thêm hoặc bỏ."
          >
            <div className="flex min-h-20 flex-wrap gap-2 rounded-lg border border-dashed p-2">
              {lineup.units.map((member) => {
                const unit = units.get(member.unitCode)
                return (
                  <span key={member.unitCode} className="relative grid w-20 justify-items-center gap-0.5">
                    <Thumb src={image(unit?.portraitAssetId)} color={COST_COLOR[unit?.cost ?? 1]} />
                    <span className="type-meta max-w-16 truncate">{unit?.name ?? member.unitCode}</span>
                    <span className="flex min-h-6 items-center gap-0.5" aria-label={`Trang bị của ${unit?.name}`}>
                      {member.itemCodes.map((code) => (
                        <button
                          key={code}
                          type="button"
                          title={`Bỏ ${itemByCode.get(code)?.name ?? code}`}
                          onClick={() =>
                            update({
                              ...lineup,
                              units: lineup.units.map((item) =>
                                item === member
                                  ? { ...item, itemCodes: item.itemCodes.filter((entry) => entry !== code) }
                                  : item,
                              ),
                            })
                          }
                        >
                          <img
                            src={image(itemByCode.get(code)?.iconAssetId)}
                            alt={itemByCode.get(code)?.name ?? code}
                            className="size-5 rounded-sm"
                          />
                        </button>
                      ))}
                      {member.itemCodes.length < 3 && (
                        <CodePicker
                          iconOnly
                          label={`Thêm trang bị cho ${unit?.name ?? member.unitCode}`}
                          groups={itemGroups}
                          chosen={member.itemCodes}
                          max={3}
                          onToggle={(code) =>
                            update({
                              ...lineup,
                              units: lineup.units.map((item) =>
                                item === member
                                  ? {
                                      ...item,
                                      itemCodes: item.itemCodes.includes(code)
                                        ? item.itemCodes.filter((entry) => entry !== code)
                                        : [...item.itemCodes, code],
                                    }
                                  : item,
                              ),
                            })
                          }
                        />
                      )}
                    </span>
                    <span className="flex gap-0.5">
                      <button
                        type="button"
                        aria-pressed={member.carry}
                        aria-label={`${unit?.name} là chủ lực`}
                        title="Chủ lực (M)"
                        className={`type-label grid size-6 place-items-center rounded ${member.carry ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:text-foreground"}`}
                        onClick={() =>
                          update({
                            ...lineup,
                            units: lineup.units.map((item) =>
                              item === member ? { ...item, carry: !item.carry } : item,
                            ),
                          })
                        }
                      >
                        M
                      </button>
                      <button
                        type="button"
                        aria-label={`Bỏ ${unit?.name}`}
                        className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive"
                        onClick={() => update({ ...lineup, units: lineup.units.filter((item) => item !== member) })}
                      >
                        <X className="size-4" />
                      </button>
                    </span>
                  </span>
                )
              })}
              {!lineup.units.length && <span className="type-meta self-center">Chưa có quân cờ nào.</span>}
            </div>
            <label className="relative max-w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Tìm quân cờ để thêm…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
              {costs.map((cost) => {
                const pool = content.units.filter(
                  (unit) => unit.cost === cost && (!needle || normalize(unit.name).includes(needle)),
                )
                if (!pool.length) return null
                return (
                  <div key={cost} className="flex flex-wrap items-center gap-1.5">
                    <span className="type-meta w-14 shrink-0" style={{ color: COST_COLOR[cost] }}>
                      {cost} vàng
                    </span>
                    {pool.map((unit) => {
                      const chosen = lineup.units.some((item) => item.unitCode === unit.code)
                      return (
                        <button
                          key={unit.code}
                          type="button"
                          aria-pressed={chosen}
                          title={unit.name}
                          disabled={!chosen && lineup.units.length >= 11}
                          onClick={() =>
                            update({
                              ...lineup,
                              units: chosen
                                ? lineup.units.filter((item) => item.unitCode !== unit.code)
                                : [
                                    ...lineup.units,
                                    { unitCode: unit.code, carry: false, row: null, column: null, itemCodes: [] },
                                  ],
                            })
                          }
                          className={`rounded-md p-0.5 transition-opacity disabled:opacity-30 ${chosen ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
                        >
                          <Thumb src={image(unit.portraitAssetId)} color={COST_COLOR[unit.cost]} />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </FormBlock>
          <FormBlock
            title="Bàn cờ"
            hint="Chọn một quân rồi bấm ô để đặt; bấm ô có quân khi đang chọn để đổi chỗ. Bấm ô trống lúc chưa chọn sẽ đặt quân chưa xếp đầu tiên."
          >
            <BoardEditor key={lineup.code} lineup={lineup} units={units} image={image} update={update} />
          </FormBlock>
          <FormBlock title="Huy hiệu Phe/Nghề" hint="Huy hiệu từ chúc phúc cộng thêm một vào Phe/Nghề, tối đa 3.">
            <TraitPicker
              traits={content.traits}
              chosen={lineup.emblems}
              orderKey={lineup.code}
              image={image}
              onChange={(emblems) => update({ ...lineup, emblems })}
            />
            {lineup.emblems.length > 0 && (
              <p className="type-meta">
                Đang chọn: {lineup.emblems.map((code) => traits.get(code)?.name ?? code).join(", ")}
              </p>
            )}
          </FormBlock>
          <FormBlock title="Trang bị ưu tiên" hint="Trang bị nên lên trước cho cả đội hình, theo thứ tự; tối đa 6.">
            <OrderedChips
              codes={lineup.priorityItemCodes ?? []}
              describe={itemThumb}
              empty="Chưa chọn trang bị ưu tiên."
              onChange={(priorityItemCodes) => update({ ...lineup, priorityItemCodes })}
            />
            <CodePicker
              label="Chọn trang bị"
              groups={itemGroups}
              chosen={lineup.priorityItemCodes ?? []}
              max={6}
              onToggle={(code) => {
                const codes = lineup.priorityItemCodes ?? []
                update({
                  ...lineup,
                  priorityItemCodes: codes.includes(code) ? codes.filter((entry) => entry !== code) : [...codes, code],
                })
              }}
            />
          </FormBlock>
          <FormBlock title="Chúc phúc ưu tiên" hint="Chúc phúc nên chọn khi đi đội hình này, theo thứ tự; tối đa 5.">
            <OrderedChips
              codes={lineup.blessingCodes}
              describe={(code) => {
                const blessing = blessingByCode.get(code)
                return {
                  name: blessing?.name ?? code,
                  thumb: blessing ? <BlessingThumb src={image(blessing.iconAssetId)} tier={blessing.tier} /> : null,
                }
              }}
              empty="Chưa chọn chúc phúc ưu tiên."
              onChange={(blessingCodes) => update({ ...lineup, blessingCodes })}
            />
            <CodePicker
              label="Chọn chúc phúc"
              groups={blessingGroups}
              chosen={lineup.blessingCodes}
              max={5}
              onToggle={(code) =>
                update({
                  ...lineup,
                  blessingCodes: lineup.blessingCodes.includes(code)
                    ? lineup.blessingCodes.filter((entry) => entry !== code)
                    : [...lineup.blessingCodes, code],
                })
              }
            />
          </FormBlock>
          <FormBlock
            title="Giai đoạn trận"
            hint="Đội hình đầu trận và giữa trận; các quân ở khối Quân cờ phía trên là cuối trận."
          >
            <StageEditor key={lineup.code} lineup={lineup} content={content} image={image} update={update} />
          </FormBlock>
          <FormBlock title="Mô tả và mẹo">
            <label className="grid gap-1">
              <span className="type-label">Điểm mạnh</span>
              <Input
                value={lineup.summary ?? ""}
                placeholder="VD: ST quần thể, ST chiêu bộc phá"
                onChange={(event) => update({ ...lineup, summary: event.target.value || null })}
              />
              <span className="type-meta">
                Một dòng ngắn dưới tên đội hình, như mô tả trong Đề cử đội hình của game.
              </span>
            </label>
            <label className="grid gap-1">
              <span className="type-label">Mẹo</span>
              <Textarea
                className="min-h-24"
                value={lineup.notes ?? ""}
                placeholder="Cách chơi, lên sao quân nào trước, khi nào chuyển hướng…"
                onChange={(event) => update({ ...lineup, notes: event.target.value || null })}
              />
            </label>
          </FormBlock>
        </>
      ) : (
        <p className="type-body text-muted-foreground">Chọn hoặc thêm một đội hình.</p>
      )}
    </MasterDetail>
  )
}
