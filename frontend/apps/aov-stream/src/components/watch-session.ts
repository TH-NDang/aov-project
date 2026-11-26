import { openYouTube } from "@aov/ui/lib/youtube-player"
import { createWatch, type Watch, type WatchPorts } from "../lib/watch-store"
import type { WatchMatch } from "../lib/watch-types"
import { streamLocale, streamText } from "./stream-locale"

const KEY = "aov-stream-watch"

const frameTitle = ({ teams: { A, B } }: WatchMatch) =>
  streamText(`Video: ${A.name} gặp ${B.name}`, `Video: ${A.name} vs ${B.name}`)

let frameHost: HTMLElement | null = null

const browser: WatchPorts = {
  open(host, { match, video, second, onState, onFailure, onAutoplayBlocked }) {
    frameHost = host
    return openYouTube(host, {
      videoId: video,
      second,
      title: frameTitle(match),
      language: streamLocale(),
      onState,
      onFailure,
      onAutoplayBlocked,
    })
  },
  read() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  write(text) {
    try {
      localStorage.setItem(KEY, text)
    } catch {
      /* Without storage a match simply starts afresh next time. */
    }
  },
  every(milliseconds, run) {
    const timer = setInterval(run, milliseconds)
    return () => clearInterval(timer)
  },
  now: () => performance.now(),
}

/** The one video of the app, bound to this browser. */
export const watch: Watch = createWatch(browser)

// The player is kept from one match to the next, so its frame is named again when the match changes.
let named = watch.view().match
watch.subscribe(() => {
  const { match } = watch.view()
  if (match === named) return
  named = match
  const frame = frameHost?.querySelector("iframe")
  if (match && frame) frame.setAttribute("aria-label", frameTitle(match))
})

window.addEventListener("pagehide", watch.keep)
