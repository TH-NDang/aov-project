import { HomeCarousel } from "./home-carousel"
import { HomeCategories } from "./home-categories"
import { SeasonUpdates } from "./season-updates"
import "./wiki-home.css"

export function WikiHome() {
  return (
    <div className="wiki-home">
      <section className="wiki-home-welcome" aria-labelledby="wiki-welcome-title">
        <h1 id="wiki-welcome-title">Chào mừng đến với AOV WiKi</h1>
        <p>Cùng khám phá những điều còn ẩn giấu.</p>
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
