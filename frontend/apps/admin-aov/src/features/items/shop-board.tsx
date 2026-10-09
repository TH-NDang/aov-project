import { useMemo, useState, type ReactNode } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { Plus, Search } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@aov/ui/components/input-group"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import { cn } from "@aov/ui/lib/utils"
import type { Item, ItemCategory, ShopPosition } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { useSearchParam } from "@/hooks/use-search-param"
import { buildsInto, SUPPORT_GROUP, SUPPORT_VARIANTS } from "@/lib/domain/items"
import { formatNumber, matchesQuery } from "@/lib/text"
import type { ItemWorkspace } from "./use-item-workspace"

interface DragPayload {
  itemId: string
  /** Index in `shopPositions`, or null when dragged from the library. */
  positionIndex: number | null
}

type Relation = "selected" | "component" | "upgrade" | undefined

interface ShopBoardProps {
  workspace: ItemWorkspace
  categories: ItemCategory[]
  selectedId: string | null
  onSelect: (itemId: string) => void
}

export function ShopBoard({ workspace, categories, selectedId, onSelect }: ShopBoardProps) {
  const [group, setGroup] = useSearchParam("group", categories[0]?.name ?? "")
  const [variantFilter, setVariantFilter] = useState("all")
  const variant = variantFilter === "all" ? "" : variantFilter
  const [extraRows, setExtraRows] = useState(0)
  const [libraryQuery, setLibraryQuery] = useState("")
  const [dragging, setDragging] = useState<DragPayload | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const items = workspace.items
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const placements = useMemo(
    () =>
      items.flatMap((item) =>
        item.shopPositions
          .map((position, positionIndex) => ({ item, position, positionIndex }))
          .filter(
            ({ position }) =>
              position.group === group && (!variant || position.variant === null || position.variant === variant),
          ),
      ),
    [items, group, variant],
  )

  const columns = Math.max(3, ...placements.map(({ position }) => (position.column ?? 0) + 1))
  const rows = Math.max(6, ...placements.map(({ position }) => (position.row ?? 0) + 2)) + extraRows
  const cells = new Map<string, typeof placements>()
  for (const placement of placements) {
    if (placement.position.row === null || placement.position.column === null) continue
    const key = `${placement.position.row}:${placement.position.column}`
    cells.set(key, [...(cells.get(key) ?? []), placement])
  }
  const unplaced = placements.filter(({ position }) => position.row === null || position.column === null)

  const relation = useMemo(() => {
    const result = new Map<string, Relation>()
    const selected = selectedId ? byId.get(selectedId) : undefined
    if (!selected) return result
    for (const component of selected.recipe.components) result.set(component.itemId, "component")
    for (const upgrade of buildsInto(items, selected.id)) result.set(upgrade.id, "upgrade")
    result.set(selected.id, "selected")
    return result
  }, [selectedId, byId, items])

  const move = (payload: DragPayload, row: number | null, column: number | null) => {
    workspace.updateItem(payload.itemId, (item) => {
      let index = payload.positionIndex ?? item.shopPositions.findIndex((position) => position.group === group)
      const next: ShopPosition = {
        group,
        row,
        column,
        variant: variant || (index >= 0 ? item.shopPositions[index].variant : null) || null,
      }
      if (index < 0) index = item.shopPositions.push(next) - 1
      else item.shopPositions[index] = next
    })
  }

  const onDragStart = (event: DragStartEvent) => setDragging(event.active.data.current as DragPayload)
  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null)
    const payload = event.active.data.current as DragPayload | undefined
    const target = event.over?.data.current as { row: number | null; column: number | null } | undefined
    if (!payload || !target) return
    move(payload, target.row, target.column)
    onSelect(payload.itemId)
  }

  const library = items.filter((item) => matchesQuery(libraryQuery, item.name, item.id))

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <InputGroup className="h-8">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={libraryQuery}
              onChange={(event) => setLibraryQuery(event.target.value)}
              placeholder="Tìm tên / mã…"
              aria-label="Tìm trang bị để kéo"
            />
          </InputGroup>
          <p className="text-xs text-muted-foreground">
            Kéo món vào ô shop. Thả vào ô đã có món sẽ xếp chồng, không xoá món cũ.
          </p>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1 xl:max-h-[calc(100svh-22rem)]">
            {library.map((item) => (
              <DraggableChip
                key={item.id}
                item={item}
                positionIndex={null}
                relation={relation.get(item.id)}
                onSelect={onSelect}
                compact
              />
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={1}
              value={group}
              onValueChange={(value) => value && setGroup(value)}
              className="flex-wrap"
            >
              {categories.map((category) => (
                <ToggleGroupItem key={category.id} value={category.name}>
                  {category.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {group === SUPPORT_GROUP && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={variantFilter}
                onValueChange={(value) => value && setVariantFilter(value)}
              >
                <ToggleGroupItem value="all">Mọi nhánh</ToggleGroupItem>
                {SUPPORT_VARIANTS.map((name) => (
                  <ToggleGroupItem key={name} value={name}>
                    {name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setExtraRows((count) => count + 2)}>
              <Plus /> Thêm hàng
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm ring-2 ring-primary" /> Đang chọn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-2 border-dashed border-foreground/60" /> Nguyên liệu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-accent ring-1 ring-foreground/30" /> Nâng cấp thành
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <div
              className="grid min-w-[560px] gap-px bg-border"
              style={{ gridTemplateColumns: `3rem repeat(${columns}, minmax(150px, 1fr))` }}
            >
              <div className="bg-muted/50" />
              {Array.from({ length: columns }, (_, column) => (
                <div key={column} className="bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Cột {column}
                </div>
              ))}
              {Array.from({ length: rows }, (_, row) => (
                <Row key={row} row={row} columns={columns} cells={cells} relation={relation} onSelect={onSelect} />
              ))}
            </div>
          </div>

          <DropZone id="unplaced" row={null} column={null} className="min-h-16 rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Chưa xếp vị trí ({unplaced.length}) · thả vào đây để bỏ hàng/cột
            </p>
            <div className="flex flex-wrap gap-2">
              {unplaced.map(({ item, positionIndex }) => (
                <DraggableChip
                  key={`${item.id}:${positionIndex}`}
                  item={item}
                  positionIndex={positionIndex}
                  relation={relation.get(item.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </DropZone>
        </section>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && byId.get(dragging.itemId) ? (
          <ChipBody item={byId.get(dragging.itemId)!} className="shadow-lg ring-2 ring-primary" />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function Row({
  row,
  columns,
  cells,
  relation,
  onSelect,
}: {
  row: number
  columns: number
  cells: Map<string, { item: Item; positionIndex: number }[]>
  relation: Map<string, Relation>
  onSelect: (itemId: string) => void
}) {
  return (
    <>
      <div className="flex items-start justify-center bg-background pt-3 text-xs text-muted-foreground tabular-nums">
        {row}
      </div>
      {Array.from({ length: columns }, (_, column) => {
        const placed = cells.get(`${row}:${column}`) ?? []
        return (
          <DropZone
            key={column}
            id={`cell:${row}:${column}`}
            row={row}
            column={column}
            className="min-h-20 bg-background p-1.5"
          >
            <div className="flex flex-col gap-1.5">
              {placed.length > 1 && (
                <Badge variant="outline" className="self-start text-[10px]">
                  {placed.length} món cùng ô
                </Badge>
              )}
              {placed.map(({ item, positionIndex }) => (
                <DraggableChip
                  key={`${item.id}:${positionIndex}`}
                  item={item}
                  positionIndex={positionIndex}
                  relation={relation.get(item.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </DropZone>
        )
      })}
    </>
  )
}

function DropZone({
  id,
  row,
  column,
  className,
  children,
}: {
  id: string
  row: number | null
  column: number | null
  className?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { row, column } })
  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "bg-accent outline-2 -outline-offset-2 outline-primary/60")}
    >
      {children}
    </div>
  )
}

function ChipBody({ item, className, compact }: { item: Item; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md border bg-card p-1.5 text-left", className)}>
      <MediaImage path={item.image} alt="" className={cn("shrink-0 object-contain", compact ? "size-7" : "size-9")} />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{item.name}</p>
        <p className="truncate text-[11px] text-muted-foreground tabular-nums">
          {formatNumber(item.price)} · C{item.tier}
          {item.recipe.status === "unverified" && " · chưa xác nhận"}
        </p>
      </div>
    </div>
  )
}

function DraggableChip({
  item,
  positionIndex,
  relation,
  onSelect,
  compact,
}: {
  item: Item
  positionIndex: number | null
  relation: Relation
  onSelect: (itemId: string) => void
  compact?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${item.id}:${positionIndex ?? "library"}`,
    data: { itemId: item.id, positionIndex } satisfies DragPayload,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onSelect(item.id)}
      aria-label={`${item.name}. Kéo để đổi vị trí, bấm để xem chi tiết.`}
      className={cn(
        "cursor-grab touch-none rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <ChipBody
        item={item}
        compact={compact}
        className={cn(
          "transition-colors hover:bg-accent/60",
          relation === "selected" && "ring-2 ring-primary",
          relation === "component" && "border-2 border-dashed border-foreground/60",
          relation === "upgrade" && "bg-accent ring-1 ring-foreground/30",
        )}
      />
    </button>
  )
}
