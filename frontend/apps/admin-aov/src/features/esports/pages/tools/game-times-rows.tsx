import { useRef, useState, type ReactNode } from "react"
import type { GameContent } from "@aov/community-contracts"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@aov/ui/components/dropdown-menu"
import { Input } from "@aov/ui/components/input"
import { formatClock, parseClock } from "@/lib/clock"
import { DockMenuContent } from "../../components/game/dock-menu"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { readDraft } from "../../model/draft"
import {
  atVideo,
  clearChange,
  clearRefusal,
  endChange,
  lengthChange,
  lengthRefusal,
  timeChange,
  timeRefusal,
  type GameTime,
} from "../../model/game-times"
import { chapterAfter, insideOther } from "../../model/next-step"
import { placeAt } from "../../model/playback-place"
import { chapterClock, type GameChapter } from "../../model/series-vod"
import { withPlayback } from "../../model/timeline-io"
import { gameToVideo, videoToGame, youtubeWatchUrl } from "../../model/vod"
import type { GameDesk } from "../game-desk"
import "./game-tool.css"

/** The games of the match on the video on screen; null while they are read. */
type Placed = GameChapter[] | null

/**
 * Why a mark may not stand at a video second; null when it may. The rules of the next step at the foot: no new phase
 * inside another game, and nothing that reaches the game after that second.
 */
function refusalAt(desk: GameDesk, chapters: Placed, time: GameTime, second: number) {
  const { entry, chapter } = desk
  const inside = chapters && time !== "end" ? insideOther(placeAt(chapters, second), chapter.gameId) : null
  const next = chapters ? chapterAfter(chapters, chapter, second) : null
  return inside ?? timeRefusal(entry.content, chapter, time, second, next)
}

const TIMES: readonly [GameTime, string][] = [
  ["draftStart", "Bắt đầu cấm chọn"],
  ["lock", "Chốt đội hình"],
  ["live", "Vào trận"],
  ["end", "Kết thúc"],
]

const secondOf = ({ entry: { content }, chapter }: GameDesk, time: GameTime): number | null => {
  switch (time) {
    case "draftStart":
      return readDraft(content).startSecond ?? null
    case "lock":
      return readDraft(content).lockedSecond ?? null
    case "live":
      return content.sourceTimestampSeconds ?? null
    case "end":
      return chapter.live && chapter.ended ? Math.round(chapter.end) : null
  }
}

/** Writes a mark of the game, with the winner's name in the words of its end; false when it was refused. */
function writeTime(desk: GameDesk, time: GameTime, second: number) {
  const { content } = desk.entry
  const url = desk.videoId ? youtubeWatchUrl(desk.videoId) : undefined
  return desk.record(
    time === "end"
      ? endChange(content, desk.chapter, second, null, (side) => desk.view.sides[side].team.shortName)
      : timeChange(content, desk.chapter, time, second, url),
  )
}

function Row({ label, value, acts, under }: { label: string; value: ReactNode; acts?: ReactNode; under?: ReactNode }) {
  return (
    <div className="esp-gt-row" role="group" aria-label={label}>
      <span>{label}</span>
      <span className="esp-gt-value">{value}</span>
      <span className="esp-gt-acts">{acts}</span>
      {under && <div className="esp-gt-under">{under}</div>}
    </div>
  )
}

/**
 * Where the game is in its video: its four edges, the way to find its 0:00 from the clock on screen, its length where it
 * has no place in a video, and the pauses. `chapters` are the games of the match on the same video.
 */
export function GameTimesRows({ desk, chapters }: { desk: GameDesk; chapters: Placed }) {
  const { videoId, chapter, editable, view } = desk
  return (
    <>
      {videoId !== null &&
        TIMES.map(([time, label]) => <TimeRow key={time} desk={desk} time={time} label={label} chapters={chapters} />)}
      {videoId !== null && editable && <ClockRow desk={desk} chapters={chapters} />}
      {!chapter.live &&
        (editable ? (
          <LengthRow key={view.durationSeconds ?? "none"} desk={desk} />
        ) : (
          <Row
            label="Thời lượng"
            value={
              view.durationSeconds === null ? (
                <span className="esp-gt-none">Chưa ghi</span>
              ) : (
                formatClock(view.durationSeconds)
              )
            }
          />
        ))}
      <PauseRows desk={desk} />
    </>
  )
}

