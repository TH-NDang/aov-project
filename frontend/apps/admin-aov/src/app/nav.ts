import {
  Gem,
  Database,
  Hexagon,
  ImageIcon,
  Images,
  LayoutDashboard,
  type LucideIcon,
  Medal,
  Radio,
  Shield,
  Shirt,
  Swords,
  Trophy,
  Zap,
} from "lucide-react"

export type NavBadgeKey = "unmatchedPortraits" | "itemIssues"

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
  /** Short helper shown in the command menu. */
  description: string
  badge?: NavBadgeKey
  soon?: boolean
  activePaths?: string[]
}

export interface NavSection {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
  sections?: NavSection[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [{ title: "Bảng điều khiển", to: "/", icon: LayoutDashboard, description: "Số liệu và việc cần xử lý" }],
  },
  {
    label: "Dự án",
    items: [{ title: "Lưu trữ", to: "/storage", icon: Database, description: "Bảng JSON riêng và import theo ID" }],
  },
  {
    label: "Wiki",
    items: [],
    sections: [
      {
        title: "Nhân vật",
        icon: Swords,
        items: [
          { title: "Tướng", to: "/heroes", icon: Swords, description: "Thông tin, kỹ năng, trang phục" },
          { title: "Trang phục", to: "/skins", icon: Shirt, description: "Toàn bộ trang phục theo tướng" },
          {
            title: "Không gian ảnh",
            to: "/portraits",
            icon: Images,
            description: "Portrait, head, cover và bậc trang phục",
            badge: "unmatchedPortraits",
            activePaths: ["/portraits", "/media"],
          },
        ],
      },
      {
        title: "Kho trang bị",
        icon: Shield,
        items: [
          { title: "Trang bị", to: "/items", icon: Shield, description: "Shop, công thức ghép", badge: "itemIssues" },
          { title: "Phù hiệu", to: "/enchantments", icon: Hexagon, description: "Bốn hệ phù hiệu" },
          { title: "Bảng ngọc", to: "/arcana", icon: Gem, description: "Chưa thu thập dữ liệu" },
          { title: "Phụ trợ", to: "/spells", icon: Zap, description: "Phép phụ trợ cho tướng" },
        ],
      },
    ],
  },
  {
    label: "Sắp triển khai",
    items: [
      { title: "Giải đấu", to: "/tournaments", icon: Trophy, description: "Giải, đội, lịch thi đấu", soon: true },
      { title: "Livestream", to: "/streams", icon: Radio, description: "Kênh và trạng thái live", soon: true },
    ],
  },
]

export const MEDIA_NAV: NavItem[] = [
  { title: "Portrait", to: "/portraits", icon: ImageIcon, description: "Ghép và sắp xếp portrait" },
  { title: "Head", to: "/media/head", icon: ImageIcon, description: "Head tướng, trang phục và icon danh sách" },
  { title: "Cover", to: "/media/cover", icon: Images, description: "Cover tướng và trang phục" },
  { title: "Bậc trang phục", to: "/media/badges", icon: Medal, description: "Nhãn bậc và sự kiện" },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => [
  ...group.items,
  ...(group.sections ?? []).flatMap((section) => section.items),
])
