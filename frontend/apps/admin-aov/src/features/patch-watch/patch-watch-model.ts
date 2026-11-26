import type { ChangeSchedule, PatchNoteSource } from "./patch-watch-api"

export type PatchNoteSourceCode = "LIENQUAN_VN" | "ROV_TH" | "MOBA_TW_EXP" | "MOBA_TW" | "GARENA_ID" | "MANUAL"
export type PatchNoteRegion = "VN" | "TH" | "TW" | "ID" | "OTHER"
export type PatchNoteChannel = "OFFICIAL" | "EXPERIMENTAL"
export type PatchNotePostState = "NEW" | "DONE" | "DISMISSED" | "EARLIER"
export type PatchNoteScheduleMode = "DAILY" | "EVERY_HOURS"
export type PatchNoteFailure = "UNREACHABLE" | "HTTP_STATUS" | "TOO_LARGE" | "UNREADABLE"

/** The three ways a source can run, as the schedule editor offers them; paused keeps the mode it had. */
export type ScheduleChoice = PatchNoteScheduleMode | "PAUSED"

export const SOURCE_NAMES: Record<PatchNoteSourceCode, string> = {
  LIENQUAN_VN: "Garena Việt Nam",
  ROV_TH: "RoV Thái Lan",
  MOBA_TW_EXP: "Máy chủ thử nghiệm",
  MOBA_TW: "Garena Đài Loan",
  GARENA_ID: "Garena Indonesia",
  MANUAL: "Thêm tay",
}

export const REGION_LABELS: Record<PatchNoteRegion, string> = {
  VN: "Việt Nam",
  TH: "Thái Lan",
  TW: "Đài Loan",
  ID: "Indonesia",
  OTHER: "Khác",
}

/** The short mark of each region on the cards. */
export const REGION_CODES: Record<PatchNoteRegion, string> = { VN: "VN", TH: "TH", TW: "TW", ID: "ID", OTHER: "—" }

export const CHANNEL_LABELS: Record<PatchNoteChannel, string> = {
  OFFICIAL: "Chính thức",
  EXPERIMENTAL: "Thử nghiệm",
}

export const STATE_LABELS: Record<PatchNotePostState, string> = {
  NEW: "Mới",
  DONE: "Đã xử lý",
  DISMISSED: "Bỏ qua",
  EARLIER: "Bài cũ",
}

export const SCHEDULE_CHOICES = [
  ["DAILY", "Mỗi ngày"],
  ["EVERY_HOURS", "Theo giờ"],
  ["PAUSED", "Tạm dừng"],
] as const satisfies readonly (readonly [ScheduleChoice, string])[]

const FAILURE_TEXT: Record<PatchNoteFailure, string> = {
  UNREACHABLE: "Không vào được trang",
  HTTP_STATUS: "Trang trả lỗi",
  TOO_LARGE: "Trang quá lớn",
  UNREADABLE: "Không thấy bài nào, có thể trang đã đổi giao diện",
}

export const MIN_HOURS = 1
export const MAX_HOURS = 24
export const HOUR_OPTIONS = Array.from({ length: MAX_HOURS - MIN_HOURS + 1 }, (_, index) => MIN_HOURS + index)

/** `HH:mm` of a time the backend sends as `HH:mm` or `HH:mm:ss`. */
export function timeOfDay(value: string) {
  return /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : "08:00"
}

export function scheduleChoice(source: Pick<PatchNoteSource, "mode" | "paused">): ScheduleChoice {
  return source.paused ? "PAUSED" : source.mode
}

/** How often the source is read, as a short line: "08:00 mỗi ngày", "Mỗi 6 giờ", "Tạm dừng". */
export function scheduleText(source: Pick<PatchNoteSource, "mode" | "paused" | "dailyAt" | "everyHours">) {
  if (source.paused) return "Tạm dừng"
  return source.mode === "DAILY" ? `${timeOfDay(source.dailyAt)} mỗi ngày` : `Mỗi ${source.everyHours} giờ`
}

/** Why the last read failed, with the status the page answered; null when it went through. */
export function failureText(source: Pick<PatchNoteSource, "failure" | "failureStatus" | "failures">) {
  if (!source.failure) return null
  const status = source.failure === "HTTP_STATUS" && source.failureStatus ? ` ${source.failureStatus}` : ""
  const times = source.failures > 1 ? ` · ${source.failures} lần liền` : ""
  return `${FAILURE_TEXT[source.failure]}${status}${times}`
}

export interface ScheduleDraft {
  choice: ScheduleChoice
  dailyAt: string
  everyHours: number
}

export function scheduleDraft(source: PatchNoteSource): ScheduleDraft {
  return { choice: scheduleChoice(source), dailyAt: timeOfDay(source.dailyAt), everyHours: source.everyHours }
}

export function isTimeOfDay(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

/** The body of a schedule change; pausing keeps the mode and times, so turning it back on restores them. */
export function scheduleBody(source: PatchNoteSource, draft: ScheduleDraft): ChangeSchedule {
  return {
    mode: draft.choice === "PAUSED" ? source.mode : draft.choice,
    dailyAt: isTimeOfDay(draft.dailyAt) ? draft.dailyAt : timeOfDay(source.dailyAt),
    everyHours: Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(draft.everyHours))),
    paused: draft.choice === "PAUSED",
    expectedVersion: source.version,
  }
}

export function scheduleChanged(source: PatchNoteSource, draft: ScheduleDraft) {
  const before = scheduleDraft(source)
  return (
    before.choice !== draft.choice ||
    (draft.choice === "DAILY" && before.dailyAt !== draft.dailyAt) ||
    (draft.choice === "EVERY_HOURS" && before.everyHours !== draft.everyHours)
  )
}

/** States an editor moves a post to from where it is: a waiting post is handled or dismissed, others come back. */
export function nextStates(state: PatchNotePostState): PatchNotePostState[] {
  return state === "NEW" ? ["DONE", "DISMISSED"] : ["NEW"]
}

/** A web address with a host, the only kind the backend keeps. */
export function isWebAddress(value: string) {
  try {
    const url = new URL(value.trim())
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname
  } catch {
    return false
  }
}

/** A title for a post the source did not name: the last part of its address. */
export function postTitle(post: { title: string | null; url: string }) {
  if (post.title?.trim()) return post.title.trim()
  try {
    const path = new URL(post.url).pathname.split("/").filter(Boolean)
    return decodeURIComponent(path.at(-1) ?? post.url)
  } catch {
    return post.url
  }
}
