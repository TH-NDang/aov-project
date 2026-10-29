import { useState, type ReactNode } from "react"
import type { Reference, Selection } from "@aov/community-contracts"
import { EyeOff, Search, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Input } from "@aov/ui/components/input"
import { allowedOptions, unavailableReason, type Unavailable } from "../../model/series-rules"

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLocaleLowerCase()

/**
 * Picks a hero or spell from the catalogue. Entries that the rules make unavailable are left out of the suggestions
 * entirely; typing one of them by name explains why it cannot be used.
 */
export function ReferencePicker({
  label,
  value,
  options,
  blocked,
  disabled = false,
  allowManual = true,
  onChange,
  children,
}: {
  label: string
  value: Selection | null | undefined
  options: Reference[]
  blocked?: Map<string, Unavailable>
  disabled?: boolean
  /** Offers the typed name when the catalogue has no match. */
  allowManual?: boolean
  onChange: (value: Selection) => void
  /** The trigger, usually the slot's icon. */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const query = fold(search.trim())
  const allowed = allowedOptions(options, blocked, value)
  const hidden = options.length - allowed.length
  const shown = allowed.filter((option) => !query || fold(`${option.name} ${option.code}`).includes(query))
  const exact = options.find((option) => fold(option.name) === query)
  const typedReason = query && blocked ? unavailableReason(blocked, exact ?? { name: search.trim() }) : null
  const choose = (selection: Selection) => {
    onChange(selection)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value?.name || "chưa chọn"}`}
          title={`${label}: ${value?.name || "chưa chọn"}`}
          disabled={disabled}
          className="rounded-lg disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--esp-gold)]"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-80 max-w-[calc(100vw-1.5rem)] space-y-2 p-2">
        <div className="relative">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Tìm ${label.toLocaleLowerCase()}…`}
            aria-label={`Tìm ${label.toLocaleLowerCase()}`}
            className="h-8 pl-8"
          />
        </div>
        {typedReason && (
          <p role="alert" className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            Không chọn được {exact?.name ?? search.trim()}: {typedReason}.
          </p>
        )}
        <div className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto" role="listbox" aria-label={label}>
          {shown.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={value?.id === option.id}
              onClick={() => choose({ id: option.id, name: option.name })}
              className="flex flex-col items-center gap-1 rounded-md p-1 text-[10px] leading-tight hover:bg-muted aria-selected:bg-[var(--esp-gold-soft)]"
            >
              {option.iconUrl ? (
                <img src={option.iconUrl} alt="" loading="lazy" className="size-10 rounded-md object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-md bg-muted text-xs font-bold"
                >
                  {option.name.slice(0, 2)}
                </span>
              )}
              <span className="line-clamp-2 w-full text-center">{option.name}</span>
            </button>
          ))}
        </div>
        {!shown.length && <p className="px-1 py-2 text-xs text-muted-foreground">Không có lựa chọn phù hợp.</p>}
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          {allowManual && query && !exact && !typedReason && (
            <button
              type="button"
              className="rounded-md border px-2 py-1 hover:bg-muted"
              onClick={() => choose({ id: null, name: search.trim() })}
            >
              Dùng tên “{search.trim()}”
            </button>
          )}
          {(value?.id || value?.name) && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
              onClick={() => choose({ id: null, name: null })}
            >
              <X size={12} /> Bỏ chọn
            </button>
          )}
          {hidden > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground" title="Theo luật cấm chọn">
              <EyeOff size={12} /> Ẩn {hidden} không hợp lệ
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
