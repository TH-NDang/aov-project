export type YTPlayer = {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  loadVideoById(video: { videoId: string; startSeconds: number }): void
  cueVideoById(video: { videoId: string; startSeconds: number }): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getVideoLoadedFraction?(): number
  mute?(): void
  unMute?(): void
  setVolume?(volume: number): void
  setPlaybackRate?(rate: number): void
  destroy(): void
}
type YTNamespace = { Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer }
type YTEvents = {
  onReady(event: { target: YTPlayer }): void
  onStateChange(event: { data: number }): void
  onError(event: { data: number }): void
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

/** States of the player, as its API numbers them. */
export const UNSTARTED = -1
export const PLAYING = 1
export const PAUSED = 2
export const BUFFERING = 3
export const CUED = 5

/** How long the API script may take before the player counts as blocked. */
const API_TIMEOUT_MS = 12_000

let apiPromise: Promise<YTNamespace> | null = null

/** Loads the official player API once; a failed load may be tried again. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const timer = window.setTimeout(() => reject(new Error("YouTube player API timed out")), API_TIMEOUT_MS)
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

/**
 * Makes a player in the place of an element. It loads without autoplay, so the timeline can use the video's actual
 * duration, and without YouTube's keys, which would be taken twice.
 */
export const createYouTubePlayer = (
  YT: YTNamespace,
  element: HTMLElement,
  { videoId, start, controls }: { videoId: string; start: number; controls: boolean },
  events: YTEvents,
) =>
  new YT.Player(element, {
    videoId,
    host: "https://www.youtube-nocookie.com",
    width: "100%",
    height: "100%",
    playerVars: {
      start,
      autoplay: 0,
      controls: controls ? 1 : 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      rel: 0,
      playsinline: 1,
    },
    events,
  })
