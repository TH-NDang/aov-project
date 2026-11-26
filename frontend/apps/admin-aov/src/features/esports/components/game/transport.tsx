import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Captions,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Youtube,
} from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { NativeSelect } from "@/components/native-select"
import { formatClock, parseClock } from "@/lib/clock"
import { phaseWords, placeAt } from "../../model/playback-place"
import type { Playhead } from "../../model/playhead"
import type { GameChapter } from "../../model/series-vod"
import { useMouseList } from "../series/mouse-list"
import { TransportMenu, YOUTUBE_ROW, YOUTUBE_ROW_WHY, youtubeLabel } from "./transport-menu"
import { usePlayheadValue } from "./use-playhead"
import { isSilent, otherSound, rateLabel, RATES, type Sound } from "./use-video-settings"
import "./transport.css"

/** Width the row is drawn for until it has been measured. */
const UNMEASURED = 800

export type TransportProps = {
  playhead: Playhead
  chapters: GameChapter[]
  /** The game on screen, to say so when it has no place in the video yet. */
  focusedGameId?: string | null
  duration: number | null
  live: boolean
  playing: boolean
  canPlay: boolean
  sound: Sound
  onSound: (sound: Sound) => void
  rate: number
  onRate: (rate: number) => void
  youtubeControls: boolean
  onYoutubeControls: (shown: boolean) => void
  youtubeUrl: (second: number) => string
  fullscreen: boolean
  onFullscreen: (() => void) | null
  onToggle: () => void
  onSeek: (second: number) => void
  onStep: (direction: 1 | -1) => void
}

/** A control of the row: an icon or a short text, named for screen readers and under the pointer with its key. */
function Key({
  label,
  hint = label,
  shortcut,
  pressed,
  onClick,
  children,
}: {
  label: string
  hint?: string
  shortcut?: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="esp-transport-key"
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      title={shortcut ? `${hint} (${shortcut})` : hint}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** The only plain video time of the screen; pressed, it takes the time to go to. */
function Time({ playhead, duration, live, onSeek }: TransportProps) {
  const second = usePlayheadValue(playhead, Math.floor)
  const [typed, setTyped] = useState<string | null>(null)
  const wanted = typed === null ? null : parseClock(typed)
  if (typed !== null)
    return (
      <Input
        autoFocus
        className="ml-1 h-8 w-26 flex-none px-2 font-bold tabular-nums"
        aria-label="Mốc cần tới"
        aria-invalid={wanted === null || undefined}
        value={typed}
        onFocus={(event) => event.target.select()}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={() => setTyped(null)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== "Escape") return
          event.preventDefault()
          event.stopPropagation()
          if (event.key === "Enter" && wanted === null) return
          setTyped(null)
          if (event.key === "Enter" && wanted !== null) onSeek(Math.min(wanted, duration ?? wanted))
        }}
      />
    )
  return (
    <button
      type="button"
      className="esp-transport-time"
      aria-label={`Vị trí ${formatClock(second)}, bấm để gõ mốc cần tới`}
      title="Bấm để gõ mốc cần tới"
      onClick={() => setTyped(formatClock(second))}
    >
      <b>{formatClock(second)}</b>
      {live ? <small data-live>Trực tiếp</small> : duration !== null && <small>/ {formatClock(duration)}</small>}
    </button>
  )
}

/** Where the video is, with the name of the game before the tab and what it shows there after it. */
function placeWords({ chapters, focusedGameId }: Pick<TransportProps, "chapters" | "focusedGameId">, second: number) {
  if (!chapters.length) return ""
  const place = placeAt(chapters, second)
  if (place.kind !== "between") return `Ván ${place.chapter.number}\t${phaseWords(place)}`
  const only = chapters.length === 1 ? chapters[0] : undefined
  const focused = chapters.find((chapter) => chapter.gameId === focusedGameId) ?? only
  if (focused && !focused.synced) return `Ván ${focused.number}\tchưa đặt mốc`
  const { next } = place
  return next ? `\tNgoài ván, ván ${next.number} sau ${formatClock(next.from - second)}` : "\tNgoài ván"
}

