import { Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import {
  ITEM_STATS,
  itemEffectsFromDescription,
  parseItemDescription,
  type ItemEffectGameplay,
  type ItemScalingSource,
  type ItemStatGrantData,
} from "@aov/ui/lib/item-description"
import { NativeSelect } from "@/components/native-select"

const GROWTHS = { "": "Cố định", LEVEL: "Tăng theo cấp", STACK: "Mỗi lần cộng dồn" } as const
const TARGETS = { SELF: "Bản thân", TEAM: "Cả đồng đội lân cận" } as const
const SOURCES: Record<ItemScalingSource, string> = {
  MAX_HEALTH: "Máu tối đa",
  BONUS_HEALTH: "Máu thêm",
  PHYSICAL_ATTACK: "Công vật lý",
  BONUS_PHYSICAL_ATTACK: "Công vật lý thêm",
  MAGIC_ATTACK: "Công phép",
  HERO_LEVEL: "Mỗi cấp tướng",
}

/** A number field that keeps an empty box as null rather than 0. */
function NumberField({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: number | null | undefined
  onChange: (value: number | null) => void
  className?: string
}) {
  return (
    <label className={className}>
      <span className="type-label block">{label}</span>
      <Input
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  )
}

function UnitSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null | undefined
  onChange: (unit: string | null) => void
}) {
  return (
    <label>
      <span className="type-label block">{label}</span>
      <NativeSelect value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Điểm</option>
        <option value="%">%</option>
      </NativeSelect>
    </label>
  )
}

