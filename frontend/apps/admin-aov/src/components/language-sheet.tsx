import { Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"
import { HeroLanguageIcon } from "@/features/publishing/components/editing/hero-language-picker"
import { languageOptions } from "@/features/users/profile-preference-picker"

export interface LanguageRow {
  code: string
  label: string
  /** How far the record is written in this language, as a short label for the row. */
  status?: string
  done?: number
  total?: number
  complete?: boolean
}

export const languageName = (code: string) => languageOptions.find((option) => option.value === code)?.label ?? code

/**
 * The row of a detail sheet's ⋯ menu that opens the language sheet: the flag and the language being read, with a dot
 * while that language is not fully written.
 */
export function LanguageMenuItem({
  value,
  incomplete = false,
  disabled,
  onOpen,
}: {
  value: string
  incomplete?: boolean
  disabled?: boolean
  onOpen: () => void
}) {
  return (
    <DropdownMenuItem disabled={disabled} className="gap-2" data-language-menu-item onSelect={onOpen}>
      <HeroLanguageIcon locale={value} />
      <span className="min-w-0 flex-1 truncate">Ngôn ngữ · {languageName(value)}</span>
      {incomplete && <span className="size-1.5 rounded-full bg-(--aov-warning)" aria-label="Chưa viết đủ" />}
    </DropdownMenuItem>
  )
}

/**
 * The languages a record can be read in, one large row each: the flag, the name, how far it is written, and a pencil
 * that opens writing in it. A sheet rather than a submenu, so it reads well on a phone, where it rises from the bottom.
 */
export function LanguageSheet({
  open,
  onOpenChange,
  rows,
  value,
  onChange,
  onEdit,
  editLabel,
  disabled = false,
  note,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: readonly LanguageRow[]
  value: string
  onChange: (code: string) => void
  /** Opens writing in one language from its own row; left out when the record cannot be edited. */
  onEdit?: (code: string) => void
  editLabel: (label: string) => string
  /** The reading language stays put while a part is being edited in it; the pencils still work. */
  disabled?: boolean
  note?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" fitContent className="w-full gap-0 overflow-y-auto sm:max-w-sm">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="type-section-title">Ngôn ngữ hiển thị nội dung</SheetTitle>
          <SheetDescription className="type-meta">
            {note ?? "Chọn ngôn ngữ để đọc; bút bên cạnh mở trang bằng ngôn ngữ đó để viết."}
          </SheetDescription>
        </SheetHeader>
        <div role="radiogroup" aria-label="Ngôn ngữ hiển thị nội dung" className="grid gap-1 p-2">
          {rows.map((row) => {
            const checked = row.code === value
            return (
              <div key={row.code} className="flex items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  data-locale={row.code}
                  disabled={disabled}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    checked ? "bg-primary/10" : "hover:bg-muted",
                  )}
                  onClick={() => {
                    onChange(row.code)
                    onOpenChange(false)
                  }}
                >
                  <HeroLanguageIcon locale={row.code} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("type-body block", checked && "font-semibold text-primary")}>{row.label}</span>
                    {row.status && (
                      <span className={cn("type-meta mt-0.5 block", row.complete && "text-(--aov-success)")}>
                        {row.status}
                      </span>
                    )}
                  </span>
                  {!!row.total && (
                    <span className="type-meta shrink-0 tabular-nums" aria-label="Số mục đã viết">
                      {row.done}/{row.total}
                    </span>
                  )}
                </button>
                {onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 shrink-0 text-muted-foreground"
                    aria-label={editLabel(row.label)}
                    title={editLabel(row.label)}
                    onClick={() => {
                      onOpenChange(false)
                      onEdit(row.code)
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
