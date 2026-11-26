import type { CSSProperties } from "react"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { bannerOfDay, HOME_BANNER_WIDTH } from "../../lib/home-banners"
import { resizedImageUrl } from "../../lib/sized-image"
import "./home-intro.css"

/**
 * The opening of the home page: a short title on a stage lit by the artwork of the day. The artwork stands large on the
 * right; a blurred copy of it washes its colours across the whole width, so the band is as rich on the left as on the
 * right. Search stays in the header.
 */
export function HomeIntro() {
  const { locale } = useWikiContext()
  const banner = bannerOfDay()

  return (
    <section
      className="wiki-home-intro"
      aria-labelledby="wiki-home-title"
      style={
        {
          // The same copy the static home page preloads.
          "--home-art": `url("${resizedImageUrl(banner.image, HOME_BANNER_WIDTH)}")`,
          "--home-wash": `url("${resizedImageUrl(banner.image, 384)}")`,
          "--home-art-position": banner.position,
        } as CSSProperties
      }
    >
      <span className="wiki-home-stage" aria-hidden="true">
        <span className="wiki-home-stage-wash" />
        <span className="wiki-home-stage-art" />
        <span className="wiki-home-stage-scrim" />
      </span>
      <div className="wiki-home-intro-inner">
        <h1 id="wiki-home-title">
          {wikiText(locale, "Cẩm nang ", "The ")}
          <em>{wikiText(locale, "Liên Quân Mobile", "Arena of Valor")}</em>
          {wikiText(locale, "", " handbook")}
        </h1>
      </div>
      <span className="wiki-home-art-credit">{banner.character}</span>
    </section>
  )
}
