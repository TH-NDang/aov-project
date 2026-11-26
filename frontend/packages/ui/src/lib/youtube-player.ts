export type YouTubeState = "OPENING" | "PLAYING" | "PAUSED" | "WAITING" | "ENDED"
export type YouTubeFailure = "FORBIDDEN" | "GONE" | "BLOCKED" | "FAILED"
export type YouTubePlayer = {
  load(videoId: string, second: number): void
  seek(second: number): void
  play(): void
  pause(): void
  time(): number | null
  rate(): number
  muted(): boolean
  mute(on: boolean): void
  focus(): void
  destroy(): void
}
export type YouTubeOptions = {
  videoId: string
  second: number
  /** What the frame is called for a screen reader. */
  title: string
  language?: string
  onState(state: YouTubeState): void
  onFailure(failure: YouTubeFailure): void
  onAutoplayBlocked(): void
}

/** What is used of a player of YouTube's IFrame API. */
type ApiPlayer = {
  loadVideoById(video: { videoId: string; startSeconds?: number }): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  getPlayerState(): number
  getPlaybackRate(): number
  isMuted(): boolean
  mute(): void
  unMute(): void
  getIframe(): HTMLIFrameElement
  destroy(): void
}
type Api = { Player: new (element: HTMLElement, options: Record<string, unknown>) => ApiPlayer }
type ApiPage = { YT?: Partial<Api>; onYouTubeIframeAPIReady?: () => void }

const API = "https://www.youtube.com/iframe_api"
const FRAME_HOST = "https://www.youtube-nocookie.com"
/** Milliseconds a player may take to be ready. */
const READY = 12_000

const STATES: Record<number, YouTubeState> = {
  [-1]: "OPENING",
  0: "ENDED",
  1: "PLAYING",
  2: "PAUSED",
  3: "WAITING",
  5: "OPENING",
}
const FAILURES: Record<number, YouTubeFailure> = {
  100: "GONE",
  101: "FORBIDDEN",
  150: "FORBIDDEN",
  153: "FORBIDDEN",
}

// Not declared on Window: another app that loads the API by itself declares its own part of it there.
const page = () => window as unknown as ApiPage
const api = (): Api | null => (page().YT?.Player ? (page().YT as Api) : null)

let loading: Promise<Api> | null = null

/** Loads YouTube's script once per page; a script that could not be loaded is asked for again the next time. */
function loadApi(): Promise<Api> {
  const loaded = api()
  if (loaded) return Promise.resolve(loaded)
  loading ??= new Promise<Api>((resolve, reject) => {
    const before = page().onYouTubeIframeAPIReady
    page().onYouTubeIframeAPIReady = () => {
      before?.()
      const own = api()
      if (own) resolve(own)
      else reject(new Error("YouTube's player API is not there"))
    }
    const script = document.createElement("script")
    script.src = API
    script.async = true
    script.onerror = () => {
      script.remove()
      reject(new Error("YouTube's player API could not be loaded"))
    }
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

/** The script has begun but never came to its end: without its trace a later try loads it again. */
function forgetApi() {
  if (api()) return
  loading = null
  // The script declares it with `var`, so it cannot be deleted; where it is empty the script begins afresh.
  page().YT = undefined
}

/**
 * Opens a video in an element of its own inside `host`, with YouTube's own controls and from a second on; from second 0
 * a live stream plays its live edge. Commands that come before the player is ready are kept until then.
 */
export function openYouTube(host: HTMLElement, options: YouTubeOptions): YouTubePlayer {
  let player: ApiPlayer | null = null
  let gone = false
  /** Where it goes once it is ready: to a second of its video, or into a video that is loaded. */
  let place: { videoId: string; second: number; load: boolean } | null = null
  let playing: boolean | null = null
  let quiet: boolean | null = null
  let videoId = options.videoId
  let discard = () => {}

  const mount = document.createElement("div")
  host.replaceChildren(mount)

  const tell = (state: YouTubeState | undefined) => {
    if (state && !gone) options.onState(state)
  }
  const fail = (failure: YouTubeFailure) => {
    window.clearTimeout(timer)
    if (!gone) options.onFailure(failure)
  }
  const timer = window.setTimeout(() => {
    fail("BLOCKED")
    forgetApi()
  }, READY)

  function catchUp(ready: ApiPlayer) {
    if (place?.load) loadInto(ready, place.videoId, place.second)
    else if (place) ready.seekTo(place.second, true)
    if (quiet != null) setQuiet(ready, quiet)
    if (playing === true) ready.playVideo()
    if (playing === false) ready.pauseVideo()
  }

  function create({ Player }: Api) {
    if (gone) return
    const opened = new Player(mount, {
      videoId: options.videoId,
      host: FRAME_HOST,
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
        origin: window.location.origin,
        ...(options.language ? { hl: options.language } : {}),
        ...(options.second >= 1 ? { start: Math.floor(options.second) } : {}),
      },
      events: {
        onReady: () => {
          if (gone) return
          window.clearTimeout(timer)
          player = opened
          // Its title attribute becomes the name of the video, which YouTube's script writes there.
          opened.getIframe().setAttribute("aria-label", options.title)
          tell("OPENING")
          // It may have begun to play before it said that it is ready.
          const state = STATES[opened.getPlayerState()]
          if (state !== "OPENING") tell(state)
          if (!gone) catchUp(opened)
        },
        onStateChange: ({ data }: { data: number }) => tell(STATES[data]),
        onError: ({ data }: { data: number }) => fail(FAILURES[data] ?? "FAILED"),
        onAutoplayBlocked: () => {
          if (!gone) options.onAutoplayBlocked()
        },
      },
    })
    discard = () => opened.destroy()
  }

  loadApi().then(create, () => fail("BLOCKED"))

  return {
    load(id, second) {
      videoId = id
      if (player) loadInto(player, id, second)
      else place = { videoId: id, second, load: true }
    },
    seek(second) {
      if (player) player.seekTo(second, true)
      else place = { videoId, second, load: !!place?.load }
    },
    play() {
      if (player) player.playVideo()
      else playing = true
    },
    pause() {
      if (player) player.pauseVideo()
      else playing = false
    },
    time() {
      // The API answers 0 for a video that has not begun.
      if (!player || STATES[player.getPlayerState()] === "OPENING") return null
      return player.getCurrentTime()
    },
    rate: () => player?.getPlaybackRate() ?? 1,
    muted: () => player?.isMuted() ?? quiet ?? false,
    mute(on) {
      if (player) setQuiet(player, on)
      else quiet = on
    },
    focus: () => player?.getIframe().focus(),
    destroy() {
      if (gone) return
      gone = true
      window.clearTimeout(timer)
      discard()
      player = null
      // YouTube puts the element it was given back in place of its frame.
      host.replaceChildren()
    },
  }
}

function loadInto(player: ApiPlayer, videoId: string, second: number) {
  player.loadVideoById(second >= 1 ? { videoId, startSeconds: second } : { videoId })
}

function setQuiet(player: ApiPlayer, on: boolean) {
  if (on) player.mute()
  else player.unMute()
}
