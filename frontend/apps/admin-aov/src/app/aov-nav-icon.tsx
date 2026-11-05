import { createArtworkIcon } from "@aov/ui/components/artwork-icon"
import { cn } from "@aov/ui/lib/utils"
import { catalogIcons } from "@aov/ui/components/catalog-icons"

const artwork = new URL("./admin-nav-art.svg?no-inline", import.meta.url).href

/** Catalog navigation shares its artwork with the public wiki. */
export const NAV_ICONS = {
  dashboard: createArtworkIcon(artwork, "dashboard"),
  imageLibrary: createArtworkIcon(artwork, "imageLibrary"),
  profile: createArtworkIcon(artwork, "profile"),
  users: createArtworkIcon(artwork, "users"),
  characterBook: createArtworkIcon(artwork, "characterBook"),
  ...catalogIcons,
  heroMedia: createArtworkIcon(artwork, "heroMedia"),
  portrait: createArtworkIcon(artwork, "portrait"),
  head: createArtworkIcon(artwork, "head"),
  cover: createArtworkIcon(artwork, "cover"),
  badges: createArtworkIcon(artwork, "badges"),
  armory: createArtworkIcon(artwork, "armory"),
  releases: createArtworkIcon(artwork, "releases"),
  glossary: createArtworkIcon(artwork, "glossary"),
  competition: createArtworkIcon(artwork, "competition"),
  competitionProfile: createArtworkIcon(artwork, "competitionProfile"),
  moderation: createArtworkIcon(artwork, "moderation"),
  tournaments: createArtworkIcon(artwork, "tournaments"),
  teams: createArtworkIcon(artwork, "teams"),
  players: createArtworkIcon(artwork, "players"),
  streams: createArtworkIcon(artwork, "streams"),
  page: createArtworkIcon(artwork, "page"),
  organizations: createArtworkIcon(artwork, "organizations"),
  circuits: createArtworkIcon(artwork, "circuits"),
  coaches: createArtworkIcon(artwork, "coaches"),
  broadcast: createArtworkIcon(artwork, "broadcast"),
}

export type AovNavIconName = keyof typeof NAV_ICONS

export function AovNavIcon({ name, className }: { name: AovNavIconName; className?: string }) {
  const Icon = NAV_ICONS[name]
  return <Icon className={cn("size-6 shrink-0", className)} />
}
