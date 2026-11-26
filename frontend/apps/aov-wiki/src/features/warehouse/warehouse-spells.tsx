import { useState, type CSSProperties } from "react"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { isRetiredSpell, spellRows, type WarehouseSpell } from "./use-item-catalog"
import { WarehouseArtwork } from "./warehouse-artwork"
import { WarehouseEntryLink } from "./warehouse-entry-link"
import { fillStyle } from "./warehouse-grid"
import { EmptyGroup, FoldedGroup } from "./warehouse-parts"
import {
  warehouseName,
  warehouseText,
  type PublishedWarehouseRecord,
  type WarehouseEntry,
} from "../../lib/warehouse-types"
import { formatGameNumber } from "@aov/ui/lib/game-number"

/**
 * A cooldown as the game writes it, in seconds; from a minute up, the minutes follow after an "about" sign, so a long
 * wait reads at a glance: ninety seconds also reads as about 1.5 minutes.
 */
export function spellCooldownText(seconds: number | null | undefined, locale: string) {
  if (seconds == null) return wikiText(locale, "Chưa rõ hồi chiêu", "Cooldown unknown")
  const exact = wikiText(locale, `${formatGameNumber(seconds)} giây`, `${formatGameNumber(seconds)} s`)
  if (seconds < 60) return exact
  const minutes = formatGameNumber(seconds / 60, 1)
  return `${exact} ≈ ${wikiText(locale, `${minutes} phút`, `${minutes} min`)}`
}

/**
 * What the talent does, for its card. The game's text opens with the cooldown the card already states beside the
 * clock, so those words are left out here; the entry itself shows the text as written.
 */
function spellSummary(description: string | null | undefined, cooldown: number | null) {
  const plain = referenceInputPlainText(description ?? "").trim()
  const opening = cooldown == null ? null : new RegExp(`^${cooldown}\\s*giây hồi chiêu\\s*:\\s*`, "i").exec(plain)
  if (!opening) return plain
  const rest = plain.slice(opening[0].length)
  return rest.charAt(0).toLocaleUpperCase("vi") + rest.slice(1)
}

/**
 * Whether a talent keeps several charges, as Punish does: it can be cast again after its short cooldown while a charge
 * is left, and each charge it spends comes back on its own, more slowly.
 */
export function spellKeepsCharges(content: WarehouseSpell["content"]) {
  return (content.maxCharges ?? 0) > 1
}

/** The charges a talent keeps, one gilded pip each, as the game shows them stacked by its icon. */
export function SpellChargePips({ count }: { count: number }) {
  return (
    <span className="wiki-spell-pips" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  )
}

/** How many charges a talent keeps and how often one comes back, such as two charges with one back every 45 seconds. */
export function spellChargesText(content: WarehouseSpell["content"], locale: string) {
  if (!spellKeepsCharges(content)) return null
  const holds = wikiText(locale, `Tích trữ ${content.maxCharges} lần`, `Holds ${content.maxCharges} charges`)
  const recharge = content.chargeRechargeSeconds
  return recharge
    ? `${holds} · ${wikiText(locale, `mỗi lần hồi ${formatGameNumber(recharge)} giây`, `one back every ${formatGameNumber(recharge)} s`)}`
    : holds
}

function SpellCard({
  entry,
  selected,
  onOpen,
}: {
  entry: WarehouseSpell
  selected: boolean
  onOpen: (entry: WarehouseEntry, element: HTMLElement) => void
}) {
  const { locale } = useWikiContext()
  const { content } = entry
  const name = warehouseName(entry, locale)
  const text = warehouseText(content.translations, locale)
  const description = spellSummary(text?.description || text?.summary, content.cooldownSeconds)
  const state = content.states.find((candidate) => candidate.key === content.defaultStateKey) ?? content.states[0]
  const charges = spellChargesText(content, locale)
  return (
    <WarehouseEntryLink
      kind="spells"
      entry={entry}
      selected={selected}
      onOpen={onOpen}
      className="wiki-spell-card"
      data-spell-card={entry.id}
      aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
    >
      <WarehouseArtwork entry={entry} kind="spells" assetId={state?.iconAssetId ?? content.iconAssetId} />
      <span className="wiki-spell-card-text">
        <strong>{name}</strong>
        <span className="wiki-spell-card-meta">
          <span>
            <WikiIcon name="clock" size={14} />
            <span className="sr-only">{wikiText(locale, "Hồi chiêu", "Cooldown")}</span>
            {spellCooldownText(content.cooldownSeconds, locale)}
            {/* With charges, the cooldown is only the pause between two casts. */}
            {spellKeepsCharges(content) && wikiText(locale, " giữa hai lần dùng", " between casts")}
          </span>
          {content.states.length > 1 && (
            <span>{wikiText(locale, `${content.states.length} dạng`, `${content.states.length} forms`)}</span>
          )}
          {content.availability === "REMOVED" && <span>{wikiText(locale, "Đã gỡ", "Retired")}</span>}
        </span>
        {charges && content.maxCharges && (
          <span className="wiki-spell-card-charges">
            <SpellChargePips count={content.maxCharges} />
            {charges}
          </span>
        )}
        {description && <span className="wiki-spell-card-description">{description}</span>}
      </span>
    </WarehouseEntryLink>
  )
}

/** All talents with what they do in view; the ones no longer in the game wait in a folded group. */
export function SpellCatalog({
  entries,
  params,
  searching,
  selectedId,
  onSelect,
}: {
  /** Entries left by the page search. */
  entries: PublishedWarehouseRecord[]
  params: URLSearchParams
  searching: boolean
  selectedId: string | null
  onSelect: (entry: WarehouseEntry, button?: HTMLElement) => void
}) {
  const { locale } = useWikiContext()
  const rows = spellRows(entries, locale)
  const current = rows.filter((entry) => !isRetiredSpell(entry))
  const retired = rows.filter(isRetiredSpell)
  // What the reader chose by hand; untouched, the group opens for a search, an old link to it or an open entry.
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open =
    chosen ??
    (searching ||
      !current.length ||
      params.get("availability") === "REMOVED" ||
      retired.some((entry) => entry.id === selectedId))
  const grid = (list: WarehouseSpell[]) => (
    <div className="wiki-spell-grid" style={fillStyle(list.length) as CSSProperties}>
      {list.map((entry) => (
        <SpellCard key={entry.id} entry={entry} selected={entry.id === selectedId} onOpen={onSelect} />
      ))}
    </div>
  )
  if (!rows.length) return <EmptyGroup />
  return (
    <div className="wiki-spells">
      {current.length > 0 && grid(current)}
      {retired.length > 0 && (
        <FoldedGroup
          title={wikiText(locale, "Phụ trợ cũ", "Archived talents")}
          count={retired.length}
          open={open}
          onToggle={() => setChosen(!open)}
        >
          {grid(retired)}
        </FoldedGroup>
      )}
    </div>
  )
}
