/**
 * The one short word a hero's change is tagged with: the words players use, the same in every language. Most follow the
 * tone of the change (`patchChangeTone`); a fix keeps its own word, since "Tweak" would hide that something was broken.
 */
const BY_TONE: Record<string, string> = {
  up: "Buff",
  down: "Nerf",
  rework: "Rework",
  new: "New",
  adjust: "Tweak",
}
const FIXES = new Set(["FIX", "BUG_FIX"])

export function changeShortWord(kind: string, tone: string) {
  if (FIXES.has(kind)) return "Fix"
  return BY_TONE[tone] ?? BY_TONE.adjust!
}
