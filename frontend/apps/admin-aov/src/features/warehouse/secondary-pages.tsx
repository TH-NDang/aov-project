import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Gem, GitBranch, Languages, LayoutGrid, ListOrdered, Plus, Sparkles, Zap } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { Skeleton } from "@aov/ui/components/skeleton"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { SearchField } from "@/components/search-field"
import { useSearchParam } from "@/hooks/use-search-param"
import { errorMessage } from "@/lib/api/errors"
import { matchesQuery } from "@/lib/text"
import { useWarehouseCatalog, warehouseApi, warehouseKeys, invalidateWarehouseCatalogs } from "./warehouse-api"
import { WarehouseRulesetSelect, useWarehouseContext } from "./warehouse-controls"
import { EnchantmentBranches } from "./enchantment-branches"
import { WarehouseOrderPicker } from "./warehouse-order-picker"
import { enchantmentBranchColor } from "./enchantment-colors"
import { useWarehouseScope, WarehouseScopeControls } from "./warehouse-scope"
import { availabilityLabels, SpellCollection } from "./spell-cards"
import { ArcanaCollection } from "./arcana-cards"
import { ArcanaFilters } from "./arcana-filters"
import {
  warehouseText,
  type ArcanaContent,
  type EnchantmentContent,
  type SpellContent,
  type WarehouseContents,
  type WarehouseEntry,
  type WarehouseMetadata,
} from "./warehouse-types"
import {
  EnchantmentBranchEditor,
  newSecondaryContent,
  SecondaryEditor,
  secondaryNames,
  type SecondaryContent,
  type SecondaryKind,
} from "./secondary-editor"

type SecondaryEntry = WarehouseEntry<WarehouseContents[SecondaryKind]>
const titles: Record<SecondaryKind, string> = { enchantments: "Phù hiệu", arcana: "Bảng ngọc", spells: "Phụ trợ" }
const permissionNames: Record<SecondaryKind, string> = {
  enchantments: "enchantment",
  arcana: "arcana",
  spells: "spell",
}
const spellAvailabilityFilters = ["REMOVED"] as const

export function BackendEnchantmentsPage() {
  return <SecondaryPage kind="enchantments" />
}
export function BackendArcanaPage() {
  return <SecondaryPage kind="arcana" />
}
export function BackendSpellsPage() {
  return <SecondaryPage kind="spells" />
}

