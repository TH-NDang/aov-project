import type { LocaleText } from "@aov/ui/lib/locale-text"

/** The schedule is what the game's lobby showed when it was recorded, so the page says so once. */
export const scheduleNote = (text: LocaleText) =>
  text(
    "Lịch mở ghi theo sảnh chọn chế độ, có thể đã đổi.",
    "Schedules are as the mode lobby showed them and may have changed.",
  )

/** The line under the modes title: the counts once modes are listed, then the schedule note. */
export const modesLead = (text: LocaleText, counts: string) =>
  counts ? `${counts}. ${scheduleNote(text)}` : scheduleNote(text)
