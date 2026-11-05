import * as React from "react"
import { Package } from "lucide-react"
import { createArtworkIcon } from "./artwork-icon"

const artwork = new URL("../assets/item-category-art.svg?no-inline", import.meta.url).href
type CategoryIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string }
type CategoryIcon = React.ComponentType<CategoryIconProps>

/** Uploaded group artwork takes priority over these shared category illustrations. */
const fallbackIcons: Record<string, CategoryIcon> = {
  cong: createArtworkIcon(artwork, "attack"),
  phep: createArtworkIcon(artwork, "magic"),
  thu: createArtworkIcon(artwork, "defense"),
  "toc-chay": createArtworkIcon(artwork, "movement"),
  "di-rung": createArtworkIcon(artwork, "jungle"),
  "phu-tro": createArtworkIcon(artwork, "support"),
}

export function itemCategoryFallback(code: string | null | undefined): CategoryIcon {
  return (code && fallbackIcons[code]) || Package
}

export function ItemCategoryArtwork({ code, size = 20, ...props }: CategoryIconProps & { code?: string | null }) {
  const Icon = itemCategoryFallback(code)
  return <Icon aria-hidden="true" size={size} {...props} />
}
