import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Check, ChevronsUpDown, Link2, MoreHorizontal, Sparkles, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { commandFilter, normalize } from "@/lib/text"
import { usePublicHeroes } from "@/lib/public-heroes"

export interface MenuAction {
  label: string
  icon?: ReactNode
  /** Not needed when the action only opens its choices. May ask first, and then settles once answered. */
  onSelect?: () => void | Promise<void>
  disabled?: boolean
  destructive?: boolean
  /** Draws a line above the action, to set apart the ones that remove something. */
  apart?: boolean
  /** Choices shown in a submenu instead of acting at once. */
  choices?: { label: string; onSelect: () => void; current?: boolean }[]
}

/** The "⋯" button of a row or an entry: every way to change it, in one place. */
export function RowMenu({
  label,
  actions,
  size = "icon-sm",
}: {
  label: string
  actions: MenuAction[]
  size?: "icon-sm" | "icon"
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size={size} aria-label={label} title={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {actions.map((action) => (
          <MenuEntry key={action.label} action={action} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuEntry({ action }: { action: MenuAction }) {
  const body = (
    <>
      {action.icon}
      {action.label}
    </>
  )
  return (
    <>
      {action.apart && <DropdownMenuSeparator />}
      {action.choices ? (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={action.disabled || !action.choices.length}>{body}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            {action.choices.map((choice) => (
              <DropdownMenuItem key={choice.label} disabled={choice.current} onSelect={choice.onSelect}>
                {choice.current ? <Check /> : <span className="size-4" />}
                {choice.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ) : (
        <DropdownMenuItem
          disabled={action.disabled}
          variant={action.destructive ? "destructive" : "default"}
          onSelect={action.onSelect}
        >
          {body}
        </DropdownMenuItem>
      )}
    </>
  )
}

/**
 * A text box that shows what was written before as soon as it gets focus, so a value is picked rather than retyped.
 * Typing narrows the list; anything new can still be written.
 */
export function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
  className,
  heading = "Gợi ý",
}: {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  label: string
  className?: string
  heading?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Focus shows every suggestion; only typing narrows them.
  const [typing, setTyping] = useState(false)
  const needle = typing ? normalize(value.trim()) : ""
  const shown = useMemo(() => {
    const unique = [...new Set(suggestions.map((entry) => entry.trim()).filter(Boolean))]
    return unique.filter((entry) => !needle || normalize(entry).includes(needle)).slice(0, 12)
  }, [suggestions, needle])
  const choose = (entry: string) => {
    onChange(entry)
    setOpen(false)
  }

  return (
    // A plain list under the box: a popover layer would close itself on the click that focuses the box.
    <div className="relative">
      <Input
        aria-label={label}
        placeholder={placeholder}
        className={className}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        onFocus={() => {
          setTyping(false)
          setActive(0)
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value)
          setTyping(true)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (!shown.length) return
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            setOpen(true)
            setActive((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length)
          } else if (event.key === "Enter" && open) {
            event.preventDefault()
            choose(shown[active] ?? shown[0])
          } else if (event.key === "Escape") setOpen(false)
        }}
      />
      {open && shown.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full min-w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <p className="type-meta flex items-center gap-1 px-2 py-1">
            <Sparkles className="size-3.5" /> {heading}
          </p>
          <ul role="listbox" aria-label={heading} className="grid max-h-64 overflow-y-auto">
            {shown.map((entry, at) => (
              <li key={entry} role="option" aria-selected={at === active}>
                <button
                  type="button"
                  className={`type-body flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left ${at === active ? "bg-muted" : "hover:bg-muted/60"}`}
                  // Picking happens before the input loses focus.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    choose(entry)
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{entry}</span>
                  {entry === value && <Check className="size-4 shrink-0" aria-label="Đang chọn" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Chips that take two rows at most. The rest stay hidden behind a "+n" chip that opens them in place, so a long set of
 * choices does not push the form down.
 */
export function ClampedChips({ children, rows = 2 }: { children: ReactNode[]; rows?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState<{ height: number; hidden: number } | null>(null)

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => {
      const chips = [...element.children] as HTMLElement[]
      const tops = [...new Set(chips.map((chip) => chip.offsetTop))].sort((a, b) => a - b)
      if (tops.length <= rows) return setLimit(null)
      const lastRow = tops[rows - 1]
      const height = Math.max(
        ...chips.filter((chip) => chip.offsetTop === lastRow).map((chip) => chip.offsetTop + chip.offsetHeight),
      )
      setLimit({ height, hidden: chips.filter((chip) => chip.offsetTop > lastRow).length })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children, rows])

  const clamped = !!limit && !open
  return (
    <div className="flex items-end gap-1.5">
      <div
        ref={box}
        className="flex min-w-0 flex-1 flex-wrap gap-1.5 overflow-hidden"
        style={clamped ? { maxHeight: limit.height } : undefined}
      >
        {children}
      </div>
      {limit && (
        <button
          type="button"
          className="type-meta shrink-0 rounded-full border px-2.5 py-1 hover:border-foreground/40 hover:text-foreground"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Thu gọn" : `+${limit.hidden}`}
        </button>
      )}
    </div>
  )
}

interface HeroOption {
  code: string
  name: string
  head?: string
}

/** Every published hero by name, for linking a unit to its Wiki page. */
const sortedByName = (heroes: HeroOption[]) => [...heroes].sort((a, b) => a.name.localeCompare(b.name, "vi"))

/**
 * Picks the Wiki hero a unit stands for from the published heroes, with their faces. The hero named like the unit is
 * offered first, so most units link in one click.
 */
export function HeroCodePicker({
  value,
  unitName,
  onChange,
}: {
  value: string | null
  unitName: string
  onChange: (code: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const heroes = usePublicHeroes(sortedByName)
  const list = heroes.data ?? []
  const selected = list.find((hero) => hero.code === value)
  const match = !value ? list.find((hero) => normalize(hero.name) === normalize(unitName.trim())) : undefined

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-label="Tướng trên Wiki"
              className="min-w-0 flex-1 justify-between font-normal"
            >
              <span className="flex min-w-0 items-center gap-2">
                {selected?.head ? (
                  <img src={selected.head} alt="" className="size-6 rounded-sm object-cover" />
                ) : (
                  <Link2 className="size-4 text-muted-foreground" />
                )}
                <span className={`truncate ${selected || value ? "" : "text-muted-foreground"}`}>
                  {selected
                    ? `${selected.name} · ${selected.code}`
                    : value
                      ? `${value} (chưa có trên Wiki)`
                      : "Chọn tướng…"}
                </span>
              </span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
            <Command filter={commandFilter}>
              <CommandInput placeholder="Tìm tướng…" />
              <CommandList>
                <CommandEmpty>{heroes.isLoading ? "Đang tải tướng…" : "Không có tướng khớp."}</CommandEmpty>
                <CommandGroup>
                  {list.map((hero) => (
                    <CommandItem
                      key={hero.code}
                      value={`${hero.name} ${hero.code}`}
                      onSelect={() => {
                        onChange(hero.code)
                        setOpen(false)
                      }}
                    >
                      {hero.head ? (
                        <img src={hero.head} alt="" className="size-6 rounded-sm object-cover" />
                      ) : (
                        <span className="size-6 rounded-sm bg-muted" />
                      )}
                      <span className="flex-1 truncate">{hero.name}</span>
                      <span className="type-meta">{hero.code}</span>
                      {hero.code === value && <Check />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Bỏ liên kết tướng"
            onClick={() => onChange(null)}
          >
            <X />
          </Button>
        )}
      </div>
      {match && (
        <button
          type="button"
          className="type-meta inline-flex items-center gap-1.5 justify-self-start rounded-full border border-dashed px-2 py-0.5 hover:border-foreground/40 hover:text-foreground"
          onClick={() => onChange(match.code)}
        >
          <Sparkles className="size-3.5" /> Gợi ý: {match.name}
        </button>
      )}
    </div>
  )
}
