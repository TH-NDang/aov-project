/** The point of a picture that matters most, usually a face, as fractions of its width and height from the top left. */
export type FocalPoint = { x: number; y: number }

/**
 * The `object-position` that keeps the point in view when a picture is cropped to a fixed shape. A percentage in
 * `object-position` lines up that spot of the picture with that spot of the frame, so the point can never fall outside.
 */
export function focalPosition(point?: FocalPoint | null) {
  if (!point) return undefined
  const percent = (value: number) => `${Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10}%`
  return `${percent(point.x)} ${percent(point.y)}`
}
