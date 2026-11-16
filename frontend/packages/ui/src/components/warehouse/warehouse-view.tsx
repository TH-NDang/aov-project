import { createContext, useContext, type ComponentType, type ReactNode } from "react"
import type { CatalogBadgeKind } from "@aov/ui/lib/warehouse-content"

export interface WarehouseImageProps {
  id?: string | null
  alt?: string
  className?: string
  frameAspectRatio?: number
  preview?: boolean
}
type BadgeProps = { kinds: readonly CatalogBadgeKind[]; compact?: boolean }
interface WarehouseView {
  Asset: ComponentType<WarehouseImageProps>
  language?: string
  Badges?: ComponentType<BadgeProps>
}

const Context = createContext<WarehouseView | null>(null)
export function WarehouseViewProvider({ children, ...view }: WarehouseView & { children: ReactNode }) {
  return <Context.Provider value={view}>{children}</Context.Provider>
}
export function WarehouseAsset(props: WarehouseImageProps) {
  const view = useContext(Context)
  if (!view) throw new Error("Missing warehouse presentation provider")
  return <view.Asset {...props} />
}
export function WarehouseBadges(props: BadgeProps) {
  const Badges = useContext(Context)?.Badges
  return Badges ? <Badges {...props} /> : null
}
export function cardChangeKinds(kinds: readonly CatalogBadgeKind[] = []) {
  return kinds.filter((kind) => kind !== "INHERITED")
}

const viText = (vi: string, _en: string) => vi
const enText = (_vi: string, en: string) => en
/** The language of the warehouse screen. Admin sets none, so it stays Vietnamese whatever the content locale is. */
export function useWarehouseLanguage() {
  return useContext(Context)?.language ?? "vi-VN"
}
export function useWarehouseText() {
  return useWarehouseLanguage().startsWith("en") ? enText : viText
}
