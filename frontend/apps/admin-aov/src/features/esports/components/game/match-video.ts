import type { Sound } from "./use-video-settings"
import { BUFFERING, CUED, PAUSED, PLAYING, UNSTARTED, type YTPlayer } from "./youtube-api"

/** Why there is no picture: the script did not load, the channel forbids other sites, or the video is gone. */
export type VideoProblem = "blocked" | "forbidden" | "gone"

export type MatchPlayerHandle = {
  /** Seeks the official video, queuing the request until the player is ready. */
  seek(videoSecond: number, play?: boolean): void
  toggle(): void
  /** Null while the player tells no time of its video: before it is ready, and before its first frame. */
  currentTime(): number | null
}

/** What is wanted of the video, and who is told what becomes of it. */
export type MatchVideoProps = {
  videoId: string
  startAt: number
  sound: Sound
  rate: number
  onTime: (second: number) => void
  onDuration?: (seconds: number) => void
  onPlayingChange: (playing: boolean) => void
  onProblem?: (problem: VideoProblem | null) => void
}

/** Readings of one length after which a video counts as recorded; a live one grows long before. */
const STEADY_READINGS = 20
/** A video that grew by more than this is live, however long it stands still; YouTube corrects a length by a second. */
const LIVE_GROWTH = 3
/** Readings after which a video that was asked for counts as loaded even if the player did not say so. */
const SWITCH_READINGS = 8
/** Milliseconds without a first frame after which a player is stuck; mostly that frame comes within one or two seconds. */
const STUCK_MS = 6000
/** Readings that came meanwhile: a page that was too busy to read was too busy to hear of a frame. */
const STUCK_READINGS = 4
/** YouTube covers the picture with other videos once one ends, so the player stops this many seconds before. */
const BEFORE_END = 1

/** Where the video is wanted, and whether it runs from there. */
type Wish = { second: number; play: boolean }

const holding = (videoId: string) => ({ videoId, time: null as number | null, first: 0, duration: 0, steady: 0 })

const problemOf = (code: number): VideoProblem =>
  code === 101 || code === 150 ? "forbidden" : code === 100 || code === 2 ? "gone" : "blocked"

/**
 * The video of a match through the players that show it one after another. What is asked of it before a player can do
 * it waits, and the next player goes on where the one before it was. `props` answers what is wanted now; `replace` has
 * a new player made in the place of the present one.
 */
