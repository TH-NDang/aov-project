import * as React from "react"
import { Pipette } from "lucide-react"
import { Button } from "./button"
import { colorsUsedIn, gameTextColors } from "../lib/rich-text-blocks"
import { cn } from "../lib/utils"

type EyeDropperConstructor = new () => { open(): Promise<{ sRGBHex: string }> }

const hexColor = /^#[\da-f]{6}$/i

/** Choosing by meaning, by what this text already uses, or by picking off the screen spares guessing a hex value. */
export function RichTextColorPalette({
  text,
  color,
  onPick,
  className,
}: {
  /** The text being edited, so colors it already uses can be reused exactly. */
  text: string
  color: string
  onPick: (color: string) => void
  className?: string
}) {
  const [custom, setCustom] = React.useState(hexColor.test(color) ? color : "#000000")
  const preset = new Set<string>(gameTextColors.map((entry) => entry.color))
  const used = colorsUsedIn(text)
    .filter((entry) => !preset.has(entry))
    .slice(0, 10)
  const EyeDropper = (
    typeof window === "undefined" ? undefined : (window as unknown as { EyeDropper?: EyeDropperConstructor })
  )?.EyeDropper
  return (
    <div className={cn("w-72 max-w-full space-y-3 p-1", className)}>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Màu trong game</p>
        <div className="grid grid-cols-2 gap-0.5">
          {gameTextColors.map((entry) => (
            <button
              key={entry.color}
              type="button"
              title={`${entry.label} · ${entry.color}`}
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                color.toLowerCase() === entry.color && "bg-accent",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(entry.color)}
            >
              <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="truncate">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>
      {used.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Đang dùng trong mô tả này</p>
          <div className="flex flex-wrap gap-1">
            {used.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-label={`Dùng màu ${entry}`}
                title={entry}
                className="size-6 rounded border outline-none hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: entry }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onPick(entry)}
              />
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Màu khác</p>
        <div className="flex items-center gap-1">
          <input
            type="color"
            aria-label="Chọn màu khác"
            value={hexColor.test(custom) ? custom : "#000000"}
            onChange={(event) => setCustom(event.target.value)}
            className="size-7 shrink-0 cursor-pointer rounded border bg-background p-0"
          />
          <input
            aria-label="Mã màu"
            value={custom}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => setCustom(event.target.value.trim())}
            className="h-7 min-w-0 flex-1 rounded border bg-background px-1.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {EyeDropper && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Lấy màu từ màn hình"
              title="Lấy màu từ màn hình, ví dụ từ ảnh gốc đang mở cạnh bên"
              className="size-7 shrink-0 p-0"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                void new EyeDropper()
                  .open()
                  .then((result) => {
                    setCustom(result.sRGBHex)
                    onPick(result.sRGBHex)
                  })
                  // Pressing Escape cancels the picker; nothing has changed.
                  .catch(() => {})
              }
            >
              <Pipette aria-hidden className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2"
            disabled={!hexColor.test(custom)}
            onClick={() => onPick(custom.toLowerCase())}
          >
            Dùng
          </Button>
        </div>
      </div>
    </div>
  )
}
