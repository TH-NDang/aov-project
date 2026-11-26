import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react"
import { Link2, Youtube } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { MatchPlayer } from "../components/game/match-player"
import { Transport } from "../components/game/transport"
import { VideoProblemNote } from "../components/game/video-problem"
import { MatchTimeline } from "../components/series/timeline/match-timeline"
import { roundName } from "../components/series/studio-head"
import type { RetimeTarget } from "../model/broadcast-timeline"
import { retimeChange } from "../model/retime"
import { chapterAt } from "../model/series-vod"
import type { TimelineRow } from "../model/track-layout"
import { youtubeWatchUrl } from "../model/vod"
import type { Studio } from "./match-studio"

/** Below this width, or on a window this low, the track of a compact screen is folded. */
const FOLD_WIDTH = 640
const LOW_WINDOW = "(max-height: 559.98px)"

/** Whether the watch column has no room for the track. */
function useNarrow(column: RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const element = column.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry!.contentRect.width
      setNarrow((width > 0 && width < FOLD_WIDTH) || !!window.matchMedia?.(LOW_WINDOW).matches)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [column])
  return narrow
}

/**
 * While a mark that can be moved is pressed, the video follows it into whatever game lies under it: the desk stays on
 * the game of the mark until the button is let go, so the drop is written to that game.
 */
function useMarkHold(onMoving: (moving: boolean) => void) {
  const release = useRef<(() => void) | null>(null)
  useEffect(() => () => release.current?.(), [])
  return (event: PointerEvent<HTMLElement>) => {
    if ((event.button ?? 0) !== 0 || !(event.target instanceof Element) || !event.target.closest("[data-movable]"))
      return
    release.current?.()
    const end = () => {
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
      release.current = null
      onMoving(false)
    }
    // These listeners come before those of the mark itself, so the drop that follows them still finds the desk held.
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
    release.current = end
    onMoving(true)
  }
}

/** The row in the place of a video: takes the link of one while recording, else says there is none. */
function LinkRow({ studio }: { studio: Studio }) {
  const { link, linking } = studio
  if (!studio.editable)
    return (
      <div className="esp-linkrow type-body text-muted-foreground">
        <Youtube size={18} aria-hidden />
        Trận chưa có video.{studio.access.canWrite && " Bật Ghi để gắn video."}
      </div>
    )
  return (
    <form
      className="esp-linkrow type-body"
      onSubmit={(event) => {
        event.preventDefault()
        if (linking && !studio.attaching) studio.attachVideo(link, "match")
      }}
    >
      <span className="esp-linkrow-label">
        <Youtube size={18} aria-hidden /> Trận chưa có video
      </span>
      <Input
        value={link}
        onChange={(event) => studio.setLink(event.target.value)}
        placeholder="https://www.youtube.com/watch?v=…"
        aria-label="Liên kết YouTube của trận"
        aria-invalid={!!link && !linking}
        className="h-9 w-full max-w-md min-w-0 flex-1"
      />
      <Button type="submit" variant={linking ? "default" : "outline"} disabled={!linking || studio.attaching}>
        <Link2 aria-hidden /> Gắn video
      </Button>
      {!!link && !linking && (
        <span className="type-meta text-destructive" role="alert">
          Chỉ nhận liên kết YouTube (watch, youtu.be, live).
        </span>
      )}
    </form>
  )
}

