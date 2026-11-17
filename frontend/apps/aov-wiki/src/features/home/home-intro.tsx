import type { CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiSearch } from "../../components/wiki-search"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { usePublishedChanges } from "../../lib/wiki-patch-changes"
import { seasonUpdatesQuery } from "./home-api"
import { bannerOfDay } from "./home-banners"
import { patchDayLabel } from "./patch-day-label"
import { SITE_NAME } from "../../lib/seo/page-meta"

/**
 * The opening of the home page: what the Wiki is, the search that reaches every published name, and one line about the
 * version the data comes from.
 */
export function HomeIntro() {
  const scope = useWikiContext()
  const { locale, href, region, regions } = scope
  const updates = useQuery(seasonUpdatesQuery(scope))
  const { subjects } = usePublishedChanges("HERO")
  const banner = bannerOfDay()
  const current = updates.data?.patches.find((patch) => patch.isCurrent)
  const date = current?.effectiveOn ?? current?.effectiveAt ?? ""

  return (
    <section
      className="wiki-home-intro"
      style={{ "--home-art": `url("${banner.image}")`, "--home-art-position": banner.position } as CSSProperties}
    >
      <div className="wiki-home-intro-inner">
        <p className="wiki-home-eyebrow">{SITE_NAME} · Liên Quân Mobile</p>
        <h1>
          {wikiText(
            locale,
            "Tra cứu tướng, trang bị và mọi thay đổi của Liên Quân",
            "Look up heroes, equipment and every change in Arena of Valor",
          )}
        </h1>
        <WikiSearch size="hero" />
        {current && (
          <Link className="wiki-home-patch-pill" to={href(`/updates/${current.code}`)}>
            <span className="wiki-home-live" aria-hidden="true" />
            <span>
              {wikiText(locale, "Bản ", "Version ")}
              <LocalTime
                value={date}
                sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
                label={(zone) => patchDayLabel(date, zone)}
                fallback={current.code}
              />
            </span>
            <span className="wiki-home-patch-pill-title">{current.title || current.code}</span>
            {subjects.size > 0 && (
              <span className="wiki-home-patch-pill-count">
                {wikiText(locale, `${subjects.size} tướng thay đổi`, `${subjects.size} heroes changed`)}
              </span>
            )}
            <WikiIcon name="arrow" size={16} />
          </Link>
        )}
      </div>
      <span className="wiki-home-art-credit">{banner.character}</span>
    </section>
  )
}
