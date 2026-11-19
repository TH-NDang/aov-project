import { useState, type ReactNode } from "react"
import type { Loadout, ObservationStatus } from "@aov/community-contracts"
import { EyeOff } from "lucide-react"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"

/** Renders the control that records when the source showed a loadout; omitted where no clock is available. */
export type ObservedAtControl = (
  value: number | null | undefined,
  onChange: (second: number | null) => void,
  label: string,
) => ReactNode

/**
 * Every edit is a change applied to the latest value, never a copy of what was on screen, so two edits made before
 * the first one is saved cannot undo each other.
 */
export type Change<T> = (change: (value: T) => T) => void

/**
 * One part of a player's loadout, emblems or arcana: its title with how much is recorded, the switch that says the
 * source never showed it, the moment the source showed it, the editor of the part and a note.
 */
export function LoadoutSection<T>({
  part,
  title,
  label,
  status,
  progress,
  recorded,
  hiddenText,
  value,
  observedAt,
  onChange,
  children,
}: {
  part: "arcana" | "enchantments"
  title: string
  /** The part's name inside a sentence. */
  label: string
  status: ObservationStatus
  progress: string
  /** What marking the part as not shown would discard, such as the number of emblems recorded. */
  recorded: string
  /** Said in place of the editor while the part is marked as not shown. */
  hiddenText: string
  value: Loadout<T>
  observedAt?: ObservedAtControl
  onChange: Change<Loadout<T>>
  children: ReactNode
}) {
  const hidden = status === "NOT_SHOWN"
  const toggleHidden = async () => {
    if (hidden) return onChange((loadout) => ({ ...loadout, status: "UNKNOWN" }))
    if (
      value.entries.length &&
      !(await confirmAction({
        title: `Đánh dấu nguồn không hiển thị ${label}?`,
        description: `${recorded} đã ghi của tuyển thủ này sẽ bị bỏ.`,
        confirmLabel: "Bỏ và đánh dấu",
      }))
    )
      return
    onChange((loadout) => ({ ...loadout, status: "NOT_SHOWN", entries: [] }))
  }

  return (
    <section data-part={part} className="space-y-2.5" aria-label={title}>
      <header className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <StatusChip status={status} progress={progress} />
        <HiddenToggle hidden={hidden} label={label} onToggle={() => void toggleHidden()} />
        {observedAt?.(
          value.observedAtSeconds,
          (observedAtSeconds) => onChange((loadout) => ({ ...loadout, observedAtSeconds })),
          label,
        )}
      </header>
      {hidden ? <p className="text-xs text-muted-foreground">{hiddenText}</p> : children}
      <NoteField
        key={value.note ?? ""}
        label={`Ghi chú ${label}`}
        value={value.note ?? ""}
        onCommit={(note) => onChange((loadout) => ({ ...loadout, note }))}
      />
    </section>
  )
}

function StatusChip({ status, progress }: { status: ObservationStatus; progress: string }) {
  const text =
    status === "KNOWN"
      ? `Đủ ${progress}`
      : status === "PARTIAL"
        ? `Một phần · ${progress}`
        : status === "NOT_SHOWN"
          ? "Nguồn không hiển thị"
          : "Chưa ghi"
  return (
    <span
      data-status={status}
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "KNOWN" && "bg-[color-mix(in_oklch,var(--esp-live)_18%,transparent)] text-foreground",
        status === "PARTIAL" && "bg-[var(--esp-gold-soft)] text-foreground",
        (status === "UNKNOWN" || status === "NOT_SHOWN") && "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </span>
  )
}

/** Says the source never showed this loadout, which is not the same as the player using nothing. */
function HiddenToggle({ hidden, label, onToggle }: { hidden: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={hidden}
      title={
        hidden
          ? `Bỏ đánh dấu để ghi ${label}`
          : `Đánh dấu khi video không hiện ${label}; khác với tuyển thủ không dùng gì`
      }
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
        hidden ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <EyeOff size={13} /> Nguồn không hiển thị
    </button>
  )
}

/** A note typed freely and saved when the field is left, since every save is a request. */
function NoteField({ label, value, onCommit }: { label: string; value: string; onCommit: (note: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <Textarea
      aria-label={label}
      placeholder="Ghi chú nguồn hoặc phần còn thiếu…"
      value={text}
      maxLength={1000}
      rows={2}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => text.trim() !== value.trim() && onCommit(text.trim())}
    />
  )
}