function PlaceWords(props: TransportProps) {
  const text = usePlayheadValue(props.playhead, (second) => placeWords(props, Math.floor(second)))
  const [game, words] = text.split("\t")
  return (
    <span className="esp-transport-place" data-between={!game || undefined} title={text.replace("\t", " ").trim()}>
      {game && <b>{game} </b>}
      {words}
    </span>
  )
}

function YoutubeLink({ playhead, youtubeUrl }: TransportProps) {
  const second = usePlayheadValue(playhead, Math.floor)
  return (
    <a
      className="esp-transport-key"
      href={youtubeUrl(second)}
      target="_blank"
      rel="noreferrer"
      aria-label={youtubeLabel(second)}
      title={youtubeLabel(second)}
    >
      <Youtube size={16} />
    </a>
  )
}

/**
 * The one row that drives the video. Each control stands here once; where the row is narrow the last ones move into its
 * own menu, never to a second place on the screen.
 */
export function Transport(props: TransportProps) {
  const { playhead, duration, playing, sound, youtubeControls, fullscreen, onFullscreen } = props
  const row = useRef<HTMLDivElement>(null)
  const speeds = useMouseList()
  const [width, setWidth] = useState(UNMEASURED)
  useEffect(() => {
    const element = row.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => setWidth(element.clientWidth || UNMEASURED))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const jump = (seconds: number) =>
    props.onSeek(Math.min(duration ?? Number.POSITIVE_INFINITY, Math.max(0, playhead.get() + seconds)))
  const silent = isSilent(sound)
  const steps = width >= 480

  return (
    <div ref={row} className="esp-transport" role="toolbar" aria-label="Điều khiển video">
      {steps && (
        <Key label="Mốc trước" shortcut="[" onClick={() => props.onStep(-1)}>
          <SkipBack size={16} />
        </Key>
      )}
      <Key label="Lùi 10 giây" shortcut="J" onClick={() => jump(-10)}>
        −10
      </Key>
      <button
        type="button"
        className="esp-transport-play"
        aria-label={playing ? "Tạm dừng" : "Phát"}
        aria-keyshortcuts="Space"
        title={playing ? "Tạm dừng (Space)" : "Phát (Space)"}
        disabled={!props.canPlay}
        onClick={props.onToggle}
      >
        {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <Key label="Tới 10 giây" shortcut="L" onClick={() => jump(10)}>
        +10
      </Key>
      {steps && (
        <Key label="Mốc sau" shortcut="]" onClick={() => props.onStep(1)}>
          <SkipForward size={16} />
        </Key>
      )}
      <Time {...props} />
      <PlaceWords {...props} />
      <span className="esp-transport-end">
        {steps && (
          <Key label={silent ? "Bật tiếng" : "Tắt tiếng"} shortcut="M" onClick={() => props.onSound(otherSound(sound))}>
            {silent ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Key>
        )}
        {width >= 700 && (
          <input
            type="range"
            className="esp-transport-volume"
            min={0}
            max={100}
            value={sound.muted ? 0 : sound.volume}
            aria-label="Âm lượng"
            title="Âm lượng"
            onChange={(event) => props.onSound({ volume: Number(event.target.value), muted: false })}
          />
        )}
        {steps && (
          <NativeSelect
            value={props.rate}
            aria-label="Tốc độ phát"
            title="Tốc độ phát"
            className="h-8 shrink-0 border-0 bg-transparent px-1.5 text-sm font-medium shadow-none hover:bg-accent dark:bg-transparent"
            {...speeds.handlers}
            onChange={(event) => {
              props.onRate(Number(event.target.value))
              event.target.blur()
            }}
          >
            {RATES.map((value) => (
              <option key={value} value={value}>
                {rateLabel(value)}
              </option>
            ))}
          </NativeSelect>
        )}
        {width < 600 ? (
          <TransportMenu {...props} steps={steps} />
        ) : (
          <>
            <Key
              label={YOUTUBE_ROW}
              hint={YOUTUBE_ROW_WHY}
              pressed={youtubeControls}
              onClick={() => props.onYoutubeControls(!youtubeControls)}
            >
              <Captions size={16} />
            </Key>
            <YoutubeLink {...props} />
            {onFullscreen && (
              <Key label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"} shortcut="F" onClick={onFullscreen}>
                {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </Key>
            )}
          </>
        )}
      </span>
    </div>
  )
}
