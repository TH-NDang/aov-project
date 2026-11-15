import type { HeroContentTab } from "./hero-location"

/** The element id of a content tab's panel; links and the `?tab=` address land on it. */
export const heroContentSectionId = (tab: HeroContentTab) => `hero-content-${tab}`

const HERO_CONTENT_TABS: readonly HeroContentTab[] = ["overview", "skills", "skins", "media", "videos"]

/** The tabs a hero shows: videos belong to a saved hero, so a new one has none yet. */
export const heroContentTabs = (videos: boolean) => HERO_CONTENT_TABS.filter((tab) => videos || tab !== "videos")
