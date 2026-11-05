import { createArtworkIcon } from "./artwork-icon"

const artwork = new URL("../assets/nav-art.svg?no-inline", import.meta.url).href

/** Navigation artwork shared by every app. */
export const navArtIcons = {
  dashboard: createArtworkIcon(artwork, "dashboard"),
  imageLibrary: createArtworkIcon(artwork, "imageLibrary"),
  profile: createArtworkIcon(artwork, "profile"),
  users: createArtworkIcon(artwork, "users"),
  characterBook: createArtworkIcon(artwork, "characterBook"),
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
