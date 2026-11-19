import type { MouseEvent } from "react"
import { AtSign, ChevronDown, Link2Off, Redo2, Table2, Undo2 } from "lucide-react"
import { paragraphStyles } from "../../lib/rich-text-blocks"
import type { referenceFormatState } from "../../lib/reference-input-formatting"
import { Button } from "../button"
import { Popover, PopoverContent, PopoverTrigger } from "../popover"
import { RichTextColorPalette } from "../rich-text-color-palette"
import { cn } from "@aov/ui/lib/utils"

export type TextFormat = "b" | "i" | "muted" | "color" | "noauto" | "plain"
export type Formatting = ReturnType<typeof referenceFormatState>

/** Buttons keep the focus in the text, so the selection they act on stays where it is. */
const keepFocus = (event: MouseEvent) => event.preventDefault()

/** The row above the text: paragraph type and table, bold and italic, colour, references and history. */
export function RichTextToolbar({
  label,
  text,
  formatting,
  color,
  compact,
  allowBlocks,
  allowTables,
  disabled,
  composing,
  hasSelection,
  canUndo,
  canRedo,
  onStyle,
  onInsertTable,
  onFormat,
  onPickColor,
  onToggleReferences,
  onUndo,
}: {
  label: string
  text: string
  formatting: Formatting
  color: string
  compact: boolean
  allowBlocks: boolean
  allowTables: boolean
  disabled?: boolean
  composing: boolean
  hasSelection: boolean
  canUndo: boolean
  canRedo: boolean
  onStyle: (style: string) => void
  onInsertTable: () => void
  onFormat: (kind: TextFormat) => void
  onPickColor: (color: string) => void
  onToggleReferences: () => void
  onUndo: (redo?: boolean) => void
}) {
  return (
    <div
      role="toolbar"
      aria-label={`Định dạng ${label}`}
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1",
        compact && "gap-0.5 rounded-lg",
      )}
    >
      {(allowBlocks || allowTables) && (
        <div className="flex items-center border-r pr-1">
          {allowBlocks && (
            <select
              aria-label="Loại văn bản"
              title="Đặt kiểu cho cả đoạn. Bôi đen một phần câu rồi chọn Chú thích thì chữ nhạt đi ngay trong câu, không xuống dòng."
              className="h-7 rounded bg-transparent px-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
              disabled={disabled || composing}
              value={formatting.style}
              onChange={(event) => onStyle(event.target.value)}
            >
              <option value="normal">Đoạn thường</option>
              {Object.entries(paragraphStyles).map(([key, style]) => (
                <option key={key} value={key}>
                  {style.label}
                </option>
              ))}
            </select>
          )}
          {allowTables && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Chèn bảng ví dụ"
              title="Chèn bảng ví dụ"
              className="size-7 p-0"
              disabled={disabled || composing}
              onMouseDown={keepFocus}
              onClick={onInsertTable}
            >
              <Table2 aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      )}
      <div
        role="group"
        aria-label="Định dạng chữ"
        className={cn("flex shrink-0 items-center gap-1 border-r pr-2", compact && "gap-0.5 pr-1")}
      >
        {(
          [
            ["b", "Đậm", "B"],
            ["i", "Nghiêng", "I"],
          ] as const
        ).map(([kind, name, letter]) => (
          <Button
            key={kind}
            type="button"
            variant={(kind === "b" ? formatting.bold : formatting.italic) ? "secondary" : "ghost"}
            size="sm"
            aria-label={name}
            title={kind === "b" ? "Đậm (Ctrl+B)" : "Nghiêng (Ctrl+I)"}
            aria-pressed={kind === "b" ? formatting.bold : formatting.italic}
            disabled={disabled}
            onMouseDown={keepFocus}
            onClick={() => onFormat(kind)}
            className={cn(kind === "b" ? "font-bold" : "italic", compact && "size-7 rounded-md p-0")}
          >
            {letter}
          </Button>
        ))}
      </div>
      <div
        role="group"
        aria-label="Màu chữ"
        className={cn("flex shrink-0 items-center gap-1 border-r px-1 pr-2", compact && "gap-0.5 pr-1")}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Áp dụng màu"
          title="Tô chữ đang chọn bằng màu này"
          className={cn("gap-1.5", compact && "size-7 rounded-md p-0")}
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => onFormat("color")}
        >
          <span aria-hidden className="size-3.5 rounded-sm border" style={{ backgroundColor: color }} />
          {!compact && "Màu"}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Chọn màu chữ"
              title="Chọn màu theo ý nghĩa trong game"
              className="size-7 rounded-md p-0"
              disabled={disabled}
              onMouseDown={keepFocus}
            >
              <ChevronDown aria-hidden className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto p-2"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <RichTextColorPalette text={text} color={color} onPick={onPickColor} />
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="sm"
          variant={formatting.muted ? "secondary" : "ghost"}
          aria-label="Chữ nhạt"
          aria-pressed={formatting.muted}
          title="Làm chữ đang chọn nhạt đi ngay trong câu, không xuống dòng"
          className={compact ? "type-label h-7 rounded-md px-1.5" : undefined}
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => onFormat("muted")}
        >
          Nhạt
        </Button>
      </div>
      <div
        role="group"
        aria-label="Chèn tham chiếu"
        className={cn("flex shrink-0 items-center border-r px-1 pr-2", compact && "px-0.5 pr-1")}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={compact ? "Chèn tham chiếu" : undefined}
          title="Chèn tham chiếu (@)"
          className={compact ? "size-7 rounded-md p-0" : undefined}
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={onToggleReferences}
        >
          {compact ? <AtSign aria-hidden className="size-3.5" /> : "@ Tham chiếu"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={formatting.noauto ? "secondary" : "ghost"}
          aria-label="Bỏ qua tự nhận diện"
          aria-pressed={formatting.noauto}
          title={
            formatting.noauto
              ? "Bật lại tự nhận diện cho đoạn đang chọn"
              : "Bôi đen đoạn cần bỏ qua tự nhận diện tướng, kỹ năng hoặc thuật ngữ"
          }
          className={compact ? "type-label h-7 gap-1 rounded-md px-1.5" : undefined}
          disabled={disabled || composing || !hasSelection}
          onMouseDown={keepFocus}
          onClick={() => onFormat("noauto")}
        >
          <Link2Off aria-hidden className="size-3.5" />
          {compact ? "Bỏ qua" : "Bỏ qua tự nhận diện"}
        </Button>
      </div>
      <div
        role="group"
        aria-label="Lịch sử chỉnh sửa"
        className={cn("flex shrink-0 items-center gap-1 px-1", compact && "gap-0.5 px-0.5")}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Hoàn tác"
          title="Hoàn tác (Ctrl+Z)"
          className={compact ? "size-7 rounded-md p-0" : undefined}
          disabled={disabled || !canUndo}
          onMouseDown={keepFocus}
          onClick={() => onUndo()}
        >
          {compact ? <Undo2 aria-hidden className="size-3.5" /> : "↶"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Làm lại"
          title="Làm lại (Ctrl+Shift+Z)"
          className={compact ? "size-7 rounded-md p-0" : undefined}
          disabled={disabled || !canRedo}
          onMouseDown={keepFocus}
          onClick={() => onUndo(true)}
        >
          {compact ? <Redo2 aria-hidden className="size-3.5" /> : "↷"}
        </Button>
      </div>
    </div>
  )
}