function GrantEditor({
  grant,
  onChange,
  onRemove,
}: {
  grant: ItemStatGrantData
  onChange: (patch: Partial<ItemStatGrantData>) => void
  onRemove: () => void
}) {
  const scalings = grant.scalings ?? []
  const changeScaling = (index: number, patch: Partial<NonNullable<ItemStatGrantData["scalings"]>[number]>) =>
    onChange({ scalings: scalings.map((scaling, i) => (i === index ? { ...scaling, ...patch } : scaling)) })
  return (
    <div className="space-y-2 rounded-md border bg-background p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2">
          <span className="type-label block">Chỉ số</span>
          <NativeSelect value={grant.stat} onChange={(event) => onChange({ stat: event.target.value })}>
            {ITEM_STATS.map((stat) => (
              <option key={stat.code} value={stat.code}>
                {stat.vi}
              </option>
            ))}
          </NativeSelect>
        </label>
        <NumberField label="Giá trị" value={grant.value} onChange={(value) => onChange({ value })} />
        <NumberField label="Đến" value={grant.maxValue} onChange={(maxValue) => onChange({ maxValue })} />
        <UnitSelect label="Đơn vị" value={grant.unit} onChange={(unit) => onChange({ unit })} />
        <label>
          <span className="type-label block">Cách tăng</span>
          <NativeSelect
            value={grant.growth ?? ""}
            onChange={(event) => onChange({ growth: (event.target.value || null) as ItemStatGrantData["growth"] })}
          >
            {Object.entries(GROWTHS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <NumberField label="Tối đa" value={grant.cap} onChange={(cap) => onChange({ cap })} />
        <NumberField
          label="Kéo dài (giây)"
          value={grant.durationSeconds}
          onChange={(durationSeconds) => onChange({ durationSeconds })}
        />
        <label className="col-span-2">
          <span className="type-label block">Áp dụng cho</span>
          <NativeSelect
            value={grant.target ?? "SELF"}
            onChange={(event) => onChange({ target: event.target.value as keyof typeof TARGETS })}
          >
            {Object.entries(TARGETS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      {scalings.map((scaling, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2rem] items-end gap-2">
          <label>
            <span className="type-label block">Theo chỉ số</span>
            <NativeSelect
              value={scaling.source}
              onChange={(event) => changeScaling(index, { source: event.target.value as ItemScalingSource })}
            >
              {Object.entries(SOURCES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <NumberField
            label="Tỷ lệ"
            value={scaling.value}
            onChange={(value) => changeScaling(index, { value: value ?? 0 })}
          />
          <UnitSelect label="Đơn vị" value={scaling.unit} onChange={(unit) => changeScaling(index, { unit })} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Bỏ tỷ lệ"
            onClick={() => onChange({ scalings: scalings.filter((_, i) => i !== index) })}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange({ scalings: [...scalings, { source: "MAGIC_ATTACK", value: 0, unit: "%" }] })}
        >
          <Plus />
          Thêm tỷ lệ theo chỉ số
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          <Trash2 />
          Bỏ chỉ số này
        </Button>
      </div>
    </div>
  )
}

/**
 * The gameplay of each effect the description writes, in its order (ADR-033): one card per effect with its text beside
 * it, so an editor sees which line a card belongs to and when the two lists drift apart.
 */
export function ItemEffectsEditor({
  effects,
  description,
  onChange,
}: {
  effects: ItemEffectGameplay[]
  /** The Vietnamese description, whose effects the cards follow. */
  description: string | null | undefined
  onChange: (effects: ItemEffectGameplay[]) => void
}) {
  const passives = parseItemDescription(description, "vi-VN", { effectStats: false }).passives
  const update = (index: number, patch: Partial<ItemEffectGameplay>) =>
    onChange(effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)))
  const changeGrant = (index: number, grantIndex: number, patch: Partial<ItemStatGrantData>) =>
    update(index, {
      grants: (effects[index].grants ?? []).map((grant, i) => (i === grantIndex ? { ...grant, ...patch } : grant)),
    })
  return (
    <section className="space-y-2" aria-label="Hiệu ứng">
      <h3 className="type-label">Hiệu ứng và chỉ số từ hiệu ứng</h3>
      {!effects.length && passives.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange(itemEffectsFromDescription(description))}
        >
          <Sparkles />
          Điền {passives.length} hiệu ứng từ mô tả
        </Button>
      )}
      {effects.length > 0 && effects.length !== passives.length && (
        <p className="type-meta text-(--aov-warning)">
          Mô tả viết {passives.length} hiệu ứng nhưng ở đây có {effects.length}. Hiệu ứng thứ n phải khớp dòng thứ n của
          mô tả.
        </p>
      )}
      {effects.map((effect, index) => (
        <div key={index} className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="type-body">
            <span className="font-semibold">{passives[index]?.name ?? `Hiệu ứng ${index + 1}`}</span>
            {passives[index] && <span className="text-muted-foreground"> · {passives[index].text}</span>}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <label className="col-span-2 sm:col-span-1">
              <span className="type-label block">Mã</span>
              <Input value={effect.key} onChange={(event) => update(index, { key: event.target.value })} />
            </label>
            <label>
              <span className="type-label block">Cách dùng</span>
              <NativeSelect
                value={effect.activation ?? "PASSIVE"}
                onChange={(event) => update(index, { activation: event.target.value as "PASSIVE" | "ACTIVE" })}
              >
                <option value="PASSIVE">Nội tại</option>
                <option value="ACTIVE">Kích hoạt</option>
              </NativeSelect>
            </label>
            <NumberField
              label="Hồi chiêu (giây)"
              value={effect.cooldownSeconds}
              onChange={(cooldownSeconds) => update(index, { cooldownSeconds })}
            />
            <NumberField
              label="Cộng dồn tối đa"
              value={effect.maxStacks}
              onChange={(maxStacks) => update(index, { maxStacks })}
            />
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={!!effect.unique}
                onChange={(event) => update(index, { unique: event.target.checked })}
              />
              Duy nhất
            </label>
          </div>
          {(effect.grants ?? []).map((grant, grantIndex) => (
            <GrantEditor
              key={grantIndex}
              grant={grant}
              onChange={(patch) => changeGrant(index, grantIndex, patch)}
              onRemove={() => update(index, { grants: (effect.grants ?? []).filter((_, i) => i !== grantIndex) })}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                update(index, { grants: [...(effect.grants ?? []), { stat: "magic-attack", value: 0, unit: null }] })
              }
            >
              <Plus />
              Thêm chỉ số từ hiệu ứng
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(effects.filter((_, i) => i !== index))}
            >
              <Trash2 />
              Bỏ hiệu ứng
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([
            ...effects,
            { key: `hieu-ung-${effects.length + 1}`, activation: "PASSIVE", unique: false, grants: [] },
          ])
        }
      >
        <Plus />
        Thêm hiệu ứng
      </Button>
    </section>
  )
}
