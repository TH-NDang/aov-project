import { useWarehouseScope, WarehouseScopeControls, WarehouseScopeEmpty } from "../components/catalog/warehouse-scope"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { FolderPlus, LoaderCircle, PencilLine, Plus, Rows3 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@aov/ui/components/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@aov/ui/components/alert-dialog"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { UnsavedBar } from "@/components/unsaved-bar"
import { useSearchParam } from "@/hooks/use-search-param"
import { errorMessage } from "@/lib/api/errors"
import { Field } from "../../publishing/components/editing/fields"
import { warehouseApi, invalidateWarehouseCatalogs, useWarehouseMetadata } from "../api/warehouse-api"
import {
  WarehouseDraftMenu,
  WarehouseRulesetSelect,
  useWarehouseContext,
} from "../components/catalog/warehouse-controls"
import { ItemSearch, itemSearchMatches } from "../components/items/item-search"
import { ItemStatFilter } from "@aov/ui/components/warehouse/item-facts"
import { itemMatchesStatFilters, itemReaderContent, itemStatFilterCounts } from "@aov/ui/lib/item-description"
import { type WarehouseEntry, type WarehouseMetadata } from "../model/warehouse-types"
import { warehouseName, warehouseText, type ItemContent } from "@aov/ui/lib/warehouse-content"
import { EnchantmentBranchEditor } from "../components/secondary/enchantment-branch-editor"
import { recipeConnectionError } from "@aov/ui/lib/item-graph"
import { ItemShopGraph, ItemShopHelp } from "../components/items/item-shop-graph"
import { ItemEditor } from "../components/items/item-editor"
import type { EditTarget, WarehouseSection } from "../components/sheet/warehouse-edit-section"
import type { NewDraft } from "../components/sheet/warehouse-sheet"
import { confirmDiscard } from "@/components/confirm-dialog"
import { leavingPage, useLeaveGuard } from "@/hooks/use-leave-guard"

type Entry = WarehouseEntry<ItemContent>
type PendingItem = { entry: Entry; content: ItemContent; patchId?: string | null }
function withPendingEdits(entry: Entry, pending?: PendingItem): Entry {
  if (!pending) return entry
  return {
    ...entry,
    content: pending.content,
    revision: {
      ...pending.entry.revision,
      effectiveFromPatchVariantId:
        pending.patchId === undefined ? pending.entry.revision.effectiveFromPatchVariantId : pending.patchId,
    },
  }
}
/** A board change waiting for its published item to get a draft. */
type DraftAction =
  | { type: "connect"; from: string; to: string }
  | { type: "move"; id: string; index: number; row: number; column: number }
type DraftRequest = { id: string; action: DraftAction }
function initialItem(locale: string, name: string): ItemContent {
  return {
    iconAssetId: null,
    tier: null,
    price: null,
    categoryCode: null,
    shopPositions: [],
    recipeStatus: "UNKNOWN",
    components: [],
    stats: [],
    translations: [{ locale, name, summary: null, description: null }],
    notes: null,
  }
}
export function BackendItemsPage() {
  const context = useWarehouseContext()
  const scope = useWarehouseScope("items", context.rulesetId, context.locale)
  const catalog = scope.catalog
  const displayedCatalog = scope.scoped ? scope.query : catalog
  const groups = useWarehouseMetadata("items")
  const client = useQueryClient()
  const { actor } = useSession()
  const canWrite = !!actor?.capabilities.includes("item:write")
  const canPublish = !!actor?.capabilities.includes("item:publish")
  const [group, setGroup] = useSearchParam("group")
  const [selectedId, setSelectedId] = useSearchParam("item")
  const [statParam, setStatParam] = useSearchParam("stats")
  const [focusId, setFocusId] = useState<string | null>(selectedId || null)
  const [edits, setEdits] = useState<Map<string, PendingItem>>(() => new Map())
  const [undo, setUndo] = useState<Map<string, PendingItem>[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [extraRows, setExtraRows] = useState(0)
  const [jump, setJump] = useState<{ id: string; group: string | null } | null>(null)
  const [draftRequest, setDraftRequest] = useState<DraftRequest | null>(null)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [translationView, setTranslationView] = useState<{ entryId: string; locale: string; language: string } | null>(
    null,
  )
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [autoDraft, setAutoDraft] = useState(false)
  const [rememberDraft, setRememberDraft] = useState(false)
  const [categoryEditor, setCategoryEditor] = useState<WarehouseMetadata | "new" | null>(null)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const pending = edits.size
  const { badgeKinds } = scope
  const rows = useMemo(
    () =>
      scope.entries.map((base) => {
        const item = {
          ...base,
          changeKinds: badgeKinds(base),
        }
        return withPendingEdits(item, edits.get(item.id))
      }),
    [scope.entries, edits, badgeKinds],
  )
  const searchMatches = useMemo(
    () => (context.q ? new Set(itemSearchMatches(rows, context.q, context.locale).map((item) => item.id)) : null),
    [rows, context.q, context.locale],
  )
  const activeStats = useMemo(() => (statParam ? statParam.split(",") : []), [statParam])
  const statsById = useMemo(
    () =>
      new Map(
        rows.map((item) => [
          item.id,
          itemReaderContent(item.content, warehouseText(item.content.translations, context.locale)).stats,
        ]),
      ),
    [rows, context.locale],
  )
  const matches = useMemo(() => {
    if (!activeStats.length) return searchMatches
    return new Set(
      rows
        .filter((item) => !searchMatches || searchMatches.has(item.id))
        .filter((item) => itemMatchesStatFilters(statsById.get(item.id) ?? [], activeStats))
        .map((item) => item.id),
    )
  }, [rows, searchMatches, statsById, activeStats])
  const categories = groups.data ?? []
  const category = categories.some((c) => c.code === group) ? group : (categories[0]?.code ?? "")
  const statCounts = useMemo(
    () =>
      itemStatFilterCounts(
        rows
          .filter((item) => item.content.shopPositions.some((position) => position.categoryCode === category))
          .filter((item) => !searchMatches || searchMatches.has(item.id))
          .map((item) => statsById.get(item.id) ?? []),
        activeStats,
      ),
    [rows, category, searchMatches, statsById, activeStats],
  )
  // Scrolls to a searched item once its group is on screen.
  useEffect(() => {
    if (!jump || (jump.group && jump.group !== category)) return
    setJump(null)
    document
      .querySelector(`[data-item-node="${CSS.escape(jump.id)}"]`)
      ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" })
  }, [jump, category])
  const selectedBase =
    (editingEntry?.id === selectedId && editingEntry.revision.rulesetId === context.rulesetId ? editingEntry : null) ??
    rows.find((item) => item.id === selectedId) ??
    catalog.data?.find((item) => item.id === selectedId)
  const selected = selectedBase && withPendingEdits(selectedBase, edits.get(selectedId))
  const existingDraft = scope.drafts.find((entry) => entry.id === selected?.id)
  const recipeItems = useMemo(() => {
    const items = new Map((catalog.data ?? []).map((entry) => [entry.id, withPendingEdits(entry, edits.get(entry.id))]))
    for (const row of rows) items.set(row.id, row)
    if (selected) items.set(selected.id, selected)
    return [...items.values()]
  }, [catalog.data, rows, edits, selected])
  useLeaveGuard(leavingPage(pending > 0), async () => {
    const leave = await confirmDiscard({
      title: `Còn ${pending} thay đổi chưa lưu`,
      description: "Lưu thay đổi lên máy chủ trước khi rời trang, hoặc bỏ phần đang sửa.",
      confirmLabel: "Bỏ thay đổi và rời trang",
    })
    if (leave) {
      setEdits(new Map())
      setUndo([])
    }
    return leave
  })
  useEffect(() => {
    if (!pending) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [pending])
  function select(id: string) {
    setEditingEntry(null)
    setEditTarget(null)
    setFocusId(id)
    setSelectedId(id)
  }
  function jumpTo(item: Entry) {
    const position = item.content.shopPositions[0]
    if (!position) {
      select(item.id)
      return
    }
    setGroup(position.categoryCode)
    setFocusId(item.id)
    setJump({ id: item.id, group: position.categoryCode })
  }
  function openEntry(entry: Entry, section?: WarehouseSection) {
    setEditTarget(section ? { revisionId: entry.revision.id, section } : null)
    setEditingEntry(entry)
    setSelectedId(entry.id)
  }
  function update(entry: Entry, content: ItemContent, patchId?: string | null) {
    setUndo((history) => [...history.slice(-19), new Map(edits)])
    setEdits((previous) =>
      new Map(previous).set(entry.id, {
        entry,
        content,
        patchId: patchId === undefined ? previous.get(entry.id)?.patchId : patchId,
      }),
    )
  }
  async function refresh() {
    await invalidateWarehouseCatalogs(client)
  }
  async function saveAll() {
    setBusy(true)
    setError("")
    try {
      for (const [id, pendingItem] of edits) {
        await warehouseApi.save("items", pendingItem.entry, pendingItem.content, pendingItem.patchId)
        setEdits((previous) => {
          const next = new Map(previous)
          next.delete(id)
          return next
        })
      }
      setUndo([])
      await refresh()
      toast.success("Đã lưu thay đổi lên máy chủ.")
    } catch (cause) {
      setError(errorMessage(cause))
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  async function fork(entry: Entry, request: NewDraft) {
    setBusy(true)
    setError("")
    try {
      const draft = await warehouseApi.fork("items", entry, request.cause, request.patchVariantId)
      await refresh()
      openEntry(draft, request.cause === "TRANSLATION_UPDATE" ? "translations" : "details")
      toast.success("Đã tạo bản nháp.")
    } catch (cause) {
      toast.error(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  async function publish(entry: Entry) {
    setBusy(true)
    setError("")
    try {
      await warehouseApi.publish("items", entry)
      await refresh()
      setSelectedId(null)
      setEditTarget(null)
      toast.success("Đã xuất bản trang bị.")
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  async function discard(entry: Entry) {
    setBusy(true)
    setError("")
    try {
      await warehouseApi.discard("items", entry)
      setEdits((previous) => {
        const next = new Map(previous)
        next.delete(entry.id)
        return next
      })
      await refresh()
      setSelectedId(null)
      setEditTarget(null)
      toast.success("Đã bỏ bản nháp.")
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  async function create() {
    setBusy(true)
    setError("")
    try {
      const result = await warehouseApi.create("items", {
        code: code.trim(),
        name: name.trim(),
        initialLocale: context.locale,
        rulesetId: context.rulesetId,
        content: initialItem(context.locale, name.trim()),
      })
      await refresh()
      setCreating(false)
      setName("")
      setCode("")
      setFocusId(result.id)
      openEntry(result)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  function requestDraft(request: DraftRequest) {
    if (autoDraft) void createDraftAndApply(request)
    else setDraftRequest(request)
  }
  function getDraft(entry: Entry) {
    return (
      scope.drafts.find(
        (item) =>
          item.id === entry.id &&
          item.revision.state === "DRAFT" &&
          item.revision.sourceRevisionId === entry.revision.id,
      ) ?? warehouseApi.fork("items", entry)
    )
  }
  async function createDraftAndApply(request: DraftRequest) {
    const entry = rows.find((item) => item.id === request.id)
    if (!entry) return
    const existing = scope.drafts.find((draft) => draft.id === entry.id)
    if (existing && existing.revision.sourceRevisionId !== entry.revision.id) {
      openEntry(existing)
      toast.info("Đã mở bản nháp đang có. Bạn có thể chỉnh sửa trực tiếp tại đây.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const draft = await getDraft(entry)
      await refresh()
      const action = request.action
      if (action.type === "connect") connect(action.from, action.to, draft)
      else move(action.id, action.index, action.row, action.column, draft)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  function move(id: string, index: number, row: number, column: number, draft?: Entry) {
    const item = draft ?? rows.find((entry) => entry.id === id)!
    if (item.revision.state !== "DRAFT") {
      requestDraft({ id, action: { type: "move", id, index, row, column } })
      return
    }
    update(item, {
      ...item.content,
      shopPositions: item.content.shopPositions.map((position, i) =>
        i === index ? { ...position, row, column } : position,
      ),
    })
  }
  function connect(from: string, to: string, draft?: Entry) {
    const problem = recipeConnectionError(recipeItems, from, to)
    if (problem) {
      toast.error(problem)
      return
    }
    const target = draft ?? rows.find((item) => item.id === to)!
    if (target.revision.state !== "DRAFT") {
      requestDraft({ id: to, action: { type: "connect", from, to } })
      return
    }
    if (target.content.components.some((part) => part.itemId === from)) {
      select(to)
      return
    }
    update(target, {
      ...target.content,
      recipeStatus: "VERIFIED",
      components: [...target.content.components, { itemId: from, quantity: 1 }],
    })
    setFocusId(to)
    toast.success("Đã thêm nguyên liệu. Lưu thay đổi để ghi lên máy chủ.")
  }
  async function switchRuleset(id: string) {
    if (
      pending &&
      !(await confirmDiscard({
        title: "Chuyển bộ quy tắc?",
        description: "Các thay đổi chưa lưu sẽ bị bỏ.",
        confirmLabel: "Bỏ và chuyển",
      }))
    )
      return

    setEdits(new Map())
    setUndo([])
    setSelectedId(null)
    setFocusId(null)
    context.setRuleset(id)
  }
  return (
    <Page className="min-h-0 min-w-0 gap-4" data-item-selection-surface>
      <PageHeader
        title="Trang bị"
        search={
          <ItemSearch
            items={rows}
            categories={categories}
            locale={context.locale}
            value={context.search}
            onChange={context.setSearch}
            onPick={jumpTo}
          />
        }
        actions={
          <>
            <WarehouseRulesetSelect
              context={{
                ...context,
                setRuleset: (id) => void switchRuleset(id),
              }}
            />
            <ItemShopHelp />
            <WarehouseDraftMenu
              entries={scope.drafts}
              locale={context.locale}
              onOpen={openEntry}
              variants={scope.data?.variants}
            />
            {canWrite && (
              <PageActionsMenu label="Tạo và thiết lập trang bị">
                <DropdownMenuItem disabled={busy || !context.rulesetId} onSelect={() => setCreating(true)}>
                  <Plus />
                  Tạo trang bị
                </DropdownMenuItem>
                <DropdownMenuItem disabled={busy} onSelect={() => setExtraRows((rows) => rows + 2)}>
                  <Rows3 />
                  Thêm 2 hàng trống
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCategoryEditor("new")}>
                  <FolderPlus />
                  Tạo nhóm trang bị
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!categories.some((c) => c.code === category)}
                  onSelect={() => setCategoryEditor(categories.find((c) => c.code === category)!)}
                >
                  <PencilLine />
                  Sửa nhóm đang xem
                </DropdownMenuItem>
              </PageActionsMenu>
            )}
          </>
        }
      />
      <WarehouseScopeControls scope={scope} />
      {(error || displayedCatalog.isError || groups.isError) && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {error || errorMessage(displayedCatalog.error ?? groups.error)}
        </p>
      )}
      {displayedCatalog.isPending ||
      groups.isPending ||
      (!scope.scoped && scope.overview.isPending) ||
      (scope.scoped &&
        (scope.showAll
          ? !rows.length && (scope.draftQuery.isPending || catalog.isPending)
          : scope.changes.isPending)) ? (
        <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải kho trang bị…
        </p>
      ) : scope.scoped && !rows.length ? (
        displayedCatalog.isSuccess &&
        groups.isSuccess &&
        (scope.showAll || scope.changes.isSuccess) && <WarehouseScopeEmpty scope={scope} />
      ) : (
        <>
          <ItemStatFilter
            className="max-sm:shrink-0 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[&>button]:shrink-0 max-sm:[&>button]:whitespace-nowrap"
            value={activeStats}
            counts={statCounts}
            onChange={(value) => setStatParam(value.join(","))}
          />
          <ItemShopGraph
            items={rows}
            categories={categories}
            locale={context.locale}
            selectedId={focusId}
            onFocus={setFocusId}
            category={category}
            onCategory={setGroup}
            onSelect={select}
            editable={canWrite && !busy}
            matches={matches}
            extraRows={extraRows}
            onExtraRowsChange={setExtraRows}
            onConnect={connect}
            onMove={move}
          />
          {!rows.length && !displayedCatalog.isError && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Chưa có trang bị trong bộ quy tắc này.
            </p>
          )}
        </>
      )}
      {selected && (
        <ItemEditor
          key={`${selected.id}:${selected.revision.id}:${selected.revision.version}`}
          entry={selected}
          items={recipeItems}
          relatedItems={rows}
          onView={openEntry}
          categories={categories}
          locale={context.locale}
          editable={canWrite && selected.revision.state === "DRAFT"}
          busy={busy}
          translationOnly={
            (selected.revision.state === "DRAFT" ? selected : existingDraft)?.revision.cause === "TRANSLATION_UPDATE"
          }
          initialLanguage={
            translationView && translationView.entryId === selectedId && translationView.locale === context.locale
              ? translationView.language
              : undefined
          }
          onLanguageChange={(language) => setTranslationView({ entryId: selectedId, locale: context.locale, language })}
          initialSection={editTarget?.revisionId === selected.revision.id ? editTarget.section : undefined}
          onClose={() => {
            setSelectedId(null)
            setEditTarget(null)
          }}
          onApply={(content, patchId) => {
            const problem = content.components
              .map((p) => recipeConnectionError(recipeItems, p.itemId, selected.id))
              .find(Boolean)
            if (problem) {
              toast.error(problem)
              return
            }
            update(selected, content, patchId)
            setSelectedId(null)
          }}
          onFork={
            canWrite && scope.draftsReady && selected.revision.state === "PUBLISHED"
              ? (request) => void fork(selected, request)
              : undefined
          }
          openDraftNo={existingDraft?.revision.revisionNo}
          onOpenDraft={
            canWrite && existingDraft && selected.revision.state === "PUBLISHED"
              ? (section) => openEntry(existingDraft, section)
              : undefined
          }
          onPublish={
            canPublish && selected.revision.state === "DRAFT" && !edits.has(selected.id)
              ? () => void publish(selected)
              : undefined
          }
          onDiscard={canWrite && selected.revision.state === "DRAFT" ? () => void discard(selected) : undefined}
        />
      )}
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!busy) setCreating(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo trang bị</DialogTitle>
            <DialogDescription>
              Bản nháp mới trong {context.rulesets.data?.find((r) => r.id === context.rulesetId)?.code}.
            </DialogDescription>
          </DialogHeader>
          <Field label="Tên trang bị" value={name} onChange={setName} />
          <Field
            label="Mã trang bị"
            value={code}
            onChange={setCode}
            placeholder="vi-du-trang-bi"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button onClick={() => void create()} disabled={busy || !name.trim() || !code.trim()}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}Tạo bản nháp
          </Button>
        </DialogContent>
      </Dialog>
      {categoryEditor && (
        <EnchantmentBranchEditor
          kind="items"
          branch={categoryEditor === "new" ? null : categoryEditor}
          locale={context.locale}
          onClose={() => setCategoryEditor(null)}
          onSave={async (value) => {
            await warehouseApi.saveMetadata("items", value)
            await refresh()
            setCategoryEditor(null)
          }}
        />
      )}
      <AlertDialog
        open={!!draftRequest}
        onOpenChange={(open) => {
          if (!open) setDraftRequest(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tạo bản nháp cho{" "}
              {draftRequest
                ? warehouseName(rows.find((item) => item.id === draftRequest.id) ?? rows[0], context.locale)
                : ""}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Món này đã xuất bản.{" "}
              {draftRequest?.action.type === "connect" ? "Để thêm nguyên liệu" : "Để đổi vị trí trong cửa hàng"} cần một
              bản nháp. Thay đổi chỉ hiện trên wiki sau khi bạn lưu và xuất bản lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={rememberDraft}
              onChange={(event) => setRememberDraft(event.target.checked)}
            />
            Tự tạo bản nháp, không hỏi lại trong lần làm việc này
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const request = draftRequest
                setDraftRequest(null)
                if (rememberDraft) setAutoDraft(true)
                if (request) void createDraftAndApply(request)
              }}
            >
              Tạo bản nháp và tiếp tục
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {canWrite && (
        <UnsavedBar
          count={pending}
          busy={busy}
          onSave={() => void saveAll()}
          canUndo={undo.length > 0}
          onUndo={() => {
            const previous = undo.at(-1)
            if (previous) {
              setEdits(previous)
              setUndo((history) => history.slice(0, -1))
            }
          }}
        />
      )}
    </Page>
  )
}
