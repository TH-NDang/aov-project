import { FastForward, Keyboard, Pause, Play, Rewind } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"

const SHORTCUTS: { keys: string[]; text: string; edit?: boolean }[] = [
  { keys: ["Space"], text: "Phát / tạm dừng" },
  { keys: ["←", "→"], text: "Lùi / tới 5 giây (giữ Shift: 1 giây)" },
  { keys: [",", "."], text: "Lùi / tới 1 giây" },
  { keys: ["J", "L"], text: "Lùi / tới 10 giây (giữ Shift: 30 giây)" },
  { keys: ["Home"], text: "Về đầu ván đang xem (lúc bắt đầu cấm chọn)" },
  { keys: ["[", "]"], text: "Sự kiện trước / sau" },
  { keys: ["E"], text: "Ghi sự kiện", edit: true },
  { keys: ["K", "O", "I", "N"], text: "Ghi hạ gục / mục tiêu / trang bị / khoảnh khắc", edit: true },
  { keys: ["Alt", "←", "→"], text: "Dời mốc đang chọn trên thanh 1 giây (giữ Shift: 5 giây)", edit: true },
  { keys: ["?"], text: "Mở / đóng danh sách này" },
]

/**
 * Previous moment, play and next moment, the note that confirms what a key did, and the list of shortcuts. A phone has
 * no keyboard to use them with, so it shows no list.
 */
export function MatchTransport({
  playing,
  canPlay,
  flash,
  shortcuts,
  editable,
  onStep,
  onTogglePlay,
}: {
  playing: boolean
  canPlay: boolean
  flash: { text: string; id: number } | null
  shortcuts: { open: boolean; onOpenChange: (open: boolean) => void } | null
  editable: boolean
  onStep: (direction: 1 | -1) => void
  onTogglePlay: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={() => onStep(-1)}
        aria-label="Sự kiện trước ( [ )"
      >
        <Rewind size={15} />
      </Button>
      <Button
        size="icon"
        className="size-9 rounded-full"
        disabled={!canPlay}
        onClick={onTogglePlay}
        aria-label={playing ? "Tạm dừng (Space)" : "Phát (Space)"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={() => onStep(1)}
        aria-label="Sự kiện tiếp theo ( ] )"
      >
        <FastForward size={15} />
      </Button>
      {flash && (
        <span
          key={flash.id}
          role="status"
          className="esp-num rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background animate-in fade-in"
        >
          {flash.text}
        </span>
      )}
      {shortcuts && <ShortcutList open={shortcuts.open} onOpenChange={shortcuts.onOpenChange} editable={editable} />}
    </div>
  )
}

/** Every keyboard shortcut of the match page, opened from the transport or with "?". */
function ShortcutList({
  open,
  onOpenChange,
  editable,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editable: boolean
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="ml-auto h-8 text-xs text-muted-foreground">
          <Keyboard size={14} /> Phím tắt
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3 text-xs">
        <p className="font-semibold">Phím tắt khi xem video</p>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
          {SHORTCUTS.filter((entry) => editable || !entry.edit).map((entry) => (
            <div key={entry.text} className="contents">
              <dt className="flex gap-1">
                {entry.keys.map((key) => (
                  <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{entry.text}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Bấm vào video vẫn dùng được phím tắt. Kéo video nổi bằng chuột, hoặc Alt + phím mũi tên.
        </p>
      </PopoverContent>
    </Popover>
  )
}
