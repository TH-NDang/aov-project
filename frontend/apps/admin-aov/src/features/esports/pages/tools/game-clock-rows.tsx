import { useState, type KeyboardEvent } from "react"
import type { GameContent } from "@aov/community-contracts"
import { Check } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { formatClock, parseClock } from "@/lib/clock"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { readClock, stillChange } from "../../model/clock-sync"
import { atVideo } from "../../model/game-times"
import { chapterClock } from "../../model/series-vod"
import { withPlayback } from "../../model/timeline-io"
import { gameToVideo, videoToGame } from "../../model/vod"
import type { GameDesk } from "../game-desk"
import { Row } from "./game-tool-row"

/** Up to this clock a difference is a misplaced 0:00 rather than a pause: the broadcast comes in late, not the game. */
const EARLY = 60

/**
 * The clock the game shows on screen, read at the video where it stands. The broadcast may come into a game when its
 * clock already says 0:15, and the game may stand still while the video runs: what is typed places 0:00 for the first,
 * and records a pause for the second. Until something is typed the field shows, faint, the clock that is recorded.
 */
export function ClockRow({
  desk,
  refusal,
  onStart,
}: {
  desk: GameDesk
  /** Why 0:00 may not stand at a video second; null when it may. */
  refusal: (second: number) => string | null
  onStart: (second: number) => Promise<boolean>
}) {
  const { chapter, playhead } = desk
  const [typed, setTyped] = useState("")
  const now = usePlayheadValue(playhead, Math.floor)
  const shown = typed.trim() ? parseClock(typed) : null
  const reading = shown === null ? null : readClock(chapter, now, shown)
  const recorded = chapter.live && now >= chapter.start ? formatClock(chapterClock(chapter, now)) : "phút:giây"
  // A late broadcast is behind on 0:00 only by seconds; later on, a clock behind is a game that stood still.
  const pauseFirst = !!reading?.stillFor && reading.shown > EARLY

  // Each reading is taken at the second the video stands at when it is written, not when it was typed.
  const at = () => readClock(chapter, desk.markNow() ?? now, shown ?? 0)
  const done = (saved: boolean) => saved && setTyped("")
  const place = () => void onStart(at().start).then(done)
  const still = () => {
    const { stillFor } = at()
    if (stillFor) void desk.record(stillChange(desk.entry.content, shown ?? 0, stillFor)).then(done)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation()
      setTyped("")
    }
    if (event.key !== "Enter" || !reading || reading.recorded === reading.shown) return
    event.preventDefault()
    if (pauseFirst) still()
    else place()
  }

  return (
    <Row
      label="Đồng hồ game"
      value={
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={onKeyDown}
          className="esp-num h-8 w-20 px-1 text-center placeholder:text-sm"
          inputMode="numeric"
          placeholder={recorded}
          aria-label="Đồng hồ trên màn hình"
          title="Gõ đồng hồ game đang hiện trên video"
          aria-invalid={!!typed.trim() && shown === null}
        />
      }
      acts={!reading && <span className="esp-gt-none text-xs">Gõ giờ trên màn hình</span>}
      under={
        reading && (
          <Reading
            reading={reading}
            live={chapter.live}
            refused={refusal(reading.start)}
            pauseFirst={pauseFirst}
            onPlace={place}
            onStill={still}
          />
        )
      }
    />
  )
}

/** What a typed clock means, and the one or two ways to make the record agree with it; the first is what Enter does. */
function Reading({
  reading,
  live,
  refused,
  pauseFirst,
  onPlace,
  onStill,
}: {
  reading: ReturnType<typeof readClock>
  /** The game has a 0:00 already, which is then moved. */
  live: boolean
  /** Why 0:00 may not go where the clock places it. */
  refused: string | null
  pauseFirst: boolean
  onPlace: () => void
  onStill: () => void
}) {
  const { shown, recorded, start, stillFor } = reading
  if (recorded === shown)
    return (
      <span className="esp-gt-line text-muted-foreground">
        <Check size={14} aria-hidden /> Khớp với mốc vào trận.
      </span>
    )
  const place = (
    <Button
      key="place"
      type="button"
      size="xs"
      variant={pauseFirst ? "outline" : "secondary"}
      className="aria-disabled:opacity-50"
      aria-label={`Đặt lúc vào trận ở ${atVideo(start)}`}
      aria-disabled={refused ? true : undefined}
      title={refused ?? undefined}
      onClick={onPlace}
    >
      {live ? "Dời vào trận" : "Vào trận"} {atVideo(start)}
    </Button>
  )
  const still = stillFor !== null && (
    <Button key="still" type="button" size="xs" variant={pauseFirst ? "secondary" : "outline"} onClick={onStill}>
      Tạm dừng {formatClock(stillFor)} ở {formatClock(shown)}
    </Button>
  )
  return (
    <div role="status" className="grid gap-1.5">
      <span className="text-muted-foreground">
        {recorded === null
          ? `0:00 của ván ở ${atVideo(start)}.`
          : `Mốc đang cho ${formatClock(recorded)}, ${recorded > shown ? "nhanh" : "chậm"} ${Math.abs(recorded - shown)} giây.`}
      </span>
      <span className="esp-gt-line">{pauseFirst ? [still, place] : [place, still]}</span>
      {refused && !pauseFirst && <span className="text-xs text-destructive">{refused}</span>}
    </div>
  )
}

type Pause = { atSeconds: number; durationSeconds: number }

