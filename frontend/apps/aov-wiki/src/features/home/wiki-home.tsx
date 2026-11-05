import { HomeCarousel } from "./home-carousel"
import { HomeCategories } from "./home-categories"
import { HomePatchHeroes } from "./home-patch-heroes"
import { SeasonUpdates } from "./season-updates"
import "./wiki-home.css"

export function WikiHome() {
  return (
    <div className="wiki-home">
      <HomeCarousel />
      <div className="wiki-home-guide">
        <HomeCategories />
        <SeasonUpdates />
      </div>
      <HomePatchHeroes />
    </div>
  )
}
