import { useEffect, useState } from "react"
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, LoaderCircle } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { errorMessage } from "@/lib/api/errors"
import { HeroAsset } from "../publishing/hero-content"

export interface OrderItem {
  id: string
  name: string
  iconAssetId: string | null
  color?: string
}

function SortableRow({
  item,
  index,
  total,
  disabled,
  move,
}: {
  item: OrderItem
  index: number
  total: number
  disabled: boolean
  move: (from: number, to: number) => void
}) {
  const sortable = useSortable({ id: item.id, disabled })
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        position: "relative",
        zIndex: sortable.isDragging ? 1 : undefined,
      }}
      className="flex items-center gap-2 rounded-xl border bg-card p-2 sm:gap-3"
    >
      <button
        type="button"
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
        aria-label={`Kéo ${item.name}`}
        disabled={disabled}
        className="grid size-10 shrink-0 touch-none cursor-grab place-items-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:opacity-40"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full border p-0.5"
        style={{ borderColor: item.color }}
      >
        <HeroAsset
          id={item.iconAssetId}
          alt=""
          frameAspectRatio={1}
          className="size-full rounded-full border-0 bg-transparent"
        />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{item.name}</span>
      <div className="flex shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Đưa ${item.name} lên`}
          disabled={disabled || index === 0}
          onClick={() => move(index, index - 1)}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Đưa ${item.name} xuống`}
          disabled={disabled || index === total - 1}
          onClick={() => move(index, index + 1)}
        >
          <ArrowDown className="size-4" />
        </Button>
      </div>
    </li>
  )
}

export function WarehouseOrderPicker({
  label,
  contextLabel,
  items,
  disabled = false,
  disabledReason,
  blockedReason,
  onSave,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  label: string
  contextLabel?: string
  items: OrderItem[]
  disabled?: boolean
  disabledReason?: string
  blockedReason?: string
  onSave: (ids: string[]) => Promise<void>
  /** Opens the dialog from outside, e.g. a page menu; pair with `hideTrigger`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  function setOpen(next: boolean) {
    if (openProp === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  const [ordered, setOrdered] = useState(items)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  // A dialog opened from outside starts from the current order, like one opened by the trigger.
  useEffect(() => {
    if (!openProp) return
    setOrdered(items)
    setError("")
  }, [openProp])
  const dirty = ordered.some((item, index) => item.id !== items[index]?.id)
  function move(from: number, to: number) {
    if (busy || blockedReason || from < 0 || to < 0 || from >= ordered.length || to >= ordered.length) return
    setOrdered((rows) => arrayMove(rows, from, to))
  }
  async function save() {
    setBusy(true)
    setError("")
    try {
      await onSave(ordered.map((item) => item.id))
      setOpen(false)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={hideTrigger ? "contents" : "space-y-1.5"}>
      {!hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !items.length}
          onClick={() => {
            setOrdered(items)
            setError("")
            setOpen(true)
          }}
        >
          <ListOrdered className="size-4" />
          {label}
        </Button>
      )}
      {!hideTrigger && disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent
          className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-lg"
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
          onPointerDownOutside={(event) => busy && event.preventDefault()}
          showCloseButton={!busy}
        >
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {contextLabel && <p className="text-sm font-medium">{contextLabel}</p>}
            <DialogDescription>
              Kéo tay nắm để đổi vị trí. Có thể dùng nút lên/xuống hoặc phím Space và mũi tên.
            </DialogDescription>
          </DialogHeader>
          {blockedReason && (
            <p role="status" className="text-sm text-amber-600 dark:text-amber-400">
              {blockedReason}
            </p>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id)
                move(
                  ordered.findIndex((item) => item.id === active.id),
                  ordered.findIndex((item) => item.id === over.id),
                )
            }}
          >
            <SortableContext items={ordered.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto py-1" aria-label={label}>
                {ordered.map((item, index) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    index={index}
                    total={ordered.length}
                    disabled={busy || !!blockedReason}
                    move={move}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="button" disabled={busy || !dirty || !!blockedReason} onClick={() => void save()}>
              {busy && <LoaderCircle className="size-4 animate-spin" />}Lưu thứ tự
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
