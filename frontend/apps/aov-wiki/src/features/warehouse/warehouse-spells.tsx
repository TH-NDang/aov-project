import { useState, type CSSProperties } from "react"
import { referenceInputPlainText } from "@aov/ui/lib/reference-input-dom"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { isRetiredSpell, spellRows, type WarehouseSpell } from "./use-item-catalog"
import { WarehouseArtwork } from "./warehouse-artwork"
import { fillStyle } from "./warehouse-grid"
import { EmptyGroup, FoldedGroup } from "./warehouse-parts"
import { warehouseName, warehouseText, type PublishedWarehouseRecord, type WarehouseEntry } from "./warehouse-types"

/** When a talent becomes available to an account, where the game says so. */
function spellUnlockText(content: WarehouseSpell["content"], locale: string) {
  if (content.unlockType === "LEVEL" && content.unlockLevel != null)
    return wikiText(locale, `Mở ở cấp ${content.unlockLevel}`, `Unlocks at level ${content.unlockLevel}`)
  if (content.unlockType === "ACCOUNT_CREATION") return wikiText(locale, "Có sẵn từ đầu", "Available from the start")
  return null
}

export function spellCooldownText(seconds: number | null | undefined, locale: string) {
  return seconds == null
    ? wikiText(locale, "Chưa rõ hồi chiêu", "Cooldown unknown")
    : wikiText(locale, `${seconds.toLocaleString(locale)} giây`, `${seconds.toLocaleString(locale)} s`)
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

function SpellCard({
  entry,
  selected,
  onOpen,
}: {
  entry: WarehouseSpell
  selected: boolean
  onOpen: (entry: WarehouseEntry, button: HTMLButtonElement) => void
}) {
  const { locale } = useWikiContext()
  const { content } = entry
  const name = warehouseName(entry, locale)
  const text = warehouseText(content.translations, locale)
  const description = spellSummary(text?.description || text?.summary, content.cooldownSeconds)
  const state = content.states.find((candidate) => candidate.key === content.defaultStateKey) ?? content.states[0]
  const unlock = spellUnlockText(content, locale)
  return (
    <button
      type="button"
      className="wiki-spell-card"
      data-spell-card={entry.id}
      aria-pressed={selected}
      aria-label={wikiText(locale, `Xem ${name}`, `View ${name}`)}
      onClick={(event) => onOpen(entry, event.currentTarget)}
    >
      <WarehouseArtwork entry={entry} kind="spells" assetId={state?.iconAssetId ?? content.iconAssetId} />
      <span className="wiki-spell-card-text">
        <strong>{name}</strong>
        <span className="wiki-spell-card-meta">
          <span>
            <WikiIcon name="clock" size={14} />
            <span className="sr-only">{wikiText(locale, "Hồi chiêu", "Cooldown")}</span>
            {spellCooldownText(content.cooldownSeconds, locale)}
          </span>
          {unlock && <span>{unlock}</span>}
          {content.states.length > 1 && (
            <span>{wikiText(locale, `${content.states.length} dạng`, `${content.states.length} forms`)}</span>
          )}
          {content.availability === "REMOVED" && <span>{wikiText(locale, "Đã gỡ", "Retired")}</span>}
        </span>
        {description && <span className="wiki-spell-card-description">{description}</span>}
      </span>
    </button>
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
  onSelect: (entry: WarehouseEntry, button?: HTMLButtonElement) => void
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
