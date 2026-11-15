import { ItemOverview } from "@aov/ui/components/warehouse/item-overview"
import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { arcanaGroupLabel } from "@aov/ui/components/warehouse/arcana-cards"
import { warehouseViewGroups } from "./warehouse-view"
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImageCredit } from "../../components/wiki-image-credit"
import { WarehouseUpdates } from "./warehouse-updates"
import { WarehouseArtwork } from "./warehouse-artwork"
import { FeedbackDialog } from "../../components/feedback-dialog"
import { SubjectVideos } from "../videos/subject-videos"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { arcanaTitle } from "./warehouse-arcana"
import { romanTier } from "./warehouse-parts"
import { spellCooldownText } from "./warehouse-spells"
import {
  arcanaDetailDescription,
  warehouseName,
  warehouseStatValue,
  warehouseText,
  type WarehouseEntry,
  type PublishedWarehouseRecord,
  type WarehouseGroup,
  type WarehouseKind,
  type WarehouseText,
} from "./warehouse-types"

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

function statLabel(key: string, text?: WarehouseText) {
  return text?.statLabels?.[key] ?? STAT_LABELS[key] ?? key.replace(/_/g, " ")
}

function PanelTitle(props: ComponentProps<"h2">) {
  return <h2 data-slot="sheet-title" {...props} />
}

/** The name as lists and headings show it: an arcana goes without the color and tier its group already states. */
function entryTitle(entry: PublishedWarehouseRecord, locale: string) {
  return entry.kind === "arcana" ? arcanaTitle(entry, locale) : warehouseName(entry, locale)
}

/** Where the entry belongs, in one line. */
function eyebrow(entry: PublishedWarehouseRecord, groups: WarehouseGroup[], locale: string, kindName: string) {
  const groupName = (code?: string | null) => {
    const group = groups.find((candidate) => candidate.code === code)
    return group && warehouseText(group.translations, locale)?.name
  }
  const tier = (value?: number | null) => value && `${wikiText(locale, "Cấp", "Tier")} ${romanTier(value)}`
  if (entry.kind === "arcana") return arcanaGroupLabel(entry.content.color, entry.content.tier, locale)
  if (entry.kind === "items")
    return [groupName(entry.content.categoryCode) ?? kindName, tier(entry.content.tier)].filter(Boolean).join(" · ")
  if (entry.kind === "enchantments")
    return [groupName(entry.content.branchCode) ?? kindName, tier(entry.content.tier)].filter(Boolean).join(" · ")
  return kindName
}

const VIDEO_KINDS = { items: "ITEM", enchantments: "ENCHANTMENT", arcana: "ARCANA", spells: "SPELL" } as const

