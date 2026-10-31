import { useState } from "react"
import { Clock3, Link2, Pause, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import {
  formatClock,
  gameToVideo,
  parseClock,
  videoToGame,
  youtubeLinkTime,
  youtubeVideoId,
  type VodPause,
} from "../../model/vod"
import { TimeTag, VIDEO_MARK, VideoMark } from "../primitives"

/**
 * Admin controls that tie the game clock to the official broadcast. The usual flow: pause the video
 * anywhere in the game, read the in-game clock on screen and press sync. Once the start is known,
 * pauses and the end of the game are entered as positions in the video, like everything else recorded.
 */
export function VodSyncPanel({
  url,
  startSecond,
  pauses,
  duration,
  gameAt,
  videoNow,
  onChange,
}: {
  url: string
  startSecond: number | null
  pauses: VodPause[]
  duration: number
  gameAt: number
  videoNow: number | null
  onChange: (change: { url?: string; startSecond?: number | null; pauses?: VodPause[]; duration?: number }) => void
}) {
  const sync = { url, startSecond, pauses }
  const synced = startSecond != null
  const nowText = formatClock(videoNow ?? gameToVideo(sync, gameAt) ?? 0)
  const [link, setLink] = useState(url)
  const [clock, setClock] = useState(formatClock(gameAt))
  const [start, setStart] = useState(startSecond == null ? "" : formatClock(startSecond))
  const [pauseFrom, setPauseFrom] = useState(nowText)
  const [pauseTo, setPauseTo] = useState("")
  const [end, setEnd] = useState(synced ? formatClock(gameToVideo(sync, duration)) : "")
  const [length, setLength] = useState(formatClock(duration))
  const clockSecond = parseClock(clock)
  const linkValid = !link.trim() || !!youtubeVideoId(link)

  const from = parseClock(pauseFrom)
  const to = parseClock(pauseTo)
  const pauseValid = startSecond != null && from !== null && to !== null && from >= startSecond && to > from
  const endSecond = parseClock(end)
  const endGame =
    startSecond != null && endSecond !== null && endSecond > startSecond ? videoToGame(sync, endSecond) : null

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

      <div className="grid gap-3 @2xl:grid-cols-2">
        <label className="space-y-1.5">
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
        {synced ? (
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              <VideoMark /> Ván kết thúc tại (mốc video)
            </span>
            <span className="flex gap-2">
              <Input
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="esp-num h-8"
                placeholder="1:20:10"
                aria-invalid={end.trim() !== "" && endGame === null}
              />
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => setEnd(nowText)}
                title="Lấy vị trí video"
              >
                <Clock3 size={13} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!endGame}
                onClick={() => endGame && onChange({ duration: Math.round(endGame) })}
              >
                Lưu
              </Button>
            </span>
            <span className="block text-xs text-muted-foreground">
              {endGame ? (
                <>
                  Thời lượng ván <TimeTag kind="game" seconds={endGame} className="text-foreground" />
                </>
              ) : (
                "Mốc kết thúc phải sau mốc bắt đầu."
              )}
            </span>
          </label>
        ) : (
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">⏱ Thời lượng ván</span>
            <span className="flex gap-2">
              <Input
                value={length}
                onChange={(event) => setLength(event.target.value)}
                className="esp-num h-8"
                placeholder="18:42"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!parseClock(length)}
                onClick={() => onChange({ duration: parseClock(length) ?? duration })}
              >
                Lưu
              </Button>
            </span>
          </label>
        )}
      </div>

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
    </section>
  )
}