export function createMatchVideo(props: () => MatchVideoProps, replace: () => void) {
  let player: YTPlayer | null = null
  let ready = false
  /** The video runs for the viewer, also while it waits for data. */
  let playing = false
  /** What was asked of a player that is not ready, or does not hold the wanted video yet. */
  let pending: Wish | null = null
  /** What the player holds: the video, its last reading, its first and last length, and how long that stayed. */
  let held = holding("")
  /** From the request for another video until the player reports on it: it still tells the old video's time. */
  let switching = false
  /** The player drew a frame of the video it holds. Until then it reports zero whatever was asked of it. */
  let drawn = false
  /** What is wanted of a video that was started and drew nothing yet; see `begin`. */
  let start: (Wish & { since: number; readings: number }) | null = null
  /** The second that video runs from when it is asked to play. */
  let startsAt = 0
  /** The player stands in the place of one that was stuck on the same video. */
  let replaced = false

  /** The sound of the viewer, but none of a video that only runs until it shows its first frame. */
  function applySound(current: YTPlayer) {
    const { volume, muted } = props().sound
    current.setVolume?.(volume)
    if (muted || start?.play === false) current.mute?.()
    else current.unMute?.()
  }

  function applySettings(current: YTPlayer) {
    applySound(current)
    // Loading a video puts the speed back to 1.
    if (props().rate !== 1) current.setPlaybackRate?.(props().rate)
  }

  function hasDrawn(current: YTPlayer) {
    const state = current.getPlayerState()
    drawn ||= state === PLAYING || state === PAUSED
    return drawn
  }

  /** The second a recorded video is stopped at; a live one has no end yet. */
  function lastSecond(current: YTPlayer) {
    const recorded = held.steady >= STEADY_READINGS && held.duration - held.first <= LIVE_GROWTH
    return recorded ? current.getDuration() - BEFORE_END : Number.POSITIVE_INFINITY
  }

  /**
   * Starts a video that has drawn nothing yet. Sought before its first frame a player may stay black for good, and
   * paused it does, so it only ever plays: from the second it was made for, or loaded at another one, and without sound
   * when it is to stand still. What is wanted beyond that is done at its first frame.
   */
  function begin(current: YTPlayer, second: number, play: boolean) {
    const under = start
    start = { ...(under ?? { since: Date.now(), readings: 0 }), second, play: play || under?.play === true }
    applySound(current)
    if (under && !play) return
    if (under || Math.abs(second - startsAt) < 1) return current.playVideo()
    startsAt = Math.floor(second)
    current.loadVideoById({ videoId: held.videoId, startSeconds: startsAt })
  }

  function seek(second: number, play = false) {
    const target = Math.max(0, second)
    if (!ready || !player || switching || held.videoId !== props().videoId) {
      pending = { second: target, play: play || pending?.play === true }
      return
    }
    const reachable = Math.min(target, lastSecond(player))
    if (!hasDrawn(player)) return begin(player, reachable, play)
    player.seekTo(reachable, true)
    if (play) player.playVideo()
  }

  function toggle() {
    if (!ready || !player || switching) pending = { second: pending?.second ?? props().startAt, play: true }
    else if (!hasDrawn(player)) begin(player, start?.second ?? startsAt, true)
    else if (playing) player.pauseVideo()
    else player.playVideo()
  }

  /** Puts the wanted video into the player, playing or waiting as the one before it was. */
  function load(current: YTPlayer) {
    const second = Math.max(0, pending?.second ?? props().startAt)
    const play = playing || start?.play === true || pending?.play === true
    const video = { videoId: props().videoId, startSeconds: Math.floor(second) }
    pending = null
    held = holding(video.videoId)
    switching = true
    drawn = false
    replaced = false
    startsAt = video.startSeconds
    start = play ? { second, play, since: Date.now(), readings: 0 } : null
    applySound(current)
    props().onProblem?.(null)
    if (play) current.loadVideoById(video)
    else current.cueVideoById(video)
  }

  /** The player reports on the video it was asked for: what was wanted meanwhile is done now. */
  function switched(current: YTPlayer, state: number) {
    switching = false
    held.steady = 0
    applySettings(current)
    const wish = pending
    pending = null
    if (wish) seek(wish.second, wish.play)
    // A cued video shows YouTube's poster; the picture at its second is what the editor came for.
    else if (state === CUED) seek(props().startAt)
  }

  /** The first frame is drawn: the video goes where it was wanted meanwhile, and stands still unless it was to run. */
  function arrive(current: YTPlayer, wish: Wish) {
    start = null
    replaced = false
    const off = Math.abs(wish.second - startsAt)
    if (wish.play ? off >= 1 : off > 0) current.seekTo(Math.min(wish.second, lastSecond(current)), true)
    if (!wish.play) current.pauseVideo()
    applySettings(current)
  }

  function tellPlaying(now: boolean) {
    playing = now
    props().onPlayingChange(now)
  }

  function readDuration(current: YTPlayer) {
    const duration = Math.round(current.getDuration())
    if (!Number.isFinite(duration) || duration <= 0) return
    if (duration === held.duration) held.steady++
    else {
      held.first ||= duration
      held.duration = duration
      held.steady = 0
      props().onDuration?.(duration)
    }
  }

  /**
   * A player that draws nothing although it was started is made again: no call to it was seen to help. Where a new one
   * draws nothing either, YouTube's poster comes back in the place of a black picture.
   */
  function watchStart(current: YTPlayer) {
    if (!start || ++start.readings < STUCK_READINGS || Date.now() - start.since < STUCK_MS) return
    // Data that arrives slowly, or not at all, would only arrive later in a new player.
    if ((current.getVideoLoadedFraction?.() ?? 0) > 0 || navigator.onLine === false) return
    if (!replaced) {
      replaced = true
      return replace()
    }
    replaced = false
    start = null
    applySound(current)
    current.cueVideoById({ videoId: held.videoId, startSeconds: startsAt })
  }

  const handle: MatchPlayerHandle = {
    seek,
    toggle,
    currentTime: () => (ready && player && !switching && hasDrawn(player) ? player.getCurrentTime() : null),
  }

  return {
    handle,

    /** Makes a player that holds the wanted video; `make` gets the second it is to start from. */
    open(make: (video: { videoId: string; start: number }) => YTPlayer) {
      const { videoId, startAt } = props()
      held = holding(videoId)
      startsAt = Math.max(0, Math.floor(pending?.second ?? startAt))
      player = make({ videoId, start: startsAt })
    },

    /** Leaves the player to the next one, which continues where it is, playing or paused as it was. */
    close() {
      if (ready)
        pending = start
          ? { second: start.second, play: start.play }
          : { second: held.time ?? props().startAt, play: playing }
      ready = false
      switching = false
      drawn = false
      start = null
      player?.destroy()
      player = null
    },

    onReady(current: YTPlayer) {
      ready = true
      props().onProblem?.(null)
      applySettings(current)
      if (held.videoId !== props().videoId) return load(current)
      readDuration(current)
      const wish = pending
      pending = null
      if (wish) seek(wish.second, wish.play)
    },

    onState(state: number) {
      if (!player) return
      if (switching) {
        // A player that is given another video first pauses the one it was playing.
        if (state === UNSTARTED || state === PAUSED) return
        switched(player, state)
      }
      if (state === PLAYING || state === PAUSED) {
        drawn = true
        const wish = start
        if (wish) arrive(player, wish)
        // It only ran to this frame and is stopped on it.
        if (wish && !wish.play && state === PLAYING) return
      }
      // On the way to a frame, its first one or the next, the video runs or stands as it did before.
      if (state !== UNSTARTED && state !== BUFFERING) tellPlaying(state === PLAYING)
    },

    onError(code: number) {
      switching = false
      start = null
      tellPlaying(false)
      props().onProblem?.(problemOf(code))
    },

    /** Takes one reading of the player. */
    read() {
      if (!ready || !player?.getCurrentTime) return
      const state = player.getPlayerState()
      if (switching) {
        // A player that was cued before tells nothing new when it is cued again.
        if (++held.steady > SWITCH_READINGS) switched(player, state)
        return
      }
      readDuration(player)
      if (!hasDrawn(player)) return watchStart(player)
      if (state === UNSTARTED || state === CUED) return
      const time = player.getCurrentTime()
      if (!Number.isFinite(time)) return
      if (state === PLAYING && time >= lastSecond(player)) player.pauseVideo()
      held.time = time
      props().onTime(time)
    },

    /** Another video may be wanted. */
    showWanted() {
      if (ready && player && held.videoId !== props().videoId) load(player)
    },

    setSound() {
      if (ready && player) applySound(player)
    },

    setRate() {
      if (ready) player?.setPlaybackRate?.(props().rate)
    },
  }
}
