import { useState } from "react"
import { Input } from "@aov/ui/components/input"
import { Switch } from "@aov/ui/components/switch"
import { ClampedChips, HeroCodePicker } from "../entry-controls"
import type { GuideContent } from "../game-mode-api"
import { fixedCodes, named } from "../guide-codes"
import { type Unit, type SectionProps, COST_COLOR, swapAt, duplicateAt, renameUnit } from "./guide-model"
import { FormBlock, Segmented, IconUpload, RichField, Thumb } from "./guide-fields"
import { MasterDetail, DetailHeader } from "./master-detail"

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
      <span key={star} className="type-meta text-center text-(--aov-warning)">
        {star}
      </span>
    ))}
  </div>
)

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
