import { HomeIntro } from "./home-intro"
import { HomePatchChanges } from "./home-patch-changes"
import { HomeRoles } from "./home-roles"
import { HomeSections } from "./home-sections"
import { SeasonUpdates } from "./season-updates"
import "./wiki-home.css"

/**
 * The home page, in the order a reader needs it: find something by name, pick a section, see what the version in force
 * changed. The same order serves both layouts; only the proportions differ.
 */
export function WikiHome() {
  return (
    <div className="wiki-home">
      <HomeIntro />
      <div className="wiki-home-body">
        <HomeSections />
        <div className="wiki-home-columns">
          <HomePatchChanges />
          <div className="wiki-home-side">
            <SeasonUpdates />
            <HomeRoles />
          </div>
        </div>
      </div>
    </div>
  )
}
