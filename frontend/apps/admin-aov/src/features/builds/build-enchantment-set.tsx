import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  EnchantmentSetBuilder,
  type SetBuilderBranch,
  type SetBuilderEnchantment,
} from "@aov/ui/components/warehouse/enchantment-set-builder"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import type { EnchantmentSet } from "@aov/ui/lib/enchantment-set"
import { warehouseText, type EnchantmentContent } from "@aov/ui/lib/warehouse-content"
import { backendRequest } from "@/app/auth/session"
import { defaultRulesetId } from "@/lib/default-ruleset"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import { useContentLocale } from "@/features/publishing/api/publication-overview"
import { HeroAsset } from "@/features/publishing/components/editing/hero-asset"
import { useWarehouseCatalog, useWarehouseMetadata } from "@/features/warehouse/api/warehouse-api"
import type { WarehouseEntry } from "@/features/warehouse/model/warehouse-types"

const publishing = createPublishingApi(backendRequest)
const vietnamese = (vi: string) => vi

/**
 * A build's five enchantments on the game's set screen: the primary branch with its three tiers, then the two
 * secondary ones, each spot opening the choices the game allows there. Without `onChange` it only shows the set.
 */
export function BuildEnchantmentSet({
  value,
  onChange,
}: {
  value: (string | null)[]
  onChange?: (next: (string | null)[]) => void
}) {
  const locale = useContentLocale()
  const rulesets = useQuery({ queryKey: publishingKeys.rulesets, queryFn: publishing.rulesets, staleTime: 60000 })
  const catalog = useWarehouseCatalog("enchantments", defaultRulesetId(rulesets.data), locale)
  const metadata = useWarehouseMetadata("enchantments")

  const branches: SetBuilderBranch[] = useMemo(
    () =>
      [...(metadata.data ?? [])]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((branch) => {
          const copy = warehouseText(branch.translations, locale)
          return {
            code: branch.code,
            name: copy?.name || branch.code,
            color: enchantmentBranchColor(branch),
            suitability: copy?.suitability || copy?.description,
            icon: (
              <HeroAsset id={branch.iconAssetId} frameAspectRatio={1} className="size-full border-0 bg-transparent" />
            ),
          }
        }),
    [metadata.data, locale],
  )
  const enchantments: SetBuilderEnchantment[] = useMemo(
    () =>
      ((catalog.data ?? []) as WarehouseEntry<EnchantmentContent>[]).map((entry) => {
        const copy = warehouseText(entry.content.translations, locale)
        return {
          id: entry.id,
          branchCode: entry.content.branchCode,
          tier: entry.content.tier,
          position: entry.content.position,
          name: copy?.name || entry.code,
          summary: copy?.summary,
          description: copy?.description,
          icon: (
            <HeroAsset
              id={entry.content.iconAssetId}
              frameAspectRatio={1}
              className="size-full rounded-full border-0 bg-transparent"
            />
          ),
          use: entry.content,
        }
      }),
    [catalog.data, locale],
  )

  if (catalog.isPending || metadata.isPending) return <p className="type-meta">Đang tải phù hiệu…</p>
  return (
    <EnchantmentSetBuilder
      branches={branches}
      enchantments={enchantments}
      value={value as EnchantmentSet}
      onChange={onChange}
      text={vietnamese}
    />
  )
}
