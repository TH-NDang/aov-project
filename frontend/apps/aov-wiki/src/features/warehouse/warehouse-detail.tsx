import { ItemOverview } from "@aov/ui/components/warehouse/item-overview"
import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { arcanaGroupLabel, compactArcanaName } from "@aov/ui/components/warehouse/arcana-cards"
import { SecondaryAttributes } from "@aov/ui/components/warehouse/secondary-attributes"
import { warehouseViewGroups } from "./warehouse-view"
import { useEffect, useRef, useState, type ComponentProps, type ElementType, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { WikiIcon } from "../../components/wiki-icon"
import { WarehouseUpdates } from "./warehouse-updates"
import { WarehouseArtwork } from "./warehouse-artwork"
import { FeedbackDialog } from "../../layout/feedback-dialog"
import { WarehouseIcon } from "./warehouse-icon"
import { SubjectVideos } from "../videos/subject-videos"
import { wikiReferencesQuery } from "../../lib/wiki-references"
import { useWikiContext, wikiText } from "../../context/wiki-context"
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

function statLabel(key: string, text?: WarehouseText) {
  return text?.statLabels?.[key] ?? STAT_LABELS[key] ?? key.replace(/_/g, " ")
}

function PanelTitle(props: ComponentProps<"h2">) {
  return <h2 data-slot="sheet-title" {...props} />
}

/** Where the entry belongs, in one line: the facts that used to take a section of their own. */
function eyebrow(entry: PublishedWarehouseRecord, groups: WarehouseGroup[], locale: string, kindName: string) {
  const groupName = (code?: string | null) => {
    const group = groups.find((candidate) => candidate.code === code)
    return group && warehouseText(group.translations, locale)?.name
  }
  const tier = (value?: number | null) => value && `${wikiText(locale, "Cấp", "Tier")} ${ROMAN[value] ?? value}`
  if (entry.kind === "arcana") return arcanaGroupLabel(entry.content.color, entry.content.tier, locale)
  if (entry.kind === "items")
    return [groupName(entry.content.categoryCode) ?? kindName, tier(entry.content.tier)].filter(Boolean).join(" · ")
  if (entry.kind === "enchantments")
    return [groupName(entry.content.branchCode) ?? kindName, tier(entry.content.tier)].filter(Boolean).join(" · ")
  return kindName
}

const VIDEO_KINDS = { items: "ITEM", enchantments: "ENCHANTMENT", arcana: "ARCANA", spells: "SPELL" } as const

function DetailContent({
  entry,
  kind,
  entries,
  groups,
  onSelect,
  Title,
}: {
  entry: PublishedWarehouseRecord
  kind: WarehouseKind
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  onSelect: (entry: PublishedWarehouseRecord) => void
  Title: ElementType
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
  const baseText = warehouseText(content.translations, scope.locale)
  const text = kind === "spells" && state ? (warehouseText(state.translations, scope.locale) ?? baseText) : baseText
  const description = text?.description || text?.summary
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
      <div className="wiki-warehouse-detail-identity">
        <WarehouseArtwork entry={entry} kind={kind} assetId={state?.iconAssetId ?? content.iconAssetId} showCredit />
        <div className="min-w-0">
          <span className="wiki-warehouse-detail-eyebrow">{eyebrow(entry, groups, scope.locale, scope.t(kind))}</span>
          <div className="wiki-edit-heading">
            <Title>{arcana ? compactArcanaName(name, arcana.color, arcana.tier) : name}</Title>
            {!editing && (
              <button
                ref={pencil}
                type="button"
                className="wiki-feedback-trigger"
                title={ui("Đề xuất chỉnh sửa", "Suggest an edit")}
                aria-label={ui(`Đề xuất chỉnh sửa · ${name}`, `Suggest an edit · ${name}`)}
                onClick={() => setEditing(true)}
              >
                <WikiIcon name="feedback" size={17} />
              </button>
            )}
          </div>
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
            ...(text?.effects ?? []).map((effect) => ({
              label: effect.name || ui("Hiệu ứng", "Effect"),
              value: effect.description,
              multiline: true,
            })),
          ]}
        />
      ) : (
        <div className="wiki-warehouse-detail-body">
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
              {entry.kind === "spells" && (
                <SecondaryAttributes
                  kind={entry.kind}
                  content={entry.content}
                  branches={warehouseViewGroups(groups)}
                  locale={scope.locale}
                  part="mechanics"
                  showPlacement={false}
                />
              )}
              {arcana && statRows.length > 0 && (
                <section className="space-y-2">
                  <h3 className="type-section-title">{ui("Chỉ số", "Stats")}</h3>
                  <dl className="divide-y divide-[var(--wiki-line)]">
                    {statRows.map(({ key, label, value }) => (
                      <div
                        key={key}
                        className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0 type-body"
                      >
                        <dt>{rich(label)}</dt>
                        <dd className="shrink-0 font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              {visibleDescription && <div className="wiki-type-prose">{rich(visibleDescription)}</div>}
              {!!text?.effects?.length && (
                <section className="space-y-2">
                  <h3 className="type-section-title">{ui("Hiệu ứng", "Effects")}</h3>
                  {text.effects.map((effect) => (
                    <div key={effect.key} className="space-y-1">
                      {effect.name && <h4 className="type-label">{effect.name}</h4>}
                      <div className="wiki-type-prose">{rich(effect.description)}</div>
                    </div>
                  ))}
                </section>
              )}
              {sameTier.length > 0 && (
                <section className="space-y-2">
                  <h3 className="type-section-title">{ui("Cùng cấp trong hệ", "Same tier in this branch")}</h3>
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
              {!description && !text?.effects?.length && !content.stats?.length && arcana && (
                <p className="wiki-warehouse-detail-muted">
                  {ui("Thông tin chi tiết đang được bổ sung.", "More details are being prepared.")}
                </p>
              )}
            </>
          )}
          <SubjectVideos kind={VIDEO_KINDS[entry.kind]} id={entry.id} />
          <WarehouseUpdates entry={entry} />
          {!entry.revision.effectiveFromPatchVariantId && (
            <p className="wiki-warehouse-baseline-note">
              <WarehouseIcon name="clock" size={14} />
              {content.availability === "REMOVED"
                ? ui("Chưa xác định patch ngừng sử dụng.", "The retirement patch is not yet confirmed.")
                : ui("Dữ liệu nền, chưa xác định patch gốc.", "Baseline data, original patch not yet confirmed.")}
            </p>
          )}
        </div>
      )}
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
        <span>{warehouseName(previous, locale)}</span>
      </button>
      <small aria-live="polite">
        {index + 1}/{order.length}
      </small>
      <button
        type="button"
        aria-label={`${wikiText(locale, "Mục sau", "Next")}: ${warehouseName(next, locale)}`}
        onClick={() => onSelect(next)}
      >
        <span>{warehouseName(next, locale)}</span>
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
  /** Stay beside the catalog as a panel instead of opening over it. */
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

  if (inline) {
    return (
      <aside className="wiki-warehouse-detail wiki-warehouse-panel" aria-label={ui("Chi tiết", "Details")}>
        {selected ? (
          <>
            <button
              type="button"
              className="wiki-warehouse-detail-close"
              aria-label={ui("Bỏ chọn", "Clear selection")}
              onClick={onClose}
            >
              <WarehouseIcon name="close" />
            </button>
            <div className="wiki-warehouse-detail-scroll">
              <DetailContent
                key={JSON.stringify([selected.id, selected.revision.id, locale])}
                entry={selected}
                kind={kind}
                entries={entries}
                groups={groups}
                onSelect={onSelect}
                Title={PanelTitle}
              />
            </div>
            <DetailStepper current={selected} order={order} onSelect={onSelect} />
          </>
        ) : (
          <div className="wiki-warehouse-panel-empty">
            <WarehouseIcon name={kind} size={36} />
            <h2>
              {selectedId && !loading
                ? ui("Không tìm thấy mục này", "Entry not found")
                : ui("Chọn một mục để xem", "Pick an entry to read")}
            </h2>
            <p>
              {kind === "items"
                ? ui(
                    "Chỉ số, hiệu ứng và công thức ghép sẽ hiện ở đây.",
                    "Stats, effects and the build recipe appear here.",
                  )
                : ui("Thông tin chi tiết sẽ hiện ở đây.", "The details appear here.")}
            </p>
          </div>
        )}
      </aside>
    )
  }

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
          {ui("Thông tin, chỉ số và hiệu ứng.", "Details, stats and effects.")}
        </SheetDescription>
        <div className="wiki-warehouse-detail-scroll">
          {shown ? (
            <DetailContent
              key={JSON.stringify([shown.id, shown.revision.id, locale])}
              entry={shown}
              kind={kind}
              entries={entries}
              groups={groups}
              onSelect={onSelect}
              Title={SheetTitle}
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
        {shown && <DetailStepper current={shown} order={order} onSelect={onSelect} />}
      </SheetContent>
    </Sheet>
  )
}
