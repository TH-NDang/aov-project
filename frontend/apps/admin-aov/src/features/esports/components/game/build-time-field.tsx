import { useState } from "react"
import { Clock3, Play, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { formatClock, parseClock } from "@/lib/clock"

const written = (second: number | null) => (second == null ? "" : formatClock(second))

/** Reads `8:32`, and `832` from a keyboard without a colon; one or two digits could be minutes as well as seconds. */
const readTime = (text: string) => {
  const digits = text.match(/^(\d{1,2})(\d{2})$/)
  return parseClock(digits ? `${digits[1]}:${digits[2]}` : text.includes(":") ? text : "")
}

/**
 * When the player had an item, on the game clock: typed as minutes and seconds, or taken from the video. A typed time
 * is saved when the field is left or Enter is pressed, since every save is a request.
 */
export function BuildTimeField({
  value,
  nowGame,
  onCommit,
  onSeek,
}: {
  value: number | null
  /** The game second the video is at. */
  nowGame?: number | null
  onCommit: (second: number | null) => void
  onSeek?: (gameSecond: number) => void
}) {
  const [text, setText] = useState(written(value))
  const [shown, setShown] = useState(value)
  const [misread, setMisread] = useState(false)
  // A time taken from the video, or undone, replaces what the field shows.
  if (shown !== value) {
    setShown(value)
    setText(written(value))
    setMisread(false)
  }

  const commit = () => {
    const typed = text.trim()
    const second = readTime(typed)
    setMisread(!!typed && second == null)
    if ((!typed || second != null) && second !== value) onCommit(second)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="relative">
          <Input
            aria-label="Thời điểm có món này, phút:giây trong ván"
            aria-invalid={misread || undefined}
            value={text}
            inputMode="numeric"
            placeholder="phút:giây"
            maxLength={7}
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => event.key === "Enter" && commit()}
            className="esp-num h-8 w-28 pr-8"
          />
          {value != null && (
            <button
              type="button"
              className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Xóa thời điểm"
              // Leaving the field would save what it shows before the press clears it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCommit(null)}
            >
              <X size={13} />
            </button>
          )}
        </span>
        {value != null && onSeek && (
          <button
            type="button"
            className="grid size-8 place-items-center rounded-md border hover:bg-muted"
            aria-label={`Xem lúc ${formatClock(value)} trên video`}
            title={`Xem lúc ${formatClock(value)} trên video`}
            onClick={() => onSeek(value)}
          >
            <Play size={13} />
          </button>
        )}
        {nowGame != null && nowGame !== value && (
          <Button size="sm" variant="outline" className="px-2.5 text-xs" onClick={() => onCommit(nowGame)}>
            <Clock3 aria-hidden /> Lấy lúc video {formatClock(nowGame)}
          </Button>
        )}
      </div>
      {misread && (
        <p role="alert" className="text-xs text-destructive">
          Nhập phút:giây, ví dụ 8:32.
        </p>
      )}
    </>
  )
}
