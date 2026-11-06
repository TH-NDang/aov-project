import { HomeCarousel } from "./home-carousel"
import { HomeCategories } from "./home-categories"
import { HomePatchHeroes } from "./home-patch-heroes"
import { SeasonUpdates } from "./season-updates"
import "./wiki-home.css"

export function WikiHome() {
  return (
    <div className="wiki-home">
      <div className="wiki-home-top">
        <HomeCarousel />
        <div className="public-panel wiki-slip wiki-home-news">
          <SeasonUpdates />
        </div>
      </div>
      <div className="public-panel wiki-slip wiki-home-sections">
        <HomeCategories />
      </div>
      <div className="public-panel wiki-slip wiki-home-strip">
        <HomePatchHeroes />
      </div>
    </div>
  )
}
