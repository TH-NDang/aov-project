import type { VodPause } from "@aov/community-contracts"
import { useEffect, useRef, useState } from "react"
import type { Side } from "@aov/community-contracts"
import { Clock3, Crown, Flag, Link2, Pause, Plus, RefreshCw, Save, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import type { TeamView } from "../../model/game-view"
import { gameToVideo, videoToGame, youtubeLinkTime, youtubeVideoId } from "../../model/vod"
import { formatClock, parseClock } from "@/lib/clock"
import { TeamLogo, TimeTag, VIDEO_MARK, VideoMark } from "../primitives"

/** What the panel can change; every key is optional so one save carries only what was edited. */
export type VodSyncChange = {
  url?: string
  startSecond?: number | null
  pauses?: VodPause[]
  duration?: number
  winner?: Side | null
}

/**
 * Admin controls that tie the game clock to the official broadcast, from its start to its end. The usual flow: pause
 * the video anywhere in the game, read the in-game clock on screen and press sync. Once the start is known, pauses
 * and the end of the game are entered as positions in the video, like everything else recorded. The winner is
 * recorded with the end, so closing a game needs no panel of its own.
 */
export function VodSyncPanel({
  url,
  startSecond,
  pauses,
  recordedDuration,
  gameAt,
  videoNow,
  number,
  teams,
  winner,
  focus,
  onChange,
}: {
  url: string
  startSecond: number | null
  pauses: VodPause[]
  /** The recorded length of the game, or null while it has no end yet. */
  recordedDuration: number | null
  gameAt: number
  videoNow: number | null
  number: number
  teams: Record<Side, TeamView>
  winner: Side | null
  /** Opens the panel on the end of the game, for someone who came to close it. */
  focus?: "end"
  onChange: (change: VodSyncChange) => void
}) {
  const sync = { url, startSecond, pauses }
  const synced = startSecond != null
  const nowText = formatClock(videoNow ?? gameToVideo(sync, gameAt) ?? 0)
  const [link, setLink] = useState(url)
  const [clock, setClock] = useState(formatClock(gameAt))
  const [start, setStart] = useState(startSecond == null ? "" : formatClock(startSecond))
  const [pauseFrom, setPauseFrom] = useState(nowText)
  const [pauseTo, setPauseTo] = useState("")
  // A game without a recorded end ends where the video is now, which is where its last second is being watched.
  const [end, setEnd] = useState(
    synced ? (recordedDuration != null ? formatClock(gameToVideo(sync, recordedDuration)) : nowText) : "",
  )
  const [length, setLength] = useState(recordedDuration != null ? formatClock(recordedDuration) : "")
  const [won, setWon] = useState<Side | null>(winner)
  const ending = useRef<HTMLFieldSetElement>(null)
  useEffect(() => {
    if (focus === "end") ending.current?.scrollIntoView?.({ block: "nearest" })
  }, [focus])
  const clockSecond = parseClock(clock)
  const linkValid = !link.trim() || !!youtubeVideoId(link)

  const from = parseClock(pauseFrom)
  const to = parseClock(pauseTo)
  const pauseValid = startSecond != null && from !== null && to !== null && from >= startSecond && to > from
  const endSecond = parseClock(end)
  const endGame =
    startSecond != null && endSecond !== null && endSecond > startSecond ? videoToGame(sync, endSecond) : null
  const typedLength = parseClock(length)
  // What the end block would record: the game clock at the end mark, or the typed length without a video.
  const closing = synced ? (endGame ? Math.round(endGame) : null) : typedLength && typedLength > 0 ? typedLength : null
  const endTyped = synced ? end.trim() !== "" : length.trim() !== ""
  const endChanged = closing !== null && closing !== recordedDuration

  return (
    <section className="space-y-4 p-4 text-sm">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="esp-vod-link">
          Video YouTube chính thức
        </label>
        <div className="flex gap-2">
          <Input
            id="esp-vod-link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-invalid={!linkValid}
            className="h-8"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!linkValid || link.trim() === url}
            onClick={() => {
              const fromLink = youtubeLinkTime(link)
              onChange({ url: link.trim(), ...(fromLink !== null ? { startSecond: fromLink } : {}) })
              if (fromLink !== null) setStart(formatClock(fromLink))
            }}
          >
            <Link2 size={14} /> Dùng link
          </Button>
        </div>
        {!linkValid && <p className="text-xs text-destructive">Chỉ nhận link YouTube (watch, youtu.be, live).</p>}
        <p className="text-xs text-muted-foreground">
          Link có <code>?t=</code> sẽ được lấy làm mốc bắt đầu ván. Video không bị sao chép, chỉ nhúng trình phát.
        </p>
      </div>

      <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
        <p className="text-xs font-medium">Đồng bộ nhanh</p>
        <p className="text-xs text-muted-foreground">
          Dừng video ở bất kỳ đâu trong ván, nhập đồng hồ đang hiện trên màn hình game rồi bấm Đồng bộ.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={clock}
            onChange={(event) => setClock(event.target.value)}
            className="esp-num h-8 w-20 text-center"
            aria-label="Đồng hồ trong game"
            inputMode="numeric"
          />
          <Button
            size="sm"
            disabled={videoNow === null || clockSecond === null}
            onClick={() => {
              if (videoNow === null || clockSecond === null) return
              const paused = pauses
                .filter((pause) => pause.atSeconds < clockSecond)
                .reduce((total, pause) => total + pause.durationSeconds, 0)
              const next = Math.max(0, Math.round(videoNow - clockSecond - paused))
              onChange({ startSecond: next })
              setStart(formatClock(next))
            }}
          >
            <RefreshCw size={14} /> Đồng bộ tại {VIDEO_MARK} {videoNow === null ? "…" : formatClock(videoNow)}
          </Button>
          {videoNow === null && <span className="text-xs text-muted-foreground">Phát video trước để lấy vị trí.</span>}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          <VideoMark /> Ván bắt đầu tại (mốc video)
        </span>
        <span className="flex gap-2">
          <Input
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="esp-num h-8"
            placeholder="1:02:30"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={start.trim() !== "" && parseClock(start) === null}
            onClick={() => onChange({ startSecond: start.trim() ? parseClock(start) : null })}
          >
            Lưu
          </Button>
        </span>
      </label>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Pause size={13} /> Tạm dừng kỹ thuật trong video
        </p>
        {pauses.map((pause, index) => {
          const begin = gameToVideo(sync, pause.atSeconds)
          return (
            <div key={index} className="esp-num flex flex-wrap items-center gap-2 text-xs">
              {begin !== null && (
                <span className="rounded bg-muted px-2 py-1">
                  <TimeTag kind="video" seconds={begin} /> –{" "}
                  <TimeTag kind="video" seconds={begin + pause.durationSeconds} />
                </span>
              )}
              <span className="text-muted-foreground">
                dừng {formatClock(pause.durationSeconds)} lúc <TimeTag kind="game" seconds={pause.atSeconds} /> trong
                ván
              </span>
              <button
                type="button"
                className="ml-auto grid size-6 place-items-center rounded hover:bg-muted hover:text-destructive"
                aria-label="Xóa đoạn tạm dừng"
                onClick={() => onChange({ pauses: pauses.filter((_, position) => position !== index) })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
        {synced ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>
              Dừng từ <VideoMark />
            </span>
            <Input
              value={pauseFrom}
              onChange={(event) => setPauseFrom(event.target.value)}
              className="esp-num h-7 w-20 text-center"
              aria-label="Mốc video bắt đầu tạm dừng"
              aria-invalid={pauseFrom.trim() !== "" && (from === null || from < (startSecond ?? 0))}
            />
            <span>
              đến <VideoMark />
            </span>
            <Input
              value={pauseTo}
              onChange={(event) => setPauseTo(event.target.value)}
              className="esp-num h-7 w-20 text-center"
              aria-label="Mốc video tiếp tục ván"
              placeholder={nowText}
              aria-invalid={pauseTo.trim() !== "" && !pauseValid}
            />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              className="h-7"
              onClick={() => setPauseTo(nowText)}
              title="Lấy vị trí video"
            >
              <Clock3 size={13} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={!pauseValid}
              onClick={() => {
                if (!pauseValid) return
                const atSeconds = Math.round(videoToGame(sync, from) ?? 0)
                onChange({ pauses: [...pauses, { atSeconds, durationSeconds: to - from }] })
                setPauseTo("")
              }}
            >
              <Plus size={13} /> Thêm
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Đặt mốc bắt đầu ván trước khi ghi tạm dừng.</p>
        )}
      </div>

      {/* Closing the game: where it ends and who won, saved together. */}
      <fieldset ref={ending} className="space-y-3 rounded-lg border p-3" data-game-end>
        <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold">
          <Flag size={13} /> Kết thúc ván {number}
        </legend>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Đội thắng ván ${number}`}>
          {(["BLUE", "RED"] as const).map((side) => (
            <button
              key={side}
              type="button"
              data-side={side}
              aria-pressed={won === side}
              onClick={() => setWon(won === side ? null : side)}
              className={cn(
                "flex items-center gap-2 rounded-xl border border-l-4 border-l-[var(--side)] px-3 py-2 text-left transition",
                won === side ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]" : "hover:bg-muted",
              )}
            >
              <TeamLogo team={teams[side]} size={26} />
              <span className="min-w-0 flex-1 truncate font-semibold">{teams[side].name}</span>
              {won === side && <Crown size={15} className="text-[var(--esp-gold)]" aria-label="thắng" />}
            </button>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {synced ? (
              <>
                <VideoMark /> Ván kết thúc tại (mốc video)
              </>
            ) : (
              "⏱ Thời lượng ván"
            )}
          </span>
          <span className="flex gap-2">
            {synced ? (
              <>
                <Input
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                  className="esp-num h-8"
                  placeholder="1:20:10"
                  aria-invalid={endTyped && closing === null}
                />
                <Button size="sm" variant="outline" type="button" onClick={() => setEnd(nowText)}>
                  <Clock3 size={13} /> Hiện tại ({VIDEO_MARK} {nowText})
                </Button>
              </>
            ) : (
              <Input
                value={length}
                onChange={(event) => setLength(event.target.value)}
                className="esp-num h-8"
                placeholder="18:42"
                aria-invalid={endTyped && closing === null}
              />
            )}
          </span>
          <span className="block text-xs text-muted-foreground">
            {closing !== null ? (
              <>
                Thời lượng ván <TimeTag kind="game" seconds={closing} className="text-foreground" />
              </>
            ) : endTyped ? (
              <span className="text-destructive">
                {synced ? "Mốc kết thúc phải sau mốc bắt đầu." : "Thời lượng chưa đúng dạng phút:giây."}
              </span>
            ) : (
              "Để trống nếu chưa rõ; đội thắng vẫn được lưu."
            )}
          </span>
        </label>
        <div className="flex justify-end">
          <Button
            size="sm"
            type="button"
            disabled={(endTyped && closing === null) || (!endChanged && won === winner)}
            onClick={() =>
              onChange({
                ...(endChanged ? { duration: closing! } : {}),
                ...(won !== winner ? { winner: won } : {}),
              })
            }
          >
            <Save size={14} /> Lưu kết thúc ván
          </Button>
        </div>
      </fieldset>
    </section>
  )
}
