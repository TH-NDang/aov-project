import { FolderLock, HardDrive, Images } from "lucide-react"
import { Link } from "react-router"
import { cn } from "@aov/ui/lib/utils"

export type FileTab = "images" | "sources" | "storage"

const TABS: { tab: FileTab; label: string; to: string; Icon: typeof Images }[] = [
  { tab: "images", label: "Ảnh công khai", to: "/image-management", Icon: Images },
  { tab: "sources", label: "Tệp nguồn", to: "/image-management?tab=sources", Icon: FolderLock },
  { tab: "storage", label: "Dung lượng R2", to: "/image-management?tab=storage", Icon: HardDrive },
]

export function readFileTab(params: URLSearchParams): FileTab {
  const tab = params.get("tab")
  return tab === "sources" || tab === "storage" ? tab : "images"
}

/**
 * The three parts of file management (ADR-030 section 12). They are links, not panes, so each part keeps its own
 * address and an image link such as `?asset=` still opens the public images.
 */
export function FileTabs({ current }: { current: FileTab }) {
  return (
    <nav aria-label="Phần của quản lý tệp" className="-mb-1 scrollbar-none overflow-x-auto border-b">
      <ul className="flex h-11 min-w-max items-stretch gap-1">
        {TABS.map(({ tab, label, to, Icon }) => (
          <li key={tab} className="flex">
            <Link
              to={to}
              aria-current={tab === current ? "page" : undefined}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity",
                tab === current && "text-foreground after:opacity-100",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