function TimeRow({ desk, time, label, chapters }: { desk: GameDesk; time: GameTime; label: string; chapters: Placed }) {
  const { entry, chapter, editable } = desk
  const [typed, setTyped] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const now = usePlayheadValue(desk.playhead, (second) => Math.floor(second))
  const second = secondOf(desk, time)
  const refused = (at: number) => refusalAt(desk, chapters, time, at)

  const take = () => {
    const at = desk.markNow() ?? now
    const refusal = refused(at)
    if (refusal) desk.say(refusal)
    else void writeTime(desk, time, at)
  }
  const typedSecond = typed === null ? null : parseClock(typed)
  const typedRefusal =
    typed === null || !typed.trim() ? null : typedSecond === null ? "Gõ mốc dạng 1:02:30." : refused(typedSecond)
  const save = () => {
    if (typedSecond === null || typedRefusal) return
    void writeTime(desk, time, typedSecond)
    setTyped(null)
  }
  const clear = () => {
    const refusal = clearRefusal(entry.content, time)
    if (refusal) desk.say(refusal)
    else void desk.record(clearChange(entry.content, time))
  }
  const refusal = editable ? refused(now) : null

  return (
    <Row
      label={label}
      value={
        <>
          {second === null ? (
            <span className="esp-gt-none">Chưa đặt</span>
          ) : (
            <button
              type="button"
              className="esp-gt-time"
              aria-label={`Tới lúc ${label.toLocaleLowerCase("vi")}, ${atVideo(second)}`}
              onClick={() => desk.seekVideo(second)}
            >
              {atVideo(second)}
            </button>
          )}
          {time === "end" && chapter.live && desk.view.durationSeconds !== null && (
            <span>{formatClock(desk.view.durationSeconds)}</span>
          )}
        </>
      }
      acts={
        editable && (
          <>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              className="aria-disabled:opacity-50"
              aria-label={`Lấy ${atVideo(now)} làm lúc ${label.toLocaleLowerCase("vi")}`}
              aria-disabled={refusal ? true : undefined}
              title={refusal ?? undefined}
              onClick={take}
            >
              Lấy {atVideo(now)}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Thêm thao tác với mốc ${label.toLocaleLowerCase("vi")}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DockMenuContent
                align="end"
                onCloseAutoFocus={(event) => {
                  // The menu would give the focus back to its button, and the mark typed next would fire keys.
                  if (!field.current) return
                  event.preventDefault()
                  field.current.focus()
                }}
              >
                <DropdownMenuItem onSelect={() => setTyped(second === null ? "" : formatClock(second))}>
                  Gõ mốc…
                </DropdownMenuItem>
                {second !== null && <DropdownMenuItem onSelect={clear}>Bỏ mốc</DropdownMenuItem>}
              </DockMenuContent>
            </DropdownMenu>
          </>
        )
      }
      under={
        typed !== null && (
          <form
            className="esp-gt-line"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <Input
              ref={field}
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return
                event.stopPropagation()
                setTyped(null)
              }}
              className="esp-num h-8 w-24"
              inputMode="numeric"
              placeholder="1:02:30"
              aria-label={`Mốc ${label.toLocaleLowerCase("vi")}`}
              aria-invalid={!!typedRefusal}
            />
            <Button type="submit" size="sm" variant="outline" disabled={typedSecond === null || !!typedRefusal}>
              Lưu
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTyped(null)}>
              Hủy
            </Button>
            {typedRefusal && (
              <span className="text-xs text-destructive" role="alert">
                {typedRefusal}
              </span>
            )}
          </form>
        )
      }
    />
  )
}

/**
 * Finds 0:00 from the clock the game shows on screen, wherever in the game the video stands. The field holds what was
 * typed; until then it shows, faint, the clock the recorded 0:00 gives at the playhead, which goes on with the video.
 */
