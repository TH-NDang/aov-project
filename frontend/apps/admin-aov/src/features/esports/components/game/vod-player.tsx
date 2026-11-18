import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react"
import {
  ArrowUpRight,
  Captions,
  ExternalLink,
  GripHorizontal,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Youtube,
} from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { youtubeWatchUrl } from "../../model/vod"
import { formatClock } from "@/lib/clock"
import { usePhoneLayout } from "./floating-panel"
import { NativeSelect } from "@/components/native-select"

type YTPlayer = {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  mute?(): void
  unMute?(): void
  setVolume?(volume: number): void
  setPlaybackRate?(rate: number): void
  destroy(): void
}
type YTNamespace = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer }

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const timer = window.setTimeout(() => reject(new Error("YouTube player API timed out")), 12_000)
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error("YouTube player API unavailable"))
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error("YouTube player API failed to load"))
    }
    document.head.append(script)
  }).catch((error) => {
    apiPromise = null
    throw error
  })
  return apiPromise
}

export type VodPlayerHandle = {
  /** Seeks the official video, queuing the request until the player is ready. */
  seek(videoSecond: number, play?: boolean): void
  toggle(): void
  currentTime(): number | null
}

const PLAYING = 1
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
/** Where the floating player was last dragged to; a per-viewer convenience. */
const POSITION_KEY = "esports:mini-player-position"
const EDGE = 8
const CAPTIONS_SHOW = "Phụ đề: hiện điều khiển của YouTube"
const CAPTIONS_HIDE = "Ẩn điều khiển của YouTube"
const CAPTIONS_WHY =
  "Phụ đề được tắt hoặc bật trong hàng nút của YouTube (nút CC, hoặc nút của tiện ích phụ đề): " +
  "bấm để hiện hàng nút đó"

type Position = { x: number; y: number }

function savedPosition(): Position | null {
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null")
    return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? { x: value.x, y: value.y } : null
  } catch {
    return null
  }
}

function savePosition(position: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position))
  } catch {
    // Without storage the player simply starts from its default corner next time.
  }
}

/**
 * Loads the official player without autoplay so the timeline can use the video's actual duration. YouTube's own
 * controls are off; the bar below the video (never over it) plays, seeks, sets volume, speed and full screen. When the
 * page scrolls past the video it floats and can be dragged by its title bar.
 *
 * Captions are switched inside YouTube's frame, never from this page: the player API and cc_load_policy changed
 * nothing when tried, and text over the video may also come from a subtitle extension of the viewer's browser,
 * whose button sits in YouTube's control row. The captions button therefore brings that row back for a moment.
 */
export const VodPlayer = forwardRef<
  VodPlayerHandle,
  {
    videoId: string
    startAt: number
    title: string
    onTime: (videoSecond: number) => void
    onDuration?: (seconds: number) => void
    onPlayingChange: (playing: boolean) => void
  }
