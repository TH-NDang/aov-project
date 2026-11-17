import type { ReactNode } from "react"
import { WarehouseViewProvider } from "@aov/ui/components/warehouse/warehouse-view"
import { HeroAsset } from "@/features/publishing/components/hero-asset"
import { CatalogChangeBadges } from "./catalog-changes"
export function AdminWarehouseView({ children }: { children: ReactNode }) {
  return (
    <WarehouseViewProvider Asset={HeroAsset} Badges={CatalogChangeBadges}>
      {children}
    </WarehouseViewProvider>
  )
}
