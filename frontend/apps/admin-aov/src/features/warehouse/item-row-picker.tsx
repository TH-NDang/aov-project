import { createPortal } from "react-dom"
import { useLayoutEffect, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { ArrowDown, ArrowUp, Check, GripVertical, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { cn } from "@aov/ui/lib/utils"
import { HeroAsset } from "../publishing/hero-content"
import { shopRowPeers } from "./item-shop-position"
import { warehouseName, type ItemContent, type WarehouseEntry } from "./warehouse-types"

type Entry = WarehouseEntry<ItemContent>
type Peer = ReturnType<typeof shopRowPeers>[number]

function ItemTile({ entry, locale }: { entry: Entry; locale: string }) {
  return (
    <>
      <HeroAsset id={entry.content.iconAssetId} alt="" className="size-8 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{warehouseName(entry, locale)}</span>
    </>
  )
}

function MovingItem({ entry, locale }: { entry: Entry; locale: string }) {
  const drag = useDraggable({ id: "current-item" })
  return (
    <div
      ref={drag.setNodeRef}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-primary/40 bg-background p-2",
        drag.isDragging && "opacity-30",
      )}
    >
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        aria-label={`Kéo ${warehouseName(entry, locale)}`}
        className="grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <ItemTile entry={entry} locale={locale} />
    </div>
  )
}

function RowSlot({
  row,
  selected,
  peers,
  entry,
  locale,
  onChoose,
}: {
  row: number
  selected: boolean
  peers: Peer[]
  entry: Entry
  locale: string
  onChoose: () => void
}) {
  const drop = useDroppable({ id: `row-${row}`, data: { row } })
  return (
    <li
      ref={drop.setNodeRef}
      className={cn(
        "space-y-2 rounded-xl border p-2",
        selected ? "border-primary/50 bg-primary/5" : "border-dashed",
        drop.isOver && "border-primary bg-primary/10 ring-2 ring-primary/20",
      )}
    >
      <div className="flex min-h-14 items-center gap-2">
        <button
          type="button"
          aria-label={`Chọn hàng ${row + 1}`}
          aria-pressed={selected}
          onClick={onChoose}
          className="flex w-16 shrink-0 flex-col items-center gap-1 self-stretch justify-center rounded-lg text-xs tabular-nums hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          Hàng {row + 1}
          {selected && <Check className="size-3.5 text-primary" />}
        </button>
        {selected ? (
          <MovingItem entry={entry} locale={locale} />
        ) : (
          <button
            type="button"
            onClick={onChoose}
            aria-label={`Đặt trang bị vào hàng ${row + 1}`}
            className="min-h-12 min-w-0 flex-1 rounded-lg px-2 text-left text-xs text-muted-foreground hover:bg-accent"
          >
            {peers.length ? "Đặt cùng hàng này" : "Đặt vào hàng này"}
          </button>
        )}
      </div>
      {!!peers.length && (
        <div className="flex flex-wrap items-center gap-2 pl-2 text-xs text-muted-foreground">
          <span>Cùng hàng:</span>
          {peers.map((peer) => (
            <span
              key={`${peer.item.id}:${peer.positionIndex}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1"
            >
              <HeroAsset id={peer.item.content.iconAssetId} alt="" className="size-5 rounded" />
              {warehouseName(peer.item, locale)}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

export function ItemRowPicker({
  entry,
  items,
  positionIndex,
  locale,
  contextLabel,
  disabled,
  onChange,
}: {
  entry: Entry
  items: Entry[]
  positionIndex: number
  locale: string
  contextLabel: string
  disabled: boolean
  onChange: (row: number | null) => void
}) {
  const position = entry.content.shopPositions[positionIndex]
  const [open, setOpen] = useState(false)
  const [row, setRow] = useState<number | null>(position.row)
  const [extra, setExtra] = useState(0)
  const [dragging, setDragging] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  useLayoutEffect(() => {
    if (open && row !== null)
      list.current
        ?.querySelector<HTMLElement>(`[aria-label="Chọn hàng ${row + 1}"]`)
        ?.scrollIntoView?.({ block: "nearest" })
  }, [open, row])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const peers = shopRowPeers(items, entry, positionIndex)
  const count = Math.max(3, ...peers.map((p) => p.row + 2), (position.row ?? -1) + 2) + extra
  return (
    <div className="col-span-full space-y-1.5">
      <span className="block text-xs">Hàng</span>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        disabled={disabled || position.column === null}
        aria-label={`Điều chỉnh hàng vị trí ${positionIndex + 1}`}
        onClick={() => {
          setRow(position.row ?? 0)
          setExtra(0)
          setOpen(true)
        }}
      >
        <GripVertical className="size-4" />
        {position.row === null ? "Chọn vị trí hàng" : `Hàng ${position.row + 1}`}
        <span className="ml-auto text-xs text-muted-foreground">Điều chỉnh</span>
      </Button>
      {position.column === null && <p className="text-xs text-muted-foreground">Chọn cột trước khi xếp hàng.</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden rounded-2xl p-4 sm:max-w-lg sm:p-6">
          <DialogHeader className="pr-6">
            <DialogTitle>Điều chỉnh hàng trang bị</DialogTitle>
            <p className="text-sm font-medium">
              {contextLabel} · Cột {(position.column ?? 0) + 1}
            </p>
            <DialogDescription>
              Kéo tay nắm của trang bị đến hàng muốn đặt, hoặc chọn trực tiếp một hàng. Các trang bị khác giữ nguyên vị
              trí.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={row === null || row === 0}
              onClick={() => setRow((current) => (current === null ? 0 : Math.max(0, current - 1)))}
            >
              <ArrowUp className="size-3.5" />
              Lên
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={row === null || row === count - 1}
              onClick={() => setRow((current) => (current === null ? 0 : Math.min(count - 1, current + 1)))}
            >
              <ArrowDown className="size-3.5" />
              Xuống
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setExtra((current) => current + 1)}
            >
              <Plus className="size-3.5" />
              Thêm hàng
            </Button>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={() => setDragging(true)}
            onDragCancel={() => setDragging(false)}
            onDragEnd={({ over }) => {
              setDragging(false)
              const target = over?.data.current?.row
              if (typeof target === "number") setRow(target)
            }}
          >
            <ol
              ref={list}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-1"
              aria-label="Các hàng trong cột trang bị"
            >
              {Array.from({ length: count }, (_, index) => (
                <RowSlot
                  key={index}
                  row={index}
                  selected={row === index}
                  peers={peers.filter((p) => p.row === index)}
                  entry={entry}
                  locale={locale}
                  onChoose={() => setRow(index)}
                />
              ))}
            </ol>
            {open &&
              createPortal(
                <DragOverlay dropAnimation={null} zIndex={100}>
                  {dragging && (
                    <div className="pointer-events-none flex w-64 items-center gap-2 rounded-lg border border-primary bg-background p-3 shadow-lg">
                      <ItemTile entry={entry} locale={locale} />
                    </div>
                  )}
                </DragOverlay>,
                document.body,
              )}
          </DndContext>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              disabled={disabled}
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
            >
              Chưa xếp hàng
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              disabled={row === null || disabled}
              onClick={() => {
                onChange(row)
                setOpen(false)
              }}
            >
              Chọn hàng {row === null ? "" : row + 1}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
