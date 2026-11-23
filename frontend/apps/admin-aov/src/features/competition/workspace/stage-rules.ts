import type { DraftRule, SideSelection, StagePatch } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import type { WikiPatch } from "../wiki-patch-api"

export const DRAFT_RULE_NAMES: Record<DraftRule, string> = {
  GLOBAL: "Cấm chọn toàn cục",
  STANDARD: "Cấm chọn thường",
}

export const DRAFT_RULE_HINTS: Record<DraftRule, string> = {
  GLOBAL: "Đội không chọn lại tướng đã dùng trong loạt trận.",
  STANDARD: "Đội được chọn lại tướng ở ván sau.",
}

export const SIDE_SELECTION_NAMES: Record<SideSelection, string> = {
  HOME_FIRST_THEN_LOSER: "Đội đứng trước chọn ván 1, sau đó đội thua chọn",
  OTHER: "Cách khác (ghi ở phần luật khác)",
}

/** Whether a patch line names an update at all: the backend refuses one that names none. */
export function patchLineIsEmpty(line: StagePatch) {
  return !line.patchId && !line.releasedOn && !line.sourceUrl?.trim()
}

/** The Wiki patch released the same day as a line not linked yet; Wiki patch codes are the release day. */
export function sameDayWikiPatch(line: StagePatch, patches: readonly WikiPatch[]) {
  if (line.patchId || !line.releasedOn) return undefined
  return patches.find((patch) => patch.code === line.releasedOn)
}

/** How a Wiki patch reads in a list: its release day, then its title when it has one. */
export function wikiPatchLabel(patch: WikiPatch) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(patch.code) ? formatCalendarDate(patch.code) : patch.code
  return patch.title ? `${day} · ${patch.title}` : day
}

/** The title of a line: its update name, else the day it was released, else the Wiki patch or its source. */
export function patchLineTitle(line: StagePatch, wikiPatch?: WikiPatch) {
  if (line.name?.trim()) return line.name.trim()
  if (line.releasedOn) return `Bản cập nhật ${formatCalendarDate(line.releasedOn)}`
  if (wikiPatch) return wikiPatchLabel(wikiPatch)
  return "Bản cập nhật"
}

/** A new line takes what it can from the Wiki patch picked for it, without overwriting what the editor wrote. */
export function linkWikiPatch(line: StagePatch, patch: WikiPatch | undefined): StagePatch {
  if (!patch) return { ...line, patchId: null }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(patch.code) ? patch.code : null
  return {
    ...line,
    patchId: patch.id,
    releasedOn: line.releasedOn || day,
    name: line.name?.trim() ? line.name : (patch.title ?? null),
  }
}
