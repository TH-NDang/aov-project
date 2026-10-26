import { HomeCarousel } from "./home-carousel"
import { HomeCategories } from "./home-categories"
import { SeasonUpdates } from "./season-updates"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import "./wiki-home.css"

export function WikiHome() {
  const { locale } = useWikiContext()
  return (
    <div className="wiki-home">
      <section className="wiki-home-welcome" aria-labelledby="wiki-welcome-title">
        <h1 id="wiki-welcome-title">{wikiText(locale, "Chào mừng đến với AOV WiKi", "Welcome to AOV WiKi")}</h1>
        <p>
          {wikiText(locale, "Cùng khám phá những điều còn ẩn giấu.", "Discover the stories waiting to be unearthed.")}
        </p>
      </section>
      <div className="wiki-home-hub">
        <div className="wiki-home-featured">
          <HomeCarousel />
          <SeasonUpdates />
        </div>
        <HomeCategories />
      </div>
    </div>
  )
}
