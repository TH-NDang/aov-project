import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { AtSign, Eraser, Link2Off, Palette } from "lucide-react"
import type { EntityReferenceInputHandle } from "../entity-reference-input"
import type { TextSelection } from "../../lib/entity-rich-text-editor"
import { Button } from "../button"
import { RichTextColorPalette } from "../rich-text-color-palette"
import type { Formatting, TextFormat } from "./rich-text-toolbar"

/** Buttons keep the focus in the text, so the selection they act on stays where it is. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault()

/**
 * When the bar shows: while the editor has the focus and text is selected, once the pointer has let go, until Escape or
 * the next selection. `blocked` keeps it away while something else uses the selection.
 */
export function useSelectionBar(
  area: React.RefObject<EntityReferenceInputHandle | null>,
  selection: TextSelection,
  blocked: boolean,
) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [focused, setFocused] = React.useState(false)
  const [selecting, setSelecting] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)
  const [colorsOpen, setColorsOpen] = React.useState(false)
  // The bar waits for the pointer to let go, so it never jumps around under a selection still being dragged.
  React.useEffect(() => {
    if (!selecting) return
    const done = () => setSelecting(false)
    window.addEventListener("pointerup", done)
    window.addEventListener("pointercancel", done)
    return () => {
      window.removeEventListener("pointerup", done)
      window.removeEventListener("pointercancel", done)
    }
  }, [selecting])
  React.useEffect(() => {
    setDismissed(false)
    setColorsOpen(false)
  }, [selection.start, selection.end])
  return {
    ref,
    open: focused && !selecting && !dismissed && !blocked && selection.start !== selection.end,
    colorsOpen,
    setColorsOpen,
    dismiss: () => setDismissed(true),
    /** Handlers for the editor around the field. */
    onFocus: () => setFocused(true),
    onPointerDown: (event: React.PointerEvent) => {
      if (area.current?.element?.contains(event.target as Node)) setSelecting(true)
    },
    onBlur: (event: React.FocusEvent) => {
      const target = event.relatedTarget as Node | null
      if (!event.currentTarget.contains(target) && !ref.current?.contains(target)) setFocused(false)
    },
  }
}

/** A small bar over the selected text with the formats most often applied to it. */
export function SelectionFormatBar({
  ref,
  open,
  area,
  text,
  formatting,
  color,
  colorsOpen,
  onColorsOpenChange,
  onDismiss,
  onFormat,
  onPickColor,
  onInsertReference,
}: {
  ref: React.Ref<HTMLDivElement>
  open: boolean
  area: React.RefObject<EntityReferenceInputHandle | null>
  text: string
  formatting: Formatting
  color: string
  colorsOpen: boolean
  onColorsOpenChange: (open: boolean) => void
  onDismiss: () => void
  onFormat: (kind: TextFormat) => void
  onPickColor: (color: string) => void
  onInsertReference: () => void
}) {
  // The bar stands over the selected text, or over the whole field when the browser has no box for the selection.
  const anchor = React.useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => {
          const root = area.current!.element!
          const selected = root.ownerDocument.getSelection()
          const range = selected?.rangeCount ? selected.getRangeAt(0) : undefined
          const rect =
            range && root.contains(range.commonAncestorContainer) && typeof range.getBoundingClientRect === "function"
              ? range.getBoundingClientRect()
              : undefined
          return rect?.width ? rect : root.getBoundingClientRect()
        },
      },
    }),
    [area],
  )
  return (
    <PopoverPrimitive.Root open={open}>
      <PopoverPrimitive.Anchor virtualRef={anchor} />
      {open && (
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={ref}
            role="toolbar"
            aria-label="Định dạng chữ đang chọn"
            side="top"
            align="center"
            sideOffset={8}
            collisionPadding={12}
            updatePositionStrategy="always"
            className="z-50 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={onDismiss}
          >
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                size="sm"
                variant={formatting.bold ? "secondary" : "ghost"}
                aria-label="Đậm chữ đang chọn"
                aria-pressed={formatting.bold}
                title="Đậm (Ctrl+B)"
                className="size-7 p-0 font-bold"
                onMouseDown={keepFocus}
                onClick={() => onFormat("b")}
              >
                B
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formatting.italic ? "secondary" : "ghost"}
                aria-label="Nghiêng chữ đang chọn"
                aria-pressed={formatting.italic}
                title="Nghiêng (Ctrl+I)"
                className="size-7 p-0 italic"
                onMouseDown={keepFocus}
                onClick={() => onFormat("i")}
              >
                I
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formatting.muted ? "secondary" : "ghost"}
                aria-label="Làm nhạt chữ đang chọn"
                aria-pressed={formatting.muted}
                title="Chú thích ngay trong câu, không xuống dòng"
                className="h-7 px-1.5 text-xs"
                onMouseDown={keepFocus}
                onClick={() => onFormat("muted")}
              >
                Nhạt
              </Button>
              <Button
                type="button"
                size="sm"
                variant={colorsOpen ? "secondary" : "ghost"}
                aria-label="Màu chữ đang chọn"
                aria-expanded={colorsOpen}
                title="Chọn màu"
                className="size-7 p-0"
                onMouseDown={keepFocus}
                onClick={() => onColorsOpenChange(!colorsOpen)}
              >
                <Palette
                  aria-hidden
                  className="size-3.5"
                  style={formatting.color ? { color: formatting.color } : undefined}
                />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Chèn tham chiếu vào chữ đang chọn"
                title="Chèn tham chiếu (@)"
                className="size-7 p-0"
                onMouseDown={keepFocus}
                onClick={onInsertReference}
              >
                <AtSign aria-hidden className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formatting.noauto ? "secondary" : "ghost"}
                aria-label="Bỏ qua tự nhận diện chữ đang chọn"
                aria-pressed={formatting.noauto}
                title={formatting.noauto ? "Bật lại tự nhận diện cho đoạn đang chọn" : "Bỏ qua tự nhận diện"}
                className="size-7 p-0"
                onMouseDown={keepFocus}
                onClick={() => onFormat("noauto")}
              >
                <Link2Off aria-hidden className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Bỏ định dạng chữ đang chọn"
                title="Bỏ đậm, nghiêng, nhạt và màu"
                className="size-7 p-0"
                onMouseDown={keepFocus}
                onClick={() => onFormat("plain")}
              >
                <Eraser aria-hidden className="size-3.5" />
              </Button>
            </div>
            {colorsOpen && (
              <RichTextColorPalette
                text={text}
                color={formatting.color ?? color}
                onPick={onPickColor}
                className="mt-1 border-t pt-2"
              />
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  )
}
