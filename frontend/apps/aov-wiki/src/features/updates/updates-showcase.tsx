import { useQueries } from "@tanstack/react-query"
import type { CSSProperties } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { CatalogShowcase } from "../../components/catalog-showcase"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, useWikiText, type WikiPatch } from "../../context/wiki-context"
import { patchChangeTone } from "../../lib/change-kinds"
import { changeSetKind } from "../../lib/wiki-change-format"
import { patchChangesQuery, releaseDateValue, type PatchChangeRow, type PatchRelease } from "../../lib/updates-api"
import { LocalTime } from "@aov/ui/components/local-time"
import { patchDayLabel } from "../../lib/patch-day-label"
import "./updates-showcase.css"

/** How many of the latest updates stand on the timeline. */
const STOPS = 5

/** How many faces stand over a stop before the rest are counted. */
const FACES = 4

export interface HeroFace {
  name: string
  image?: string
}

/** A hero that is a form of another hero names its holder, whose picture stands in when the form has none listed. */
export type HeroRow = PatchChangeRow & { holderId?: string }

/**
 * The head of the patch notes: the title and the number of updates in the top left corner, and under them a timeline
 * of the latest updates across the whole banner. Each update is a stop on a gold line, oldest on the left, with its
 * day under it and over it the faces of a few heroes it changed, each ringed in the colour of its change. The update
 * in force glows. While the list loads the head has its text only.
 */
export function UpdatesShowcase({
  releases,
  variants,
  faces,
}: {
  /** Newest first, as the list below shows them. */
  releases: readonly PatchRelease[]
  variants: ReadonlyMap<string, WikiPatch>
  faces: ReadonlyMap<string, HeroFace>
}) {
  const text = useWikiText()
  const scope = useWikiContext()
  const zone = scope.regions.find((market) => market.code === scope.region)?.timeZone
  const wide = usePageLayout() === "wide"
  const latest = releases.slice(0, STOPS).reverse()
  // The same notes each row of the list reads, so the timeline costs no request of its own.
  const changes = useQueries({ queries: latest.map((release) => patchChangesQuery(scope, release, "HERO")) })
  const count = releases.length
  return (
    <CatalogShowcase
      title={text("Ghi chú cập nhật", "Patch notes")}
      count={count ? text(`${count} bản cập nhật`, count === 1 ? "1 update" : `${count} updates`) : undefined}
      wide={wide}
      align="top"
      scene={
        latest.length > 0 && (
          <div className="wiki-updates-line">
            <span className="wiki-updates-line-track" />
            {latest.map((release, index) => {
              const variant = variants.get(release.variantId)
              const day = releaseDateValue(variant?.regionalDate, release.effectiveAt)
              const rows: HeroRow[] = changes[index]?.data ?? []
              const shown = rows.flatMap((row) => {
                const face = faces.get(row.heroId ?? "") ?? faces.get(row.holderId ?? "")
                const kind = changeSetKind(row) ?? "UPDATED"
                return face?.image
                  ? [{ image: face.image, tone: patchChangeTone(kind), key: row.heroId ?? face.name }]
                  : []
              })
              return (
                <div
                  key={release.id}
                  className="wiki-updates-stop"
                  data-current={variant?.isCurrent || undefined}
                  style={
                    {
                      "--at": latest.length === 1 ? "50%" : `${13 + (index * 74) / (latest.length - 1)}%`,
                      "--order": index,
                    } as CSSProperties
                  }
                >
                  <span className="wiki-updates-stop-faces">
                    {shown.slice(0, FACES).map((face) => (
                      <span key={face.key} className="wiki-updates-stop-face" data-tone={face.tone}>
                        <WikiImage frameWidth={48} src={face.image} alt="" />
                      </span>
                    ))}
                    {rows.length > FACES && shown.length >= FACES && (
                      <span className="wiki-updates-stop-more">+{rows.length - FACES}</span>
                    )}
                  </span>
                  <span className="wiki-updates-stop-dot" />
                  <LocalTime
                    className="wiki-updates-stop-date"
                    value={day}
                    sourceTimeZone={zone}
                    label={(shown) => (day ? patchDayLabel(day, shown) : release.code)}
                    fallback={<span className="wiki-updates-stop-date">{release.code}</span>}
                  />
                </div>
              )
            })}
          </div>
        )
      }
    />
  )
}
