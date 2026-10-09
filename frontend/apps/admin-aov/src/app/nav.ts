import {
  Gem,
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
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [{ title: "Bảng điều khiển", to: "/", icon: LayoutDashboard, description: "Số liệu và việc cần xử lý" }],
  },
  {
    label: "Wiki",
    items: [
      { title: "Tướng", to: "/heroes", icon: Swords, description: "Thông tin, kỹ năng, trang phục" },
      { title: "Trang phục", to: "/skins", icon: Shirt, description: "Toàn bộ trang phục theo tướng" },
      { title: "Trang bị", to: "/items", icon: Shield, description: "Shop, công thức ghép", badge: "itemIssues" },
      { title: "Phù hiệu", to: "/enchantments", icon: Hexagon, description: "Bốn hệ phù hiệu" },
      { title: "Bảng ngọc", to: "/arcana", icon: Gem, description: "Chưa thu thập dữ liệu" },
    ],
  },
  {
    label: "Ảnh & media",
    items: [
      {
        title: "Portrait",
        to: "/portraits",
        icon: ImageIcon,
        description: "Ghép và sắp xếp portrait",
        badge: "unmatchedPortraits",
      },
      { title: "Head & cover", to: "/media/head-cover", icon: Images, description: "Ảnh head, cover, icon danh sách" },
      { title: "Bậc trang phục", to: "/media/badges", icon: Medal, description: "Nhãn bậc và sự kiện" },
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
