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
        title: "Quản lý tệp",
        icon: "imageLibrary",
        to: "/image-management",
        description: "Ảnh công khai, tệp nguồn riêng tư và dung lượng R2",
        capability: "catalog:read",
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
            description: "Bản nháp, xuất bản và lịch sử phiên bản của tướng",
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
          {
            title: "Build đề cử",
            icon: "builds",
            to: "/builds",
            description: "Bộ đồ game đề cử cho từng tướng, đọc từ ảnh màn Chuẩn bị",
            capability: "catalog:read",
          },
          {
            title: "Thống kê đấu hạng",
            icon: "ranking",
            to: "/ranking",
            description: "Tỷ lệ thắng, chọn, cấm và chỉ số mỗi trận đọc từ ảnh game",
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
            description: "Cửa hàng, công thức ghép",
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
            description: "Kỹ năng phụ trợ của tướng",
            capability: "catalog:read",
          },
        ],
      },
      {
        title: "Lối chơi",
        icon: "competition",
        items: [
          {
            title: "Chế độ chơi",
            icon: "gameModes",
            to: "/game-modes",
            description: "Chế độ PVP, giải trí và cẩm nang Cờ Liên Quân",
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
        title: "Video",
        icon: "videos",
        to: "/videos",
        description: "Video của tướng, kỹ năng, trang phục, duyệt và nhập dữ liệu thu thập",
        capability: "catalog:read",
      },
      {
        title: "Thuật ngữ & tham chiếu",
        to: "/terminology",
        icon: "glossary",
        description: "Tên gọi khác, cách hiển thị và xem trước tham chiếu",
      },
    ],
  },
  {
    label: "Giải đấu & trực tiếp",
    items: [
      {
        title: "Livestream",
        icon: "streams",
        to: "/streams",
        description: "Kênh và trạng thái phát trực tiếp",
        soon: true,
      },
    ],
    sections: [
      {
        title: "Quản lý thi đấu",
        icon: "competition",
        items: [
          {
            title: "Hồ sơ thi đấu",
            icon: "competitionProfile",
            to: "/organizations",
            description: "Tổ chức, đội tuyển và tuyển thủ",
            activePaths: ["/organizations", "/circuits", "/teams", "/players", "/coaches", "/broadcast", "/pages"],
          },
          {
            title: "Giải đấu",
            icon: "tournaments",
            to: "/tournaments",
            description: "Giải đấu, lịch thi đấu và kết quả",
          },
          {
            title: "Yêu cầu & kiểm duyệt",
            icon: "moderation",
            to: "/page-requests",
            description: "Đại diện trang và báo cáo cộng đồng",
          },
        ],
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
    description: "Head của tướng và biểu tượng danh sách",
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
    description: "Tên, biểu tượng theo ngôn ngữ và trang phục liên quan",
  },
]

export const NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => [...group.items, ...(group.sections ?? []).flatMap((section) => section.items)]),
  {
    title: "Hồ sơ của tôi",
    icon: "profile",
    to: "/profile",
    description: "Tên hiển thị, ảnh đại diện và thông tin cá nhân",
  },
]

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

const profilePageIcons: Record<string, AovNavIconName> = {
  "/organizations": "organizations",
  "/circuits": "circuits",
  "/teams": "teams",
  "/players": "players",
  "/coaches": "coaches",
  "/broadcast": "broadcast",
}

export function pageNavIcon(location: string): AovNavIconName {
  const { pathname, searchParams } = new URL(location, "http://local")
  if (pathname === "/hero/media") {
    const media = MEDIA_NAV.find(
      (item) => new URL(item.to, "http://local").searchParams.get("tab") === searchParams.get("tab"),
    )
    return media?.icon ?? "portrait"
  }
  return profilePageIcons[pathname] ?? activeNavItem(pathname)?.icon ?? "page"
}
