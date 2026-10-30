import { useEffect, useId, useMemo, useRef, useState } from "react"
import { cn } from "@aov/ui/lib/utils"
import { SearchField } from "@/components/search-field"
import { matchesQuery } from "@/lib/text"
import { HeroAsset } from "../publishing/hero-content"
import {
  warehouseName,
  warehouseText,
  type ItemContent,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "./warehouse-types"

type Entry = WarehouseEntry<ItemContent>
const visibleResults = 8

export function itemSearchMatches(items: Entry[], query: string, locale: string) {
  const q = query.trim()
  return q ? items.filter((item) => matchesQuery(q, warehouseName(item, locale), item.code)) : []
}

/** Search box with a result list; picking a result jumps to the item on the shop board. */
export function ItemSearch({
  items,
  categories,
  locale,
  value,
  onChange,
  onPick,
  className,
}: {
  items: Entry[]
  categories: WarehouseMetadata[]
  locale: string
  value: string
  onChange: (value: string) => void
  onPick: (item: Entry) => void
  className?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const q = value.trim()
  const matches = useMemo(() => itemSearchMatches(items, q, locale), [items, q, locale])
  const shown = matches.slice(0, visibleResults)
  const expanded = open && !!q
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => setActive(0), [q])
  function pick(item: Entry) {
    setOpen(false)
    // Leaving the field also collapses it back to an icon on phones.
    input.current?.blur()
    onPick(item)
  }
  return (
    <SearchField
      placement="header"
      inputRef={input}
      className={className}
      label="Tìm trang bị"
      placeholder="Tìm tên hoặc mã…"
      shortcut
      value={value}
      onChange={(next) => {
        onChange(next)
        setOpen(true)
      }}
      role="combobox"
      aria-expanded={expanded}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={expanded && shown.length ? `${listId}-${active}` : undefined}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.preventDefault()
          setOpen(false)
          return
        }
        if (!q || !shown.length) return
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault()
          setOpen(true)
          const step = event.key === "ArrowDown" ? 1 : -1
          setActive((index) => (index + step + shown.length) % shown.length)
        } else if (event.key === "Enter") {
          event.preventDefault()
          pick(shown[Math.min(active, shown.length - 1)])
        }
      }}
    >
      {expanded && (
        <div
          id={listId}
          role="listbox"
          aria-label="Kết quả tìm trang bị"
          className="absolute top-full right-0 left-0 z-40 mt-1 sm:min-w-72 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {shown.length ? (
            shown.map((item, index) => {
              const group = categories.find((entry) => entry.code === item.content.shopPositions[0]?.categoryCode)
              return (
                <div
                  key={item.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5",
                    index === active && "bg-accent text-accent-foreground",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(item)}
                >
                  <HeroAsset
                    id={item.content.iconAssetId}
                    alt=""
                    className="size-7 shrink-0 rounded-md"
                    frameAspectRatio={1}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{warehouseName(item, locale)}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {group ? warehouseText(group.translations, locale)?.name || group.code : "Chưa xếp nhóm"} ·{" "}
                      {item.code}
                    </span>
                  </span>
                  {item.content.price !== null && (
                    <span className="shrink-0 text-xs tabular-nums text-amber-600 dark:text-amber-400">
                      {item.content.price.toLocaleString("vi-VN")}
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">Không có trang bị khớp “{q}”.</p>
          )}
          {matches.length > shown.length && (
            <p className="mt-1 border-t px-2 pt-1.5 pb-0.5 text-xs text-muted-foreground">
              Còn {matches.length - shown.length} kết quả · gõ thêm để thu hẹp
            </p>
          )}
        </div>
      )}
    </SearchField>
  )
}
