import { useRef, useState } from "react"
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
import type { GameChapter } from "../../model/series-vod"
import { youtubeWatchUrl } from "../../model/vod"
import type { GameDesk } from "../game-desk"
import { ClockRow, PauseRows } from "./game-clock-rows"
import { Row } from "./game-tool-row"
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

/**
 * Where the game is in its video: its four edges, the clock on screen that places its 0:00 and finds its pauses, its
 * length where it has no place in a video, and the pauses. `chapters` are the games of the match on the same video.
 */
export function GameTimesRows({ desk, chapters }: { desk: GameDesk; chapters: Placed }) {
  const { videoId, chapter, editable, view } = desk
  return (
    <>
      {videoId !== null &&
        TIMES.map(([time, label]) => <TimeRow key={time} desk={desk} time={time} label={label} chapters={chapters} />)}
      {videoId !== null && editable && (
        <ClockRow
          desk={desk}
          refusal={(second) => refusalAt(desk, chapters, "live", second)}
          onStart={async (second) => {
            const refusal = refusalAt(desk, chapters, "live", second)
            if (refusal) desk.say(refusal)
            return !refusal && writeTime(desk, "live", second)
          }}
        />
      )}
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
