import { useState } from "react"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { AdminEntityText } from "../terminology/catalog"
import { AdminLiveRichTextField } from "../terminology/rich-text-field"
import { plainComparisonText } from "./hero-comparison"
import { isRecord } from "./import-relations"
import { rankValues, skillRankCount, skillSourceTable } from "./skill-rank-values"
import type { Skill } from "./types"

export function SkillTagsEditor({
  tags,
  locale,
  onChange,
}: {
  tags: string[]
  locale: string
  onChange: (tags: string[]) => void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  function remove(index: number) {
    onChange(tags.filter((_, i) => i !== index))
    setEditing(null)
  }
  return (
    <div className="space-y-2">
      <h4 className="type-label">Đặc tính</h4>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag, index) => (
          <Badge key={index} variant="outline" className="gap-1.5">
            <AdminEntityText text={tag} />
            <button
              type="button"
              aria-label={`Sửa nhãn ${plainComparisonText(tag)}`}
              onClick={() => setEditing(index)}
              className="rounded p-1 hover:bg-muted"
            >
              <Pencil className="size-3" />
            </button>
          </Badge>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(tags.length)}>
          <Plus className="size-3.5" /> Thêm nhãn
        </Button>
      </div>
      {editing !== null && (
        <div className="space-y-2">
          <AdminLiveRichTextField
            key={`${locale}:${editing}`}
            label="Nội dung nhãn"
            short
            locale={locale}
            value={tags[editing] ?? ""}
            onChange={(value) => {
              if (editing === tags.length) {
                if (value.trim()) onChange([...tags, value])
              } else if (!value.trim()) {
                onChange(tags.filter((_, i) => i !== editing))
                setEditing(tags.length - 1)
              } else onChange(tags.map((tag, i) => (i === editing ? value : tag)))
            }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
              <Check className="size-3.5" /> Xong
            </Button>
            {editing < tags.length && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(editing)}>
                <Trash2 className="size-3.5" /> Bỏ nhãn
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type Table = Record<string, unknown>
const cellInput =
  "w-full min-w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-ring"
const rankLabels = (count: number) => Array.from({ length: count }, (_, i) => `Cấp ${i + 1}`)

export function SkillTableEditor({
  skill,
  table,
  onChange,
}: {
  skill: Skill
  table: Table
  onChange: (table: Table) => void
}) {
  const rows: unknown[] = Array.isArray(table.rows) ? table.rows : []
  const labels: unknown[] = Array.isArray(table.column_labels) ? table.column_labels : []
  // Pin the calculated columns while typing an incomplete expression in the summary cell.
  const [formulaRanks] = useState(() => {
    const view = skillSourceTable(skill)
    return view.derived ? view.columns.length : 0
  })
  const width = rows.reduce<number>(
    (n, row) => (isRecord(row) && Array.isArray(row.display_values) ? Math.max(n, row.display_values.length) : n),
    0,
  )
  const count = Math.max(labels.length, width) || skillRankCount(skill) || 1
  const columns = rankLabels(formulaRanks || count).map((fallback, i) =>
    !formulaRanks && labels[i] != null ? String(labels[i]).replace(/^lv\.?\s*(\d+)$/i, "Cấp $1") : fallback,
  )
  function writeRow(index: number, change: Table) {
    onChange({ ...table, rows: rows.map((row, i) => (i === index && isRecord(row) ? { ...row, ...change } : row)) })
  }
  function addRow() {
    onChange({
      ...table,
      column_labels: labels.length ? labels : columns,
      rows: [...rows, { label: "", display_values: Array.from({ length: formulaRanks ? 1 : count }, () => "") }],
    })
  }
  return (
    <div className="min-w-0 space-y-2">
      {rows.length > 0 && (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm tabular-nums">
            <caption className="sr-only">Chỉnh sửa thông số theo cấp chiêu</caption>
            <thead className="type-label bg-muted/40">
              <tr>
                <th scope="col" className="px-2 py-2">
                  Thông số
                </th>
                {columns.map((col, i) => (
                  <th scope="col" key={i} className="px-2 py-2 text-center">
                    {col}
                  </th>
                ))}
                {columns.length > 1 && (
                  <th scope="col" className="px-2 py-2">
                    Tổng quan
                  </th>
                )}
                <th scope="col">
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                if (!isRecord(row) || !Array.isArray(row.display_values)) return null
                const values = row.display_values
                const name = String(row.label ?? "")
                const calculated = formulaRanks > 1 && values.length === 1
                function valueInput(i: number, label: string) {
                  return (
                    <input
                      className={cellInput}
                      aria-label={`${name || "Thông số"} · ${label}`}
                      value={String(values[i] ?? "")}
                      onChange={(event) =>
                        writeRow(index, {
                          display_values: Array.from({ length: Math.max(i + 1, values.length) }, (_, j) =>
                            j === i ? event.target.value : (values[j] ?? ""),
                          ),
                        })
                      }
                    />
                  )
                }
                const ranks = calculated ? rankValues(values[0], formulaRanks) : null
                return (
                  <tr key={index} className="border-b">
                    <th scope="row" className="min-w-32 p-1">
                      <input
                        className={cellInput}
                        required
                        aria-label={`Tên thông số ${index + 1}`}
                        placeholder="Tên thông số"
                        value={name}
                        onChange={(event) => writeRow(index, { label: event.target.value })}
                      />
                    </th>
                    {columns.map((label, i) => (
                      <td key={i} className="min-w-14 p-1 text-center">
                        {calculated ? (ranks?.[i] ?? "—") : valueInput(i, label)}
                      </td>
                    ))}
                    {columns.length > 1 && (
                      <td className="min-w-36 px-2">
                        {calculated ? valueInput(0, "Tổng quan") : <AdminEntityText text={values.join(" / ")} />}
                      </td>
                    )}
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Bỏ thông số ${name || index + 1}`}
                        onClick={() => onChange({ ...table, rows: rows.filter((_, i) => index !== i) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5" /> Thêm thông số
        </Button>
        {!formulaRanks && rows.length > 0 && count < 18 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...table,
                column_labels: [...columns.map((col, i) => labels[i] ?? col), `Cấp ${count + 1}`],
              })
            }
          >
            <Plus className="size-3.5" /> Thêm cấp
          </Button>
        )}
      </div>
    </div>
  )
}
