import { useEffect, useState } from "react"
import { useBlocker } from "react-router"
import { Save, TriangleAlert, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@aov/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Kbd } from "@aov/ui/components/kbd"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Spinner } from "@aov/ui/components/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { MasterDetail } from "@/components/master-detail"
import { PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { useItemCatalog, useItemIssues, useSaveItems } from "@/lib/queries"
import { ItemDetailPanel } from "./item-detail-panel"
import { ItemIssues } from "./item-issues"
import { ItemsTable } from "./items-table"
import { ShopBoard } from "./shop-board"
import { useItemWorkspace } from "./use-item-workspace"

const TABS = ["list", "shop", "review"] as const

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

export function ItemsPage() {
  const catalog = useItemCatalog()
  const issues = useItemIssues()
  const workspace = useItemWorkspace(catalog.data)
  const save = useSaveItems()
  const [tab, setTab] = useSearchParam("tab", "list")
  const [selectedId, setSelectedId] = useSearchParam("item")
  const [recipeFilter] = useSearchParam("recipe")
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const pending = workspace.changed.size
  const activeTab = TABS.includes(tab as (typeof TABS)[number]) ? tab : "list"

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => pending > 0 && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!pending) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [pending])

  const { undo } = workspace
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !event.shiftKey &&
        !isTyping(event.target)
      ) {
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undo])

  const onSave = () =>
    save.mutate(
      { expectedVersion: workspace.baseVersion, items: workspace.items },
      {
        onSuccess: (saved) =>
          toast.success(`Đã lưu ${pending} trang bị.`, { description: `Danh mục trang bị v${saved.version}` }),
      },
    )

  const selected = selectedId ? workspace.items.find((item) => item.id === selectedId) : undefined
  const categories = catalog.data?.categories ?? []

  return (
    <>
      <MasterDetail
        detail={
          selected ? (
            <ItemDetailPanel
              item={selected}
              workspace={workspace}
              categories={categories}
              issues={(issues.data ?? []).filter((issue) => issue.itemIds.includes(selected.id))}
              onSelect={setSelectedId}
            />
          ) : null
        }
        detailTitle="Chi tiết trang bị"
        onCloseDetail={() => setSelectedId(null)}
      >
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <PageHeader
            title="Trang bị"
            description={
              catalog.data
                ? `${catalog.data.items.length} trang bị · thu thập ${catalog.data.collectedOn} · danh mục v${catalog.data.version}. Hàng và cột tính từ 0.`
                : "Đang tải danh mục…"
            }
            actions={
              <>
                {pending > 0 && <Badge variant="secondary">{pending} thay đổi chưa lưu</Badge>}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={undo} disabled={!workspace.canUndo || save.isPending}>
                      <Undo2 /> Hoàn tác
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <Kbd>Ctrl Z</Kbd>
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDiscard(true)}
                  disabled={!pending || save.isPending}
                >
                  Bỏ thay đổi
                </Button>
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={!pending || workspace.problems.length > 0 || save.isPending}
                >
                  {save.isPending ? <Spinner /> : <Save />} Lưu thay đổi
                </Button>
              </>
            }
          />

          {workspace.problems.length > 0 && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>Có {workspace.problems.length} lỗi cần sửa trước khi lưu</AlertTitle>
              <AlertDescription>
                <ul className="space-y-0.5">
                  {workspace.problems.slice(0, 5).map((problem, index) => (
                    <li key={index}>
                      {problem.itemId ? (
                        <button
                          type="button"
                          className="font-medium underline underline-offset-4"
                          onClick={() => setSelectedId(problem.itemId)}
                        >
                          {workspace.items.find((item) => item.id === problem.itemId)?.name ?? problem.itemId}
                        </button>
                      ) : null}{" "}
                      {problem.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!workspace.ready ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-80" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
              <TabsList>
                <TabsTrigger value="list">Danh sách</TabsTrigger>
                <TabsTrigger value="shop">Bố cục shop</TabsTrigger>
                <TabsTrigger value="review">
                  Cần kiểm tra
                  {issues.data && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                      {issues.data.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list">
                <ItemsTable
                  items={workspace.items}
                  categories={categories}
                  issues={issues.data ?? []}
                  changed={workspace.changed}
                  selectedId={selectedId || null}
                  onSelect={setSelectedId}
                  initialFilters={recipeFilter ? [{ id: "status", value: [recipeFilter] }] : []}
                />
              </TabsContent>
              <TabsContent value="shop">
                <ShopBoard
                  workspace={workspace}
                  categories={categories}
                  selectedId={selectedId || null}
                  onSelect={setSelectedId}
                />
              </TabsContent>
              <TabsContent value="review">
                <ItemIssues
                  issues={issues.data ?? []}
                  items={workspace.items}
                  selectedId={selectedId || null}
                  onSelect={setSelectedId}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </MasterDetail>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ {pending} thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>Danh mục trang bị sẽ quay về phiên bản đã lưu gần nhất.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction onClick={workspace.discard}>Bỏ thay đổi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === "blocked"} onOpenChange={(open) => !open && blocker.reset?.()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rời trang khi còn {pending} thay đổi chưa lưu?</AlertDialogTitle>
            <AlertDialogDescription>Các thay đổi trang bị chưa lưu sẽ mất nếu bạn rời trang.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Ở lại</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Rời trang</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
