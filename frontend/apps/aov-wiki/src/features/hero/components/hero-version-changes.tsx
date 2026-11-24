import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { GameIcon } from "@aov/ui/components/game-icons"
import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, type WikiPatch } from "../../../context/wiki-context"
import { heroChangesQuery } from "../../../lib/updates-api"
import type { HeroDetail } from "../../../lib/hero-api"
import { previousPatch } from "../../../lib/hero-patch-line"

/** The side mark of the band says what the version did to the hero, in the tones the home page uses. */
export const CHANGE_TONES: Record<string, string> = {
  RELEASE: "new",
  ADDED: "new",
  REWORK: "rework",
  BUFF: "up",
  NERF: "down",
}

/**
 * What the selected version changed for this hero, from published patch notes only. Two snapshots of the hero can also
 * differ in wording or spelling; that is editorial work, which Admin compares and the public page never shows.
 */
export function useHeroVersion(hero: HeroDetail) {
  const scope = useWikiContext()
  const patches = useMemo(() => scope.options?.patches ?? [], [scope.options])
  const seasons = useMemo(() => scope.options?.seasons ?? [], [scope.options])
  const selected =
    patches.find((patch) => patch.id === scope.patchVariantId) ??
    patches.find((patch) => patch.code === hero.context?.patch?.code)
  const previous = previousPatch(patches, seasons, selected)

  const history = useQuery(heroChangesQuery(scope, hero.id))
  const rows = useMemo(() => (history.data ?? []).filter((row) => row.summary || row.changes?.length), [history.data])
  const notes = useMemo(() => rows.filter((row) => row.patchVariantId === selected?.id), [rows, selected?.id])

  const changedSkills = useMemo(() => {
    const keys = new Set<string>()
    for (const row of notes) for (const change of row.changes ?? []) if (change.skillKey) keys.add(change.skillKey)
    return keys
  }, [notes])

  return { selected, previous, notes, rows, changedSkills, pending: history.isPending }
}

export type HeroVersion = ReturnType<typeof useHeroVersion>

/** Reads the page at another version; the version in force is the page without a version in its address. */
export function usePatchOpener() {
  const { setScope } = useWikiContext()
  return (patch: WikiPatch) =>
    setScope(
      patch.isCurrent
        ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
        : { seasonId: patch.seasonId, patchVariantId: patch.id, includeUnscoped: false },
    )
}

/** Shown after jumping from a change to its skill, so a reader can go back; it leaves once they have. */
export function BackToChanges({
  target,
  label,
  onBack,
  onReturned,
}: {
  target: RefObject<HTMLElement | null>
  label: ReactNode
  onBack: () => void
  onReturned: () => void
}) {
  const [away, setAway] = useState(false)
  const wasAway = useRef(false)
  useEffect(() => {
    const node = target.current
    if (!node) return
    // Follows the section's heading, not the whole section: a page too short to scroll it fully away still needs this.
    const observer = new IntersectionObserver(
      // Several changes can arrive together while the page is busy, and only the latest one counts.
      (entries) => {
        const entry = entries[entries.length - 1]
        const isAway = !entry.isIntersecting && entry.boundingClientRect.top < window.innerHeight / 2
        if (wasAway.current && !isAway) onReturned()
        wasAway.current = isAway
        setAway(isAway)
      },
      { rootMargin: "-56px 0px 0px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target, onReturned])
  if (!away) return null
  return (
    <button type="button" className="wiki-version-float" onClick={onBack}>
      <GameIcon name="tied-scroll" size={22} />
      <span>{label}</span>
      <WikiIcon name="chevron" size={16} />
    </button>
  )
}
