import { useId } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { control } from "../publishing/fields"
import { warehouseText, type WarehouseContent, type WarehouseEntry, type WarehouseStat } from "./warehouse-types"

export function WarehouseStatsEditor({
  stats,
  catalog,
  locale,
  disabled,
  onChange,
  knownStats = [],
}: {
  stats: WarehouseStat[]
  catalog: WarehouseEntry<WarehouseContent & { stats?: WarehouseStat[] }>[]
  locale: string
  disabled: boolean
  onChange: (stats: WarehouseStat[]) => void
  /** Suggested on top of the keys the catalog already uses, for catalogs with no structured stats yet. */
  knownStats?: { key: string; label: string }[]
}) {
  const list = useId()
  const keys = new Map<string, string>(knownStats.map(({ key, label }) => [key, label]))
  const units = new Set<string>(knownStats.length ? ["POINT", "PERCENT"] : [])
  for (const { content } of catalog) {
    const labels = warehouseText(content.translations, locale)?.statLabels
    for (const stat of content.stats ?? []) {
      if (stat.key) keys.set(stat.key, labels?.[stat.key] || keys.get(stat.key) || stat.key)
      if (stat.unit) units.add(stat.unit)
    }
  }
  function update(index: number, patch: Partial<WarehouseStat>) {
    onChange(stats.map((stat, i) => (i === index ? { ...stat, ...patch } : stat)))
  }
  const grid = "grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_2rem] items-center gap-1.5"
  return (
    <fieldset disabled={disabled} aria-label="Chỉ số" className="min-w-0 space-y-2">
      <datalist id={list}>
        {[...keys].map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </datalist>
      <datalist id={list + "-units"}>
        {[...units].map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
      {stats.length > 0 && (
        <div className={grid + " type-label"} aria-hidden="true">
          <span>Chỉ số</span>
          <span>Giá trị</span>
          <span>Đơn vị</span>
        </div>
      )}
      {stats.map((stat, index) => (
        <div className={grid} key={index}>
          <input
            className={control}
            list={list}
            aria-label={`Mã chỉ số ${index + 1}`}
            placeholder="Chọn hoặc nhập mã"
            value={stat.key}
            onChange={(e) => update(index, { key: e.target.value })}
          />
          <input
            className={control}
            type="number"
            step="any"
            aria-label={`Giá trị ${index + 1}`}
            value={stat.value}
            onChange={(e) => update(index, { value: Number(e.target.value) })}
          />
          <input
            className={control}
            list={list + "-units"}
            aria-label={`Đơn vị ${index + 1}`}
            value={stat.unit ?? ""}
            onChange={(e) => update(index, { unit: e.target.value || null })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Bỏ chỉ số ${index + 1}`}
            onClick={() => onChange(stats.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {!!keys.size && stats.length > 0 && (
        <p className="type-meta">Gõ tên hoặc mã để tìm chỉ số đã dùng trong danh mục.</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...stats, { key: "", value: 0, unit: null }])}
      >
        <Plus />
        Thêm chỉ số
      </Button>
    </fieldset>
  )
}
