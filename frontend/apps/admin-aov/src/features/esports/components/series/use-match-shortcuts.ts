import { useEffect, useRef } from "react"
import { formatClock } from "@/lib/clock"
import type { TimelineKind } from "../../model/timeline"
import { VIDEO_MARK } from "../../model/vod"

const SHORTCUT_KINDS: Record<string, TimelineKind> = { k: "KILL", o: "OBJECTIVE", i: "ITEM", n: "NOTE" }

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (!!target.closest("input, textarea, select, [contenteditable=true]") || target.isContentEditable)

/** What the keys of the match page act on, read afresh at every key press. */
export type MatchShortcuts = {
  /** The playhead, in video seconds. */
  at: number
  /** Where the focused game begins on the video (its ban/pick phase), or null without a game. */
  gameFrom: number | null
  hasVideo: boolean
  /** True while recording a game that has gone live, the only time a moment can be recorded. */
  canRecord: boolean
  /** While the composer is open its own fields take the keys. */
  composing: boolean
  seek: (second: number) => void
  step: (direction: 1 | -1) => void
  togglePlayer: () => void
  /** Confirms what a key did beside the transport. */
  say: (text: string) => void
  toggleList: () => void
  compose: (kind: TimelineKind) => void
}

/** The keyboard shortcuts of the match page, listed for the editor in `ShortcutList`. */
export function useMatchShortcuts(shortcuts: MatchShortcuts) {
  const latest = useRef(shortcuts)
  latest.current = shortcuts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = latest.current
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      if (state.composing) return
      const key = event.key.toLowerCase()
      const jump = (seconds: number) => {
        const target = Math.max(0, state.at + seconds)
        state.seek(target)
        state.say(`${seconds < 0 ? "−" : "+"}${Math.abs(seconds)} giây · ${VIDEO_MARK} ${formatClock(target)}`)
      }
      if (key === " " && state.hasVideo) {
        state.togglePlayer()
        state.say("Phát / tạm dừng")
      } else if (key === "arrowleft") jump(event.shiftKey ? -1 : -5)
      else if (key === "arrowright") jump(event.shiftKey ? 1 : 5)
      else if (key === ",") jump(-1)
      else if (key === ".") jump(1)
      else if (key === "j") jump(event.shiftKey ? -30 : -10)
      else if (key === "l") jump(event.shiftKey ? 30 : 10)
      else if (key === "home" && state.gameFrom !== null) {
        state.seek(state.gameFrom)
        state.say(`Về đầu ván · ${VIDEO_MARK} ${formatClock(state.gameFrom)}`)
      } else if (key === "[") state.step(-1)
      else if (key === "]") state.step(1)
      else if (key === "?" || (key === "/" && event.shiftKey)) state.toggleList()
      else if (state.canRecord && (key === "e" || SHORTCUT_KINDS[key])) state.compose(SHORTCUT_KINDS[key] ?? "KILL")
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
