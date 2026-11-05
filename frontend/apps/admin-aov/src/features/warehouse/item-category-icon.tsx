import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { warehouseText, type WarehouseMetadata } from "./warehouse-types"
import { ItemCategoryIcon } from "./item-category-view"
export { ItemCategoryIcon } from "./item-category-view"
export { itemCategoryFallback } from "@aov/ui/components/item-category-icons"
export function ItemCategorySelect({
  label,
  categories,
  locale,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string
  categories: WarehouseMetadata[]
  locale: string
  value: string | null
  onChange: (code: string) => void
  allowEmpty?: boolean
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="type-label">{label}</span>
      <Select
        value={value || (allowEmpty ? "__none__" : "")}
        onValueChange={(code) => onChange(code === "__none__" ? "" : code)}
      >
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder="Chọn nhóm" />
        </SelectTrigger>
        <SelectContent position="popper">
          {allowEmpty && <SelectItem value="__none__">Chưa chọn nhóm</SelectItem>}
          {value && !categories.some((category) => category.code === value) && (
            <SelectItem value={value}>{value}</SelectItem>
          )}
          {categories.map((category) => (
            <SelectItem key={category.code} value={category.code}>
              <span className="flex items-center gap-2">
                <ItemCategoryIcon category={category} />
                {warehouseText(category.translations, locale)?.name || category.code}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
