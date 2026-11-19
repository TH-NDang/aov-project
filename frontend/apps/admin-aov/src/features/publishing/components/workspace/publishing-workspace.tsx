import { HeroWorkspace, type HeroWorkspaceProps } from "./hero-workspace"
import { PublishingHeroList } from "./publishing-hero-list"

/** The hero list without a hero, the page of that hero with one; the drawer of the list opens the same page. */
export function PublishingWorkspace(props: HeroWorkspaceProps) {
  return props.heroId ? <HeroWorkspace {...props} /> : <PublishingHeroList />
}
