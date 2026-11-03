import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Field, control } from "./fields"
import { STAT_LABELS } from "./patch-change-model"
import type { Stats } from "./types"

const units: Record<string, string> = {
  POINT: "Điểm",
  PERCENT: "Phần trăm (%)",
  HP: "Máu",
  seconds: "Giây",
  UNKNOWN: "Chưa xác định",
  "": "Không có đơn vị",
}
const percentageStats = new Set([
  "BONUS_ATTACK_SPEED",
  "CRITICAL_CHANCE",
  "CRITICAL_DAMAGE",
  "PHYSICAL_LIFESTEAL",
  "MAGIC_LIFESTEAL",
  "COOLDOWN_REDUCTION",
])

export function HeroStatsEditor({ value, onChange }: { value: Stats; onChange: (value: Stats) => void }) {
  const update = (index: number, patch: Partial<Stats["values"][number]>) =>
    onChange({ ...value, values: value.values.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) })
  const nextKey = Object.keys(STAT_LABELS).find((key) => !value.values.some((entry) => entry.statKey === key)) ?? ""
  return (
    <div className="space-y-3">
      <p className="type-meta">Chọn chỉ số, nhập giá trị cơ bản và mức tăng mỗi cấp. Để trống giá trị chưa có nguồn.</p>
      {!value.values.length && (
        <p className="type-body rounded-lg border border-dashed p-4 text-muted-foreground">
          Chưa có chỉ số. Thêm chỉ số để bắt đầu.
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
                  update(index, { statKey, unit: percentageStats.has(statKey) ? "PERCENT" : "POINT" })
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
              size="icon"
              aria-label={`Bỏ chỉ số ${STAT_LABELS[stat.statKey] ?? "khác"}`}
              onClick={() => onChange({ ...value, values: value.values.filter((_, i) => i !== index) })}
            >
              <Trash2 className="size-4" />
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
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange({
            ...value,
            values: [
              ...value.values,
              {
                statKey: nextKey,
                baseValue: null,
                growthPerLevel: null,
                unit: percentageStats.has(nextKey) ? "PERCENT" : "POINT",
              },
            ],
          })
        }
      >
        <Plus className="size-4" />
        Thêm chỉ số
      </Button>
    </div>
  )
}
