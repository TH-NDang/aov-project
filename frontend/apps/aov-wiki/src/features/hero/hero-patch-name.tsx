import { LocalTime } from "@aov/ui/components/local-time"
import { useWikiContext, type WikiPatch } from "../../context/wiki-context"

/**
 * A version as the page names it, the same way the version picker does: the day it took effect, or its title or code
 * while that day is not known.
 */
export function PatchName({ patch }: { patch: Pick<WikiPatch, "regionalDate" | "title" | "code"> }) {
  const { locale } = useWikiContext()
  return <LocalTime value={patch.regionalDate} locale={locale} fallback={patch.title || patch.code} />
}
