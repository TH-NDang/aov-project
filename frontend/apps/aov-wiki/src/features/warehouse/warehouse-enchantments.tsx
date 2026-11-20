import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { CSSProperties } from "react"
import { enchantmentBranchColor } from "@aov/ui/lib/enchantment-colors"
import { enchantmentColumn } from "@aov/ui/lib/warehouse-content"
import { enchantmentActivationName, enchantmentUsesText } from "@aov/ui/lib/enchantment-use"
import { WikiIcon } from "../../components/wiki-icon"
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
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { activation, maxUses } = entry.content
  // An enchantment the player triggers, or one that changes the talent, is marked in the corner.
  const marked = activation === "ACTIVE" || activation === "TALENT_UPGRADE"
  const mark = marked
    ? [enchantmentActivationName(activation, text), enchantmentUsesText(maxUses, text)].filter(Boolean).join(" · ")
    : null
  return (
    <button
      type="button"
      className="wiki-enchantment-node"
      style={{ gridColumn: enchantmentColumn(entry.content.position) ?? undefined }}
      aria-pressed={selected}
      aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
      onClick={(event) => onOpen(entry, event.currentTarget)}
    >
      {mark && (
        <span className="wiki-enchantment-mark" data-activation={activation} title={mark}>
          <WikiIcon name={activation === "ACTIVE" ? "spark" : "switch"} size={12} />
          <span className="sr-only">{mark}</span>
        </span>
      )}
      <WarehouseArtwork entry={entry} kind="enchantments" />
      <span title={summary ? `${name} · ${summary}` : name}>
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
          <section
            key={code}
            className="wiki-enchantment-branch"
            aria-label={name}
            style={
              { "--branch-color": enchantmentBranchColor({ code, color: branch?.color ?? null }) } as CSSProperties
            }
          >
            <header>
              {icon && <WikiImage className="wiki-enchantment-branch-art" src={icon} alt="" width="44" height="44" />}
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
                  {/* Three places in every tier, each enchantment in its own, so the columns line up down the branch. */}
                  <div>
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
