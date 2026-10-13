import type { AovNavIconName } from "@/app/aov-nav-icon"

export type NavBadgeKey = "unmatchedPortraits" | "itemIssues"

export interface NavItem {
  title: string
  to: string
  icon: AovNavIconName
  /** Short helper shown in the command menu. */
  description: string
  badge?: NavBadgeKey
  soon?: boolean
  activePaths?: string[]
  capability?: string
}

export interface NavSection {
  title: string
  icon: AovNavIconName
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
        icon: "dashboard",
        to: "/",
        description: "Số liệu và việc cần xử lý",
      },
    ],
  },
  {
    label: "Dự án",
    items: [
      {
        title: "Lưu trữ",
        icon: "storage",
        to: "/storage",
        description: "Bảng JSON riêng và import theo ID",
      },
      {
        title: "Hồ sơ của tôi",
        icon: "profile",
        to: "/profile",
        description: "Tên hiển thị, avatar và thông tin cá nhân",
      },
      {
        title: "Người dùng",
        icon: "users",
        to: "/users",
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
        icon: "characterBook",
        items: [
          {
            title: "Tướng",
            icon: "heroes",
            to: "/heroes",
            description: "Thông tin, kỹ năng, trang phục",
          },
          {
            title: "Trang phục",
            icon: "skins",
            to: "/skins",
            description: "Toàn bộ trang phục theo tướng",
          },
          {
            title: "Không gian ảnh",
            icon: "gallery",
            to: "/portraits",
            description: "Portrait, head, cover và bậc trang phục",
            badge: "unmatchedPortraits",
            activePaths: ["/portraits", "/media"],
          },
        ],
      },
      {
        title: "Kho trang bị",
        icon: "armory",
        items: [
          {
            title: "Trang bị",
            icon: "items",
            to: "/items",
            description: "Shop, công thức ghép",
            badge: "itemIssues",
          },
          {
            title: "Phù hiệu",
            icon: "enchantments",
            to: "/enchantments",
            description: "Bốn hệ phù hiệu",
          },
          {
            title: "Bảng ngọc",
            icon: "arcana",
            to: "/arcana",
            description: "Chưa thu thập dữ liệu",
          },
          {
            title: "Phụ trợ",
            icon: "spells",
            to: "/spells",
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
        icon: "tournaments",
        to: "/tournaments",
        description: "Giải, đội, lịch thi đấu",
        soon: true,
      },
      {
        title: "Livestream",
        icon: "streams",
        to: "/streams",
        description: "Kênh và trạng thái live",
        soon: true,
      },
    ],
  },
]

export const MEDIA_NAV: NavItem[] = [
  {
    title: "Portrait",
    to: "/portraits",
    icon: "portrait",
    description: "Ghép và sắp xếp portrait",
  },
  {
    title: "Head",
    to: "/media/head",
    icon: "head",
    description: "Head tướng, trang phục và icon danh sách",
  },
  {
    title: "Cover",
    to: "/media/cover",
    icon: "cover",
    description: "Cover tướng và trang phục",
  },
  {
    title: "Bậc trang phục",
    to: "/media/badges",
    icon: "badges",
    description: "Nhãn bậc và sự kiện",
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => [
  ...group.items,
  ...(group.sections ?? []).flatMap((section) => section.items),
])
