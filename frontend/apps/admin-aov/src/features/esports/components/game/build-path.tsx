import { useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react"
import type { BuildRole, BuildStep, Selection } from "@aov/community-contracts"
import { Plus, TriangleAlert, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverAnchor, PopoverBoundary, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import {
  BUILD_REFUSALS,
  MAX_HELD,
  MAX_STEPS,
  fates,
  itemKey,
  itemName,
  sellable,
  type BuildRefusal,
  type ItemIndex,
  type SeenItem,
} from "../../model/build"
import { ItemButton, ItemIcon, ItemMarks, stepLabel } from "./build-item"
import { FATE_WORDS, RolePill, StepNotes } from "./build-step-line"
import { ItemPicker, type ItemMark } from "./item-picker"

/** What can be open in the path: the catalogue, or the menu of an item. */
export type OpenPart = "catalogue" | `item:${string}`

/** The catalogue under the path, brought into sight; Escape closes it. */
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
 * The items in the order they were bought, each with what became of it, the second it was had and what it was bought
 * for; the last line adds one. With six held already, an item asks which one was sold for it.
 */
export function BuildPath({
  steps,
  index,
  problems,
  seen,
  now,
  heading,
  inline = false,
  open,
  onOpen,
  onClose,
  onPick,
  onRole,
  menu,
}: {
  steps: BuildStep[]
  index: ItemIndex
  problems: Set<BuildStep>
  seen: SeenItem[]
  /** The game second a new item is given, when one is. */
  now: number | null
  /** At the end of the heading's line. */
  heading?: ReactNode
  /** The catalogue opens under the path: a small screen has no room beside it but over the picture. */
  inline?: boolean
  open: OpenPart | null
  onOpen: (part: OpenPart) => void
  /** Closes the part if it is the open one; another may have been opened over it meanwhile. */
  onClose: (part: OpenPart) => void
  /** Answers why the item was not taken, if it was not. */
  onPick: (item: Selection, seenAt: number | null, replaces?: Selection[]) => BuildRefusal | null
  onRole: (step: BuildStep, role: BuildRole) => void
  menu: (step: BuildStep) => ReactNode
}) {
  const [refusal, setRefusal] = useState<BuildRefusal | null>(null)
  // An item that found six slots held, waiting for the one sold for it.
  const [pending, setPending] = useState<{ item: Selection; seenAt: number | null } | null>(null)
  const root = useRef<HTMLElement>(null)
  const pressedElsewhere = useRef(false)
  const fate = useMemo(() => fates(steps, index), [steps, index])
  const held = fate.filter((entry) => entry === "HELD").length
  const full = steps.length >= MAX_STEPS
  const marks = useMemo(
    () =>
      new Map<string, ItemMark>(
        steps.map((step, at) => [itemKey(step.item, index), { label: FATE_WORDS[fate[at]!], here: true }]),
      ),
    [steps, index, fate],
  )

  const toggle = (part: OpenPart) => (next: boolean) => (next ? onOpen(part) : onClose(part))
  const browse = () => {
    setRefusal(null)
    setPending(null)
    onOpen("catalogue")
  }
  const pick = (item: Selection, seenAt: number | null, replaces?: Selection[]) => {
    const reason = onPick(item, seenAt, replaces)
    if (reason === "HELD" && !replaces) {
      setRefusal(null)
      setPending({ item, seenAt })
      return
    }
    setRefusal(reason)
    if (!reason) setPending(null)
  }
  const focusAdd = () => root.current?.querySelector<HTMLElement>("[data-add]")?.focus()
  const shut = () => {
    setPending(null)
    onClose("catalogue")
    focusAdd()
  }

  const row = (step: BuildStep, at: number) => {
    const key = itemKey(step.item, index)
    const name = itemName(step.item, index)
    // A list written elsewhere may name an item twice; each still has a menu of its own.
    const repeated = steps.findIndex((entry) => itemKey(entry.item, index) === key) < at
    const part: OpenPart = `item:${repeated ? `${key}-${at}` : key}`
    const gone = fate[at] !== "HELD"
    return (
      <li key={part} className="flex min-w-0 items-center gap-1.5">
        <span className="esp-num type-meta w-5 shrink-0 text-right">{at + 1}</span>
        <Popover open={open === part} onOpenChange={toggle(part)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-item={key}
              title={stepLabel(step, index)}
              aria-label={`Món ${at + 1}: ${stepLabel(step, index)}${problems.has(step) ? ", cần sửa" : ""}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-muted"
            >
              <span className="relative inline-flex">
                <ItemIcon item={step.item} index={index} size={40} className={cn(gone && "opacity-60")} />
                <ItemMarks item={step.item} index={index} protective={step.role === "PROTECTIVE"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  <span className="truncate">{name}</span>
                  {problems.has(step) && (
                    <TriangleAlert size={14} className="shrink-0 text-(--aov-warning)" aria-hidden="true" />
                  )}
                </span>
                <StepNotes steps={steps} at={at} fate={fate[at]!} index={index} />
              </span>
              {step.atSeconds != null && (
                <span className="esp-num shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                  {formatClock(step.atSeconds)}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            collisionPadding={12}
            aria-label={name}
            className="max-h-(--radix-popover-content-available-height) w-[min(22rem,var(--radix-popover-content-available-width))] overflow-y-auto p-0"
            onOpenAutoFocus={focusInside}
            // Keys pressed in the menu are the menu's; the page would play the video or seek with them.
            onKeyDown={(event) => event.stopPropagation()}
          >
            {menu(step)}
          </PopoverContent>
        </Popover>
        {/* An item that went into another is part of that one; what it was bought for is that one's. */}
        {fate[at] === "UPGRADED" ? (
          <span className="w-20 shrink-0" />
        ) : (
          <RolePill role={step.role} name={name} onChange={(role) => onRole(step, role)} />
        )}
      </li>
    )
  }

  const add = (
    <button
      type="button"
      aria-haspopup="dialog"
      data-add
      disabled={full}
      title={full ? BUILD_REFUSALS.STEPS : "Thêm món theo thứ tự lên"}
      onClick={browse}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
    >
      <Plus size={16} aria-hidden="true" /> Thêm món
      {now != null && <span className="esp-num">· {formatClock(now)}</span>}
    </button>
  )
  const close = inline && (
    <Button type="button" size="icon-xs" variant="ghost" aria-label="Đóng danh mục" onClick={shut}>
      <X aria-hidden />
    </Button>
  )
  const chooser = pending && (
    <div className="space-y-2 overflow-y-auto p-3" role="group" aria-label="Món bán để lấy">
      <p className="text-sm font-semibold">
        Đủ {MAX_HELD} ô. {itemName(pending.item, index)} thay món nào?
      </p>
      <div className="grid grid-cols-4 gap-1">
        {sellable(steps, pending.seenAt ?? now, index).map((step) => (
          <ItemButton
            key={itemKey(step.item, index)}
            item={step.item}
            index={index}
            onClick={() => pick(pending.item, pending.seenAt, [step.item])}
          />
        ))}
      </div>
      {refusal && (
        <p role="alert" className="text-xs text-destructive">
          {BUILD_REFUSALS[refusal]}
        </p>
      )}
      <div className="flex justify-end gap-1">
        <Button type="button" size="xs" variant="ghost" onClick={() => setPending(null)}>
          Chọn món khác
        </Button>
        {close}
      </div>
    </div>
  )
  const picker = chooser || (
    <ItemPicker
      label="Thêm món"
      index={index}
      status={
        <span className="flex items-center gap-1">
          Cuối ván {held}/{MAX_HELD}
          {close}
        </span>
      }
      marks={marks}
      seen={seen}
      message={refusal && BUILD_REFUSALS[refusal]}
      onPick={(item, seenAt) => pick(item, seenAt)}
    />
  )

  return (
    <section ref={root} className="min-w-0 space-y-2" aria-label="Lộ trình lên đồ" data-path>
      <header className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
        <h4 className="text-sm font-semibold">Lộ trình lên đồ</h4>
        {steps.length > 0 && <span className="esp-num type-meta">{steps.length}</span>}
        {heading}
      </header>
      <ol className="space-y-0.5">{steps.map(row)}</ol>
      {inline ? (
        <>
          {add}
          {open === "catalogue" && (
            <CatalogueBelow label="Thêm món" onClose={shut}>
              {picker}
            </CatalogueBelow>
          )}
        </>
      ) : (
        <Popover open={open === "catalogue"} onOpenChange={toggle("catalogue")}>
          <PopoverAnchor asChild>{add}</PopoverAnchor>
          <PopoverContent
            align="start"
            collisionPadding={12}
            aria-label="Thêm món"
            className="max-h-[min(28rem,var(--radix-popover-content-available-height))] w-(--radix-popover-content-available-width) overflow-hidden p-0"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              // What asks for the time of the video belongs to adding, so pressing it keeps the catalogue open.
              if (event.target instanceof Element && event.target.closest("[data-keep-catalogue]")) {
                event.preventDefault()
                return
              }
              pressedElsewhere.current = true
            }}
            onCloseAutoFocus={(event) => {
              // Back to the line that adds, unless something else was pressed.
              event.preventDefault()
              if (!pressedElsewhere.current) focusAdd()
              pressedElsewhere.current = false
              setPending(null)
            }}
          >
            {picker}
          </PopoverContent>
        </Popover>
      )}
    </section>
  )
}
