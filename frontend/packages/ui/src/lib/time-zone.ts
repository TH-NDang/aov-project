import { useEffect, useRef, useSyncExternalStore } from "react"

/** The zones offered in settings. A value outside this list stays selectable where it is already stored. */
export const COMMON_TIME_ZONES: readonly { value: string; vi: string; en: string }[] = [
  { value: "Asia/Ho_Chi_Minh", vi: "Việt Nam", en: "Vietnam" },
  { value: "Asia/Bangkok", vi: "Thái Lan", en: "Thailand" },
  { value: "Asia/Jakarta", vi: "Jakarta", en: "Jakarta" },
  { value: "Asia/Singapore", vi: "Singapore", en: "Singapore" },
  { value: "Asia/Kuala_Lumpur", vi: "Malaysia", en: "Malaysia" },
  { value: "Asia/Manila", vi: "Philippines", en: "Philippines" },
  { value: "Asia/Taipei", vi: "Đài Loan", en: "Taiwan" },
  { value: "Asia/Hong_Kong", vi: "Hồng Kông", en: "Hong Kong" },
  { value: "Asia/Shanghai", vi: "Trung Quốc", en: "China" },
  { value: "Asia/Tokyo", vi: "Nhật Bản", en: "Japan" },
  { value: "Asia/Seoul", vi: "Hàn Quốc", en: "South Korea" },
  { value: "Asia/Kolkata", vi: "Ấn Độ", en: "India" },
  { value: "Australia/Sydney", vi: "Sydney", en: "Sydney" },
  { value: "Europe/London", vi: "Anh", en: "United Kingdom" },
  { value: "Europe/Paris", vi: "Paris", en: "Paris" },
  { value: "America/New_York", vi: "New York", en: "New York" },
  { value: "America/Los_Angeles", vi: "Los Angeles", en: "Los Angeles" },
  { value: "UTC", vi: "UTC", en: "UTC" },
]

/** Browsers still report some legacy names, for example Chrome's Asia/Saigon for Vietnam. */
const ZONE_ALIASES: Record<string, string> = {
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Calcutta": "Asia/Kolkata",
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
  GMT: "UTC",
}

export const canonicalTimeZone = (zone: string) => ZONE_ALIASES[zone] ?? zone

const checkedZones = new Map<string, boolean>()

export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || !zone || zone.length > 64) return false
  let valid = checkedZones.get(zone)
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone })
      valid = true
    } catch {
      valid = false
    }
    checkedZones.set(zone, valid)
  }
  return valid
}

let deviceZone: string | undefined

/** Read once per page: every time on screen asks for this on every render, and building a formatter is slow. */
export function browserTimeZone() {
  if (deviceZone === undefined) {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
      deviceZone = zone ? canonicalTimeZone(zone) : "UTC"
    } catch {
      deviceZone = "UTC"
    }
  }
  return deviceZone
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function usableLocale(locale: string) {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? "vi-VN"
  } catch {
    return "vi-VN"
  }
}

function formatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`
  let cached = formatters.get(key)
  if (!cached) {
    // A stored locale or zone this browser does not know must not take the page down.
    const timeZone = isValidTimeZone(options.timeZone) ? options.timeZone : "UTC"
    cached = new Intl.DateTimeFormat(usableLocale(locale), { ...options, timeZone })
    formatters.set(key, cached)
  }
  return cached
}

export type TimeValue = string | number | Date

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A value with no time of day stands for a whole day and must never move through a time zone. */
export const isCalendarDate = (value: unknown): value is string =>
  typeof value === "string" && CALENDAR_DATE.test(value)

/** Reads a moment in time; calendar dates are not moments, so they return null. */
export function toInstant(value: TimeValue | null | undefined) {
  if (value === null || value === undefined || value === "" || isCalendarDate(value)) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}

/** Formats a moment in the given zone. An invalid value returns an empty string. */
export function formatInZone(
  value: TimeValue | null | undefined,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = DATE_TIME_FORMAT,
  locale = "vi-VN",
) {
  const date = toInstant(value)
  return date ? formatter(locale, { ...options, timeZone }).format(date) : ""
}

const TIME_PARTS = new Set<keyof Intl.DateTimeFormatOptions>([
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "hour12",
  "hourCycle",
  "timeStyle",
  "timeZoneName",
  "dayPeriod",
])

/** Formats a yyyy-mm-dd date exactly as written, whatever the zone of the reader. */
export function formatCalendarDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
  locale = "vi-VN",
) {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  const dateParts = Object.fromEntries(
    Object.entries(options).filter(([key]) => !TIME_PARTS.has(key as keyof Intl.DateTimeFormatOptions)),
  ) as Intl.DateTimeFormatOptions
  const usable = Object.keys(dateParts).length
    ? dateParts
    : { day: "2-digit" as const, month: "2-digit" as const, year: "numeric" as const }
  return formatter(locale, { ...usable, timeZone: "UTC" }).format(date)
}

/** The calendar day of a moment in a zone, as yyyy-mm-dd. Use it to group or compare by day. */
export function dayKeyInZone(value: TimeValue | null | undefined, timeZone: string) {
  const date = toInstant(value)
  if (!date) return ""
  return formatter("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

/** Whole calendar days from `from` to `to`, counted on the wall calendar of the zone. */
export function calendarDaysBetween(from: TimeValue, to: TimeValue, timeZone: string) {
  const day = (value: TimeValue) => (isCalendarDate(value) ? value : dayKeyInZone(value, timeZone))
  const start = Date.parse(`${day(from)}T00:00:00Z`)
  const end = Date.parse(`${day(to)}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000)
}

/** The offset of a zone at a moment, such as UTC+7 or UTC-4; it depends on the moment where clocks change. */
export function utcOffsetLabel(timeZone: string, at: TimeValue = Date.now()) {
  const date = toInstant(at) ?? new Date()
  const name = formatter("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value
  const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!match) return "UTC+0"
  const hours = Number(match[2])
  return `UTC${match[1]}${hours}${match[3] === "00" ? "" : `:${match[3]}`}`
}

/** A readable zone name with its offset: "Vietnam (UTC+7)", "UTC", or the IANA name outside the common list. */
export function timeZoneLabel(timeZone: string, at: TimeValue = Date.now(), locale = "vi-VN") {
  const zone = canonicalTimeZone(timeZone)
  if (zone === "UTC") return "UTC"
  if (!isValidTimeZone(zone)) return timeZone.replaceAll("_", " ")
  const common = COMMON_TIME_ZONES.find((option) => option.value === zone)
  const name = common ? (locale.startsWith("en") ? common.en : common.vi) : zone.replaceAll("_", " ")
  return `${name} (${utcOffsetLabel(zone, at)})`
}

const STORAGE_KEY = "aov:time-zone:v1"

function readStoredChoice() {
  try {
    if (typeof localStorage === "undefined") return null
    const stored = localStorage.getItem(STORAGE_KEY)
    return isValidTimeZone(stored) ? canonicalTimeZone(stored) : null
  } catch {
    return null
  }
}

let choice: string | null | undefined
const listeners = new Set<() => void>()
let accountSaver: ((zone: string) => Promise<unknown>) | null = null
let savingToAccount: Promise<void> | null = null
let zoneToSave: string | null = null
let saveFailed = false
const SAVE_RETRY_DELAY = 1000
let listeningToOtherTabs = false

function publishChoice(next: string | null) {
  if (choice === next) return
  choice = next
  listeners.forEach((listener) => listener())
}

function storeChoice(next: string | null) {
  try {
    if (typeof localStorage !== "undefined") {
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // The choice lasts for this page when storage is unavailable.
  }
  publishChoice(next)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!listeningToOtherTabs && typeof window !== "undefined") {
    listeningToOtherTabs = true
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === STORAGE_KEY) publishChoice(readStoredChoice())
    })
  }
  return () => {
    listeners.delete(listener)
  }
}

