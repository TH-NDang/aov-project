import {
  BookA,
  BookUser,
  CalendarRange,
  CircleUserRound,
  ClipboardList,
  ContactRound,
  FileText,
  Gem,
  Hexagon,
  Images,
  LayoutDashboard,
  Medal,
  MonitorPlay,
  PackageOpen,
  RectangleHorizontal,
  ScanFace,
  Shield,
  Shirt,
  SquareUserRound,
  Swords,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@aov/ui/lib/utils"

/**
 * One Lucide icon per admin concept, shared by the sidebar, page tabs, command menu, dashboard and patch tabs, so the
 * same thing never shows two different pictures. Each navigation entry has its own icon.
 */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  imageLibrary: Images,
  profile: CircleUserRound,
  users: Users,
  characterBook: BookUser,
  heroes: Swords,
  heroMedia: SquareUserRound,
  skins: Shirt,
  portrait: ContactRound,
  head: ScanFace,
  cover: RectangleHorizontal,
  badges: Medal,
  armory: PackageOpen,
  items: Shield,
  enchantments: Hexagon,
  arcana: Gem,
  spells: Zap,
  releases: CalendarRange,
  glossary: BookA,
  competition: ClipboardList,
  tournaments: Trophy,
  teams: UsersRound,
  players: UserRound,
  streams: MonitorPlay,
  page: FileText,
} satisfies Record<string, LucideIcon>

export type AovNavIconName = keyof typeof NAV_ICONS

export function AovNavIcon({ name, className }: { name: AovNavIconName; className?: string }) {
  const Icon = NAV_ICONS[name]
  return <Icon aria-hidden="true" focusable="false" strokeWidth={1.75} className={cn("size-6 shrink-0", className)} />
}
