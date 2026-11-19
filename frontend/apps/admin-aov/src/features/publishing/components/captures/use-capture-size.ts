import { useRef, useState, type RefObject } from "react"
import {
  captureSizeFrom,
  clampCaptureHeight,
  clampCaptureWidth,
  defaultCaptureSize,
  isWideCapture,
  wideCaptureWidth,
  type CaptureSize,
} from "../../model/captures/capture-panel-model"

const SIZE_KEY = "aov-admin:hero-capture-size"

function readSize() {
  try {
    return captureSizeFrom(JSON.parse(localStorage.getItem(SIZE_KEY) ?? "{}"))
  } catch {
    return defaultCaptureSize
  }
}

function saveSize(size: CaptureSize) {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(size))
  } catch {
    /* The size still lasts for this page. */
  }
}

/**
 * The size of the capture panel, kept on this device. Its edge is dragged sideways beside the page and up and down
 * under it; a double click on the edge puts that side back, and one button widens or narrows it in one step.
 */
export function useCaptureSize(panel: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState(readSize)
  const wide = isWideCapture(size)
  const latestSize = useRef(size)
  latestSize.current = size
  const changeSize = (next: Partial<CaptureSize>) => setSize((current) => ({ ...current, ...next }))
  const reset = (side: keyof CaptureSize) => {
    changeSize({ [side]: defaultCaptureSize[side] })
    saveSize({ ...size, [side]: defaultCaptureSize[side] })
  }
  return {
    size,
    wide,
    dragTo: ({ x, y }: { x: number; y: number }) => {
      const split = panel.current?.parentElement?.getBoundingClientRect()
      if (!split) return
      if (panel.current && getComputedStyle(panel.current.parentElement!).flexDirection === "row")
        changeSize({ width: clampCaptureWidth(((split.right - x) / split.width) * 100) })
      else changeSize({ height: clampCaptureHeight(((split.bottom - y) / window.innerHeight) * 100) })
    },
    keepSize: () => saveSize(latestSize.current),
    resetWidth: () => reset("width"),
    resetHeight: () => reset("height"),
    toggleWide: () => {
      const next = { ...size, width: wide ? defaultCaptureSize.width : wideCaptureWidth }
      setSize(next)
      saveSize(next)
    },
  }
}
