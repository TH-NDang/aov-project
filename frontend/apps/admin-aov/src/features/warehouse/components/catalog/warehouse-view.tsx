import type { ReactNode } from "react"
import { WarehouseViewProvider } from "@aov/ui/components/warehouse/warehouse-view"
import { HeroAsset } from "@/features/publishing/components/editing/hero-asset"
import { CatalogChangeBadges } from "../history/catalog-changes"
export function AdminWarehouseView({ children }: { children: ReactNode }) {
  return (
    <WarehouseViewProvider Asset={HeroAsset} Badges={CatalogChangeBadges}>
      {children}
    </WarehouseViewProvider>
  )
}
