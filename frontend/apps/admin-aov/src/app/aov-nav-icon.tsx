import { gameIcon } from "@aov/ui/components/game-icons"
import { cn } from "@aov/ui/lib/utils"

/**
 * Navigation marks, from Game Icons, as the public wiki draws its sections: the entries the wiki also has use the same
 * icon there and here. The names are those of the navigation, so the pages that pick an icon by name stay as they are.
 */
export const NAV_ICONS = {
  home: gameIcon("family-house"),
  wiki: gameIcon("book-cover"),
  game: gameIcon("world"),
  system: gameIcon("stack"),
  dashboard: gameIcon("speedometer"),
  imageLibrary: gameIcon("wood-frame"),
  profile: gameIcon("person"),
  users: gameIcon("three-friends"),
  heroes: gameIcon("samurai-helmet"),
  skins: gameIcon("robe"),
  heroMedia: gameIcon("mona-lisa"),
  portrait: gameIcon("portrait"),
  head: gameIcon("woman-elf-face"),
  cover: gameIcon("stick-frame"),
  badges: gameIcon("rank-3"),
  builds: gameIcon("anvil-impact"),
  ranking: gameIcon("podium-winner"),
  items: gameIcon("battle-gear"),
  enchantments: gameIcon("winged-emblem"),
  arcana: gameIcon("gem-pendant"),
  spells: gameIcon("magic-swirl"),
  gameModes: gameIcon("gamepad"),
  releases: gameIcon("tied-scroll"),
  glossary: gameIcon("spell-book"),
  videos: gameIcon("clapperboard"),
  patchWatch: gameIcon("newspaper"),
  streams: gameIcon("tv"),
  competition: gameIcon("crossed-swords"),
  competitionProfile: gameIcon("id-card"),
  tournaments: gameIcon("trophy-cup"),
  page: gameIcon("papers"),
  moderation: gameIcon("gavel"),
  organizations: gameIcon("castle"),
  circuits: gameIcon("laurels"),
  teams: gameIcon("meeple-group"),
  players: gameIcon("swordman"),
  coaches: gameIcon("teacher"),
  broadcast: gameIcon("microphone"),
  creators: gameIcon("falling-star"),
}

export type AovNavIconName = keyof typeof NAV_ICONS

export function AovNavIcon({ name, className }: { name: AovNavIconName; className?: string }) {
  const Icon = NAV_ICONS[name]
  return <Icon className={cn("size-6 shrink-0", className)} />
}
