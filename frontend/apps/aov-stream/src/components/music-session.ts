import { openYouTube } from "@aov/ui/lib/youtube-player"
import type { MusicTrack } from "../lib/music-catalog"
import { createMusic, type Music, type MusicPorts } from "../lib/music-store"
import { streamLocale, streamText } from "./stream-locale"
import { watch } from "./watch-session"

const KEY = "aov-stream-music"

const frameTitle = (track: MusicTrack | null) =>
  track ? streamText(`Nhạc: ${track.title} – ${track.artist}`, `Music: ${track.title} – ${track.artist}`) : ""

let frameHost: HTMLElement | null = null

const browser: MusicPorts = {
  open(host, { video, second, onState, onFailure, onAutoplayBlocked }) {
    frameHost = host
    return openYouTube(host, {
      videoId: video,
      second,
      title: frameTitle(music.view().track),
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
      /* Without storage the music simply starts afresh next time. */
    }
  },
  every(milliseconds, run) {
    const timer = setInterval(run, milliseconds)
    return () => clearInterval(timer)
  },
  // One sound at a time: the video of a match stops for the music.
  quiet: () => watch.pause(),
  random: Math.random,
}

/** The music of the app, bound to this browser. */
export const music: Music = createMusic(browser)

// The frame is kept from one track to the next, so it is named again when the track changes.
let named = music.view().track
music.subscribe(() => {
  const { track } = music.view()
  if (track === named) return
  named = track
  frameHost?.querySelector("iframe")?.setAttribute("aria-label", frameTitle(track))
})

// And the music stops for the video of a match.
let matchHeard = false
watch.subscribe(() => {
  const { player } = watch.view()
  const heard = player === "OPENING" || player === "WAITING" || player === "PLAYING"
  if (heard && !matchHeard) music.yieldTo()
  matchHeard = heard
})

window.addEventListener("pagehide", music.keep)
