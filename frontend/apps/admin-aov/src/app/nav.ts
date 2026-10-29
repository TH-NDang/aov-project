import type { AovNavIconName } from "@/app/aov-nav-icon"

export type NavBadgeKey = "itemIssues"

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
        title: "Quản lý ảnh",
        icon: "imageLibrary",
        to: "/image-management",
        description: "Ảnh, phiên bản và nơi sử dụng",
        capability: "catalog:read",
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
            to: "/hero",
            description: "Draft, publish và lịch sử phiên bản tướng",
            capability: "catalog:read",
          },
          {
            title: "Không gian ảnh",
            icon: "heroMedia",
            to: "/hero/media",
            description: "Portrait, head, cover và bậc trang phục",
            activePaths: ["/hero/media", "/media"],
            capability: "catalog:read",
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
            capability: "catalog:read",
          },
          {
            title: "Phù hiệu",
            icon: "enchantments",
            to: "/enchantments",
            description: "Bốn hệ phù hiệu",
            capability: "catalog:read",
          },
          {
            title: "Bảng ngọc",
            icon: "arcana",
            to: "/arcana",
            description: "Màu ngọc, cấp và chỉ số",
            capability: "catalog:read",
          },
          {
            title: "Phụ trợ",
            icon: "spells",
            to: "/spells",
            description: "Phép phụ trợ cho tướng",
            capability: "catalog:read",
          },
        ],
      },
    ],
  },
  {
    label: "Quản lý game",
    items: [
      {
        title: "Phiên bản và thị trường",
        icon: "releases",
        to: "/game-configuration",
        description: "Mùa, patch và lịch phát hành",
        capability: "catalog:read",
      },
      {
        title: "Thuật ngữ & tham chiếu",
        to: "/terminology",
        icon: "glossary",
        description: "Alias, hiển thị và xem trước tham chiếu",
      },
    ],
  },
  {
    label: "Giải đấu & trực tiếp",
    items: [
      {
        title: "Giải đấu",
        icon: "tournaments",
        to: "/tournaments",
        description: "Giải, đội, lịch thi đấu",
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
    to: "/hero/media",
    icon: "portrait",
    description: "Portrait theo tướng, trang phục và ảnh chính",
  },
  {
    title: "Head",
    to: "/hero/media?tab=head",
    icon: "head",
    description: "Head tướng, trang phục và icon danh sách",
  },
  {
    title: "Cover",
    to: "/hero/media?tab=cover",
    icon: "cover",
    description: "Cover tướng và trang phục",
  },
  {
    title: "Bậc trang phục",
    to: "/hero/media?tab=badges",
    icon: "badges",
    description: "Tên, icon theo ngôn ngữ và trang phục liên quan",
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => [
  ...group.items,
  ...(group.sections ?? []).flatMap((section) => section.items),
])

function navPathMatches(path: string, pathname: string) {
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/")
}

export function isNavActive(item: Pick<NavItem, "to" | "activePaths">, pathname: string) {
  return (item.activePaths ?? [item.to]).some((path) => navPathMatches(path, pathname))
}

/** Only the most specific match is highlighted, so "/hero/media" does not also light up "/hero". */
export function activeNavItem(pathname: string, items: NavItem[] = NAV_ITEMS) {
  let active: NavItem | undefined
  let length = -1
  for (const item of items)
    for (const path of item.activePaths ?? [item.to])
      if (navPathMatches(path, pathname) && path.length > length) {
        active = item
        length = path.length
      }
  return active
}
