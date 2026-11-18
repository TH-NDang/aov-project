import { ArrowRight } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  defaultRelationMapping,
  type Relation,
  type RelationField,
  type RelationMapping,
} from "../../model/import/import-relations"
import type { ImportField, ImportPolicy } from "../../model/import/hero-import-types"
import { importFieldLabel } from "../../model/import/import-labels"
import { RelationMappingFields } from "./relation-mapping"
import { control } from "../editing/fields"

function sampleValue(value: unknown): string {
  if (value == null || value === "") return "Trống"
  if (Array.isArray(value))
    return `${value.length} mục${
      value.length && typeof value[0] === "object"
        ? ` · ${value
            .slice(0, 3)
            .map((item) => item?.name || item?.skillKey || item?.skinKey || "")
            .filter(Boolean)
            .join(", ")}`
        : ` · ${value.slice(0, 4).join(", ")}`
    }`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.values)) return `${record.values.length} chỉ số · giữ đơn vị và nguồn đi kèm`
    if (record.scaleCode)
      return `Thang ${record.scaleCode} · ${record.derived ? "quy đổi từ ảnh nguồn" : "đánh giá đã ghi nhận"}`
    return `${Object.keys(record).length} trường dữ liệu`
  }
  return String(value)
}

/**
 * The second step of the hero import: which column names the hero, which column fills each field and what happens to
 * a value already there. Every change drops the preview, which `onChange` does.
 */
export function ImportMappingStep({
  fileName,
  modeTitle,
  rows,
  columns,
  idColumn,
  setIdColumn,
  fields,
  relationFields,
  relationFieldsFailed,
  mapping,
  setMapping,
  policies,
  setPolicies,
  relations,
  setRelations,
  onChange,
  onBack,
  previewBlocked,
  onPreview,
}: {
  fileName: string
  modeTitle: string | undefined
  rows: Record<string, unknown>[]
  columns: string[]
  idColumn: string
  setIdColumn: (column: string) => void
  fields: ImportField[] | undefined
  relationFields: Record<Relation, RelationField[]> | undefined
  relationFieldsFailed: boolean
  mapping: Record<string, string>
  setMapping: (mapping: Record<string, string>) => void
  policies: Record<string, ImportPolicy>
  setPolicies: (policies: Record<string, ImportPolicy>) => void
  relations: Record<Relation, RelationMapping>
  setRelations: (relations: Record<Relation, RelationMapping>) => void
  onChange: () => void
  onBack: () => void
  previewBlocked: boolean
  onPreview: () => void
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">{fileName}</h3>
          <p className="text-sm text-muted-foreground">
            {rows.length} bản ghi · {modeTitle}
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onBack}>
          Đổi tệp / loại nhập
        </Button>
      </div>
      <label className="grid gap-2 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2 sm:items-center">
        <span>
          <strong>Cột nhận diện tướng</strong>
          <span className="mt-1 block text-muted-foreground">
            Dùng mã ổn định như airi. Không tạo lại ID khi cập nhật.
          </span>
        </span>
        <select
          className={control}
          value={idColumn}
          onChange={(e) => {
            setIdColumn(e.target.value)
            onChange()
          }}
        >
          <option value="">Chọn cột mã tướng</option>
          {columns.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="hidden grid-cols-3 gap-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span>Trường dữ liệu</span>
        <span>Cột trong tệp</span>
        <span>Khi đã có giá trị</span>
      </div>
      <div className="divide-y rounded-lg border">
        {fields?.map((field) => (
          <div key={field.key} className="grid gap-3 p-3 sm:grid-cols-3 sm:items-start">
            <div className="text-sm">
              <span className="font-medium">{importFieldLabel(field.key)}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {field.type === "image"
                  ? "Đường dẫn trong thư mục / HTTPS / UUID asset"
                  : field.type === "json"
                    ? "Ghi đè dữ liệu mục này; kiểm tra bản xem trước"
                    : "Ô trống sẽ giữ dữ liệu hiện có"}
              </span>
            </div>
            <div className="min-w-0">
              <select
                aria-label={`Cột nguồn cho ${importFieldLabel(field.key)}`}
                className={control}
                value={mapping[field.key] ?? ""}
                onChange={(e) => {
                  setMapping({ ...mapping, [field.key]: e.target.value })
                  if (field.key === "skills" || field.key === "skins")
                    setRelations({
                      ...relations,
                      [field.key]: defaultRelationMapping(
                        rows.find(
                          (row) => Array.isArray(row[e.target.value]) && (row[e.target.value] as unknown[]).length,
                        )?.[e.target.value],
                        field.key,
                      ),
                    })
                  onChange()
                }}
              >
                <option value="">Không nhập trường này</option>
                {columns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {mapping[field.key] && (
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={sampleValue(rows[0]?.[mapping[field.key]])}
                >
                  Ví dụ: {sampleValue(rows[0]?.[mapping[field.key]])}
                </p>
              )}
            </div>
            <select
              aria-label={`Xử lý ${importFieldLabel(field.key)}`}
              className={control}
              value={policies[field.key] ?? "FILL_EMPTY"}
              onChange={(e) => {
                setPolicies({ ...policies, [field.key]: e.target.value as ImportPolicy })
                onChange()
              }}
            >
              <option value="FILL_EMPTY">Chỉ bổ sung chỗ trống</option>
              <option value="OVERWRITE">Ghi đè giá trị</option>
              <option value="SKIP">Bỏ qua</option>
            </select>
          </div>
        ))}
      </div>
      {(["skills", "skins"] as const)
        .filter((section) => mapping[section] && policies[section] !== "SKIP")
        .map((section) => (
          <RelationMappingFields
            key={section}
            section={section}
            sample={
              rows.find((row) => Array.isArray(row[mapping[section]]) && (row[mapping[section]] as unknown[]).length)?.[
                mapping[section]
              ] ?? rows[0]?.[mapping[section]]
            }
            value={relations[section]}
            fields={relationFields?.[section] ?? []}
            onChange={(value) => {
              setRelations({ ...relations, [section]: value })
              onChange()
            }}
          />
        ))}
      {relationFieldsFailed && (
        <p role="alert" className="text-sm text-destructive">
          Không tải được trường ánh xạ kỹ năng/trang phục. Hãy cập nhật máy chủ.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Xem trước chưa ghi dữ liệu và chưa tải ảnh.</p>
        <Button type="button" disabled={previewBlocked} onClick={onPreview}>
          Kiểm tra {rows.length} bản ghi
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </>
  )
}