/** The video of the match: its picture, the row that drives it and the timeline of everything recorded on it. */
export function StudioWatch({
  studio,
  onRoom,
}: {
  studio: Studio
  /** The part of a compact screen that is left under the video. */
  onRoom: (room: HTMLElement | null) => void
}) {
  const { recording, editable, settings, compact, views, activeId, say } = studio
  const { chapters, focused, playhead, player, videoId, seek, problem } = recording
  const [youtubeControls, setYoutubeControls] = useState(false)
  const column = useRef<HTMLElement>(null)
  const narrow = useNarrow(column)
  const gameId = focused?.gameId ?? null
  const youtubeUrl = (second: number) => youtubeWatchUrl(videoId ?? "", second)

  // A moment is recorded in the game its second belongs to, which comes on the desk for it.
  const createAt = (row: TimelineRow, second: number) => {
    const chapter = chapterAt(chapters, second)
    if (!chapter?.live || second < chapter.start) return say("Chỗ này chưa nằm trong ván nào đã vào trận.")
    const open = () => {
      seek(second)
      studio.onForm(
        { kind: row === "SPINE" ? "NOTE" : "KILL", at: second, side: row === "SPINE" ? undefined : row },
        chapter.gameId,
      )
    }
    if (chapter.gameId !== gameId) studio.chooseGame(chapter.gameId, open)
    else open()
  }
  // A drop is answered by the function of the press, which may be older than the desk: the game is asked of the desk.
  const retime = (target: RetimeTarget, second: number) => {
    const chapter = chapters.find((candidate) => candidate.gameId === target.gameId)
    if (!chapter) return
    if (studio.desk.current?.entry.id !== target.gameId)
      return say(`Không dời được mốc của ván ${chapter.number}: ván này không còn ở khung ghi.`)
    // The video went where the mark was dropped; that is no choice of another game.
    recording.keepGame(second)
    const change = retimeChange(chapter, views[target.gameId], target, second)
    if (change) void studio.actions.current?.record(change)
  }
  const holdMark = useMarkHold(studio.onMoving)

  if (!videoId)
    return (
      <section className="esp-watch" aria-label="Video">
        <LinkRow studio={studio} />
      </section>
    )
  return (
    <section ref={column} className="esp-watch" aria-label="Video" onPointerDownCapture={holdMark}>
      <div className="esp-view">
        <div className={problem ? "hidden" : "min-h-0 min-w-0"}>
          <MatchPlayer
            ref={player}
            videoId={videoId}
            startAt={recording.startAt}
            title={roundName(studio.series.content)}
            sound={settings.sound}
            rate={settings.rate}
            youtubeControls={youtubeControls}
            onTime={recording.onTime}
            onDuration={recording.onDuration}
            onPlayingChange={recording.onPlaying}
            onProblem={recording.onProblem}
          />
        </div>
        {problem && (
          <VideoProblemNote problem={problem} youtubeUrl={youtubeUrl(Math.floor(playhead.get()))} editable={editable} />
        )}
      </div>
      <Transport
        playhead={playhead}
        chapters={chapters}
        focusedGameId={gameId}
        duration={recording.videoDuration}
        live={recording.live}
        playing={recording.playing}
        canPlay={!problem}
        sound={settings.sound}
        onSound={settings.setSound}
        rate={settings.rate}
        onRate={settings.setRate}
        youtubeControls={youtubeControls}
        onYoutubeControls={setYoutubeControls}
        youtubeUrl={youtubeUrl}
        fullscreen={studio.fullscreen}
        onFullscreen={studio.onFullscreen}
        onToggle={recording.toggle}
        onSeek={seek}
        onStep={studio.step}
      />
      <MatchTimeline
        playhead={playhead}
        duration={recording.duration}
        chapters={chapters}
        flags={recording.flags}
        events={studio.events}
        views={views}
        focusedGameId={gameId}
        activeId={activeId && gameId ? `${gameId}|${activeId}` : null}
        issues={studio.issues}
        lookups={studio.lookups}
        label={focused ? `Dòng thời gian ván ${focused.number}` : "Dòng thời gian video"}
        heroIcon={studio.heroIcon}
        playing={recording.playing}
        foldable={compact && narrow}
        fit={studio.fit}
        editing={
          editable && focused
            ? { gameId: focused.gameId, canCreate: focused.live, onCreate: createAt, onRetime: retime }
            : undefined
        }
        onSeek={(second) => {
          studio.onActive(null)
          seek(second)
        }}
        onSelect={studio.selectEvent}
      />
      {compact && <span ref={onRoom} className="esp-room" aria-hidden="true" />}
    </section>
  )
}
