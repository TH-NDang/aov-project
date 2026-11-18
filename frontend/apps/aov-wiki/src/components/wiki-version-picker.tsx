import { useRef, useState } from "react"
import { cn } from "@aov/ui/lib/utils"
import { LocalTime } from "@aov/ui/components/local-time"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { useWikiContext, type WikiPatch, useWikiText } from "../context/wiki-context"
import { WikiIcon } from "./wiki-icon"
import "./wiki-version-picker.css"

/** A version as readers name it: the day it took effect, or its title while that day is not known. */
function VersionName({ patch, locale }: { patch: WikiPatch; locale: string }) {
  return <LocalTime value={patch.regionalDate} locale={locale} fallback={patch.title || patch.code} />
}

/**
 * Says which game version the page shows. Where other versions changed what the page lists, the value opens a menu of
 * them; `changedVariants` names those versions.
 */
export function WikiVersionPicker({
  changedVariants,
  className,
}: {
  changedVariants?: ReadonlySet<string>
  /** Places the picker in the row that holds it. */
  className?: string
}) {
  const { locale, options, optionsPending, seasonId, patchVariantId, setScope } = useWikiContext()
  const root = useRef<HTMLDivElement>(null)
  const [align, setAlign] = useState<"start" | "end">("start")
  const text = useWikiText()
  const historical = !!(seasonId || patchVariantId)
  const activePatch = patchVariantId || (!seasonId && options?.currentPatchVariantId) || ""
  const selectedPatch = options?.patches.find((patch) => patch.id === activePatch)
  const activeSeason = selectedPatch?.seasonId || seasonId || options?.currentSeasonId
  const seasonLabel = options?.seasons.find((season) => season.id === activeSeason)?.displayName
  // A whole season is named as a season. The narrowest phones keep only the noun, so the value is never cut short.
  const label = (
    <span className="wiki-version-label">
      <span>{text("Dữ liệu ", "Data from ")}</span>
      {selectedPatch || optionsPending ? text("bản", "version") : text("mùa", "season")}
    </span>
  )

  if (optionsPending)
    return (
      <div className={cn("wiki-version-picker", className)} aria-busy="true">
        {label}
        <span className="wiki-version-loading" aria-hidden="true" />
      </div>
    )
  if (!seasonLabel && !selectedPatch) return null

  const patches = options?.patches.filter((patch) => changedVariants?.has(patch.id) || patch.id === activePatch) ?? []
  const seasons = (options?.seasons ?? [])
    .filter((season) => season.id === activeSeason || patches.some((patch) => patch.seasonId === season.id))
    .sort((a, b) => b.ordinal - a.ordinal)
  const current = text("Đang áp dụng", "Current")
  const chosen = (
    <span className="wiki-version-option-check">
      <WikiIcon name="check" size={18} />
      <span className="sr-only">{text("Đang xem", "Showing")}</span>
    </span>
  )
  const value = (
    <>
      <span className="wiki-version-value">
        {selectedPatch ? <VersionName patch={selectedPatch} locale={locale} /> : seasonLabel}
      </span>
      {selectedPatch?.isCurrent && <span className="wiki-version-live">{current}</span>}
    </>
  )

  return (
    <div
      ref={root}
      className={cn("wiki-version-picker", className)}
      role="group"
      aria-label={text("Phiên bản dữ liệu", "Data version")}
      data-historical={historical || undefined}
    >
      {label}
      {seasons.length && changedVariants?.size ? (
        <DropdownMenu
          modal={false}
          onOpenChange={(open) => {
            // The menu opens toward the middle of the page, whichever side the control stands on.
            const box = open && root.current?.getBoundingClientRect()
            if (box) setAlign(box.left + box.width / 2 > window.innerWidth / 2 ? "end" : "start")
          }}
        >
          <DropdownMenuTrigger className="wiki-version-trigger">
            {value}
            <WikiIcon name="chevron" size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={align}
            sideOffset={6}
            className="wiki-version-menu"
            drawerTitle={text("Xem dữ liệu theo phiên bản", "Read the data of a version")}
          >
            <p className="wiki-version-note">
              {text(
                "Chỉ liệt kê các phiên bản có thay đổi ở trang này.",
                "Only versions that changed this page are listed.",
              )}
            </p>
            {seasons.map((season) => (
              <div key={season.id} className="wiki-version-season" role="group" aria-label={season.displayName}>
                <div className="wiki-version-season-name" aria-hidden="true">
                  {season.displayName}
                </div>
                {patches
                  .filter((patch) => patch.seasonId === season.id)
                  .sort((a, b) => b.ordinal - a.ordinal)
                  .map((patch) => (
                    <DropdownMenuItem
                      key={patch.id}
                      className="wiki-version-option"
                      onSelect={() =>
                        setScope(
                          patch.isCurrent
                            ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
                            : { seasonId: season.id, patchVariantId: patch.id, includeUnscoped: false },
                        )
                      }
                    >
                      <span className="wiki-version-option-name">
                        <VersionName patch={patch} locale={locale} />
                        {patch.isCurrent && <span className="wiki-version-live">{current}</span>}
                      </span>
                      {patch.id === activePatch && chosen}
                      {/* A version without a day is already named by its title. */}
                      {patch.regionalDate && patch.title && (
                        <span className="wiki-version-option-title">{patch.title}</span>
                      )}
                      {!changedVariants?.has(patch.id) && (
                        <span className="wiki-version-option-title">
                          {text("Không có thay đổi ở trang này", "No changes on this page")}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuItem
                  className="wiki-version-option"
                  onSelect={() => setScope({ seasonId: season.id, patchVariantId: "", includeUnscoped: false })}
                >
                  <span className="wiki-version-option-name">
                    {text(`Cả mùa ${season.displayName}`, `All of ${season.displayName}`)}
                  </span>
                  {seasonId === season.id && !patchVariantId && chosen}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="wiki-version-static">{value}</span>
      )}
      {historical && (
        <button
          type="button"
          className="wiki-version-reset"
          onClick={() => setScope({ seasonId: "", patchVariantId: "", includeUnscoped: false })}
        >
          <WikiIcon name="reset" size={14} />
          {text("Về bản hiện tại", "Back to current")}
        </button>
      )}
    </div>
  )
}
