import type { CaptureState } from "../../api/use-patch-captures"

/** Width as a percentage of the split and height as dvh, so a saved size still fits another window. */
export type CaptureSize = { width: number; height: number }

export const defaultCaptureSize: CaptureSize = { width: 50, height: 52 }

/** The width beside the page that one click on the widen button gives. */
export const wideCaptureWidth = 68

export const clampCaptureWidth = (value: number) => Math.round(Math.min(75, Math.max(30, value)))

export const clampCaptureHeight = (value: number) => Math.round(Math.min(80, Math.max(25, value)))

/** A panel at least this wide counts as widened, so its button offers to narrow it again. */
export const isWideCapture = (size: CaptureSize) => size.width >= 60

/** A saved size within bounds; a side that is missing or not a number takes its default. */
export function captureSizeFrom(saved: Partial<Record<keyof CaptureSize, unknown>>): CaptureSize {
  return {
    width: clampCaptureWidth(typeof saved.width === "number" ? saved.width : defaultCaptureSize.width),
    height: clampCaptureHeight(typeof saved.height === "number" ? saved.height : defaultCaptureSize.height),
  }
}

/** What the panel says while it has no pictures of the hero to show, or null when it has. */
export function captureStateMessage(state: CaptureState, patchCode: string | undefined) {
  switch (state.status) {
    case "loading":
      return "Đang tìm ảnh gốc của tướng…"
    case "no-patch":
      return patchCode
        ? `Patch ${patchCode} chưa có bộ ảnh gốc.`
        : "Bản đang xem chưa gắn patch, nên không xác định được bộ ảnh gốc."
    case "no-hero":
      return state.heroCode
        ? `Bộ ảnh patch ${patchCode} không có tướng “${state.heroCode}”.`
        : "Không xác định được mã của tướng này nên không nối được với bộ ảnh."
    case "error":
      return state.message
    default:
      return null
  }
}
