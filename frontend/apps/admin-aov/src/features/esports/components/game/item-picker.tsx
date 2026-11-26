import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import type { Reference, Selection } from "@aov/community-contracts"
import { Search } from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import { matchesQuery } from "@/lib/text"
import {
  BUILD_REFUSALS,
  beginsWith,
  itemGroups,
  itemKey,
  unlisted,
  type ItemIndex,
  type SeenItem,
} from "../../model/build"
import { nameKey } from "../../model/name-key"
import { ChosenMark, ItemIcon } from "./build-item"

/** An item that is recorded already: where, and whether that is the place being filled. */
export type ItemMark = { label: string; here: boolean }

type Option = { key: string; item: Reference; atSeconds: number | null }
type Group = { code: string; title: string; options: Option[] }

const tierTitle = (tier: number | null) => (tier == null ? "Chưa rõ cấp" : `Cấp ${tier}`)

/** Without a search an item seen at a moment also stands in its group, where the eye looks for it by name. */
const pickerGroups = (index: ItemIndex, seen: SeenItem[], query: string, partsOf: Selection | null): Group[] =>
  [
    {
      code: "seen",
      title: "Đã thấy ở các mốc",
      options: seen
        .filter(({ item }) => matchesQuery(query, item.name, item.code))
        .map(({ item, atSeconds }) => ({ key: `seen-${item.id}`, item, atSeconds })),
    },
    ...itemGroups(index, query, partsOf).map(({ tier, items }) => ({
      code: `tier-${tier ?? "none"}`,
      title: tierTitle(tier),
      options: items
        .filter((item) => !query.trim() || !seen.some((entry) => entry.item.id === item.id))
        .map((item) => ({ key: item.id, item, atSeconds: null })),
    })),
  ].filter((group) => group.options.length)

const NOTHING_SEEN: SeenItem[] = []

/** The option a key leads to: beside it, or above or below it as the grid lies on screen. */
function neighbour(options: HTMLElement[], from: number, key: string) {
  const step = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1
  if (key === "ArrowLeft" || key === "ArrowRight") return from + step
  const here = options[from]!.getBoundingClientRect()
  const rows = options
    .map((option, position) => ({ position, box: option.getBoundingClientRect() }))
    .filter(({ box }) => (step > 0 ? box.top >= here.bottom : box.bottom <= here.top))
  // A page without a layout has no rows; the next option is then the next one listed.
  if (!rows.length) return here.height ? (step > 0 ? from : -1) : from + step
  const row = step > 0 ? Math.min(...rows.map(({ box }) => box.top)) : Math.max(...rows.map(({ box }) => box.top))
  return rows
    .filter(({ box }) => Math.abs(box.top - row) < 1)
    .sort((a, b) => Math.abs(a.box.left - here.left) - Math.abs(b.box.left - here.left))[0]!.position
}

/**
 * The catalogue's items as pictures with their names, the finished ones first. It stays open while several are added:
 * Enter takes the marked one and selects the search text, so the next name is typed over it. What is recorded already
 * is marked with its place, and pressing it is the caller's to answer: it never adds the same item twice.
 */