/** Short facts as label and value, one to a line so the values line up. */
function Facts({ rows }: { rows: { key: string; label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="wiki-warehouse-facts">
      {rows.map(({ key, label, value }) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DetailContent({
  entry,
  kind,
  entries,
  groups,
  onSelect,
  Title,
  close,
}: {
  entry: PublishedWarehouseRecord
  kind: WarehouseKind
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  onSelect: (entry: PublishedWarehouseRecord) => void
  Title: ElementType
  /** The control that puts the detail away; the panel and the sheet each bring their own. */
  close: ReactNode
}) {
  const content: WarehouseEntry["content"] = entry.content
  const [stateKey, setStateKey] = useState(content.defaultStateKey)
  const [editing, setEditing] = useState(false)
  const pencil = useRef<HTMLButtonElement>(null)
  const scope = useWikiContext()
  const ui = (vi: string, en: string) => wikiText(scope.locale, vi, en)
  const references = useQuery(wikiReferencesQuery(scope))
  const states = content.states ?? []
  const state = states.find((state) => state.key === stateKey) ?? states[0]
  const artworkId = state?.iconAssetId ?? content.iconAssetId
  const artwork = artworkId ? entry.media?.[artworkId] : undefined
  const baseText = warehouseText(content.translations, scope.locale)
  const text = kind === "spells" && state ? (warehouseText(state.translations, scope.locale) ?? baseText) : baseText
  // A state of a talent often carries only its name; what it leaves out is the talent's own text.
  const description = text?.description || text?.summary || baseText?.description || baseText?.summary
  const effects = text?.effects?.length ? text.effects : (baseText?.effects ?? [])
  const statRows = (content.stats ?? []).map((stat) => ({
    key: stat.key,
    label: statLabel(stat.key, text),
    value: warehouseStatValue(stat, scope.locale),
  }))
  const arcana = entry.kind === "arcana" ? entry.content : null
  const visibleDescription = arcana ? arcanaDetailDescription(text, statRows) : description
  const name = warehouseName(entry, scope.locale)
  const settings = references.data
  const items = entries.filter((e) => e.kind === "items")
  const sameTier =
    entry.kind === "enchantments"
      ? entries.filter(
          (e) =>
            e.kind === "enchantments" &&
            e.id !== entry.id &&
            e.content.branchCode === entry.content.branchCode &&
            e.content.tier === entry.content.tier,
        )
      : []
  const spellFacts =
    entry.kind === "spells"
      ? [
          {
            key: "cooldown",
            label: ui("Hồi chiêu", "Cooldown"),
            value: spellCooldownText(entry.content.cooldownSeconds, scope.locale),
          },
          ...(entry.content.unlockType === "LEVEL" && entry.content.unlockLevel != null
            ? [
                {
                  key: "unlock",
                  label: ui("Mở khóa", "Unlocks"),
                  value: ui(`Cấp ${entry.content.unlockLevel}`, `Level ${entry.content.unlockLevel}`),
                },
              ]
            : entry.content.unlockType === "ACCOUNT_CREATION"
              ? [
                  {
                    key: "unlock",
                    label: ui("Mở khóa", "Unlocks"),
                    value: ui("Có sẵn từ đầu", "Available from the start"),
                  },
                ]
              : []),
          ...(entry.content.maxCharges != null
            ? [
                {
                  key: "charges",
                  label: ui("Số lần tích trữ", "Maximum charges"),
                  value: String(entry.content.maxCharges),
                },
              ]
            : []),
          ...(entry.content.chargeRechargeSeconds != null
            ? [
                {
                  key: "recharge",
                  label: ui("Thời gian tích một lần", "Recharge time"),
                  value: spellCooldownText(entry.content.chargeRechargeSeconds, scope.locale),
                },
              ]
            : []),
          ...(entry.content.availability !== "AVAILABLE"
            ? [
                {
                  key: "availability",
                  label: ui("Tình trạng", "Availability"),
                  value:
                    entry.content.availability === "REMOVED"
                      ? ui("Đã gỡ khỏi game", "Removed from the game")
                      : ui("Chưa xác định", "Unknown"),
                },
              ]
            : []),
        ]
      : []

  function rich(value: string, locale = scope.locale) {
    return (
      <EntityRichText
        text={value}
        entities={settings?.entities}
        locale={locale}
        fallbackLocale={settings?.fallbackLocale}
        autoRecognize={settings?.autoRecognize ?? false}
        context="wiki"
      />
    )
  }

  return (
    <>
      <div className="wiki-warehouse-detail-bar">
        <span>{eyebrow(entry, groups, scope.locale, scope.t(kind))}</span>
        {/* Where the picture comes from sits with the other tools, so nothing covers the picture itself. */}
        {artwork?.currentVersion && (
          <WikiImageCredit
            className="wiki-warehouse-detail-tool"
            sources={artwork.currentVersion.sources}
            contactHref={`/contact?assetId=${encodeURIComponent(artwork.assetId)}&versionId=${encodeURIComponent(artwork.currentVersion.versionId)}`}
          />
        )}
        {!editing && (
          <button
            ref={pencil}
            type="button"
            className="wiki-warehouse-detail-tool"
            title={ui("Đề xuất chỉnh sửa", "Suggest an edit")}
            aria-label={ui(`Đề xuất chỉnh sửa · ${name}`, `Suggest an edit · ${name}`)}
            onClick={() => setEditing(true)}
          >
            <WikiIcon name="feedback" size={18} />
          </button>
        )}
        {close}
      </div>
      <div className="wiki-warehouse-detail-scroll">
        <div className="wiki-warehouse-detail-identity">
          <WarehouseArtwork entry={entry} kind={kind} assetId={artworkId} />
          <div>
            <Title>{entryTitle(entry, scope.locale)}</Title>
            {entry.kind === "items" && (
              <div className="wiki-warehouse-detail-price">
                <ItemPrice amount={entry.content.price} locale={scope.locale} />
              </div>
            )}
          </div>
        </div>
        {editing ? (
          <FeedbackDialog
            onCloseInline={() => {
              setEditing(false)
              requestAnimationFrame(() => pencil.current?.focus())
            }}
            target={`${scope.t(kind)} · ${warehouseName(entry, scope.locale)}${state && kind === "spells" ? " · " + (text?.name || state.key) : ""}`}
            identity={`${kind}/${entry.code}${state && kind === "spells" ? "/" + state.key : ""}`}
            revision={entry.revision.id}
            fields={[
              { label: ui("Tên", "Name"), value: text?.name ?? warehouseName(entry, scope.locale) },
              ...(entry.kind === "items" && text?.summary
                ? [{ label: ui("Tóm tắt", "Summary"), value: text.summary }]
                : []),
              {
                label: ui("Mô tả", "Description"),
                value: (entry.kind === "items" ? text?.description : arcana ? visibleDescription : description) ?? "",
                multiline: true,
              },
              ...statRows,
              ...(entry.kind === "items"
                ? [{ label: ui("Giá (vàng)", "Price (gold)"), value: content.price?.toString() ?? "" }]
                : []),
              ...(entry.kind === "spells"
                ? [
                    {
                      label: ui("Hồi chiêu (giây)", "Cooldown (seconds)"),
                      value: content.cooldownSeconds?.toString() ?? "",
                    },
                  ]
                : []),
              ...effects.map((effect) => ({
                label: effect.name || ui("Hiệu ứng", "Effect"),
                value: effect.description,
                multiline: true,
              })),
            ]}
          />
        ) : (
          <div className="wiki-warehouse-detail-body">
            {kind === "spells" && states.length > 1 && (
              <div
                className="wiki-warehouse-state-switch"
                role="group"
                aria-label={ui("Trạng thái phụ trợ", "Talent states")}
              >
                {states.map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    aria-pressed={state?.key === option.key}
                    onClick={() => setStateKey(option.key)}
                  >
                    <WarehouseArtwork entry={entry} kind={kind} assetId={option.iconAssetId} />
                    <span>{warehouseText(option.translations, scope.locale)?.name ?? option.key}</span>
                  </button>
                ))}
              </div>
            )}
            {entry.kind === "items" ? (
              <ItemOverview
                readerView
                entry={entry}
                items={items}
                relatedItems={items}
                onView={onSelect}
                categories={warehouseViewGroups(groups)}
                locale={scope.locale}
                renderText={rich}
              />
            ) : (
              <>
                {spellFacts.length > 0 && <Facts rows={spellFacts} />}
                {arcana && statRows.length > 0 && (
                  <section>
                    <h3>{ui("Chỉ số", "Stats")}</h3>
                    <Facts rows={statRows.map((row) => ({ ...row, label: rich(row.label) }))} />
                  </section>
                )}
                {visibleDescription && <div className="wiki-warehouse-detail-prose">{rich(visibleDescription)}</div>}
                {effects.length > 0 && (
                  <section>
                    <h3>{ui("Hiệu ứng", "Effects")}</h3>
                    {effects.map((effect) => (
                      <div key={effect.key} className="wiki-warehouse-detail-effect">
                        {effect.name && <h4>{effect.name}</h4>}
                        <div className="wiki-warehouse-detail-prose">{rich(effect.description)}</div>
                      </div>
                    ))}
                  </section>
                )}
                {sameTier.length > 0 && (
                  <section>
                    <h3>{ui("Cùng cấp trong hệ", "Same tier in this branch")}</h3>
                    <ul className="wiki-warehouse-siblings">
                      {sameTier.map((sibling) => (
                        <li key={sibling.id}>
                          <button type="button" onClick={() => onSelect(sibling)}>
                            <WarehouseArtwork entry={sibling} kind={kind} />
                            <span>{warehouseName(sibling, scope.locale)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {!description && !effects.length && !content.stats?.length && arcana && (
                  <p className="wiki-warehouse-detail-note">
                    {ui("Thông tin chi tiết đang được bổ sung.", "More details are being prepared.")}
                  </p>
                )}
              </>
            )}
            <WarehouseUpdates entry={entry} />
            <SubjectVideos kind={VIDEO_KINDS[entry.kind]} id={entry.id} />
            {!entry.revision.effectiveFromPatchVariantId && (
              <p className="wiki-warehouse-detail-note">
                <WikiIcon name="clock" size={14} />
                {content.availability === "REMOVED"
                  ? ui("Chưa xác định patch ngừng sử dụng.", "The retirement patch is not yet confirmed.")
                  : ui("Dữ liệu nền, chưa xác định patch gốc.", "Baseline data, original patch not yet confirmed.")}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

/** Moves to the neighbouring entries without going back to the catalog. */
function DetailStepper({
  current,
  order,
  onSelect,
}: {
  current: PublishedWarehouseRecord
  order: PublishedWarehouseRecord[]
  onSelect: (entry: PublishedWarehouseRecord) => void
}) {
  const { locale } = useWikiContext()
  const index = order.findIndex((entry) => entry.id === current.id)
  if (index < 0 || order.length < 2) return null
  const previous = order.at(index - 1)!
  const next = order[(index + 1) % order.length]
  return (
    <nav className="wiki-warehouse-step" aria-label={wikiText(locale, "Chuyển mục", "Switch entry")}>
      <button
        type="button"
        aria-label={`${wikiText(locale, "Mục trước", "Previous")}: ${warehouseName(previous, locale)}`}
        onClick={() => onSelect(previous)}
      >
        <WikiIcon name="chevronLeft" size={16} />
        <span>{entryTitle(previous, locale)}</span>
      </button>
      <small aria-live="polite">
        {index + 1}/{order.length}
      </small>
      <button
        type="button"
        aria-label={`${wikiText(locale, "Mục sau", "Next")}: ${warehouseName(next, locale)}`}
        onClick={() => onSelect(next)}
      >
        <span>{entryTitle(next, locale)}</span>
        <WikiIcon name="chevronRight" size={16} />
      </button>
    </nav>
  )
}

export function WarehouseDetail({
  selectedId,
  entries,
  order,
  kind,
  groups,
  loading,
  inline,
  onClose,
  onSelect,
  returnFocus,
}: {
  selectedId: string | null
  entries: PublishedWarehouseRecord[]
  /** The entries as the catalog currently lays them out, for stepping from one to the next. */
  order: PublishedWarehouseRecord[]
  kind: WarehouseKind
  groups: WarehouseGroup[]
  loading: boolean
  /** Stand beside the catalog as a panel instead of opening over it. */
  inline: boolean
  onClose: () => void
  onSelect: (entry: PublishedWarehouseRecord) => void
  returnFocus: RefObject<HTMLButtonElement | null>
}) {
  const { locale } = useWikiContext()
  const ui = (vi: string, en: string) => wikiText(locale, vi, en)
  const selected = entries.find((entry) => entry.id === selectedId || entry.code === selectedId)
  const lastSelection = useRef<PublishedWarehouseRecord | undefined>(undefined)
  useEffect(() => {
    if (selected) lastSelection.current = selected
  }, [selected])
  const shown = selected ?? (!selectedId ? lastSelection.current : undefined)

  useEffect(() => {
    if (!selected || order.length < 2) return
    const index = order.findIndex((entry) => entry.id === selected.id)
    if (index < 0) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      // Controls that use the arrow keys themselves keep them.
      if (
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='tab'], [role='listbox'], [role='menu'], [role='slider'], .shop-viewport",
        )
      )
        return
      event.preventDefault()
      onSelect(order[(index + (event.key === "ArrowRight" ? 1 : -1) + order.length) % order.length])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected, order, onSelect])

  const closeLabel = ui("Đóng chi tiết", "Close details")
  const missing = (
    <>
      <p>{loading ? ui("Đang tải…", "Loading…") : ui("Không tìm thấy mục này", "Entry not found")}</p>
      {!loading && (
        <small>
          {ui(
            "Mục này chưa có dữ liệu công khai tại thị trường hiện tại.",
            "No published entry is available in this market and scope.",
          )}
        </small>
      )}
    </>
  )

  if (inline) {
    if (!selectedId) return null
    const close = (
      <button
        type="button"
        className="wiki-warehouse-detail-tool"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={() => {
          onClose()
          // The panel goes away with its close button, so the catalog entry it was opened from takes the focus back.
          requestAnimationFrame(() => {
            if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true })
          })
        }}
      >
        <WikiIcon name="close" size={18} />
      </button>
    )
    return (
      <aside className="wiki-warehouse-detail wiki-warehouse-panel" aria-label={ui("Chi tiết", "Details")}>
        {selected ? (
          <>
            <DetailContent
              key={JSON.stringify([selected.id, selected.revision.id, locale])}
              entry={selected}
              kind={kind}
              entries={entries}
              groups={groups}
              onSelect={onSelect}
              Title={PanelTitle}
              close={close}
            />
            <DetailStepper current={selected} order={order} onSelect={onSelect} />
          </>
        ) : (
          <>
            <div className="wiki-warehouse-detail-bar">
              <span />
              {close}
            </div>
            <div className="wiki-warehouse-detail-missing" role="status">
              {missing}
            </div>
          </>
        )}
      </aside>
    )
  }

  const close = (
    <SheetClose className="wiki-warehouse-detail-tool" aria-label={closeLabel}>
      <WikiIcon name="close" size={18} />
    </SheetClose>
  )
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
        <SheetDescription className="sr-only">
          {ui("Thông tin, chỉ số và hiệu ứng.", "Details, stats and effects.")}
        </SheetDescription>
        {shown ? (
          <>
            <DetailContent
              key={JSON.stringify([shown.id, shown.revision.id, locale])}
              entry={shown}
              kind={kind}
              entries={entries}
              groups={groups}
              onSelect={onSelect}
              Title={SheetTitle}
              close={close}
            />
            <DetailStepper current={shown} order={order} onSelect={onSelect} />
          </>
        ) : (
          <>
            <div className="wiki-warehouse-detail-bar">
              <span />
              {close}
            </div>
            <div className="wiki-warehouse-detail-missing" role="status">
              <SheetTitle className="sr-only">{ui("Chi tiết", "Details")}</SheetTitle>
              {missing}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
