import { useCallback, useEffect, useState } from "react"

const shown = () => document.fullscreenElement === document.documentElement

/**
 * Full screen of the desk. The whole page is put on the screen and the desk covers it, so popovers and questions, which
 * live beside the desk in the page, still open over it. `toggle` is null where the browser has no full screen.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(shown)
  useEffect(() => {
    const onChange = () => setFullscreen(shown())
    document.addEventListener("fullscreenchange", onChange)
    return () => {
      document.removeEventListener("fullscreenchange", onChange)
      // The rest of Admin is not meant to stay on the whole screen.
      if (shown()) void document.exitFullscreen()
    }
  }, [])

  const toggle = useCallback(() => {
    const answer = shown() ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    // The browser can refuse, for instance without a press of the viewer; the desk then simply stays as it is.
    void answer.catch(() => {})
  }, [])
  return { fullscreen, toggle: document.fullscreenEnabled ? toggle : null }
}
