/** A video or game position as a clock: `m:ss` under an hour, `h:mm:ss` otherwise; `--:--` without a number. */
export function formatClock(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--:--"
  const total = Math.max(0, Math.floor(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, "0")
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`
}

/** Reads `90`, `1:30` or `1:02:03` as seconds; null when the text is empty, not a time or has 60 or more in a part. */
export function parseClock(value: string): number | null {
  const input = value.trim()
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(input)) return null
  const parts = input.split(":").map(Number)
  if (parts.slice(1).some((part) => part >= 60)) return null
  return parts.reduce((total, part) => total * 60 + part, 0)
}