function ClockRow({ desk, chapters }: { desk: GameDesk; chapters: Placed }) {
  const { chapter, playhead } = desk
  const [clock, setClock] = useState("")
  const shown = usePlayheadValue(playhead, (second) =>
    chapter.live ? formatClock(chapterClock(chapter, second)) : "phút:giây",
  )
  const second = clock.trim() ? parseClock(clock) : null
  const sync = () => {
    const now = desk.markNow()
    if (second === null || now === null) return
    const paused = chapter.sync.pauses
      .filter((pause) => pause.atSeconds < second)
      .reduce((total, pause) => total + pause.durationSeconds, 0)
    const start = Math.max(0, Math.round(now - second - paused))
    const refusal = refusalAt(desk, chapters, "live", start)
    if (refusal) return desk.say(refusal)
    // The typed clock belongs to the moment it was typed; once written it would only grow stale.
    void writeTime(desk, "live", start).then((saved) => saved && setClock(""))
  }
  return (
    <Row
      label="Đồng hồ game đang hiện"
      value={
        <Input
          value={clock}
          onChange={(event) => setClock(event.target.value)}
          className="esp-num h-8 w-20 text-center"
          inputMode="numeric"
          placeholder={shown}
          aria-label="Đồng hồ game đang hiện"
          aria-invalid={!!clock.trim() && second === null}
        />
      }
      acts={
        <Button type="button" size="xs" variant="secondary" disabled={second === null} onClick={sync}>
          Khớp giờ vào trận
        </Button>
      }
    />
  )
}

function LengthRow({ desk }: { desk: GameDesk }) {
  const { content } = desk.entry
  const [length, setLength] = useState(content.durationSeconds != null ? formatClock(content.durationSeconds) : "")
  const seconds = parseClock(length)
  const refusal = !length.trim()
    ? null
    : seconds === null
      ? "Gõ thời lượng dạng 18:42."
      : lengthRefusal(content, seconds)
  const changed = seconds !== null && seconds !== (content.durationSeconds ?? null)
  return (
    <Row
      label="Thời lượng"
      value={
        <Input
          value={length}
          onChange={(event) => setLength(event.target.value)}
          className="esp-num h-8 w-20 px-1 text-center placeholder:text-sm"
          inputMode="numeric"
          placeholder="phút:giây"
          aria-label="Thời lượng ván"
          aria-invalid={!!refusal}
        />
      }
      acts={
        <Button
          type="button"
          size="xs"
          variant="secondary"
          disabled={!changed || !!refusal}
          onClick={() => void desk.record(lengthChange(content, seconds!))}
        >
          Lưu
        </Button>
      }
      under={refusal && <span className="text-xs text-destructive">{refusal}</span>}
    />
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

/** Where the broadcast stopped while the game clock held. */
function PauseRows({ desk }: { desk: GameDesk }) {
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

function PauseForm({
  desk,
  onAdd,
}: {
  desk: GameDesk
  onAdd: (pause: { atSeconds: number; durationSeconds: number }) => Promise<boolean>
}) {
  const { chapter } = desk
  const now = () => formatClock(desk.markNow() ?? gameToVideo(chapter.sync, 0))
  const outside = (second: number) => second < chapter.start || (chapter.ended && second > chapter.end)
  // Both fields stay empty until a position is taken or typed: one filled when the tool opened would be stale by the
  // time the pause ends. The field the take button fills shows, faint, the position it would take.
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const shown = usePlayheadValue(desk.playhead, (second) => (outside(second) ? "" : formatClock(Math.floor(second))))
  const begin = parseClock(from)
  const end = parseClock(to)
  const badBegin = !!from.trim() && (begin === null || outside(begin))
  const badEnd = !!to.trim() && (end === null || (begin !== null && end <= begin))
  const ready = begin !== null && end !== null && !badBegin && !badEnd
  const add = async () => {
    if (begin === null || end === null) return
    const atSeconds = Math.round(videoToGame(chapter.sync, begin) ?? 0)
    if (!(await onAdd({ atSeconds, durationSeconds: end - begin }))) return
    setFrom("")
    setTo("")
  }
  const taking = from.trim() ? "to" : "from"
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
        {field(to, setTo, "Mốc video tiếp tục ván", badEnd, taking === "to")}
        {/* The position goes where one is still missing. */}
        <Button
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => (taking === "to" ? setTo(now()) : setFrom(now()))}
        >
          Lấy
        </Button>
        <Button type="button" size="xs" variant="secondary" disabled={!ready} onClick={() => void add()}>
          Thêm
        </Button>
      </div>
    </div>
  )
}
