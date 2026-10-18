import { control } from "./fields"
import { relationRows, sourcePaths, type Relation, type RelationField, type RelationMapping } from "./import-relations"

export function RelationMappingFields({
  section,
  sample,
  value,
  fields,
  onChange,
}: {
  section: Relation
  sample: unknown
  value: RelationMapping
  fields: RelationField[]
  onChange: (value: RelationMapping) => void
}) {
  let paths: string[] = []
  let problem = ""
  try {
    paths = sourcePaths(relationRows(sample, value.variants))
  } catch (error) {
    problem = (error as Error).message
  }
  return (
    <fieldset className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold">Ánh xạ {section === "skills" ? "kỹ năng" : "trang phục"}</legend>
      {section === "skills" && (
        <label className="block text-sm">
          Mảng biến thể trong mỗi kỹ năng (nếu có)
          <input
            className={control}
            value={value.variants}
            placeholder="Ví dụ: variants"
            onChange={(e) => onChange({ ...value, variants: e.target.value })}
          />
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Chỉ trường ảnh có ánh xạ mới được tải. Trường không ánh xạ giữ giá trị đang có theo mã kỹ năng/trang phục. Ghi
        đè danh sách sẽ loại các mã không có trong file.
      </p>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => {
          const selected = value.fields[field.key] ?? ""
          const choices =
            selected && !selected.startsWith("@") && !paths.includes(selected) ? [selected, ...paths] : paths
          return (
            <label key={field.key} className="space-y-1 text-sm">
              {field.label}
              <select
                className={control}
                aria-label={`${section}: ${field.label}`}
                value={selected}
                onChange={(e) => onChange({ ...value, fields: { ...value.fields, [field.key]: e.target.value } })}
              >
                <option value="">Không ánh xạ</option>
                {field.key === "displayOrder" && (
                  <option value="@order">Thứ tự trong danh sách sau khi tách biến thể</option>
                )}
                {field.key === "skillKey" && <option value="@slotKey">Tạo mã từ slot + index biến thể</option>}
                {field.key === "kind" && <option value="@slotKind">Theo slot: 0 nội tại, còn lại chủ động</option>}
                {choices.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
