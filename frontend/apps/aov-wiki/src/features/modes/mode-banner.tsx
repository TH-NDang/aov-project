import { WikiIcon } from "../../components/wiki-icon"
import { WikiImageCredit } from "../../components/wiki-image-credit"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import type { ModeImage } from "./auto-chess-model"
import type { ModeContent } from "./mode-api"
import { modeMetaText } from "./mode-cards"
import { AvailabilityState, GROUP_NAMES } from "./mode-ui"
import "./mode-banner.css"

/**
 * The head of one mode: its art as the scene, and over it the group on a plate, the name and what a reader decides by
 * (length, players, whether it is open). On wide screens it is a game frame under the breadcrumb; on phones it runs
 * edge to edge under the clear header, which frosts over it as the page scrolls. Without art the scene is the
 * section's emblem on the Wiki's dark gold. `short` keeps it low over a guide's tools, so they start near the top.
 */
export function ModeBanner({
  content,
  art,
  wide,
  short = false,
}: {
  content: ModeContent
  art?: ModeImage | null
  wide: boolean
  short?: boolean
}) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const meta = modeMetaText(content, locale)
  return (
    <section
      className={wide ? "wiki-mode-banner wiki-frame" : "wiki-mode-banner"}
      data-layout={wide ? "wide" : "compact"}
      data-art={art ? "" : undefined}
      data-short={short || undefined}
      aria-labelledby="wiki-mode-name"
    >
      <div className="wiki-mode-banner-scene" aria-hidden="true">
        {art ? (
          <img
            src={art.url}
            alt=""
            width={art.width}
            height={art.height}
            loading="eager"
            decoding="async"
            style={
              art.focalPoint ? { objectPosition: `${art.focalPoint.x * 100}% ${art.focalPoint.y * 100}%` } : undefined
            }
          />
        ) : (
          <WikiIcon name="mode" size={wide ? 132 : 104} />
        )}
      </div>
      <div className="wiki-mode-banner-text">
        <p className="wiki-mode-banner-group wiki-frame-plate">
          {text(GROUP_NAMES[content.group][0], GROUP_NAMES[content.group][1])}
        </p>
        <h1 id="wiki-mode-name">{content.name}</h1>
        {(meta || content.availability) && (
          <p className="wiki-mode-banner-meta">
            {meta && <span>{meta}</span>}
            <AvailabilityState availability={content.availability} quiet />
          </p>
        )}
      </div>
      {art && art.credits.length > 0 && (
        <div className="wiki-mode-banner-credit">
          <WikiImageCredit
            sources={art.credits}
            contactHref={`/contact?assetId=${encodeURIComponent(art.assetId)}&versionId=${encodeURIComponent(art.versionId)}`}
          />
        </div>
      )}
    </section>
  )
}

/** The banner while the mode loads: the same frame and height, a bar where the name will stand. */
export function ModeBannerSkeleton({ wide }: { wide: boolean }) {
  return (
    <div
      className={wide ? "wiki-mode-banner wiki-frame" : "wiki-mode-banner"}
      data-layout={wide ? "wide" : "compact"}
      data-skeleton=""
    >
      <div className="wiki-mode-banner-text">
        <span className="wiki-mode-banner-bar" />
      </div>
    </div>
  )
}
