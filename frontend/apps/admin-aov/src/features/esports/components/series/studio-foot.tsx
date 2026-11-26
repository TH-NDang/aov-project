import type { ReactNode } from "react"
import { Check, CircleAlert, LoaderCircle, RefreshCw, Undo2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { currentTimeZone, formatInZone } from "@aov/ui/lib/time-zone"

const SAVED_AT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit" }

/** What the desk has to say, the most pressing first: the line shows one of them at a time. */
export type FootStatus = {
  /** A change that was not saved, as a whole sentence. */
  error?: string | null
  onReload?: () => void
  saving?: boolean
  /** Why something cannot be done here. */
  refusal?: string | null
  /** The last thing that was done, with the one thing that can be done about it. */
  said?: { text: string; act: { label: string; undo: boolean; run: () => void } | null } | null
  savedAt?: Date | null
  /** What to know about the game while nothing happened yet. */
  note?: string | null
}

function Line({ status }: { status: FootStatus }) {
  if (status.saving)
    return (
      <>
        <LoaderCircle size={13} className="shrink-0 animate-spin" aria-hidden />
        <span>Đang lưu…</span>
      </>
    )
  if (status.refusal) return <span className="text-foreground">{status.refusal}</span>
  if (status.said) {
    const { text, act } = status.said
    return (
      <>
        <Check size={13} className="shrink-0" aria-hidden />
        <span title={text}>{text}</span>
        {act && (
          <Button type="button" size="xs" variant="ghost" className="text-foreground" onClick={act.run}>
            {act.undo && <Undo2 aria-hidden />} {act.label}
          </Button>
        )}
      </>
    )
  }
  if (status.savedAt)
    return (
      <>
        <Check size={13} className="shrink-0" aria-hidden />
        <span className="esp-num">Đã lưu {formatInZone(status.savedAt, currentTimeZone(), SAVED_AT)}</span>
      </>
    )
  return <span>{status.note}</span>
}

/** The foot of the dock while recording: one line for what happened, and under it the next step. */
export function StudioFoot({ status, children }: { status: FootStatus; children?: ReactNode }) {
  return (
    <footer className="esp-foot">
      {status.error ? (
        <div className="esp-said type-meta text-destructive" role="alert">
          <CircleAlert size={13} className="shrink-0" aria-hidden />
          <span title={status.error}>{status.error}</span>
          {status.onReload && (
            <Button type="button" size="xs" variant="ghost" className="text-foreground" onClick={status.onReload}>
              <RefreshCw aria-hidden /> Tải bản mới
            </Button>
          )}
        </div>
      ) : (
        <div className="esp-said type-meta" role="status">
          <Line status={status} />
        </div>
      )}
      {children}
    </footer>
  )
}
