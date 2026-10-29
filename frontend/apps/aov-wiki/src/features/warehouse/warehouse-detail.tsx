import { useEffect, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { WarehouseArtwork } from "./warehouse-artwork"
import { WarehouseIcon } from "./warehouse-icon"
import { warehouseReferencesQuery } from "./warehouse-api"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import {
  warehouseName,
  warehouseStatValue,
  warehouseText,
  type WarehouseEntry,
  type WarehouseGroup,
  type WarehouseKind,
  type WarehouseText,
} from "./warehouse-types"

const ROMAN = ["", "I", "II", "III"]
const STAT_LABELS: Record<string, string> = {
  physicalAttack: "Công vật lý",
  magicAttack: "Công phép",
  maxHealth: "Máu tối đa",
  armor: "Giáp",
  magicDefense: "Giáp phép",
  attackSpeed: "Tốc đánh",
  movementSpeed: "Tốc chạy",
  cooldownReduction: "Giảm hồi chiêu",
  criticalChance: "Tỷ lệ chí mạng",
  criticalDamage: "Sát thương chí mạng",
  armorPierce: "Xuyên giáp",
  magicPierce: "Xuyên giáp phép",
}

function DetailFacts({ entry, groups }: { entry: WarehouseEntry; groups: WarehouseGroup[] }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { content } = entry
  const group = groups.find((group) => group.code === (content.branchCode ?? content.categoryCode))
  const chips = [
    group && warehouseText(group.translations)?.name,
    content.tier && `${text("Bậc", "Tier")} ${ROMAN[content.tier] ?? content.tier}`,
    content.price != null && `${content.price.toLocaleString(locale)} ${text("vàng", "gold")}`,
    content.cooldownSeconds != null &&
      `${text("Hồi", "Cooldown")} ${content.cooldownSeconds.toLocaleString(locale)} ${text("giây", "s")}`,
    content.unlockType === "ACCOUNT_CREATION"
      ? text("Có từ đầu", "Available at start")
      : content.unlockLevel != null && `Lv ${content.unlockLevel}`,
    (content.legacy || content.availability === "REMOVED") && text("Đã ngừng sử dụng", "Retired"),
  ].filter(Boolean)
  return (
    <div className="wiki-warehouse-detail-facts">
      {chips.map((chip) => (
        <span key={String(chip)}>{chip}</span>
      ))}
    </div>
  )
}

function StatGrid({ entry, text }: { entry: WarehouseEntry; text?: WarehouseText }) {
  const { locale } = useWikiContext()
  if (!entry.content.stats?.length) return null
  return (
    <section className="wiki-warehouse-detail-section">
      <h3>{wikiText(locale, "Chỉ số", "Stats")}</h3>
      <dl className="wiki-warehouse-stat-grid">
        {entry.content.stats.map((stat) => (
          <div key={stat.key}>
            <dt>{text?.statLabels?.[stat.key] ?? STAT_LABELS[stat.key] ?? stat.key.replace(/_/g, " ")}</dt>
            <dd>{warehouseStatValue(stat, locale)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ItemRelations({
  entry,
  entries,
  onSelect,
}: {
  entry: WarehouseEntry
  entries: WarehouseEntry[]
  onSelect: (entry: WarehouseEntry) => void
}) {
  const { locale } = useWikiContext()
  const ui = (vi: string, en: string) => wikiText(locale, vi, en)
  const components = entry.content.components ?? []
  const upgrades = entries.filter((candidate) =>
    candidate.content.components?.some((component) => component.itemId === entry.id),
  )
  if (!components.length && !upgrades.length) return null

  function link(related: WarehouseEntry, quantity = 1) {
    return (
      <button type="button" className="wiki-warehouse-recipe-item" key={related.id} onClick={() => onSelect(related)}>
        <WarehouseArtwork kind="items" entry={related} />
        <span>
          {warehouseName(related)}
          {quantity > 1 && <small> ×{quantity}</small>}
        </span>
        <WarehouseIcon name="arrow" size={14} />
      </button>
    )
  }

  return (
    <>
      {!!components.length && (
        <section className="wiki-warehouse-detail-section">
          <h3>{ui("Công thức ghép", "Recipe")}</h3>
          <div className="wiki-warehouse-recipe-list">
            {components.map((component) => {
              const related = entries.find((candidate) => candidate.id === component.itemId)
              return related ? (
                link(related, component.quantity)
              ) : (
                <span className="wiki-warehouse-recipe-unavailable" key={component.itemId}>
                  {ui("Nguyên liệu chưa công khai", "Ingredient not yet public")}
                  {component.quantity > 1 ? ` ×${component.quantity}` : ""}
                </span>
              )
            })}
          </div>
        </section>
      )}
      {!!upgrades.length && (
        <section className="wiki-warehouse-detail-section">
          <h3>{ui("Ghép thành", "Builds into")}</h3>
          <div className="wiki-warehouse-recipe-list">{upgrades.map((related) => link(related))}</div>
        </section>
      )}
    </>
  )
}

function DetailContent({
  entry,
  kind,
  entries,
  groups,
  onSelect,
}: {
  entry: WarehouseEntry
  kind: WarehouseKind
  entries: WarehouseEntry[]
  groups: WarehouseGroup[]
  onSelect: (entry: WarehouseEntry) => void
}) {
  const [stateKey, setStateKey] = useState(entry.content.defaultStateKey)
  const scope = useWikiContext()
  const ui = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const references = useQuery(warehouseReferencesQuery(scope))
  const states = entry.content.states ?? []
  const state = states.find((state) => state.key === stateKey) ?? states[0]
  const baseText = warehouseText(entry.content.translations)
  const text = kind === "spells" && state ? (warehouseText(state.translations) ?? baseText) : baseText
  const description = text?.description || text?.summary
  const settings = references.data

  function rich(value: string) {
    return (
      <EntityRichText
        text={value}
        entities={settings?.entities}
        locale={scope.locale}
        fallbackLocale={settings?.fallbackLocale}
        autoRecognize={settings?.autoRecognize ?? false}
        context="wiki"
      />
    )
  }

  return (
    <>
      <div className="wiki-warehouse-detail-identity">
        <WarehouseArtwork
          entry={entry}
          kind={kind}
          assetId={state?.iconAssetId ?? entry.content.iconAssetId}
          showCredit
        />
        <div>
          <span className="wiki-warehouse-detail-eyebrow">{scope.t(kind).toLocaleUpperCase(scope.locale)}</span>
          <SheetTitle>{warehouseName(entry)}</SheetTitle>
        </div>
      </div>
      <DetailFacts entry={entry} groups={groups} />
      {!entry.revision.effectiveFromPatchVariantId && (
        <div className="wiki-warehouse-baseline-note">
          <WarehouseIcon name="clock" size={16} />
          <span>
            {entry.content.legacy && entry.content.availability === "REMOVED"
              ? ui("Chưa xác định patch ngừng sử dụng.", "The retirement patch is not yet confirmed.")
              : ui("Dữ liệu nền · Chưa xác định patch gốc.", "Baseline · Original patch not yet confirmed.")}
          </span>
        </div>
      )}
      {kind === "spells" && states.length > 1 && (
        <div className="wiki-warehouse-state-switch" aria-label={ui("Trạng thái phụ trợ", "Talent states")}>
          {states.map((option) => (
            <button
              type="button"
              key={option.key}
              aria-pressed={state?.key === option.key}
              onClick={() => setStateKey(option.key)}
            >
              <WarehouseArtwork entry={entry} kind={kind} assetId={option.iconAssetId} />
              <span>{warehouseText(option.translations)?.name ?? option.key}</span>
            </button>
          ))}
        </div>
      )}
      <StatGrid entry={entry} text={text} />
      {description && (
        <section className="wiki-warehouse-detail-section">
          <h3>{kind === "items" ? ui("Đặc tính", "Properties") : ui("Hiệu ứng", "Effect")}</h3>
          <div className="wiki-warehouse-rich-description">{rich(description)}</div>
        </section>
      )}
      {text?.effects?.map((effect) => (
        <section className="wiki-warehouse-effect" key={effect.key}>
          <h3>{effect.name}</h3>
          <div className="wiki-warehouse-rich-description">{rich(effect.description)}</div>
        </section>
      ))}
      {kind === "items" && <ItemRelations entry={entry} entries={entries} onSelect={onSelect} />}
      {!description && !text?.effects?.length && !entry.content.stats?.length && (
        <p className="wiki-warehouse-detail-muted">
          {ui("Thông tin chi tiết đang được bổ sung.", "More details are being prepared.")}
        </p>
      )}
      <footer className="wiki-warehouse-detail-footer">
        <span className="wiki-warehouse-live-dot" />
        {ui("Dữ liệu đã xuất bản", "Published data")} · {scope.region}
      </footer>
    </>
  )
}

export function WarehouseDetail({
  selectedId,
  entries,
  kind,
  groups,
  loading,
  onClose,
  onSelect,
  returnFocus,
}: {
  selectedId: string | null
  entries: WarehouseEntry[]
  kind: WarehouseKind
  groups: WarehouseGroup[]
  loading: boolean
  onClose: () => void
  onSelect: (entry: WarehouseEntry) => void
  returnFocus: RefObject<HTMLButtonElement | null>
}) {
  const { locale } = useWikiContext()
  const ui = (vi: string, en: string) => wikiText(locale, vi, en)
  const selected = entries.find((entry) => entry.id === selectedId || entry.code === selectedId)
  const lastSelection = useRef<WarehouseEntry | undefined>(undefined)
  useEffect(() => {
    if (selected) lastSelection.current = selected
  }, [selected])
  const shown = selected ?? (!selectedId ? lastSelection.current : undefined)

  return (
    <Sheet
      open={!!selectedId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="wiki-warehouse-detail"
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault()
            returnFocus.current.focus()
          }
        }}
      >
        <SheetClose className="wiki-warehouse-detail-close" aria-label={ui("Đóng chi tiết", "Close details")}>
          <WarehouseIcon name="close" />
        </SheetClose>
        <SheetDescription className="sr-only">
          {ui(
            "Thông tin, chỉ số và hiệu ứng từ dữ liệu đã xuất bản.",
            "Information, stats and effects from published data.",
          )}
        </SheetDescription>
        <div className="wiki-warehouse-detail-scroll">
          {shown ? (
            <DetailContent
              key={shown.id}
              entry={shown}
              kind={kind}
              entries={entries}
              groups={groups}
              onSelect={onSelect}
            />
          ) : (
            <div className="wiki-warehouse-detail-placeholder">
              <WarehouseIcon name={kind} size={42} />
              <SheetTitle>
                {loading ? ui("Đang tải…", "Loading…") : ui("Không tìm thấy mục này", "Entry not found")}
              </SheetTitle>
              {!loading && (
                <p>
                  {ui(
                    "Mục này chưa có dữ liệu công khai tại thị trường hiện tại.",
                    "No published entry is available in this market and scope.",
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
