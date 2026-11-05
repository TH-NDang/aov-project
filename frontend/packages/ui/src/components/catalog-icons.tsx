import { createArtworkIcon } from "./artwork-icon"

const artwork = new URL("../assets/catalog-art.svg?no-inline", import.meta.url).href

export const catalogIcons = {
  heroes: createArtworkIcon(artwork, "hero"),
  skins: createArtworkIcon(artwork, "skin"),
  items: createArtworkIcon(artwork, "items"),
  enchantments: createArtworkIcon(artwork, "enchantments"),
  arcana: createArtworkIcon(artwork, "arcana"),
  spells: createArtworkIcon(artwork, "spells"),
}
