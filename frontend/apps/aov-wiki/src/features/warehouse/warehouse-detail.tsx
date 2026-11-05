import { ItemOverview } from "@aov/ui/components/warehouse/item-overview"
import { ItemPrice } from "@aov/ui/components/warehouse/item-price"
import { arcanaGroupLabel, compactArcanaName } from "@aov/ui/components/warehouse/arcana-cards"
import { SecondaryAttributes } from "@aov/ui/components/warehouse/secondary-attributes"
import { warehouseViewGroups } from "./warehouse-view"
import { useEffect, useRef, useState, type RefObject } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { EntityRichText } from "@aov/ui/components/entity-rich-text"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@aov/ui/components/tabs"
import { WikiIcon } from "../../components/wiki-icon"
import { WarehouseUpdates } from "./warehouse-updates"
import { WarehouseRecipe } from "./warehouse-recipe"
import { WarehouseArtwork } from "./warehouse-artwork"
import { FeedbackDialog } from "../../layout/feedback-dialog"
import { WarehouseIcon } from "./warehouse-icon"
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

function ItemFacts({
  entry,
  groups,
}: {
  entry: Extract<PublishedWarehouseRecord, { kind: "items" }>
  groups: WarehouseGroup[]
}) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const { content } = entry
  const group = groups.find((group) => group.code === content.categoryCode)
  const chips = [
    group && warehouseText(group.translations, locale)?.name,
    content.tier && `${text("Bậc", "Tier")} ${ROMAN[content.tier] ?? content.tier}`,
  ].filter(Boolean)
  return (
    <div className="wiki-warehouse-detail-facts">
      {chips.map((chip) => (
        <span key={String(chip)}>{chip}</span>
      ))}
      <ItemPrice amount={content.price} locale={locale} />
    </div>
  )
}

function statLabel(key: string, text?: WarehouseText) {
  return text?.statLabels?.[key] ?? STAT_LABELS[key] ?? key.replace(/_/g, " ")
}

function DetailContent({
  entry,
  kind,
  entries,
  groups,
  onSelect,
}: {
  entry: PublishedWarehouseRecord
  kind: WarehouseKind
  entries: PublishedWarehouseRecord[]
  groups: WarehouseGroup[]
  onSelect: (entry: PublishedWarehouseRecord) => void
}) {
  const content: WarehouseEntry["content"] = entry.content
  const [stateKey, setStateKey] = useState(content.defaultStateKey)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState("details")
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
        <div>
          <span className="wiki-warehouse-detail-eyebrow">
            {arcana
              ? arcanaGroupLabel(arcana.color, arcana.tier, scope.locale)
              : scope.t(kind).toLocaleUpperCase(scope.locale)}
          </span>
          <div className="wiki-edit-heading">
            <SheetTitle>{arcana ? compactArcanaName(name, arcana.color, arcana.tier) : name}</SheetTitle>
            {!editing && (
              <button
                ref={pencil}
                type="button"
                className="wiki-feedback-trigger"
                title={ui("Đề xuất chỉnh sửa", "Suggest an edit")}
                aria-label={ui(`Đề xuất chỉnh sửa · ${name}`, `Suggest an edit · ${name}`)}
                onClick={() => {
                  setTab("details")
                  setEditing(true)
                }}
              >
                <WikiIcon name="feedback" size={17} />
              </button>
            )}
          </div>
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
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line" className="my-2 w-full justify-start border-b" aria-label={name}>
            <TabsTrigger value="details" className="flex-none">
              <WikiIcon name="book" size={15} />
              {ui("Chi tiết", "Details")}
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex-none">
              <WikiIcon name="patch" size={15} />
              {ui("Cập nhật", "Updates")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="updates">
            <WarehouseUpdates entry={entry} />
          </TabsContent>
          <TabsContent value="details">
            {entry.kind === "items" && <ItemFacts entry={entry} groups={groups} />}
            {!entry.revision.effectiveFromPatchVariantId && (
              <div className="wiki-warehouse-baseline-note">
                <WarehouseIcon name="clock" size={16} />
                <span>
                  {content.availability === "REMOVED"
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
                    <span>{warehouseText(option.translations, scope.locale)?.name ?? option.key}</span>
                  </button>
                ))}
              </div>
            )}
            {entry.kind === "items" ? (
              <div className="space-y-4">
                <ItemOverview
                  readerView
                  entry={entry}
                  items={entries.filter((e) => e.kind === "items")}
                  relatedItems={entries.filter((e) => e.kind === "items")}
                  onView={onSelect}
                  categories={warehouseViewGroups(groups)}
                  locale={scope.locale}
                  renderText={rich}
                  renderRecipe={(upgrades) => (
                    <WarehouseRecipe
                      entry={entry}
                      items={entries.filter((e) => e.kind === "items")}
                      upgrades={upgrades}
                      onSelect={onSelect}
                    />
                  )}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {visibleDescription && (
                  <section className="space-y-2">
                    <h3 className="type-section-title">{ui("Mô tả", "Description")}</h3>
                    <div className="wiki-type-prose">{rich(visibleDescription)}</div>
                  </section>
                )}
                {arcana ? (
                  statRows.length > 0 && (
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
                  )
                ) : (
                  <section className="space-y-2 border-t pt-3">
                    <h3 className="type-section-title">{ui("Thuộc tính", "Attributes")}</h3>
                    <SecondaryAttributes
                      kind={entry.kind}
                      content={entry.content}
                      branches={warehouseViewGroups(groups)}
                      locale={scope.locale}
                      part="mechanics"
                      showPlacement={false}
                    />
                  </section>
                )}
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
              </div>
            )}
            {!description && !text?.effects?.length && !content.stats?.length && entry.kind === "arcana" && (
              <p className="wiki-warehouse-detail-muted">
                {ui("Thông tin chi tiết đang được bổ sung.", "More details are being prepared.")}
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
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
  entries: PublishedWarehouseRecord[]
  kind: WarehouseKind
  groups: WarehouseGroup[]
  loading: boolean
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
