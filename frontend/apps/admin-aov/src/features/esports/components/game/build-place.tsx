import { useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react"
import type { BuildPlace, BuildStep, Selection } from "@aov/community-contracts"
import { ChevronRight, Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverAnchor, PopoverBoundary, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import {
  BUILD_REFUSALS,
  MAX_KEPT,
  MAX_STEPS,
  buildPlace,
  itemKey,
  itemName,
  stepsAt,
  type BuildRefusal,
  type ItemIndex,
  type SeenItem,
} from "../../model/build"
import { BuildChip, BuildTile } from "./build-item"
import { ItemPicker, type ItemMark } from "./item-picker"

/** What can be open in the editor: the catalogue of a place, or the menu of an item. */
export type OpenPart = `place:${BuildPlace}` | `item:${string}`

/** The catalogue under its list, brought into sight; Escape closes it. */
function CatalogueBelow({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const room = useContext(PopoverBoundary)
  const show = useEffectEvent(() => {
    if (!box.current) return
    // The video stays over the top of the screen while the page scrolls under it.
    box.current.style.scrollMarginTop = `${(room?.getBoundingClientRect().top ?? 0) + 8}px`
    box.current.scrollIntoView?.({ block: "nearest" })
  })
  useEffect(() => show(), [])
  return (
    <div
      ref={box}
      role="group"
      aria-label={label}
      className="flex max-h-[min(24rem,45svh)] flex-col overflow-hidden rounded-md border bg-popover"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.stopPropagation()
        onClose()
      }}
    >
      {children}
    </div>
  )
}

/** Focus moves into an opened menu without choosing a control, so Tab starts at its first one. */
const focusInside = (event: Event) => {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.focus()
}

/**
 * One place of a build: its items in the order they were built, each with its menu, and a plus that opens the catalogue
 * beside them. The six slots are always drawn; a list grows with what is in it.
 */
export function BuildPlaceBlock({
  place,
  steps,
  index,
  borrowed,
  problems,
  seen,
  aside,
  footer,
  inline = false,
  open,
  onOpen,
  onClose,
  onPick,
  menu,
}: {
  place: BuildPlace
  /** The whole list, whose items of other places are marked in the catalogue. */
  steps: BuildStep[]
  index: ItemIndex
  /** The list is read off a snapshot. */
  borrowed: boolean
  problems: Set<BuildStep>
  seen: SeenItem[]
  /** Beside the heading, at the end of its line. */
  aside?: ReactNode
  /** Under the catalogue. */
  footer?: ReactNode
  /** The catalogue opens under the list: a small screen has no room beside it but over the picture. */
  inline?: boolean
  open: OpenPart | null
  onOpen: (part: OpenPart) => void
  /** Closes the part if it is the open one; another may have been opened over it meanwhile. */
  onClose: (part: OpenPart) => void
  /** Answers why the item was not taken, if it was not. */
  onPick: (item: Selection, seenAt: number | null) => BuildRefusal | null
  menu: (step: BuildStep) => ReactNode
}) {
  const { label, hint } = buildPlace(place)
  const [refusal, setRefusal] = useState<BuildRefusal | null>(null)
  const root = useRef<HTMLElement>(null)
  const pressedElsewhere = useRef(false)
  const kept = place === "KEPT"
  const shown = stepsAt(steps, place)
  const free = kept ? Math.max(0, MAX_KEPT - shown.length) : 0
  const full = steps.length >= MAX_STEPS
  const marks = useMemo(
    () =>
      new Map<string, ItemMark>(
        steps.map((step) => [
          itemKey(step.item, index),
          { label: buildPlace(step.place).short, here: step.place === place },
        ]),
      ),
    [steps, index, place],
  )

  const catalogue: OpenPart = `place:${place}`
  const toggle = (part: OpenPart) => (next: boolean) => (next ? onOpen(part) : onClose(part))
  const browse = () => {
    setRefusal(null)
    onOpen(catalogue)
  }
  const pick = (item: Selection, seenAt: number | null) => {
    const here = marks.get(itemKey(item, index))?.here
    const reason = onPick(item, seenAt)
    setRefusal(reason)
    // The sixth item fills the last slot, so there is nothing left to choose.
    if (!reason && !here && free === 1) onClose(catalogue)
  }

  const item = (step: BuildStep, position: number) => {
    const key = itemKey(step.item, index)
    const shared = { step, index, problem: problems.has(step) }
    // A list written elsewhere may name an item twice; each still has a menu of its own.
    const repeated = shown.findIndex((entry) => itemKey(entry.item, index) === key) < position
    const part: OpenPart = `item:${repeated ? `${key}-${position}` : key}`
    return (
      <li key={part} className="relative min-w-0">
        {kept && position > 0 && (
          // From one slot to the next, in the order they were filled; a row starts without one.
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={cn(
              "absolute top-7 -left-2.5 text-muted-foreground/50",
              position % 3 === 0 && "hidden @lg:block",
            )}
          />
        )}
        <Popover open={open === part} onOpenChange={toggle(part)}>
          <PopoverTrigger asChild>
            {kept ? <BuildTile {...shared} number={position + 1} borrowed={borrowed} /> : <BuildChip {...shared} />}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            collisionPadding={12}
            aria-label={itemName(step.item, index)}
            className="max-h-(--radix-popover-content-available-height) w-[min(22rem,var(--radix-popover-content-available-width))] overflow-y-auto p-0"
            onOpenAutoFocus={focusInside}
            // Keys pressed in the menu are the menu's; the page would play the video or seek with them.
            onKeyDown={(event) => event.stopPropagation()}
          >
            {menu(step)}
          </PopoverContent>
        </Popover>
      </li>
    )
  }

  const focusPlus = () => {
    const plus = root.current?.querySelector<HTMLElement>("[data-add]")
    const last = [...(root.current?.querySelectorAll<HTMLElement>("[data-item]") ?? [])].at(-1)
    ;(plus ?? last)?.focus()
  }
  const shut = () => {
    onClose(catalogue)
    focusPlus()
  }
  const list = (
    <ol className={cn("grid gap-1.5", kept ? "grid-cols-3 @lg:grid-cols-6" : "grid-cols-2")}>
      {shown.map(item)}
      {Array.from({ length: free }, (_, slot) => (
        <li key={`free-${slot}`} className="min-w-0">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Thêm trang bị vào ô ${shown.length + slot + 1}`}
            data-add
            disabled={full}
            title={full ? BUILD_REFUSALS.STEPS : hint}
            onClick={browse}
            className="flex w-full flex-col items-center gap-2 rounded-lg px-0.5 pt-2 pb-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <span className="grid size-13 place-items-center rounded-lg border border-dashed border-muted-foreground/50">
              <Plus size={18} aria-hidden="true" />
            </span>
            <span className="min-h-8 text-xs leading-4">Ô {shown.length + slot + 1}</span>
          </button>
        </li>
      ))}
      {!kept && (
        <li className="min-w-0">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Thêm vào ${label}`}
            data-add
            disabled={full}
            title={full ? BUILD_REFUSALS.STEPS : hint}
            onClick={browse}
            className="flex h-full min-h-12 w-full items-center gap-3 rounded-lg border border-dashed px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
          >
            <span className="grid size-8 place-items-center">
              <Plus size={18} aria-hidden="true" />
            </span>
            Thêm món
          </button>
        </li>
      )}
    </ol>
  )
  const picker = (
    <ItemPicker
      label={label}
      index={index}
      status={
        <span className="flex items-center gap-1">
          {kept ? `${label} ${shown.length}/${MAX_KEPT}` : label}
          {inline && (
            <Button type="button" size="icon-xs" variant="ghost" aria-label="Đóng danh mục" onClick={shut}>
              <X aria-hidden />
            </Button>
          )}
        </span>
      }
      marks={marks}
      seen={seen}
      message={refusal && BUILD_REFUSALS[refusal]}
      footer={footer}
      onPick={pick}
    />
  )

  return (
    <section ref={root} className="min-w-0 space-y-2" aria-label={label} data-place={place}>
      <header className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
        <h4 className="text-sm font-semibold" title={hint}>
          {label}
        </h4>
        {(kept || shown.length > 0) && (
          <span className="esp-num type-meta">{kept ? `${shown.length}/${MAX_KEPT}` : shown.length}</span>
        )}
        {aside}
      </header>
      {inline ? (
        <>
          {list}
          {open === catalogue && (
            <CatalogueBelow label={`Thêm vào ${label}`} onClose={shut}>
              {picker}
            </CatalogueBelow>
          )}
        </>
      ) : (
        <Popover open={open === catalogue} onOpenChange={toggle(catalogue)}>
          <PopoverAnchor asChild>{list}</PopoverAnchor>
          <PopoverContent
            align="start"
            collisionPadding={12}
            aria-label={`Thêm vào ${label}`}
            className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-(--radix-popover-content-available-width) overflow-hidden p-0"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={() => {
              pressedElsewhere.current = true
            }}
            onCloseAutoFocus={(event) => {
              // Back to the plus, or to the item that filled the last slot, unless something else was pressed.
              event.preventDefault()
              if (!pressedElsewhere.current) focusPlus()
              pressedElsewhere.current = false
            }}
          >
            {picker}
          </PopoverContent>
        </Popover>
      )}
    </section>
  )
}
