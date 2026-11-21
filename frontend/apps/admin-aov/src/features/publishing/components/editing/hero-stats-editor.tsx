import { useEffect, useId, useRef, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Field } from "./fields"
import { STAT_LABELS } from "../../model/patch-changes/patch-change-model"
import {
  combatAttributeRows,
  formatStat,
  observedAttributes,
  statUnit,
  type StatDefault,
} from "../../model/assessment/combat-attributes"
import {
  formatStatNumber,
  formatStatReading,
  hasStatPercent,
  parseStatReading,
} from "../../model/assessment/stat-reading"
import type { Skills, Stats } from "@/lib/hero-types"
import { NativeSelect } from "@/components/native-select"
import { Input } from "@aov/ui/components/input"

const units: Record<string, string> = {
  POINT: "Điểm",
  PERCENT: "Phần trăm (%)",
  HP: "Máu",
  seconds: "Giây",
  UNKNOWN: "Chưa xác định",
  "": "Không có đơn vị",
}

/** One box for what the game shows as "150 | 20%", so the editor types what they see instead of splitting it up. */
function StatReadingField({
  value,
  percent,
  onChange,
}: {
  value: number | null
  percent: number | null | undefined
  onChange: (value: number | null, percent: number | null) => void
}) {
  const [typed, setTyped] = useState<string | null>(null)
  const text = typed ?? formatStatReading(value, percent)
  const reading = parseStatReading(text)
  const problem = reading.ok ? "" : reading.message
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const helpId = useId()
  // Keeps the section form from saving the last good reading while the box says something else.
  useEffect(() => input.current?.setCustomValidity(problem), [problem])
  // Undoing or discarding changes the reading from outside; while typing the words stay as typed.
  useEffect(() => {
    if (document.activeElement !== input.current) setTyped(null)
  }, [value, percent])
  return (
    <div className="col-span-2 grid content-start gap-1.5">
      <label className="type-body" htmlFor={inputId}>
        Số và phần trăm trong game
      </label>
      <Input
        ref={input}
        id={inputId}

        value={text}
        placeholder="150 | 20%"
        autoComplete="off"
        aria-invalid={!reading.ok}
        aria-describedby={helpId}
        onChange={(event) => {
          const next = event.target.value
          setTyped(next)
          const parsed = parseStatReading(next)
          if (parsed.ok) onChange(parsed.value, parsed.percent)
        }}
        onBlur={() => {
          if (reading.ok) setTyped(null)
        }}
      />
      <div id={helpId} className="space-y-1">
        <p className="type-meta">
          Gõ đúng như game hiện: số, dấu |, rồi phần trăm. Game ghi 150 | 20% thì gõ 150 | 20%.
        </p>
        {!reading.ok ? (
          <p role="alert" className="type-meta text-destructive">
            {reading.message}
          </p>
        ) : reading.value !== null && reading.percent !== null ? (
          <p className="type-meta">
            Đã đọc: số {formatStatNumber(reading.value)}, phần trăm {formatStatNumber(reading.percent)}%.
          </p>
        ) : reading.value !== null ? (
          <p className="type-meta">
            Đã đọc: số {formatStatNumber(reading.value)}, chưa có phần trăm. Game ghi gì sau dấu | thì gõ thêm, kể cả
            0%.
          </p>
        ) : null}
      </div>
    </div>
  )
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
  const observation = observedAttributes(skills, patchCode)
  const rows = combatAttributeRows(value, observation, defaults)
  const inherited = defaults.filter((rule) => !value.values.some((v) => v.statKey === rule.statKey))
  const add = (statKey: string, unit = statUnit(statKey)) =>
    onChange({ ...value, values: [...value.values, { statKey, unit, baseValue: null }] })
  const update = (index: number, patch: Partial<Stats["values"][number]>) =>
    onChange({ ...value, values: value.values.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) })
  const nextKey = Object.keys(STAT_LABELS).find((key) => !value.values.some((entry) => entry.statKey === key)) ?? ""
  return (
    <div className="space-y-3">
      <p className="type-meta">
        {observation && patchCode
          ? "Đã có thuộc tính từ ảnh của patch này. Chỉ thêm giá trị riêng khi có nguồn xác nhận chỉ số của tướng."
          : "Nhập chỉ số như màn Thuộc tính trong game ghi. Chỉ số không đổi theo cấp tướng; trang bị, phù hiệu và bảng ngọc cộng thêm khi vào trận."}
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
        <details className="rounded-lg border p-3" open={value.values.length ? undefined : true}>
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
      {!observation && !value.values.length && (
        <p className="type-body rounded-lg border border-dashed p-4 text-muted-foreground">
          Chưa nhập giá trị riêng cho tướng.
        </p>
      )}
      {value.values.map((stat, index) => (
        <div key={index} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-end gap-2">
            <label className="type-body grid min-w-0 flex-1 gap-1.5">
              Chỉ số
              <NativeSelect
                className="w-full"
                value={Object.hasOwn(STAT_LABELS, stat.statKey) ? stat.statKey : "custom"}
                onChange={(event) => {
                  const statKey = event.target.value === "custom" ? "" : event.target.value
                  update(index, {
                    statKey,
                    unit: statUnit(statKey),
                    ...(hasStatPercent(statKey) ? {} : { percentValue: null }),
                  })
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
              </NativeSelect>
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
          <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
            {hasStatPercent(stat.statKey) ? (
              <StatReadingField
                key={stat.statKey}
                value={stat.baseValue}
                percent={stat.percentValue}
                onChange={(baseValue, percentValue) => update(index, { baseValue, percentValue, unit: "POINT" })}
              />
            ) : (
              <Field
                label="Giá trị cơ bản"
                type="number"
                step="any"
                value={stat.baseValue ?? ""}
                onChange={(v) => update(index, { baseValue: v === "" ? null : Number(v) })}
              />
            )}
            {!hasStatPercent(stat.statKey) && (
              <label className="type-body col-span-2 grid gap-1.5 sm:col-span-1">
                Đơn vị
                <NativeSelect
                  className="w-full"
                  value={stat.unit}
                  onChange={(event) => update(index, { unit: event.target.value })}
                >
                  {Object.entries(units).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                  {!Object.hasOwn(units, stat.unit) && <option value={stat.unit}>Đơn vị hiện tại ({stat.unit})</option>}
                </NativeSelect>
              </label>
            )}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => add(nextKey)}>
        <Plus className="size-4" />
        {observation ? "Thêm chỉ số riêng (tùy chọn)" : "Thêm chỉ số"}
      </Button>
    </div>
  )
}
