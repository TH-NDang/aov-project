import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react"
import { createMatchVideo, type MatchPlayerHandle, type MatchVideoProps } from "./match-video"
import { createYouTubePlayer, loadYouTubeApi } from "./youtube-api"

const POLL_MS = 250

/**
 * Clicking the video moves keyboard focus into the YouTube frame, where page shortcuts no longer arrive. YouTube's own
 * keys are off, so focus is handed straight back; mouse clicks on the video still play and pause it.
 */
function useFocusBack(box: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onBlur = () =>
      window.setTimeout(() => {
        const active = document.activeElement
        if (active?.tagName === "IFRAME" && box.current?.contains(active)) box.current.focus({ preventScroll: true })
      }, 0)
    window.addEventListener("blur", onBlur)
    return () => window.removeEventListener("blur", onBlur)
  }, [box])
}

/**
 * The official player, filling the box it stands in. It loads without autoplay so the timeline can use the video's
 * actual duration, and YouTube's own controls are off: the transport plays, seeks, sets volume, speed and full screen.
 * Another video is loaded into the same player, so choosing a game never takes the frame out of the page.
 *
 * Captions are switched inside YouTube's frame, never from this page: the player API and cc_load_policy changed
 * nothing when tried, and text over the video may also come from a subtitle extension of the viewer's browser,
 * whose button sits in YouTube's control row. `youtubeControls` brings that row back, which only a new player can do.
 */
export const MatchPlayer = forwardRef<
  MatchPlayerHandle,
  MatchVideoProps & {
    title: string
    youtubeControls: boolean
  }
>(function MatchPlayer(props, ref) {
  const { videoId, title, sound, rate, youtubeControls } = props
  const box = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props
  const [replacements, setReplacements] = useState(0)
  const [video] = useState(() =>
    createMatchVideo(
      () => latest.current,
      () => setReplacements((count) => count + 1),
    ),
  )
  useFocusBack(box)

  // The player is created once, once more when YouTube's controls are shown or hidden, and in the place of a stuck one;
  // later seeks go through the handle, not `startAt`, and another video is loaded into it below.
  useEffect(() => {
    if (!host.current) return
    let cancelled = false
    let poll = 0
    const mount = document.createElement("div")
    host.current.replaceChildren(mount)
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        video.open((opening) =>
          createYouTubePlayer(
            YT,
            mount,
            { ...opening, controls: youtubeControls },
            {
              onReady: ({ target }) => {
                if (!cancelled) video.onReady(target)
              },
              onStateChange: ({ data }) => {
                if (!cancelled) video.onState(data)
              },
              onError: ({ data }) => {
                if (!cancelled) video.onError(data)
              },
            },
          ),
        )
        poll = window.setInterval(() => video.read(), POLL_MS)
      })
      .catch(() => {
        if (!cancelled) latest.current.onProblem?.("blocked")
      })
    return () => {
      cancelled = true
      window.clearInterval(poll)
      video.close()
    }
  }, [video, youtubeControls, replacements])

  useEffect(() => video.showWanted(), [video, videoId])
  useEffect(() => video.setSound(), [video, sound.volume, sound.muted])
  useEffect(() => video.setRate(), [video, rate])
  useImperativeHandle(ref, () => video.handle, [video])

  return (
    <div ref={box} tabIndex={-1} className="relative size-full min-h-0 overflow-hidden bg-black outline-none">
      <div ref={host} className="absolute inset-0 [&>iframe]:size-full" title={title} />
    </div>
  )
})
