import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { cn } from "@aov/ui/lib/utils"
import { catalogIcons } from "@aov/ui/components/catalog-icons"

/** Catalog navigation shares its artwork with the public wiki. */
export const NAV_ICONS = { ...navArtIcons, ...catalogIcons }

export type AovNavIconName = keyof typeof NAV_ICONS

export function AovNavIcon({ name, className }: { name: AovNavIconName; className?: string }) {
  const Icon = NAV_ICONS[name]
  return <Icon className={cn("size-6 shrink-0", className)} />
}
