import * as React from "react"
import { Footprints, HeartHandshake, Package, Shield, Sword, Trees, WandSparkles, type LucideIcon } from "lucide-react"

type CategoryIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string }
type CategoryIcon = React.ComponentType<CategoryIconProps>

/** A line icon of the set the interface already uses, in the group's own colour from the status tokens. */
function tinted(Icon: LucideIcon, tone: string): CategoryIcon {
  return function CategoryIcon({ size = 24, style, ...props }: CategoryIconProps) {
    return <Icon size={size} strokeWidth={2} style={{ color: tone, ...style }} {...props} />
  }
}

/** Each shop group's own colour, from the status tokens; its icon is drawn in it and a page may mark the group with it. */
const TONES: Record<string, string> = {
  cong: "var(--aov-warning)",
  phep: "var(--aov-stream-lavender)",
  thu: "var(--aov-info)",
  "toc-chay": "var(--aov-wiki-success)",
  "di-rung": "var(--aov-success)",
  "phu-tro": "var(--aov-danger)",
}

export function itemCategoryTone(code: string | null | undefined): string | undefined {
  return code ? TONES[code] : undefined
}

/** Uploaded group artwork takes priority over these shared category icons. */
const fallbackIcons: Record<string, CategoryIcon> = {
  cong: tinted(Sword, TONES.cong),
  phep: tinted(WandSparkles, TONES.phep),
  thu: tinted(Shield, TONES.thu),
  "toc-chay": tinted(Footprints, TONES["toc-chay"]),
  "di-rung": tinted(Trees, TONES["di-rung"]),
  "phu-tro": tinted(HeartHandshake, TONES["phu-tro"]),
}

export function itemCategoryFallback(code: string | null | undefined): CategoryIcon {
  return (code && fallbackIcons[code]) || Package
}

export function ItemCategoryArtwork({ code, size = 20, ...props }: CategoryIconProps & { code?: string | null }) {
  const Icon = itemCategoryFallback(code)
  return <Icon aria-hidden="true" size={size} {...props} />
}
