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
  Users,
  UserRound,
} from "lucide-react"

export type NavBadgeKey = "unmatchedPortraits" | "itemIssues"

export interface NavItem {
  title: string
  to: string
  icon: LucideIcon
  image?: string
  /** Short helper shown in the command menu. */
  description: string
  badge?: NavBadgeKey
  soon?: boolean
  activePaths?: string[]
  capability?: string
}

export interface NavSection {
  title: string
  icon: LucideIcon
  image?: string
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
    items: [
      {
        title: "Bảng điều khiển",
        image: "/images/navigation/dashboard.webp",
        to: "/",
        icon: LayoutDashboard,
        description: "Số liệu và việc cần xử lý",
      },
    ],
  },
  {
    label: "Dự án",
    items: [
      {
        title: "Lưu trữ",
        image: "/images/navigation/storage.webp",
        to: "/storage",
        icon: Database,
        description: "Bảng JSON riêng và import theo ID",
      },
      {
        title: "Hồ sơ của tôi",
        image: "/images/navigation/profile.webp",
        to: "/profile",
        icon: UserRound,
        description: "Tên hiển thị, avatar và thông tin cá nhân",
      },
      {
        title: "Người dùng",
        image: "/images/navigation/users.webp",
        to: "/users",
        icon: Users,
        description: "Quản lý hồ sơ người dùng",
        capability: "user:read",
      },
    ],
  },
  {
    label: "Wiki",
    items: [],
    sections: [
      {
        title: "Sổ nhân vật",
        image: "/images/navigation/character-book.webp",
        icon: Swords,
        items: [
          {
            title: "Tướng",
            image: "/images/navigation/heroes.webp",
            to: "/heroes",
            icon: Swords,
            description: "Thông tin, kỹ năng, trang phục",
          },
          {
            title: "Trang phục",
            image: "/images/navigation/skins.webp",
            to: "/skins",
            icon: Shirt,
            description: "Toàn bộ trang phục theo tướng",
          },
          {
            title: "Không gian ảnh",
            image: "/images/navigation/gallery.webp",
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
        image: "/images/navigation/armory.webp",
        icon: Shield,
        items: [
          {
            title: "Trang bị",
            image: "/images/navigation/items.webp",
            to: "/items",
            icon: Shield,
            description: "Shop, công thức ghép",
            badge: "itemIssues",
          },
          {
            title: "Phù hiệu",
            image: "/images/navigation/enchantments.webp",
            to: "/enchantments",
            icon: Hexagon,
            description: "Bốn hệ phù hiệu",
          },
          {
            title: "Bảng ngọc",
            image: "/images/navigation/arcana.webp",
            to: "/arcana",
            icon: Gem,
            description: "Chưa thu thập dữ liệu",
          },
          {
            title: "Phụ trợ",
            image: "/images/navigation/spells.webp",
            to: "/spells",
            icon: Zap,
            description: "Phép phụ trợ cho tướng",
          },
        ],
      },
    ],
  },
  {
    label: "Sắp triển khai",
    items: [
      {
        title: "Giải đấu",
        image: "/images/navigation/tournaments.webp",
        to: "/tournaments",
        icon: Trophy,
        description: "Giải, đội, lịch thi đấu",
        soon: true,
      },
      {
        title: "Livestream",
        image: "/images/navigation/streams.webp",
        to: "/streams",
        icon: Radio,
        description: "Kênh và trạng thái live",
        soon: true,
      },
    ],
  },
]

export const MEDIA_NAV: NavItem[] = [
  {
    title: "Portrait",
    image: "/images/navigation/portrait.webp",
    to: "/portraits",
    icon: ImageIcon,
    description: "Ghép và sắp xếp portrait",
  },
  {
    title: "Head",
    image: "/images/navigation/head.webp",
    to: "/media/head",
    icon: ImageIcon,
    description: "Head tướng, trang phục và icon danh sách",
  },
  {
    title: "Cover",
    image: "/images/navigation/cover.webp",
    to: "/media/cover",
    icon: Images,
    description: "Cover tướng và trang phục",
  },
  {
    title: "Bậc trang phục",
    image: "/images/navigation/badges.webp",
    to: "/media/badges",
    icon: Medal,
    description: "Nhãn bậc và sự kiện",
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => [
  ...group.items,
  ...(group.sections ?? []).flatMap((section) => section.items),
])