export function ItemPicker({
  label,
  index,
  status,
  marks,
  seen = NOTHING_SEEN,
  partsOf = null,
  message,
  footer,
  onPick,
}: {
  label: string
  index: ItemIndex
  /** Where what is picked goes, and how full that is. */
  status?: ReactNode
  /** By the item's key. */
  marks: Map<string, ItemMark>
  /** Items the sources of this player name and the list does not, offered first. */
  seen?: SeenItem[]
  /** The item whose parts are looked for. */
  partsOf?: Selection | null
  /** Why the last pick was refused. */
  message?: string | null
  footer?: ReactNode
  onPick: (item: Selection, atSeconds: number | null) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  // The marked option; arrow keys walk the grid once one was pressed and the text before that.
  const [marked, setMarked] = useState<string | null>(null)
  const [walking, setWalking] = useState(false)

  const groups = useMemo(() => pickerGroups(index, seen, query, partsOf), [index, seen, query, partsOf])
  const options = groups.flatMap((group) => group.options)
  const typed = query.trim()
  const exact = index.items.some((item) => nameKey(item.name) === nameKey(typed))
  const why = options.length ? null : unlisted(index, query, partsOf)
  const at = options.findIndex((option) => option.key === marked)
  const optionId = (option: Option) => `${id}-${option.key}`

  // A finger that opened the picker came for the pictures: the keyboard of a phone would cover them.
  useEffect(() => {
    if (!window.matchMedia?.("(pointer: coarse)").matches) input.current?.focus()
  }, [])
  useEffect(() => {
    if (marked) list.current?.querySelector("[data-marked]")?.scrollIntoView?.({ block: "nearest" })
  }, [marked])

  const pick = (option: Option) => {
    onPick({ id: option.item.id, name: option.item.name }, option.atSeconds)
    // Selecting would also focus the field, which raises the keyboard of a phone.
    if (document.activeElement === input.current) input.current?.select()
    // A second Enter after a typed name would take the item out again.
    if (!walking) setMarked(null)
  }
  const search = (text: string) => {
    const found = pickerGroups(index, seen, text, partsOf).flatMap((group) => group.options)
    const meant = found.find((option) => beginsWith(option.item, text)) ?? found[0]
    setQuery(text)
    setMarked(text.trim() && meant ? meant.key : null)
    setWalking(false)
  }
  const walk = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      if (options[at]) pick(options[at])
      return
    }
    const sideways = event.key === "ArrowLeft" || event.key === "ArrowRight"
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && !(sideways && walking)) return
    event.preventDefault()
    const shown = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
    if (!shown.length) return
    const next = at < 0 ? 0 : Math.min(neighbour(shown, at, event.key), shown.length - 1)
    setWalking(next >= 0)
    if (next >= 0) setMarked(options[next]!.key)
  }

  return (
    <div className="@container flex max-h-[inherit] min-h-0 flex-col">
      <div className="space-y-2 border-b p-2">
        <div className="flex items-center gap-3 pr-1">
          <span className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={input}
              role="combobox"
              aria-label="Tìm trang bị"
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={`${id}-list`}
              aria-activedescendant={options[at] ? optionId(options[at]) : undefined}
              value={query}
              maxLength={100}
              placeholder="Tìm trang bị…"
              onChange={(event) => search(event.target.value)}
              onKeyDown={walk}
              className="h-8 pl-8"
            />
          </span>
          {status && <span className="esp-num type-meta shrink-0">{status}</span>}
        </div>
        {message && (
          <p role="alert" className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            {message}
          </p>
        )}
      </div>
      <div
        ref={list}
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {groups.map((group) => (
          <div key={group.code} role="group" aria-labelledby={`${id}-${group.code}`}>
            <h5
              id={`${id}-${group.code}`}
              className="type-label sticky top-0 z-10 bg-popover px-1 pt-2 pb-1 text-muted-foreground"
            >
              {group.title}
            </h5>
            <div className="grid grid-cols-3 gap-1 @xs:grid-cols-4 @md:grid-cols-5">
              {group.options.map((option) => (
                <OptionTile
                  key={option.key}
                  id={optionId(option)}
                  option={option}
                  index={index}
                  mark={marks.get(itemKey(option.item, index))}
                  marked={option.key === marked}
                  onPick={() => pick(option)}
                />
              ))}
            </div>
          </div>
        ))}
        {!options.length && (
          <p className="px-1 py-3 text-xs text-muted-foreground">
            {why ? BUILD_REFUSALS[why] : "Không có trang bị phù hợp."}
          </p>
        )}
      </div>
      {((typed && !exact) || footer) && (
        <div className="flex flex-wrap items-center gap-2 border-t p-2 text-xs">
          {typed && !exact && (
            <button
              type="button"
              className="rounded-md border px-2 py-1 hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick({ id: null, name: typed }, null)
                search("")
              }}
            >
              Dùng tên “{typed}”
            </button>
          )}
          {footer}
        </div>
      )}
    </div>
  )
}

function OptionTile({
  id,
  option,
  index,
  mark,
  marked,
  onPick,
}: {
  id: string
  option: Option
  index: ItemIndex
  mark?: ItemMark
  marked: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={!!mark?.here}
      aria-label={mark ? `${option.item.name}, ${mark.label}` : option.item.name}
      data-option={option.item.code}
      data-marked={marked || undefined}
      title={mark && !mark.here ? `${option.item.name}: đang ở ${mark.label}, bấm để chuyển` : option.item.name}
      // The search keeps the focus, so typing the next name needs no second press.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      className={cn(
        // The heading of a group stays over the top of the list, so an option is brought out from under it.
        "relative flex min-w-0 scroll-mt-8 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-center text-xs leading-tight hover:bg-muted",
        mark?.here && "bg-foreground/10",
        marked && "outline-2 -outline-offset-2 outline-foreground",
      )}
    >
      <span className="relative inline-flex">
        <ItemIcon item={option.item} index={index} size={40} className={cn(mark && !mark.here && "opacity-60")} />
        {mark?.here && <ChosenMark />}
      </span>
      <span className="line-clamp-2 w-full text-balance">{option.item.name}</span>
      {(mark || option.atSeconds != null) && (
        <span className={cn("esp-num w-full truncate", !mark?.here && "text-muted-foreground")}>
          {mark ? mark.label : formatClock(option.atSeconds)}
        </span>
      )}
    </button>
  )
}
