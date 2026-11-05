import { useId, useState } from "react"
import { Check, ChevronsUpDown, Plus, type LucideIcon } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { matchesQuery, normalize } from "@/lib/text"
import type { CompetitionOption } from "./competition-field-options"

export function CompetitionChoiceField({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  allowCustom = false,
  clearable = false,
  disabled = false,
  placeholder = "Chọn…",
  maxLength = 300,
}: {
  label: string
  value: string
  options: CompetitionOption[]
  onChange: (value: string) => void
  icon?: LucideIcon
  allowCustom?: boolean
  clearable?: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selected = options.find((option) => option.value === value)
  const choices = value && !selected ? [{ value, label: value, detail: "Giá trị hiện có" }, ...options] : options
  const custom = search.trim()
  const canAdd =
    allowCustom &&
    custom &&
    !choices.some(
      (option) => normalize(option.value) === normalize(custom) || normalize(option.label) === normalize(custom),
    )
  const select = (next: string) => {
    if (disabled) return
    if (next !== value) onChange(next)
    setOpen(false)
  }
  return (
    <div className="grid min-w-0 gap-2">
      <span id={id} className="type-label">
        {label}
      </span>
      <Popover
        open={open && !disabled}
        onOpenChange={(next) => {
          setOpen(next)
          setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-labelledby={id}
            aria-expanded={open && !disabled}
            disabled={disabled}
            className="h-9 w-full justify-between gap-2 bg-background font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              {Icon && <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />}
              <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>
                {selected?.label || value || placeholder}
              </span>
            </span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-2rem)] p-0"
        >
          <Command key={String(open)} shouldFilter={false} label={`Chọn ${label.toLowerCase()}`}>
            <CommandInput
              aria-label={`Tìm ${label.toLowerCase()}`}
              placeholder={allowCustom ? "Tìm hoặc nhập giá trị mới…" : "Tìm trong danh sách…"}
              value={search}
              onValueChange={setSearch}
              maxLength={maxLength}
              disabled={disabled}
            />
            <CommandList className="max-h-64 overscroll-contain">
              <CommandEmpty>Không tìm thấy lựa chọn phù hợp.</CommandEmpty>
              {clearable && !search && (
                <CommandItem value="clear" onSelect={() => select("")}>
                  Chưa chọn
                </CommandItem>
              )}
              {choices
                .filter((option) => matchesQuery(search, option.value, option.label, option.keywords, option.detail))
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    disabled={disabled}
                    onSelect={() => select(option.value)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="type-body block">{option.label}</span>
                      {option.detail && <span className="type-meta block">{option.detail}</span>}
                    </span>
                    <Check
                      aria-hidden
                      className={`size-4 shrink-0 ${value === option.value ? "opacity-100" : "opacity-0"}`}
                    />
                  </CommandItem>
                ))}
              {canAdd && (
                <CommandItem
                  value={`custom:${custom}`}
                  disabled={disabled}
                  onSelect={() => select(custom)}
                  className="border-t"
                >
                  <Plus aria-hidden className="size-4" />
                  <span className="min-w-0 break-words">Dùng “{custom}”</span>
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
