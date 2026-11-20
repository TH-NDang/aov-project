import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import {
  EnchantmentSetBuilder,
  type SetBuilderBranch,
  type SetBuilderEnchantment,
} from "@aov/ui/components/warehouse/enchantment-set-builder"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { startSet, type EnchantmentSet } from "@aov/ui/lib/enchantment-set"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import {
  warehouseName,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
} from "../../lib/warehouse-types"
import { WarehouseArtwork } from "./warehouse-artwork"
import type { WarehouseEnchantment } from "./use-item-catalog"

/** A branch description that opens with its suitability label reads as the suitability alone. */
const suitabilityOf = (description: string | null | undefined) =>
  description?.replace(/^\s*(thích hợp|suits?)\s*:\s*/i, "").trim() || null

/**
 * The enchantments page as the game's set screen: pick a primary branch, its three tiers and two secondary
 * enchantments, and read each one beside the set. The set lives in the address (`set=` with five codes), so a link
 * shares it.
 */
export function EnchantmentSetView({
  entries,
  groups,
  params,
  onFilters,
}: {
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  params: URLSearchParams
  onFilters: (filters: Record<string, string | null>) => void
}) {
  const scope = useWikiContext()
  const text = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const references = useQuery(wikiReferencesQuery(scope))

  const records = useMemo(
    () => entries.filter((entry): entry is WarehouseEnchantment => entry.kind === "enchantments"),
    [entries],
  )
  const branches: SetBuilderBranch[] = useMemo(
    () =>
      groups.map((group) => {
        const copy = warehouseText(group.translations, scope.locale)
        const icon = group.icon?.currentVersion?.url
        return {
          code: group.code,
          name: copy?.name || group.code,
          color: enchantmentBranchColor(group),
          suitability: suitabilityOf(copy?.description),
          icon: icon ? <WikiImage src={icon} alt="" width="84" height="84" /> : null,
        }
      }),
    [groups, scope.locale],
  )
  const enchantments: SetBuilderEnchantment[] = useMemo(
    () =>
      records.map((entry) => {
        const copy = warehouseText(entry.content.translations, scope.locale)
        return {
          id: entry.id,
          branchCode: entry.content.branchCode,
          tier: entry.content.tier,
          position: entry.content.position,
          name: warehouseName(entry, scope.locale),
          summary: copy?.summary,
          description: copy?.description,
          icon: <WarehouseArtwork entry={entry} kind="enchantments" />,
          use: entry.content,
        }
      }),
    [records, scope.locale],
  )

  // The set is read from its codes in the address; an unknown or missing one starts a set of the first branch.
  const codes = branches.map((branch) => branch.code)
  const fromAddress = (params.get("set") ?? "").split(",").map((code) => records.find((entry) => entry.code === code))
  const value: EnchantmentSet =
    fromAddress.length === 5 && fromAddress.every(Boolean)
      ? fromAddress.map((entry) => entry!.id)
      : codes.length
        ? startSet(codes[0]!, enchantments, codes)
        : []
  const write = (next: EnchantmentSet) =>
    onFilters({
      set: next.map((id) => records.find((entry) => entry.id === id)?.code ?? "").join(","),
    })

  if (!branches.length || !enchantments.length) return null
  return (
    <EnchantmentSetBuilder
      branches={branches}
      enchantments={enchantments}
      value={value}
      onChange={write}
      text={text}
      renderText={(body) => (
        <EntityRichText
          text={body}
          entities={references.data?.entities}
          locale={scope.locale}
          fallbackLocale={references.data?.fallbackLocale}
          autoRecognize={references.data?.autoRecognize ?? false}
          context="wiki"
        />
      )}
    />
  )
}