function SecondaryPage({ kind }: { kind: SecondaryKind }) {
  const context = useWarehouseContext()
  const client = useQueryClient()
  const catalog = useWarehouseCatalog(kind, context.rulesetId, context.locale)
  const scopeState = useWarehouseScope(kind, context.rulesetId, context.locale)
  const { scoped, query: scopedCatalog, overview } = scopeState
  const branches = useQuery({
    queryKey: warehouseKeys.metadata("enchantments"),
    queryFn: () => warehouseApi.metadata("enchantments"),
    enabled: kind === "enchantments",
    staleTime: 60000,
  })
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes(`${permissionNames[kind]}:write`)
  const canPublish = capabilities.includes(`${permissionNames[kind]}:publish`)
  const [selectedId, setSelectedId] = useSearchParam("item")
  const [selectedEntry, setSelectedEntry] = useState<SecondaryEntry | null>(null)
  const [creating, setCreating] = useState(false)
  const [branchEditor, setBranchEditor] = useState<WarehouseMetadata | "new" | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [branchCode, setBranchCode] = useSearchParam("group")
  const [color, setColor] = useSearchParam("color")
  const [tier, setTier] = useSearchParam("tier")
  const [stat, setStat] = useSearchParam("stat")
  const [, setSearchParams] = useSearchParams()
  const [availabilityParam, setAvailability] = useSearchParam("availability")
  const availability = spellAvailabilityFilters.find((value) => value === availabilityParam) ?? ""

  useEffect(() => {
    if (kind === "spells" && availabilityParam && !availability) setAvailability(null)
  }, [kind, availabilityParam, availability, setAvailability])

  const records = (catalog.data ?? []).map((entry) => ({
    ...entry,
    changeKinds: scopeState.badgeKinds(entry.id),
  }))
  const scopedRecords = scoped
    ? (scopedCatalog.data ?? []).map((entry) => ({ ...entry, changeKinds: scopeState.badgeKinds(entry.id) }))
    : records
  const sortedBranches = [...(branches.data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
  const activeBranch = sortedBranches.find((branch) => branch.code === branchCode) ?? sortedBranches[0]
  const selected =
    selectedEntry && selectedEntry.id === selectedId && selectedEntry.revision.rulesetId === context.rulesetId
      ? selectedEntry
      : (scopedRecords.find((entry) => entry.id === selectedId || entry.code === selectedId) ??
        records.find((entry) => entry.id === selectedId || entry.code === selectedId))
  const mutation = useMutation({ mutationFn: (action: () => Promise<void>) => action() })
  const candidates = scopedRecords
    .filter((entry) => {
      const text = warehouseText(entry.content.translations, context.locale)
      if (!matchesQuery(context.search, entry.code, text?.name, text?.summary, text?.description)) return false
      if (kind === "arcana") {
        const content = entry.content as ArcanaContent
        return (!color || content.color === color) && (!tier || content.tier === Number(tier))
      }
      if (kind === "spells") return !availability || (entry.content as SpellContent).availability === availability
      return true
    })
    .sort((a, b) =>
      kind === "spells"
        ? (a.content as SpellContent).displayOrder - (b.content as SpellContent).displayOrder ||
          a.code.localeCompare(b.code)
        : a.code.localeCompare(b.code),
    )
  const statOptions =
    kind === "arcana"
      ? [...new Set(candidates.flatMap((entry) => (entry.content as ArcanaContent).stats.map((stat) => stat.key)))]
      : []
  const activeStat = statOptions.includes(stat) ? stat : ""
  const visible =
    kind === "arcana" && activeStat
      ? candidates.filter((entry) => (entry.content as ArcanaContent).stats.some((stat) => stat.key === activeStat))
      : candidates
  const statOptionsReady =
    !!context.rulesetId &&
    context.rulesets.isSuccess &&
    (scoped ? scopedCatalog.isSuccess && !scopedCatalog.isFetching : catalog.isSuccess && !catalog.isFetching)

  useEffect(() => {
    if (kind === "arcana" && statOptionsReady && stat && !activeStat) setStat(null)
  }, [kind, statOptionsReady, stat, activeStat, setStat])

  function open(entry: SecondaryEntry) {
    setSelectedEntry(entry)
    setSelectedId(entry.id)
  }
  function close() {
    setSelectedEntry(null)
    setSelectedId(null)
    setCreating(false)
  }
  async function refresh() {
    await invalidateWarehouseCatalogs(client)
    await client.invalidateQueries({ queryKey: ["publication-overview"] })
  }
  async function save(code: string, content: SecondaryContent, patchId: string | null) {
    await mutation.mutateAsync(async () => {
      let value = content as WarehouseContents[SecondaryKind]
      if (creating && kind === "enchantments") {
        const peers = (records as WarehouseEntry<EnchantmentContent>[]).filter(
          (entry) => entry.content.branchCode === content.branchCode && entry.content.tier === content.tier,
        )
        value = {
          ...content,
          position: Math.max(-1, ...peers.map((entry) => entry.content.position ?? -1)) + 1,
        } as EnchantmentContent
      }
      const saved = creating
        ? await warehouseApi.create(kind, {
            code,
            rulesetId: context.rulesetId,
            initialLocale: content.translations[0].locale,
            name: content.translations[0].name,
            content: value,
            effectiveFromPatchVariantId: patchId,
          })
        : await warehouseApi.save(kind, selected!, value, patchId)
      await refresh()
      if (creating) close()
      else setSelectedEntry(saved)
    })
  }
  async function action(type: "fork" | "publish" | "discard") {
    await mutation.mutateAsync(async () => {
      const saved = await warehouseApi[type](kind, selected!)
      await refresh()
      if (type === "discard") close()
      else setSelectedEntry(saved)
    })
  }
  const issue =
    catalog.error ?? branches.error ?? context.rulesets.error ?? overview.error ?? (scoped ? scopedCatalog.error : null)
  async function reorderBranches(ids: string[]) {
    try {
      if (ids.some((id) => !sortedBranches.some((entry) => entry.code === id)))
        throw new Error("The branch list has changed. Close and reopen ordering.")
      const saved = await warehouseApi.reorderBranches(
        ids.map((id) => sortedBranches.find((entry) => entry.code === id)!),
      )
      if (branchEditor && branchEditor !== "new")
        setBranchEditor(saved.find((entry) => entry.code === branchEditor.code) ?? null)
    } finally {
      await refresh()
    }
  }
  async function reorderEnchantments(ids: string[]) {
    if (!ids.length || ids.some((id) => !records.some((entry) => entry.id === id)))
      throw new Error("The enchantment list has changed. Close and reopen ordering.")
    const entries = ids.map((id) => records.find((entry) => entry.id === id)!) as WarehouseEntry<EnchantmentContent>[]
    try {
      const saved = await warehouseApi.reorderEnchantments(
        context.rulesetId,
        entries[0].content.branchCode,
        entries[0].content.tier,
        entries,
      )
      if (selected) setSelectedEntry(saved.find((entry) => entry.id === selected.id) ?? selected)
    } finally {
      await refresh()
    }
  }
  return (
    <Page className="min-h-0 min-w-0 gap-4">
      <PageHeader
        title={titles[kind]}
        search={
          <SearchField
            placement="header"
            label={`Tìm ${secondaryNames[kind]}`}
            placeholder="Tìm tên hoặc mã…"
            shortcut
            value={context.search}
            onChange={context.setSearch}
          />
        }
        actions={
          <>
            <WarehouseRulesetSelect context={context} />
            {canWrite && (
              <PageActionsMenu label={`Tạo và thiết lập ${secondaryNames[kind]}`}>
                <DropdownMenuItem
                  disabled={!context.rulesetId}
                  onSelect={() => {
                    setCreating(true)
                    setSelectedEntry(null)
                    setSelectedId(null)
                  }}
                >
                  <Plus />
                  Tạo {secondaryNames[kind]}
                </DropdownMenuItem>
                {kind === "enchantments" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setBranchEditor("new")}>
                      <GitBranch />
                      Tạo hệ
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!sortedBranches.length} onSelect={() => setOrdering(true)}>
                      <ListOrdered />
                      Thứ tự các hệ
                    </DropdownMenuItem>
                  </>
                )}
              </PageActionsMenu>
            )}
          </>
        }
      />
      {kind === "enchantments" && canWrite && (
        <WarehouseOrderPicker
          hideTrigger
          open={ordering}
          onOpenChange={setOrdering}
          label="Thứ tự các hệ"
          items={sortedBranches.map((entry) => ({
            id: entry.code,
            name: warehouseText(entry.translations, context.locale)?.name ?? entry.code,
            iconAssetId: entry.iconAssetId,
            color: enchantmentBranchColor(entry),
          }))}
          onSave={reorderBranches}
        />
      )}
      <WarehouseScopeControls scope={scopeState} />
      {kind === "arcana" && (
        <ArcanaFilters
          color={color}
          tier={tier}
          stat={activeStat}
          statDisabled={!statOptionsReady || !statOptions.length}
          statOptions={statOptions
            .map((value) => ({ value, label: statLabel(candidates, value, context.locale) }))
            .sort((a, b) => a.label.localeCompare(b.label, context.locale))}
          onColorChange={setColor}
          onTierChange={setTier}
          onStatChange={setStat}
          onReset={() =>
            setSearchParams(
              (current) => {
                const next = new URLSearchParams(current)
                for (const key of ["color", "tier", "stat"]) next.delete(key)
                return next
              },
              { replace: true },
            )
          }
        />
      )}
      {kind === "spells" && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Lọc khả dụng phụ trợ">
          <Button size="sm" variant={!availability ? "secondary" : "ghost"} onClick={() => setAvailability(null)}>
            <LayoutGrid aria-hidden className="size-3.5" />
            Tất cả
          </Button>
          {spellAvailabilityFilters.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={availability === value ? "secondary" : "ghost"}
              aria-pressed={availability === value}
              onClick={() => setAvailability(value)}
            >
              <Archive aria-hidden className="size-3.5" />
              {availabilityLabels[value]}
            </Button>
          ))}
        </div>
      )}
      {issue && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm"
        >
          <p className="flex-1 text-destructive">{errorMessage(issue)}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void catalog.refetch()
              if (kind === "enchantments") void branches.refetch()
              if (kind === "enchantments") {
                void overview.refetch()
                if (scoped) void scopedCatalog.refetch()
              }
            }}
          >
            Tải lại
          </Button>
        </div>
      )}
      {(catalog.isPending && !!context.rulesetId) ||
      (kind === "enchantments" && branches.isPending) ||
      overview.isPending ||
      (scoped && scopedCatalog.isPending) ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : kind === "enchantments" ? (
        <EnchantmentBranches
          records={visible as WarehouseEntry<EnchantmentContent>[]}
          branches={sortedBranches}
          active={scoped ? branchCode : (activeBranch?.code ?? "")}
          scoped={scoped}
          onSelect={(code) => setBranchCode(code)}
          onOpen={open}
          selectedId={selectedId}
          locale={context.locale}
          search={context.search}
          canWrite={canWrite}
          onEditBranch={setBranchEditor}
        />
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {visible.length} / {records.length} {secondaryNames[kind]}
            </span>
            <span aria-hidden>·</span>
            <Languages className="size-3.5" />
            <span>
              {
                records.filter((entry) => entry.content.translations.some((text) => text.locale === context.locale))
                  .length
              }{" "}
              có bản dịch {context.locale}
            </span>
          </div>
          {kind === "spells" ? (
            <SpellCollection
              key={JSON.stringify([context.search, availability])}
              records={visible as WarehouseEntry<SpellContent>[]}
              locale={context.locale}
              selectedId={selectedId}
              onOpen={open}
              revealLegacy={!!context.search || availability === "REMOVED"}
            />
          ) : (
            <ArcanaCollection
              key={JSON.stringify([context.search, tier, activeStat])}
              records={visible as WarehouseEntry<ArcanaContent>[]}
              locale={context.locale}
              selectedId={selectedId}
              onOpen={open}
              revealLowerTiers={!!context.search || !!activeStat || tier === "1" || tier === "2"}
            />
          )}
        </>
      )}
      {!catalog.isPending && !(scoped && scopedCatalog.isPending) && !visible.length && !issue && (
        <div className="grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center">
          <div className="space-y-2">
            <div className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
              {kind === "arcana" ? (
                <Gem className="size-5" />
              ) : kind === "spells" ? (
                <Zap className="size-5" />
              ) : (
                <Sparkles className="size-5" />
              )}
            </div>
            <p className="font-medium">
              {scoped
                ? scopeState.showAll
                  ? "Chưa có dữ liệu đã xuất bản phù hợp tại mốc này"
                  : "Chưa ghi nhận thay đổi phù hợp. Chọn Tất cả tại mốc để xem dữ liệu kế thừa."
                : records.length
                  ? "Không có kết quả phù hợp"
                  : "Chưa có dữ liệu trong bộ quy tắc này"}
            </p>
            <p className="text-sm text-muted-foreground">
              {records.length ? "Thử đổi điều kiện lọc hoặc từ khóa." : "Tạo mục mới hoặc nhập dữ liệu vào backend."}
            </p>
          </div>
        </div>
      )}
      {(creating || selected) && (
        <SecondaryEditor
          key={creating ? `new-${kind}` : `${selected!.revision.id}-${selected!.revision.version}`}
          kind={kind}
          entryId={selected?.id}
          revisionId={selected?.revision.id}
          revisionPublished={selected?.revision.state === "PUBLISHED"}
          revisionCause={selected?.revision.cause}
          sourceRevisionId={selected?.revision.sourceRevisionId}
          code={selected?.code}
          content={creating ? newSecondaryContent(kind, context.locale, activeBranch?.code) : selected!.content}
          branches={sortedBranches}
          locale={context.locale}
          isNew={creating}
          rulesetId={context.rulesetId}
          initialPatchId={selected?.revision.effectiveFromPatchVariantId ?? null}
          allowPatchChange={creating || selected?.revision.cause === "DATA_BASELINE"}
          missingFields={selected?.missingFields}
          readOnly={!canWrite || (!creating && selected!.revision.state !== "DRAFT")}
          canPublish={canPublish}
          revisionLabel={
            selected
              ? `${selected.revision.state === "DRAFT" ? "Bản nháp" : selected.revision.state === "PUBLISHED" ? "Đã xuất bản" : "Đã bỏ"} · v${selected.revision.revisionNo}`
              : undefined
          }
          onSave={save}
          onClose={close}
          onDraft={(entry) => setSelectedEntry(entry as SecondaryEntry)}
          enchantmentPeers={kind === "enchantments" ? (records as WarehouseEntry<EnchantmentContent>[]) : []}
          onReorderEnchantments={canWrite ? reorderEnchantments : undefined}
          onCreateDraft={
            !creating && canWrite && selected?.revision.state === "PUBLISHED" ? () => action("fork") : undefined
          }
          onPublish={!creating && selected?.revision.state === "DRAFT" ? () => action("publish") : undefined}
          onDiscard={!creating && selected?.revision.state === "DRAFT" ? () => action("discard") : undefined}
        />
      )}
      {branchEditor && (
        <EnchantmentBranchEditor
          key={branchEditor === "new" ? "new" : `${branchEditor.code}-${branchEditor.version}`}
          branch={branchEditor === "new" ? null : branchEditor}
          locale={context.locale}
          onClose={() => setBranchEditor(null)}
          branches={sortedBranches}
          onReorderBranches={reorderBranches}
          onSave={async (value) => {
            await warehouseApi.saveMetadata(
              "enchantments",
              branchEditor === "new"
                ? {
                    ...value,
                    displayOrder: Math.max(-1, ...sortedBranches.map((entry) => entry.displayOrder)) + 1,
                  }
                : value,
            )
            await refresh()
            setBranchEditor(null)
          }}
        />
      )}
    </Page>
  )
}

function statLabel(records: SecondaryEntry[], key: string, locale: string) {
  return (
    records.map((entry) => warehouseText(entry.content.translations, locale)?.statLabels?.[key]).find(Boolean) || key
  )
}