>(function VodPlayer({ videoId, startAt, title, onTime, onDuration, onPlayingChange }, ref) {
  const placeholder = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const ready = useRef(false)
  const pendingSeek = useRef<{ second: number; play: boolean } | null>(null)
  // True from a seek of a video that was never played until its first frame is on screen; see `seekTo`.
  const holdFrame = useRef(false)
  const soundOff = useRef(false)
  const latestStart = useRef(startAt)
  latestStart.current = startAt
  const callbacks = useRef({ onTime, onDuration, onPlayingChange })
  callbacks.current = { onTime, onDuration, onPlayingChange }
  const phone = usePhoneLayout()
  const [failed, setFailed] = useState(false)
  const [scrolledPast, setScrolledPast] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [length, setLength] = useState(0)
  const [scrub, setScrub] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(100)
  const [rate, setRate] = useState(1)
  const [youtubeControls, setYoutubeControls] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [position, setPosition] = useState<Position | null>(savedPosition)
  const latestPosition = useRef(position)
  latestPosition.current = position
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const floating = scrolledPast && !dismissed

  function clamp({ x, y }: Position): Position {
    const rect = box.current?.getBoundingClientRect()
    const width = rect?.width ?? 380
    const height = rect?.height ?? 290
    return {
      x: Math.round(Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - width - EDGE))),
      y: Math.round(Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - height - EDGE))),
    }
  }

  useEffect(() => {
    if (!placeholder.current || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) => {
      const past = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0
      setScrolledPast(past)
      if (!past) setDismissed(false)
    })
    observer.observe(placeholder.current)
    return () => observer.disconnect()
  }, [])

  // Clicking the video moves keyboard focus into the YouTube frame, where page shortcuts no longer arrive. YouTube's
  // own keys are off, so focus is handed straight back; mouse clicks on the video still play and pause it.
  useEffect(() => {
    const onBlur = () =>
      window.setTimeout(() => {
        const active = document.activeElement
        if (active?.tagName === "IFRAME" && host.current?.contains(active)) box.current?.focus({ preventScroll: true })
      }, 0)
    window.addEventListener("blur", onBlur)
    return () => window.removeEventListener("blur", onBlur)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(!!box.current && document.fullscreenElement === box.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  useEffect(() => {
    if (!host.current) return
    let cancelled = false
    let poll = 0
    let lastDuration = 0
    const reportDuration = (current: YTPlayer) => {
      const duration = Math.round(current.getDuration())
      if (Number.isFinite(duration) && duration > 0 && duration !== lastDuration) {
        lastDuration = duration
        setLength(duration)
        callbacks.current.onDuration?.(duration)
      }
    }
    const mount = document.createElement("div")
    host.current.replaceChildren(mount)
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        const initial = pendingSeek.current?.second ?? latestStart.current
        player.current = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: {
            start: Math.max(0, Math.floor(initial)),
            autoplay: 0,
            controls: youtubeControls ? 1 : 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: (event: { target: YTPlayer }) => {
              if (cancelled) return
              ready.current = true
              reportDuration(event.target)
              const seek = pendingSeek.current
              pendingSeek.current = null
              if (seek) {
                event.target.seekTo(seek.second, true)
                if (seek.play) event.target.playVideo()
                else event.target.pauseVideo()
              }
            },
            onStateChange: (event: { data: number }) => {
              if (cancelled) return
              if (event.data === PLAYING && holdFrame.current) {
                // The frame that was asked for is drawn: stop on it, and give the sound back.
                holdFrame.current = false
                player.current?.pauseVideo()
                if (!soundOff.current) player.current?.unMute?.()
                return
              }
              setPlaying(event.data === PLAYING)
              callbacks.current.onPlayingChange(event.data === PLAYING)
            },
          },
        })
        poll = window.setInterval(() => {
          const current = player.current
          if (!ready.current || !current?.getCurrentTime) return
          reportDuration(current)
          // An unstarted/cued player reports zero even when a start position was supplied.
          if (current.getPlayerState() === -1 || current.getPlayerState() === 5) return
          const time = current.getCurrentTime()
          if (!Number.isFinite(time)) return
          setNow(time)
          callbacks.current.onTime(time)
        }, 250)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      ready.current = false
      holdFrame.current = false
      window.clearInterval(poll)
      player.current?.destroy()
      player.current = null
    }
    // The player is created once per video and once more when YouTube's controls are shown or hidden, which only a
    // new player can do; later seeks go through the handle, not `startAt`.
  }, [videoId, youtubeControls])

  soundOff.current = muted
  /** The viewer asked to play while a first frame was awaited: the video simply keeps running, with its sound. */
  const releaseHold = useCallback((current: YTPlayer) => {
    if (!holdFrame.current) return
    holdFrame.current = false
    if (!soundOff.current) current.unMute?.()
  }, [])
  const seekTo = useCallback(
    (second: number, play = false) => {
      const target = Math.max(0, second)
      if (ready.current && player.current) {
        // YouTube starts a video that was never played as soon as it is sought, and draws nothing if it is paused at
        // once. A seek that did not ask to play lets it start without sound and stops it on the first frame, so a
        // marker dragged along the timeline shows the picture there without setting the broadcast running.
        const state = player.current.getPlayerState()
        if (play) releaseHold(player.current)
        else if ((state === -1 || state === 5) && !holdFrame.current) {
          holdFrame.current = true
          player.current.mute?.()
        }
        player.current.seekTo(target, true)
        if (play) player.current.playVideo()
      } else {
        pendingSeek.current = { second: target, play: play || pendingSeek.current?.play === true }
      }
    },
    [releaseHold],
  )
  const toggle = useCallback(() => {
    const current = player.current
    if (!ready.current || !current) {
      pendingSeek.current = { second: pendingSeek.current?.second ?? latestStart.current, play: true }
      return
    }
    releaseHold(current)
    if (current.getPlayerState() === PLAYING) current.pauseVideo()
    else current.playVideo()
  }, [releaseHold])

  // Both helpers only read refs, so the handle stays the same object.
  useImperativeHandle(
    ref,
    () => ({
      seek: seekTo,
      toggle,
      currentTime: () => (ready.current && player.current ? player.current.getCurrentTime() : null),
    }),
    [seekTo, toggle],
  )

  // While dragging, moves are followed on the whole window and the video frame ignores the pointer, so passing over
  // the YouTube iframe or the page below never drops the drag.
  useEffect(() => {
    if (!dragging) return
    const move = (event: globalThis.PointerEvent) => {
      if (drag.current) setPosition(clamp({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }))
    }
    const end = () => {
      drag.current = null
      setDragging(false)
      if (latestPosition.current) savePosition(latestPosition.current)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", end)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", end)
    }
  }, [dragging])

  // Keep a dragged player inside the window when it is resized.
  const dragged = position !== null
  useEffect(() => {
    if (!dragged) return
    const onResize = () => setPosition((current) => (current ? clamp(current) : current))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [dragged])

  if (failed)
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl bg-[var(--esp-ink)] p-6 text-center text-sm text-white/80">
        <Youtube size={28} className="text-destructive" />
        Không tải được trình phát YouTube (có thể bị chặn bởi trình duyệt hoặc mạng).
        <a
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white hover:bg-white/20"
          href={youtubeWatchUrl(videoId, startAt)}
          target="_blank"
          rel="noreferrer"
        >
          Mở trên YouTube <ExternalLink size={13} />
        </a>
      </div>
    )

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, a") || !box.current) return
    const rect = box.current.getBoundingClientRect()
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Synthetic pointers cannot be captured; the window listeners below still follow them.
    }
    setDragging(true)
    event.preventDefault()
  }
  const nudge = (dx: number, dy: number) => {
    const rect = box.current?.getBoundingClientRect()
    const next = clamp({ x: (position?.x ?? rect?.left ?? 0) + dx, y: (position?.y ?? rect?.top ?? 0) + dy })
    setPosition(next)
    savePosition(next)
  }

  const shown = scrub ?? now ?? startAt
  const commitScrub = () => {
    if (scrub === null) return
    seekTo(scrub)
    setScrub(null)
  }
  const control = "grid size-8 shrink-0 place-items-center rounded-md hover:bg-white/15 disabled:opacity-40"

  return (
    <div ref={placeholder} className="relative" data-video-placeholder>
      {/* Reserves the docked size while the player floats, so the page does not jump. */}
      <div className="aspect-video" aria-hidden="true" />
      <div className="h-10" aria-hidden="true" />
      <div
        ref={box}
        tabIndex={-1}
        className={cn(
          "flex flex-col overflow-hidden rounded-xl bg-black text-white outline-none",
          floating
            ? cn(
                "fixed z-50 shadow-2xl ring-1 ring-white/20",
                // At least 200px of video height, as the embedded player requires.
                phone ? "w-[calc(100vw-1rem)] min-w-[356px]" : "w-[380px]",
                !position && (phone ? "top-2 left-2" : "right-4 bottom-4"),
              )
            : "absolute inset-0",
        )}
        style={floating && position ? { left: position.x, top: position.y } : undefined}
        data-floating={floating || undefined}
        aria-label={floating ? "Trình phát video nổi" : undefined}
      >
        <div
          className={cn(
            "flex cursor-grab touch-none items-center gap-2 bg-black/90 px-2 py-1.5 text-xs select-none active:cursor-grabbing",
            !floating && "hidden",
          )}
          role="toolbar"
          tabIndex={floating ? 0 : -1}
          aria-label="Kéo để di chuyển video nổi; Alt + phím mũi tên cũng di chuyển"
          onPointerDown={startDrag}
          onKeyDown={(event) => {
            // Plain arrows stay video shortcuts; Alt + arrows move the floating player.
            if (!event.altKey) return
            const step = event.shiftKey ? 64 : 24
            const delta = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            }[event.key]
            if (!delta) return
            event.preventDefault()
            event.stopPropagation()
            nudge(delta[0]!, delta[1]!)
          }}
        >
          <GripHorizontal size={14} className="shrink-0 opacity-60" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <button
            type="button"
            className="rounded p-1 hover:bg-white/15"
            aria-label="Quay về video lớn"
            title="Quay về video lớn"
            onClick={() => placeholder.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <ArrowUpRight size={16} />
          </button>
          <button
            type="button"
            className="rounded p-1 hover:bg-white/15"
            aria-label="Đóng video nổi"
            onClick={() => setDismissed(true)}
          >
            <X size={16} />
          </button>
        </div>
        <div className={cn("relative", floating && !fullscreen ? "aspect-video" : "min-h-0 flex-1")}>
          <div
            ref={host}
            className={cn("absolute inset-0 [&>iframe]:size-full", dragging && "pointer-events-none")}
            title={title}
          />
        </div>
        <div
          className="flex h-10 shrink-0 items-center gap-0.5 bg-black/90 px-1.5 text-xs"
          aria-label="Điều khiển video"
        >
          <button type="button" className={control} aria-label={playing ? "Tạm dừng" : "Phát"} onClick={toggle}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            className={cn(control, floating && phone && "hidden")}
            aria-label="Lùi 10 giây"
            onClick={() => seekTo(shown - 10, playing)}
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className={cn(control, floating && phone && "hidden")}
            aria-label="Tới 10 giây"
            onClick={() => seekTo(shown + 10, playing)}
          >
            <RotateCw size={15} />
          </button>
          <span className="esp-num shrink-0 px-1 text-xs whitespace-nowrap text-white/85">
            {formatClock(shown)}
            {length > 0 && <span className="text-white/50"> / {formatClock(length)}</span>}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, length)}
            step={1}
            value={Math.min(Math.max(0, Math.round(shown)), Math.max(1, length))}
            disabled={!length}
            aria-label="Vị trí video"
            aria-valuetext={formatClock(shown)}
            className="mx-1 h-1 min-w-10 flex-1 cursor-pointer accent-[var(--esp-gold)]"
            onChange={(event) => setScrub(Number(event.target.value))}
            onPointerUp={commitScrub}
            onKeyUp={commitScrub}
            onBlur={commitScrub}
          />
          <button
            type="button"
            className={control}
            aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
            onClick={() => {
              if (muted) player.current?.unMute?.()
              else player.current?.mute?.()
              setMuted(!muted)
            }}
          >
            {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            aria-label="Âm lượng"
            className={cn("h-1 w-16 cursor-pointer accent-white", floating ? "hidden" : "hidden md:block")}
            onChange={(event) => {
              const next = Number(event.target.value)
              setVolume(next)
              player.current?.setVolume?.(next)
              if (next > 0 && muted) {
                player.current?.unMute?.()
                setMuted(false)
              }
            }}
          />
          <NativeSelect
            value={rate}
            aria-label="Tốc độ phát"
            className="h-7 shrink-0 border-0 bg-transparent px-1 text-xs shadow-none hover:bg-white/15 md:text-xs dark:bg-transparent [&>option]:text-black"
            onChange={(event) => {
              const next = Number(event.target.value)
              setRate(next)
              player.current?.setPlaybackRate?.(next)
            }}
          >
            {RATES.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </NativeSelect>
          <button
            type="button"
            className={cn(control, youtubeControls && "bg-white/20")}
            aria-label={youtubeControls ? CAPTIONS_HIDE : CAPTIONS_SHOW}
            title={youtubeControls ? CAPTIONS_HIDE : CAPTIONS_WHY}
            aria-pressed={youtubeControls}
            onClick={() => {
              // The new player continues where this one is, playing or paused as it was.
              pendingSeek.current = { second: now ?? latestStart.current, play: playing }
              setYoutubeControls(!youtubeControls)
            }}
          >
            <Captions size={16} />
          </button>
          {youtubeControls && (
            <span className={cn("shrink-0 px-1 text-xs text-white/85", floating ? "hidden" : "hidden md:inline")}>
              Tắt hoặc bật phụ đề ở hàng nút trên video
            </span>
          )}
          <button
            type="button"
            className={control}
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            onClick={() => {
              if (fullscreen) void document.exitFullscreen?.()
              else void box.current?.requestFullscreen?.()
            }}
          >
            {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
          <a
            className={cn(control, floating && "hidden")}
            href={youtubeWatchUrl(videoId, shown)}
            target="_blank"
            rel="noreferrer"
            aria-label="Xem trên YouTube"
            title="Xem trên YouTube"
          >
            <Youtube size={16} className="text-destructive" />
          </a>
        </div>
      </div>
    </div>
  )
})
