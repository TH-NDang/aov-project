import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Field, control } from "./fields"
import { STAT_LABELS } from "./patch-change-model"
import { combatAttributeRows, formatStat, observedAttributes, statUnit, type StatDefault } from "./combat-attributes"
import type { Skills, Stats } from "./types"

const units: Record<string, string> = {
  POINT: "Điểm",
  PERCENT: "Phần trăm (%)",
  HP: "Máu",
  seconds: "Giây",
  UNKNOWN: "Chưa xác định",
  "": "Không có đơn vị",
}
export function HeroStatsEditor({
  value,
  onChange,
  skills,
  defaults = [],
  patchCode,
  referenceError,
}: {
  value: Stats
  onChange: (value: Stats) => void
  skills?: Skills | null
  defaults?: StatDefault[]
  patchCode?: string
  referenceError?: boolean
}) {
  const snapshot = observedAttributes(skills)
  const observation = !patchCode || snapshot?.patchCode === patchCode ? snapshot : undefined
  const rows = combatAttributeRows(value, observation, defaults)
  const inherited = defaults.filter((rule) => !value.values.some((v) => v.statKey === rule.statKey))
  const add = (statKey: string, unit = statUnit(statKey)) =>
    onChange({ ...value, values: [...value.values, { statKey, unit, baseValue: null, growthPerLevel: null }] })
  const update = (index: number, patch: Partial<Stats["values"][number]>) =>
    onChange({ ...value, values: value.values.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) })
  const nextKey = Object.keys(STAT_LABELS).find((key) => !value.values.some((entry) => entry.statKey === key)) ?? ""
  return (
    <div className="space-y-3">
      <p className="type-meta">
        Nhập giá trị cơ bản hoặc mức tăng mỗi cấp khi có nguồn cho riêng tướng. Các số đọc từ ảnh được giữ riêng để đối
        chiếu.
      </p>
      {referenceError && (
        <p role="status" className="type-meta">
          Chưa tải được mặc định của patch.
        </p>
      )}
      {!!inherited.length && (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <h4 className="type-label">Mặc định của patch</h4>
          {inherited.map((rule) => (
            <div key={rule.statKey} className="flex flex-wrap items-center gap-2">
              <span className="type-body">
                {STAT_LABELS[rule.statKey] ?? rule.statKey} <strong>{formatStat(rule.baseValue, rule.unit)}</strong>
              </span>
              <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="type-meta underline">
                Nguồn · {rule.patchCode}
              </a>
              <Button type="button" variant="outline" size="sm" onClick={() => add(rule.statKey, rule.unit)}>
                Đặt giá trị riêng
              </Button>
              {rows.find((r) => r.key === rule.statKey)?.observed && (
                <span className="type-meta">Ảnh ghi {rows.find((r) => r.key === rule.statKey)?.observed}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {observation && (
        <details className="rounded-lg border p-3">
          <summary className="type-body cursor-pointer">Đối chiếu thuộc tính trên ảnh</summary>
          <p className="type-meta mt-2 break-words">
            {observation.image} · {observation.level == null ? "Chưa xác định cấp tướng" : `Cấp ${observation.level}`}
          </p>
          <dl className="mt-2 divide-y">
            {rows
              .filter((r) => r.observed)
              .map((r) => (
                <div key={r.key} className="type-body flex justify-between gap-3 py-1">
                  <dt>{r.label}</dt>
                  <dd>{r.observed}</dd>
                </div>
              ))}
          </dl>
        </details>
      )}
      {!value.values.length && (
        <p className="type-body rounded-lg border border-dashed p-4 text-muted-foreground">
          Chưa nhập giá trị riêng cho tướng.
        </p>
      )}
      {value.values.map((stat, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-end gap-2">
            <label className="type-body grid min-w-0 flex-1 gap-1.5">
              Chỉ số
              <select
                className={control}
                value={Object.hasOwn(STAT_LABELS, stat.statKey) ? stat.statKey : "custom"}
                onChange={(event) => {
                  const statKey = event.target.value === "custom" ? "" : event.target.value
                  update(index, { statKey, unit: statUnit(statKey) })
                }}
              >
                {Object.entries(STAT_LABELS).map(([key, label]) => (
                  <option
                    key={key}
                    value={key}
                    disabled={value.values.some((entry, i) => i !== index && entry.statKey === key)}
                  >
                    {label}
                  </option>
                ))}
                <option value="custom">Chỉ số khác</option>
              </select>
            </label>
            <Button
              type="button"
              variant="ghost"
              size={defaults.some((rule) => rule.statKey === stat.statKey) ? "sm" : "icon"}
              aria-label={
                defaults.some((rule) => rule.statKey === stat.statKey)
                  ? "Dùng mặc định của patch"
                  : `Bỏ chỉ số ${STAT_LABELS[stat.statKey] ?? "khác"}`
              }
              onClick={() => onChange({ ...value, values: value.values.filter((_, i) => i !== index) })}
            >
              {defaults.some((rule) => rule.statKey === stat.statKey) ? "Dùng mặc định" : <Trash2 className="size-4" />}
            </Button>
          </div>
          {!Object.hasOwn(STAT_LABELS, stat.statKey) && (
            <Field
              label="Mã chỉ số riêng"
              required
              pattern="[A-Z][A-Z0-9_]{0,63}"
              value={stat.statKey}
              onChange={(statKey) => update(index, { statKey })}
            />
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field
              label="Giá trị cơ bản"
              type="number"
              step="any"
              value={stat.baseValue ?? ""}
              onChange={(v) => update(index, { baseValue: v === "" ? null : Number(v) })}
            />
            <Field
              label="Tăng mỗi cấp"
              type="number"
              step="any"
              value={stat.growthPerLevel ?? ""}
              onChange={(v) => update(index, { growthPerLevel: v === "" ? null : Number(v) })}
            />
            <label className="type-body col-span-2 grid gap-1.5 sm:col-span-1">
              Đơn vị
              <select
                className={control}
                value={stat.unit}
                onChange={(event) => update(index, { unit: event.target.value })}
              >
                {Object.entries(units).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                {!Object.hasOwn(units, stat.unit) && <option value={stat.unit}>Đơn vị hiện tại ({stat.unit})</option>}
              </select>
            </label>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => add(nextKey)}>
        <Plus className="size-4" />
        Thêm chỉ số
      </Button>
    </div>
  )
}
