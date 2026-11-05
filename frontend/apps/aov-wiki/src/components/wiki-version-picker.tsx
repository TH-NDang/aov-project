import { PatchTimelineRail } from "@aov/ui/components/patch-timeline-rail"
import { useWikiContext, wikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
import "./wiki-version-picker.css"

export function WikiVersionPicker({ changedVariants }: { changedVariants?: ReadonlySet<string> }) {
  const scope = useWikiContext()
  const { locale, options, seasonId, patchVariantId, setScope } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const historical = !!(seasonId || patchVariantId)
  const activePatch = patchVariantId || (!seasonId && options?.currentPatchVariantId) || ""
  const reset = text("Về patch hiện tại", "Return to current patch")
  const selectedPatch = options?.patches.find((patch) => patch.id === activePatch)
  const activeSeason = selectedPatch?.seasonId || seasonId || options?.currentSeasonId
  const seasonLabel = options?.seasons.find((season) => season.id === activeSeason)?.displayName
  const patches = options?.patches.filter((patch) => changedVariants?.has(patch.id) || patch.id === activePatch) ?? []
  const seasons = (options?.seasons ?? [])
    .filter((season) => season.id === activeSeason || patches.some((patch) => patch.seasonId === season.id))
    .sort((a, b) => a.ordinal - b.ordinal)
  const returnToCurrent = () => setScope({ seasonId: "", patchVariantId: "", includeUnscoped: false })
  if (!seasons.length || !changedVariants?.size) {
    if (!seasonLabel && !selectedPatch) return null
    return (
      <span className="inline-flex items-center gap-2 type-meta">
        {[seasonLabel, selectedPatch?.code].filter(Boolean).join(" · ")}
        {historical && (
          <button type="button" className="inline-flex items-center gap-1 underline" onClick={returnToCurrent}>
            <WikiIcon name="reset" size={13} /> {reset}
          </button>
        )}
      </span>
    )
  }

  return (
    <section className="wiki-version-picker" aria-label={text("Mùa và patch", "Season and patch")}>
      <PatchTimelineRail selection={activePatch || seasonId} label={text("Chọn patch", "Select patch")}>
        {seasons.map((season) => (
          <div className="wiki-version-group" key={season.id}>
            <button
              type="button"
              data-season=""
              data-active-season={season.id === activeSeason || undefined}
              aria-pressed={seasonId === season.id && !patchVariantId}
              onClick={() => setScope({ seasonId: season.id, patchVariantId: "", includeUnscoped: false })}
            >
              {season.displayName}
            </button>
            {patches
              .filter((patch) => patch.seasonId === season.id)
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((patch) => (
                <button
                  key={patch.id}
                  type="button"
                  data-patch=""
                  aria-pressed={patch.id === activePatch}
                  title={[patch.title || patch.code, patch.isCurrent && text("Hiện tại", "Current")]
                    .filter(Boolean)
                    .join(" · ")}
                  onClick={() =>
                    setScope(
                      patch.isCurrent
                        ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
                        : { seasonId: season.id, patchVariantId: patch.id, includeUnscoped: false },
                    )
                  }
                >
                  {patch.isCurrent && (
                    <span className="wiki-version-current" aria-label={text("Hiện tại", "Current")} />
                  )}
                  {patch.code}
                </button>
              ))}
          </div>
        ))}
      </PatchTimelineRail>
      {historical && !patches.some((patch) => patch.isCurrent) && (
        <button type="button" className="shrink-0 type-meta underline" onClick={returnToCurrent}>
          {reset}
        </button>
      )}
    </section>
  )
}
