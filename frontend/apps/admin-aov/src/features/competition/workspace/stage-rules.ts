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

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Wiki patches a stage played between two days met: the one in force on the first day and those released until the
 * last. Patches a line already names, by link or by day, are left out. Oldest first, the order of the lines.
 */
export function patchesPlayed(
  patches: readonly WikiPatch[],
  days: { first: string; last: string },
  lines: readonly StagePatch[],
): WikiPatch[] {
  const dated = patches
    .filter((patch) => DAY.test(patch.code) && patch.code <= days.last)
    .sort((a, b) => a.code.localeCompare(b.code))
  const before = dated.filter((patch) => patch.code <= days.first).at(-1)
  return dated.filter(
    (patch) =>
      (patch === before || patch.code > days.first) &&
      !lines.some((line) => line.patchId === patch.id || line.releasedOn === patch.code),
  )
}

/** The lines with more of them, oldest update first; undated lines keep their place at the end. */
export const withPatchLines = (lines: readonly StagePatch[], added: readonly StagePatch[]): StagePatch[] =>
  [...lines, ...added].sort((a, b) => (a.releasedOn ?? "9999").localeCompare(b.releasedOn ?? "9999"))
