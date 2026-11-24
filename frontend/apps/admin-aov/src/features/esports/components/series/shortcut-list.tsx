import { Keyboard } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"

/** True while a key belongs to a field being typed in, so page shortcuts stay out of the way. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (!!target.closest("input, textarea, select, [contenteditable=true]") || target.isContentEditable)

const SHORTCUTS: { keys: string[]; text: string; edit?: boolean }[] = [
  { keys: ["Space"], text: "Phát / tạm dừng" },
  { keys: ["←", "→"], text: "Lùi / tới 5 giây (giữ Shift: 1 giây)" },
  { keys: [",", "."], text: "Lùi / tới 1 giây" },
  { keys: ["J", "L"], text: "Lùi / tới 10 giây (giữ Shift: 30 giây)" },
  { keys: ["Home"], text: "Về đầu ván đang xem (lúc bắt đầu cấm chọn)" },
  { keys: ["[", "]"], text: "Sự kiện trước / sau" },
  { keys: ["Shift", "P"], text: "Trận trước của giải" },
  { keys: ["Shift", "N"], text: "Trận sau của giải" },
  { keys: ["E"], text: "Ghi sự kiện", edit: true },
  { keys: ["K", "O", "I", "N"], text: "Ghi hạ gục / mục tiêu / trang bị / khoảnh khắc", edit: true },
  { keys: ["Alt", "←", "→"], text: "Dời mốc đang chọn trên thanh 1 giây (giữ Shift: 5 giây)", edit: true },
  { keys: ["?"], text: "Mở / đóng danh sách này" },
]

/** Every keyboard shortcut of the match page, opened from the transport or with "?". */
export function ShortcutList({
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
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Phím tắt"
          title="Phím tắt (?)"
          className="text-muted-foreground"
        >
          <Keyboard aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3 text-xs">
        <p className="font-semibold">Phím tắt của trang trận</p>
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
