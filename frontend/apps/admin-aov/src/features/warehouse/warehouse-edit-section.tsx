import { Check, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"

const sectionNames = {
  details: "giá, cấp và nhóm",
  stats: "chỉ số",
  recipe: "công thức",
  positions: "vị trí trong shop",
  mechanics: "thuộc tính",
  states: "trạng thái phụ trợ",
  context: "mốc patch và ghi chú",
  translations: "bản dịch",
  images: "ảnh",
} as const

export type WarehouseSection = keyof typeof sectionNames
export type EditTarget = { revisionId: string; section: WarehouseSection }

export function SectionPencil({
  section,
  name,
  active,
  draftAction,
  disabled,
  onClick,
  className,
}: {
  section: WarehouseSection
  name?: string
  active?: boolean
  draftAction?: "open" | "create"
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  const prefix = active
    ? "Xem lại"
    : draftAction === "open"
      ? "Mở nháp và sửa"
      : draftAction === "create"
        ? "Tạo nháp và sửa"
        : "Sửa"
  const label = `${prefix} ${name ?? sectionNames[section]}`
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      disabled={disabled}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {active ? <Check /> : <Pencil />}
    </Button>
  )
}
