import { useState } from "react"
import type { ObservationStatus, Reference, Selection } from "@aov/community-contracts"
import { EyeOff, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { initials } from "../../model/game-view"
import { Monogram } from "../primitives"

/**
 * Every edit is a change applied to the latest value, never a copy of what was on screen, so two edits made before
 * the first one is saved cannot undo each other. It may answer with a promise of whether the change was saved.
 */
export type Change<T> = (change: (value: T) => T) => unknown

/**
 * Where an entry sits now; entries are matched by what they are because positions shift between edits. Older data
 * holds rows without a name, which only their other fields tell apart, so an identical row is looked for first.
 */
export function indexOfEntry<T extends { selection: Selection }>(
  entries: T[],
  target: T,
  same: (a: T, b: T) => boolean,
) {
  const named = (entry: T) =>
    (entry.selection.id ?? null) === (target.selection.id ?? null) &&
    (entry.selection.name ?? null) === (target.selection.name ?? null)
  const exact = entries.findIndex((entry) => named(entry) && JSON.stringify(entry) === JSON.stringify(target))
  return exact >= 0 ? exact : entries.findIndex((entry) => named(entry) && same(entry, target))
}

export const without = <T,>(entries: T[], index: number) =>
  index < 0 ? entries : entries.filter((_, position) => position !== index)

/** How much of a loadout is recorded, in words. */
export function LoadoutStatus({ status, progress }: { status: ObservationStatus; progress: string }) {
  const text = {
    KNOWN: `Đủ ${progress}`,
    PARTIAL: `Một phần, ${progress}`,
    NOT_SHOWN: "Nguồn không hiển thị",
    UNKNOWN: "Chưa ghi",
  }[status]
  return (
    <span
      data-status={status}
      className={cn("esp-num text-sm", status === "KNOWN" ? "font-semibold" : "text-muted-foreground")}
    >
      {text}
    </span>
  )
}

/** Says the source never showed this loadout, which is not the same as the player using nothing. */
export function HiddenToggle({ hidden, label, onToggle }: { hidden: boolean; label: string; onToggle: () => void }) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-pressed={hidden}
      className={cn("text-muted-foreground", hidden && "bg-muted font-semibold text-foreground")}
      title={
        hidden
          ? `Bỏ đánh dấu để ghi ${label}`
          : `Đánh dấu khi video không hiện ${label}; khác với tuyển thủ không dùng gì`
      }
      onClick={onToggle}
    >
      <EyeOff aria-hidden /> Nguồn không hiển thị
    </Button>
  )
}

/**
 * A note typed freely and saved when the field is left, since every save is a request. Without one it is a button. What
 * was typed stays in the field until it is saved: a refused note comes back open, to be left again once fixed.
 */
export function NoteField({
  label,
  value,
  limit = 1000,
  onCommit,
}: {
  label: string
  value: string
  limit?: number
  /** Saves the note; a promise of whether it was saved keeps the typed text while it is answered. */
  onCommit: (note: string) => unknown
}) {
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(value)
  /** A note sent and not answered yet, or refused: the field keeps it over what the game says meanwhile. */
  const [kept, setKept] = useState<string | null>(null)
  // A note changed elsewhere, or taken back, replaces what the field shows.
  if (shown !== value) {
    setShown(value)
    if (kept === null) setText(value)
  }
  const commit = () => {
    setOpen(false)
    const note = text.trim()
    if (note === value.trim()) return setKept(null)
    const answer = onCommit(note)
    if (!(answer instanceof Promise)) return
    setKept(note)
    void answer.then((saved: unknown) => {
      if (saved) return setKept(null)
      setText(note)
      setOpen(true)
    })
  }
  if (!value && !open && kept === null)
    return (
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="-ml-2 justify-self-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus aria-hidden /> {label}
      </Button>
    )
  return (
    <label className="block space-y-1">
      <span className="type-label text-muted-foreground">{label}</span>
      <Textarea
        autoFocus={!value}
        value={text}
        maxLength={limit}
        rows={2}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          event.stopPropagation()
          event.currentTarget.blur()
        }}
      />
    </label>
  )
}

export function ReferenceIcon({
  reference,
  name,
  size,
  round,
}: {
  reference?: Reference
  name: string
  size: number
  round?: boolean
}) {
  return (
    <Monogram
      url={reference?.iconUrl}
      label=""
      text={initials(name).slice(0, 2)}
      size={size}
      portrait
      className={cn("shrink-0", round ? "rounded-full" : "rounded-md")}
    />
  )
}

/** How a picture that is chosen stands out among those that are not. */
export const chosenTile = "bg-foreground/10 font-semibold ring-1 ring-foreground/70 ring-inset"
