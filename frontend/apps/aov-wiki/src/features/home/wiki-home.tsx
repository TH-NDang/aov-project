import { HomeExplore } from "./home-explore"
import { HomeIntro } from "./home-intro"
import { HomePatch } from "./home-patch"
import "./wiki-home.css"

/**
 * The home page, in the order a reader needs it: what the version in force changed and the season's other versions,
 * then every section. The same order serves both layouts; only the proportions differ.
 */
export function WikiHome() {
  return (
    <div className="wiki-home">
      <HomeIntro />
      <div className="wiki-home-body">
        <HomePatch />
        <HomeExplore />
      </div>
    </div>
  )
}