/** The zone the user picked, or null while they follow the zone of their device. */
export function timeZoneChoice() {
  if (choice === undefined) choice = readStoredChoice()
  return choice
}

/** The zone every moment is shown in: the user's choice, otherwise the browser's. */
export const currentTimeZone = () => timeZoneChoice() ?? browserTimeZone()

/**
 * Names the zone the page is showing. An unchosen zone is named after the device because browsers report one city for
 * a whole offset: Windows in Vietnam reports Asia/Bangkok, which would read as Thailand.
 */
export function shownTimeZoneLabel(at: TimeValue = Date.now(), locale = "vi-VN") {
  const chosen = timeZoneChoice()
  if (chosen) return timeZoneLabel(chosen, at, locale)
  return `${locale.startsWith("en") ? "This device" : "Theo thiết bị"} (${utcOffsetLabel(browserTimeZone(), at)})`
}

export const useTimeZoneChoice = () => useSyncExternalStore(subscribe, timeZoneChoice, timeZoneChoice)

export const useUserTimeZone = () => useSyncExternalStore(subscribe, currentTimeZone, currentTimeZone)

/** Whether the latest choice failed to reach the signed-in profile, so a control can say so when it opens again. */
export const timeZoneSaveFailed = () => saveFailed

export const useTimeZoneSaveFailed = () => useSyncExternalStore(subscribe, timeZoneSaveFailed, timeZoneSaveFailed)

function publishSaveFailed(next: boolean) {
  if (saveFailed === next) return
  saveFailed = next
  listeners.forEach((listener) => listener())
}

/** Applies a choice from a settings control at once, keeps it across visits and saves it to a signed-in profile. */
export async function chooseTimeZone(zone: string | null) {
  const next = isValidTimeZone(zone) ? canonicalTimeZone(zone) : null
  storeChoice(next)
  publishSaveFailed(false)
  if (accountSaver) await saveToAccount(next ?? browserTimeZone())
}

/** Tries twice, since most failures here are a passing network error. A newer choice replaces the retry. */
async function saveWithRetry(zone: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await accountSaver?.(zone)
      return true
    } catch {
      if (attempt > 0 || zoneToSave) return false
      await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_DELAY))
      if (zoneToSave) return false
    }
  }
}

/** One write at a time, newest choice last: a profile version only fits one write, so overlapping saves would conflict. */
function saveToAccount(zone: string) {
  zoneToSave = zone
  savingToAccount ??= (async () => {
    let saved = true
    while (zoneToSave) {
      const current = zoneToSave
      zoneToSave = null
      saved = await saveWithRetry(current)
    }
    savingToAccount = null
    publishSaveFailed(!saved)
  })()
  return savingToAccount
}

/**
 * Connects the signed-in profile (`user_profile.profile.time_zone`), which is shared across the apps: a saved profile
 * replaces this browser's choice when it loads or changes, and a new choice is written back through `save`. A profile
 * that was never saved holds only a server default, so it neither overrides the choice nor receives it.
 */
export function useAccountTimeZone(
  profile: { id: string | null; timeZone: string } | null | undefined,
  save?: (zone: string) => Promise<unknown>,
) {
  const saved = profile?.id ? profile.timeZone : null
  const latestSave = useRef(save)
  latestSave.current = save
  useEffect(() => {
    // While a choice is on its way to the profile, the profile still holds an older one.
    if (isValidTimeZone(saved) && !savingToAccount) storeChoice(canonicalTimeZone(saved))
  }, [saved])
  const writable = !!saved && !!save
  useEffect(() => {
    if (!writable) return
    const saver = (zone: string) => latestSave.current?.(zone) ?? Promise.resolve()
    accountSaver = saver
    return () => {
      if (accountSaver === saver) accountSaver = null
      publishSaveFailed(false)
    }
  }, [writable])
}