const pausesOf = (content: GameContent): Pause[] => content.timeline?.pauses ?? []
const withPause = (content: GameContent, pause: Pause) =>
  withPlayback(content, { pauses: [...pausesOf(content), pause] })
function withoutPause(content: GameContent, pause: Pause) {
  const pauses = pausesOf(content)
  const at = pauses.findIndex(
    (other) => other.atSeconds === pause.atSeconds && other.durationSeconds === pause.durationSeconds,
  )
  return at < 0 ? content : withPlayback(content, { pauses: pauses.filter((_, index) => index !== at) })
}

/** Where the game stood still while the broadcast ran: at a second of its clock, for so long of the video. */
export function PauseRows({ desk }: { desk: GameDesk }) {
  const { entry, chapter, editable } = desk
  const pauses = pausesOf(entry.content)
  if (!pauses.length && !editable) return null
  // Each change is made to the game as it is when it is written, so two within one save do not undo each other.
  const write = (text: string, pause: Pause, added: boolean) =>
    desk.record({
      text,
      apply: (content) => (added ? withPause : withoutPause)(content, pause),
      revert: (content) => (added ? withoutPause : withPause)(content, pause),
    })
  return (
    <div role="group" aria-label="Tạm dừng">
      {pauses.length ? (
        pauses.map((pause, index) => (
          <Row
            key={`${pause.atSeconds}-${index}`}
            label={index ? "" : "Tạm dừng"}
            value={
              <>
                {chapter.live ? (
                  <button
                    type="button"
                    className="esp-gt-time"
                    aria-label={`Tới chỗ tạm dừng lúc ${formatClock(pause.atSeconds)}`}
                    onClick={() => desk.seekGame(pause.atSeconds)}
                  >
                    {formatClock(pause.atSeconds)}
                  </button>
                ) : (
                  formatClock(pause.atSeconds)
                )}
                <span>dừng {formatClock(pause.durationSeconds)}</span>
              </>
            }
            acts={
              editable && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-label="Xóa đoạn tạm dừng"
                  onClick={() => void write(`Đã xóa đoạn tạm dừng lúc ${formatClock(pause.atSeconds)}`, pause, false)}
                >
                  Xóa
                </Button>
              )
            }
          />
        ))
      ) : (
        <Row label="Tạm dừng" value={<span className="esp-gt-none">Không có</span>} />
      )}
      {editable && chapter.live && (
        <PauseForm
          desk={desk}
          onAdd={(pause) =>
            write(
              `Đã ghi tạm dừng lúc ${formatClock(pause.atSeconds)}, dừng ${formatClock(pause.durationSeconds)}`,
              pause,
              true,
            )
          }
        />
      )}
    </div>
  )
}

/**
 * A pause taken from the video: where the game stopped and where it ran again. The first take fills the stop, the
 * second the restart and adds the pause at once; typed positions are added with a button that comes with them.
 */
function PauseForm({ desk, onAdd }: { desk: GameDesk; onAdd: (pause: Pause) => Promise<boolean> }) {
  const { chapter } = desk
  const now = () => desk.markNow() ?? gameToVideo(chapter.sync, 0) ?? 0
  const outside = (second: number) => second < chapter.start || (chapter.ended && second > chapter.end)
  // Both fields stay empty until a position is taken or typed: one filled when the tool opened would be stale by the
  // time the pause ends. The field the take button fills shows, faint, the position it would take.
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const shown = usePlayheadValue(desk.playhead, (second) => (outside(second) ? "" : formatClock(Math.floor(second))))
  const begin = parseClock(from)
  const end = parseClock(to)
  const badBegin = !!from.trim() && (begin === null || outside(begin))
  const badEnd = (value: number | null) => value === null || (begin !== null && value <= begin)
  const ready = begin !== null && end !== null && !badBegin && !badEnd(end)
  const add = async (until: number | null = end) => {
    if (begin === null || until === null) return
    const atSeconds = Math.round(videoToGame(chapter.sync, begin) ?? 0)
    if (!(await onAdd({ atSeconds, durationSeconds: until - begin }))) return
    setFrom("")
    setTo("")
  }
  const taking = from.trim() ? "to" : "from"
  const take = () => {
    const second = now()
    if (taking === "from") return setFrom(formatClock(second))
    setTo(formatClock(second))
    if (!badBegin && !badEnd(second)) void add(second)
  }
  const field = (value: string, set: (value: string) => void, label: string, bad: boolean, hint: boolean) => (
    <Input
      value={value}
      onChange={(event) => set(event.target.value)}
      className="esp-num h-8 w-20 px-1 text-center"
      inputMode="numeric"
      placeholder={hint ? shown : undefined}
      aria-label={label}
      aria-invalid={bad}
    />
  )
  return (
    <div className="esp-gt-row">
      <div className="esp-gt-line col-span-full py-1">
        <span>Từ</span>
        {field(from, setFrom, "Mốc video bắt đầu tạm dừng", badBegin, taking === "from")}
        <span>đến</span>
        {field(to, setTo, "Mốc video tiếp tục ván", !!to.trim() && badEnd(end), taking === "to")}
        {/* The position goes where one is still missing; the second one adds the pause. */}
        <Button type="button" size="xs" variant="secondary" onClick={take}>
          {taking === "to" ? "Lấy lúc chạy lại" : "Lấy lúc dừng"}
        </Button>
        {/* Typed positions are added here; taken ones were added by the second take. */}
        {!!to.trim() && (
          <Button type="button" size="xs" variant="secondary" disabled={!ready} onClick={() => void add()}>
            Thêm
          </Button>
        )}
      </div>
    </div>
  )
}
