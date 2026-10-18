import { useEffect, useId, useState } from "react"
import { useLocation } from "react-router"
import { Keyboard } from "lucide-react"
import { Switch } from "@aov/ui/components/switch"
import { useHotkeys } from "../hotkeys"
import { Kbd, KbdGroup } from "@aov/ui/components/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@aov/ui/components/sidebar"

interface Hotkey {
  keys: string[]
  action: string
  context?: string
}

const COMMON_KEYS: Hotkey[] = [
  { keys: ["Ctrl / ⌘", "/"], action: "Mở / đóng bảng phím tắt", context: "Khi không đang nhập nội dung." },
  { keys: ["Ctrl / ⌘", "K"], action: "Tìm trang và dữ liệu" },
  { keys: ["Ctrl / ⌘", "B"], action: "Thu gọn / mở sidebar" },
  { keys: ["Ctrl / ⌘", "1…8"], action: "Mở tab theo vị trí", context: "Đếm từ trái sang phải; có thể dùng Alt + 1…8." },
  { keys: ["Ctrl / ⌘", "9"], action: "Mở tab cuối cùng", context: "Có thể dùng Alt + 9." },
  { keys: ["Ctrl / ⌘", "W"], action: "Đóng tab đang xem", context: "Có thể dùng Alt + W." },
  { keys: ["Esc"], action: "Đóng popup hoặc hủy kéo tab" },
]

function HotkeyList({ items }: { items: Hotkey[] }) {
  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div key={item.action} className="flex items-start justify-between gap-4">
          <dt className="min-w-0 text-sm">
            {item.action}
            {item.context && <p className="mt-0.5 text-xs text-muted-foreground">{item.context}</p>}
          </dt>
          <dd className="shrink-0">
            <KbdGroup>
              {item.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function HotkeyHelp() {
  const { enabled, setEnabled } = useHotkeys()
  const { pathname } = useLocation()
  const { isMobile } = useSidebar()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "/" ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing ||
        event.defaultPrevented
      )
        return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
      )
        return
      if (document.body.style.pointerEvents === "none") return
      event.preventDefault()
      setOpen((current) => !current)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled])
  const pageKeys: Hotkey[] = []
  if (pathname === "/items")
    pageKeys.push({
      keys: ["Ctrl / ⌘", "Z"],
      action: "Hoàn tác sửa trang bị",
      context: "Khi không đang gõ trong ô nhập liệu.",
    })
  if (pathname === "/portraits")
    pageKeys.push(
      { keys: ["Ctrl / ⌘", "Enter"], action: "Lưu gán portrait", context: "Khi đã chọn ảnh và nơi nhận hợp lệ." },
      {
        keys: ["Ctrl / ⌘", "Shift", "Enter"],
        action: "Lưu và chuyển ảnh tiếp theo",
        context: "Trong bảng gán portrait.",
      },
    )
  if (["/publishing", "/items"].includes(pathname))
    pageKeys.push({
      keys: ["Enter / Space"],
      action: "Mở chi tiết dòng đang focus",
      context: "Dùng Tab để đưa focus đến dòng trong bảng.",
    })
  if (pathname.startsWith("/media/") || pathname.startsWith("/publishing/"))
    pageKeys.push({ keys: ["←", "→"], action: "Ảnh trước / ảnh tiếp theo", context: "Khi đang mở ảnh lớn." })

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover modal={false} open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              tooltip="Phím tắt (Ctrl / ⌘ + /)"
              aria-label="Xem phím tắt của trang (Ctrl + /)"
              aria-keyshortcuts="Control+/ Meta+/"
            >
              <Keyboard />
              <span>Phím tắt</span>
              <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">Ctrl /</Kbd>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            side={isMobile ? "top" : "left"}
            align="end"
            sideOffset={8}
            aria-labelledby={titleId}
            className="max-h-[75svh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto p-4"
          >
            <h2 id={titleId} className="mb-1 font-semibold">
              Phím tắt
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">Ctrl trên Windows/Linux, ⌘ trên macOS.</p>
            <div className="mb-4 rounded-lg border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                Dùng phím tắt của ứng dụng
                <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Dùng phím tắt của ứng dụng" />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                Lựa chọn được nhớ trên trình duyệt này. Các phím mặc định như Tab và Esc vẫn hoạt động.
              </p>
            </div>
            <p className="mb-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Trình duyệt có thể giữ Ctrl + số và Ctrl + W để điều khiển tab của trình duyệt. Khi đó dùng tổ hợp Alt
              thay thế cho tab trong admin.
            </p>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dùng chung</h3>
            <HotkeyList items={COMMON_KEYS} />
            <div className="my-4 border-t" />
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trang đang xem</h3>
            {pageKeys.length ? (
              <HotkeyList items={pageKeys} />
            ) : (
              <p className="text-sm text-muted-foreground">Trang này chưa có phím tắt riêng.</p>
            )}
            <div className="my-4 border-t" />
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sắp xếp tab</h3>
            <p className="text-sm leading-relaxed">
              Đưa focus đến tab cần di chuyển, nhấn <Kbd>Space</Kbd>, dùng <Kbd>←</Kbd> / <Kbd>→</Kbd>, rồi nhấn{" "}
              <Kbd>Space</Kbd> để thả. <Kbd>Esc</Kbd> để hủy.
            </p>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
