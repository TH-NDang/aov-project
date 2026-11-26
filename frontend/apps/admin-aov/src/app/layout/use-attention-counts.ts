import type { NavBadgeKey } from "@/app/nav"
import { useNewPatchNoteCount } from "@/features/patch-watch/use-patch-watch"

/** The counts beside navigation entries: posts waiting in the patch-watch inbox. */
export function useAttentionCounts(): Partial<Record<NavBadgeKey, number>> {
  return { patchNotes: useNewPatchNoteCount() }
}
