import { useWarehouseScope, WarehouseScopeControls } from "./warehouse-scope"
import { CatalogChangeBadges } from "./catalog-changes"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { useBlocker } from "react-router"
import { GitBranch, Languages, List, LoaderCircle, MoreHorizontal, Plus, Save, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
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
import { Page } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { matchesQuery } from "@/lib/text"
import { errorMessage } from "@/lib/api/errors"
import { HeroAsset } from "../publishing/hero-content"
import { Field } from "../publishing/fields"
import { warehouseApi, invalidateWarehouseCatalogs, useWarehouseCatalog, useWarehouseMetadata } from "./warehouse-api"
import { WarehouseControls, useWarehouseContext } from "./warehouse-controls"
import { warehouseName, type ItemContent, type WarehouseEntry, type WarehouseMetadata } from "./warehouse-types"
import { EnchantmentBranchEditor } from "./secondary-editor"
import { recipeConnectionError } from "./item-graph"
import { ItemShopGraph } from "./item-shop-graph"
import { ItemEditor } from "./item-editor"
import { WarehouseCardHint } from "./warehouse-card-hint"

type Entry = WarehouseEntry<ItemContent>
type PendingItem = { content: ItemContent; patchId?: string | null }
const features = tableFeatures({})
const helper = createColumnHelper<typeof features, Entry>()
const empty: Entry[] = []
function ItemList({ items, locale, onSelect }: { items: Entry[]; locale: string; onSelect: (id: string) => void }) {
  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "name",
          header: "Trang bị",
          cell: ({ row }) => (
            <button
              className="group flex w-full min-w-48 cursor-pointer items-center gap-3 py-1 text-left hover:text-primary"
              onClick={() => onSelect(row.original.id)}
            >
              <HeroAsset id={row.original.content.iconAssetId} alt="" className="size-11 shrink-0 rounded-lg" />
              <span>
                <span className="block font-medium">{warehouseName(row.original, locale)}</span>
                <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
              </span>
              <CatalogChangeBadges kinds={row.original.changeKinds ?? []} compact />
              <span className="ml-auto">
                <WarehouseCardHint />
              </span>
            </button>
          ),
        }),
        helper.accessor((item) => item.content.price, {
          id: "price",
          header: "Giá",
          cell: ({ getValue }) => (
            <span className="whitespace-nowrap tabular-nums">{getValue()?.toLocaleString("vi-VN") ?? "—"}</span>
          ),
        }),
        helper.accessor((item) => item.content.tier, {
          id: "tier",
          header: "Cấp",
          cell: ({ getValue }) => getValue() ?? "—",
        }),
        helper.display({
          id: "recipe",
          header: "Công thức",
          cell: ({ row }) => (
            <Badge variant={row.original.content.recipeStatus === "UNKNOWN" ? "outline" : "secondary"}>
              {row.original.content.recipeStatus === "UNKNOWN"
                ? "Chưa xác nhận"
                : row.original.content.recipeStatus === "NONE"
                  ? "Không cần ghép"
                  : `${row.original.content.components.length} nguyên liệu`}
            </Badge>
          ),
        }),
        helper.display({
          id: "translations",
          header: "Bản dịch",
          cell: ({ row }) => (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Languages className="size-3.5" />
              {row.original.content.translations.length}
            </span>
          ),
        }),
        helper.display({
          id: "state",
          header: "Trạng thái",
          cell: ({ row }) => (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {row.original.revision.state === "DRAFT" ? "Bản nháp" : "Đã xuất bản"}
              {!!row.original.missingFields?.length && ` · Thiếu ${row.original.missingFields.length} mục`}
            </span>
          ),
        }),
      ]),
    [locale, onSelect],
  )
  const table = useTable({ features, columns, data: items, getRowId: (item) => item.id })
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-3 py-3 font-medium ${header.column.id === "name" ? "sticky left-0 z-10 bg-card" : ""}`}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/20">
              {row.getAllCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-3 py-2 ${cell.column.id === "name" ? "sticky left-0 z-10 bg-card" : ""}`}
                >
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length && <p className="p-8 text-center text-sm text-muted-foreground">Không có trang bị phù hợp.</p>}
    </div>
  )
}
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
  const catalog = useWarehouseCatalog("items", context.rulesetId, context.locale)
  const groups = useWarehouseMetadata("items")
  const client = useQueryClient()
  const { actor } = useSession()
  const canWrite = !!actor?.capabilities.includes("item:write")
  const canPublish = !!actor?.capabilities.includes("item:publish")
  const [tab, setTab] = useSearchParam("tab", "shop")
  const [group, setGroup] = useSearchParam("group")
  const [selectedId, setSelectedId] = useSearchParam("item")
  const [focusId, setFocusId] = useState<string | null>(selectedId || null)
  const [edits, setEdits] = useState<Map<string, PendingItem>>(() => new Map())
  const [undo, setUndo] = useState<Map<string, PendingItem>[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)
  const [categoryEditor, setCategoryEditor] = useState<WarehouseMetadata | "new" | null>(null)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const pending = edits.size
  const rows = useMemo(
    () =>
      (scope.scoped ? (scope.query.data ?? empty) : (catalog.data ?? empty)).map((base) => {
        const item = { ...base, changeKinds: scope.badgeKinds(base.id) }
        const pendingItem = edits.get(item.id)
        if (!pendingItem) return item

        return {
          ...item,
          content: pendingItem.content,
          revision: {
            ...item.revision,
            effectiveFromPatchVariantId:
              pendingItem.patchId === undefined ? item.revision.effectiveFromPatchVariantId : pendingItem.patchId,
          },
        }
      }),
    [catalog.data, edits, scope.query.data, scope.scoped, scope.latest, scope.showAll],
  )
  const filtered = useMemo(
    () => rows.filter((item) => matchesQuery(context.q, warehouseName(item, context.locale), item.code)),
    [rows, context.q, context.locale],
  )
  const categories = groups.data ?? []
  const category = categories.some((c) => c.code === group) ? group : (categories[0]?.code ?? "")
  const selected = rows.find((item) => item.id === selectedId)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => pending > 0 && currentLocation.pathname !== nextLocation.pathname,
  )
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
    setFocusId(id)
    setSelectedId(id)
  }
  function update(id: string, content: ItemContent, patchId?: string | null) {
    setUndo((history) => [...history.slice(-19), new Map(edits)])
    setEdits((previous) =>
      new Map(previous).set(id, { content, patchId: patchId === undefined ? previous.get(id)?.patchId : patchId }),
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
        const entry = catalog.data?.find((item) => item.id === id)
        if (!entry) throw new Error("Trang bị không còn trong danh sách. Tải lại trước khi lưu.")
        await warehouseApi.save("items", entry, pendingItem.content, pendingItem.patchId)
        setEdits((previous) => {
          const next = new Map(previous)
          next.delete(id)
          return next
        })
      }
      setUndo([])
      await refresh()
      toast.success("Đã lưu thay đổi vào backend.")
    } catch (cause) {
      setError(errorMessage(cause))
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  async function fork(entry: Entry) {
    setBusy(true)
    setError("")
    try {
      await warehouseApi.fork("items", entry)
      await refresh()
    } catch (cause) {
      setError(errorMessage(cause))
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
      toast.success("Đã xuất bản trang bị.")
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
      select(result.id)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  function connect(from: string, to: string) {
    const problem = recipeConnectionError(rows, from, to)
    if (problem) {
      toast.error(problem)
      return
    }
    const target = rows.find((item) => item.id === to)!
    if (target.revision.state !== "DRAFT") {
      toast.error("Tạo bản nháp cho món đích trước khi sửa công thức.")
      return
    }
    if (target.content.components.some((part) => part.itemId === from)) {
      select(to)
      return
    }
    update(to, {
      ...target.content,
      recipeStatus: "VERIFIED",
      components: [...target.content.components, { itemId: from, quantity: 1 }],
    })
    setFocusId(to)
    toast.success("Đã thêm nguyên liệu. Lưu thay đổi để ghi vào backend.")
  }
  return (
    <Page className="min-h-0 min-w-0 gap-4" data-item-selection-surface>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={tab === "shop" ? "secondary" : "ghost"} onClick={() => setTab("shop")}>
            <GitBranch className="size-4" />
            Sơ đồ shop
          </Button>
          <Button size="sm" variant={tab === "list" ? "secondary" : "ghost"} onClick={() => setTab("list")}>
            <List className="size-4" />
            Danh sách
          </Button>
          <span className="text-xs text-muted-foreground">{rows.length} trang bị</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && <Badge variant="secondary">{pending} thay đổi chưa lưu</Badge>}
          {canWrite && (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Hoàn tác"
                disabled={!undo.length || busy}
                onClick={() => {
                  const previous = undo.at(-1)
                  if (previous) {
                    setEdits(previous)
                    setUndo((history) => history.slice(0, -1))
                  }
                }}
              >
                <Undo2 className="size-4" />
                <span className="hidden sm:inline">Hoàn tác</span>
              </Button>
              <Button size="sm" disabled={!pending || busy} onClick={() => void saveAll()}>
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Lưu
                <span className="hidden sm:inline"> thay đổi</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label="Tạo trang bị"
                disabled={busy || !context.rulesetId}
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                Tạo<span className="hidden sm:inline"> trang bị</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="Thiết lập nhóm trang bị">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setCategoryEditor("new")}>Tạo nhóm trang bị</DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!categories.some((c) => c.code === category)}
                    onSelect={() => setCategoryEditor(categories.find((c) => c.code === category)!)}
                  >
                    Sửa nhóm đang xem
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
      <WarehouseControls
        context={{
          ...context,
          setRuleset: (id) => {
            if (pending && !window.confirm("Bỏ các thay đổi chưa lưu để chuyển bộ quy tắc?")) return
            setEdits(new Map())
            setUndo([])
            setSelectedId(null)
            setFocusId(null)
            context.setRuleset(id)
          },
        }}
        placeholder="Tìm tên hoặc mã trang bị…"
      />
      <WarehouseScopeControls scope={scope} />
      {(error || catalog.isError || groups.isError) && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {error || errorMessage(catalog.error ?? groups.error)}
        </p>
      )}
      {catalog.isPending || groups.isPending ? (
        <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải kho trang bị…
        </p>
      ) : tab === "list" ? (
        <ItemList items={filtered} locale={context.locale} onSelect={select} />
      ) : (
        <>
          {context.q && (
            <div className="flex flex-wrap gap-2">
              {filtered.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const pos = item.content.shopPositions[0]
                    if (pos) setGroup(pos.categoryCode)
                    setFocusId(item.id)
                    setSelectedId(item.id)
                  }}
                >
                  {warehouseName(item, context.locale)}
                </Button>
              ))}
            </div>
          )}
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
            onConnect={connect}
            onMove={(id, index, row, column) => {
              const item = rows.find((item) => item.id === id)!
              update(id, {
                ...item.content,
                shopPositions: item.content.shopPositions.map((position, i) =>
                  i === index ? { ...position, row, column } : position,
                ),
              })
            }}
          />
          {!rows.length && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {scope.scoped
                ? scope.showAll
                  ? "Chưa có dữ liệu trang bị đã xuất bản tại mốc này."
                  : "Chưa ghi nhận trang bị thay đổi trong phạm vi này. Chọn Tất cả tại mốc để xem dữ liệu kế thừa."
                : "Chưa có trang bị trong bộ quy tắc này."}
            </p>
          )}
        </>
      )}
      {selected && (
        <ItemEditor
          key={`${selected.id}:${selected.revision.id}:${selected.revision.version}`}
          entry={selected}
          items={rows}
          categories={categories}
          locale={context.locale}
          editable={canWrite && selected.revision.state === "DRAFT"}
          busy={busy}
          onClose={() => setSelectedId(null)}
          onApply={(content, patchId) => {
            const problem = content.components
              .map((p) => recipeConnectionError(rows, p.itemId, selected.id))
              .find(Boolean)
            if (problem) {
              toast.error(problem)
              return
            }
            update(selected.id, content, patchId)
            setSelectedId(null)
          }}
          onFork={() => void fork(selected)}
          onPublish={
            canPublish && selected.revision.state === "DRAFT" && !edits.has(selected.id)
              ? () => void publish(selected)
              : undefined
          }
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
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Còn {pending} thay đổi chưa lưu</AlertDialogTitle>
            <AlertDialogDescription>
              Lưu thay đổi vào backend trước khi rời trang, hoặc bỏ phần đang sửa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Ở lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEdits(new Map())
                setUndo([])
                blocker.proceed?.()
              }}
            >
              Bỏ thay đổi và rời trang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
