import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { useWatch } from "../../../components/use-watch"
import { watch } from "../../../components/watch-session"
import { clock } from "../../../lib/tournament-model"
import { leftOf } from "../../../lib/watch-cuts"
import { shareOf, watchHref } from "../../../lib/watch-routes"
import type { WatchMatch } from "../../../lib/watch-types"
import { lengthRows, lengthWords } from "../../../lib/watch-words"
import { RoomIcon } from "./watch-icon"
import { WatchLengths } from "./watch-lengths"
import { WatchShortcuts } from "./watch-shortcuts"
import "./watch-tools.css"

/** What is left of a length reads in seconds from here on. */
const NEAR = 600

/** Copies the address that plays from here; of a stream on now, whose seconds its recording will not have, its page. */
export function CopyLink({ match, words = false }: { match: WatchMatch; words?: boolean }) {
  const { text } = useStreamLocale()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = () => {
    const at = match.live && match.story.level !== "TIMED" ? {} : shareOf(watch.view())
    const address = `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${watchHref(match.seriesId, at)}`
    void navigator.clipboard
      ?.writeText(address)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }
  const done = text("Đã sao chép liên kết", "Link copied")
  return (
    <>
      <RoomIcon
        icon={copied ? "check" : "link"}
        label={copied ? done : text("Sao chép liên kết", "Copy link")}
        words={words}
        onClick={copy}
      />
      <span className="sr-only" role="status">
        {copied && done}
      </span>
    </>
  )
}

/** Opens over the companion, above what opened it; Escape and a press elsewhere close it, and the focus goes back. */
function Panel({ opener, children }: { opener: RefObject<HTMLElement | null>; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  // Before what stands in the panel takes the focus.
  useLayoutEffect(() => {
    const own = opener.current
    const before = own?.offsetParent ? own : (document.activeElement as HTMLElement | null)
    return () => before?.focus({ preventScroll: true })
  }, [opener])
  useEffect(() => {
    panel.current?.scrollIntoView({ block: "nearest" })
    const outside = (event: PointerEvent) => {
      const at = event.target as Node
      if (!panel.current?.contains(at) && !opener.current?.contains(at)) watch.show(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      watch.show(null)
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [opener])
  return (
    <div ref={panel} className="tn-room-panel">
      {children}
    </div>
  )
}

/** How much is watched and what of it is left; opens the choice. */
function Length({ match, button }: { match: WatchMatch; button: RefObject<HTMLButtonElement | null> }) {
  const { text } = useStreamLocale()
  const length = useWatch((view) => view.length)
  const open = useWatch((view) => view.panel === "LENGTH")
  const over = useWatch((view) => view.place?.state === "AFTER")
  const name = lengthRows(match, text).find((row) => row.length === length)?.name
  const cut = length === "all" || match.cuts.missing.length ? null : match.cuts[length]
  const left = useWatch((view) =>
    cut && view.video ? Math.ceil(leftOf(cut, match.story, view.video, view.second)) : null,
  )
  const words = !over && !!left && (left < NEAR ? clock(left) : lengthWords(left, text))
  return (
    <button
      ref={button}
      type="button"
      className="tn-room-length"
      aria-expanded={open}
      onClick={() => watch.show("LENGTH")}
    >
      <b>{name ?? text("Nguyên video", "The full video")}</b>
      {words && <span>{text(`còn ${words}`, `${words} left`)}</span>}
      <StreamIcon name="chevronDown" size={14} />
    </button>
  )
}

/** How the match is watched: how much of it, a link to this place, the keys. Their panels open over the companion. */
export function WatchTools({ match, stacked, bare }: { match: WatchMatch; stacked: boolean; bare: boolean }) {
  const { text } = useStreamLocale()
  const panel = useWatch((view) => view.panel)
  const failed = useWatch((view) => view.failure != null)
  const length = useRef<HTMLButtonElement>(null)
  const keys = useRef<HTMLButtonElement>(null)
  const offered = !failed && lengthRows(match, text).length > 0
  return (
    <div className="tn-room-tools" data-bare={bare || undefined} data-stacked={stacked || undefined}>
      {!bare && offered && <Length match={match} button={length} />}
      {!bare && (
        <span className="tn-room-tools-end">
          <CopyLink match={match} words={stacked} />
          <RoomIcon
            ref={keys}
            icon="keyboard"
            size={20}
            className="tn-room-keys"
            label={text("Phím tắt", "Shortcuts")}
            shortcut="?"
            aria-expanded={panel === "KEYS"}
            onClick={() => watch.show("KEYS")}
          />
        </span>
      )}
      {panel === "LENGTH" && offered && (
        <Panel opener={length}>
          <WatchLengths match={match} />
        </Panel>
      )}
      {panel === "KEYS" && (
        <Panel opener={keys}>
          <WatchShortcuts match={match} />
        </Panel>
      )}
    </div>
  )
}
