import type { CSSProperties } from "react"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { enchantmentRows, type WarehouseEnchantment } from "./use-item-catalog"
import { WarehouseArtwork } from "./warehouse-artwork"
import { EmptyGroup, romanTier } from "./warehouse-parts"
import {
  warehouseName,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseEntry,
  type WarehouseGroup,
} from "../../lib/warehouse-types"

function EnchantmentNode({
  entry,
  selected,
  onOpen,
}: {
  entry: WarehouseEnchantment
  selected: boolean
  onOpen: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const name = warehouseName(entry, locale)
  const summary = warehouseText(entry.content.translations, locale)?.summary
  return (
    <button
      type="button"
      className="wiki-enchantment-node"
      aria-pressed={selected}
      aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
      onClick={(event) => onOpen(entry, event.currentTarget)}
    >
      <WarehouseArtwork entry={entry} kind="enchantments" />
      <span>
        <strong>{name}</strong>
        {summary && <small>{summary}</small>}
      </span>
    </button>
  )
}

/** Each branch as the game draws it: three tiers, and in a tier the enchantments a player chooses between. */
export function EnchantmentCatalog({
  entries,
  groups,
  group,
  selectedId,
  onSelect,
}: {
  /** Entries left by the page search. */
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  group: string
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button?: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const rows = enchantmentRows(entries, group, groups, locale)
  const branches = [...new Set(rows.map((entry) => entry.content.branchCode))]
  if (!rows.length) return <EmptyGroup />
  return (
    <div className="wiki-enchantments" data-single={branches.length === 1 || undefined}>
      {branches.map((code) => {
        const branch = groups.find((candidate) => candidate.code === code)
        const text = branch && warehouseText(branch.translations, locale)
        const name = text?.name || code
        const icon = branch?.icon?.currentVersion?.url
        const members = rows.filter((entry) => entry.content.branchCode === code)
        const tiers = [...new Set(members.map((entry) => entry.content.tier))]
        return (
          <section key={code} className="wiki-enchantment-branch" aria-label={name}>
            <header>
              {icon && <WikiImage className="wiki-enchantment-branch-art" src={icon} alt="" width="40" height="40" />}
              <div>
                <h2>
                  {name}
                  <small>{members.length}</small>
                </h2>
                {text?.description && <p>{text.description}</p>}
              </div>
            </header>
            {tiers.map((tier) => {
              const nodes = members.filter((entry) => entry.content.tier === tier)
              const label = `${wikiText(locale, "Cấp", "Tier")} ${romanTier(tier)}`
              return (
                <div key={tier} className="wiki-enchantment-tier" role="group" aria-label={label}>
                  <span title={label} aria-hidden="true">
                    {romanTier(tier)}
                  </span>
                  {/* Two or three enchantments share the row evenly, so a tier of two leaves no hole. */}
                  <div style={{ "--nodes": nodes.length } as CSSProperties}>
                    {nodes.map((entry) => (
                      <EnchantmentNode
                        key={entry.id}
                        entry={entry}
                        selected={entry.id === selectedId}
                        onOpen={onSelect}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
