import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react"
import { useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { selfProfile, userKeys } from "@/features/users/user-api"
import { useSession } from "@/app/auth/auth-gate"
import { logout } from "@/app/auth/session"
import { useTheme, type Theme } from "@/app/theme"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@aov/ui/components/sidebar"

export function UserMenu() {
  const { actor } = useSession()
  const navigate = useNavigate()
  const profile = useQuery({
    queryKey: [...userKeys.self, actor?.issuer, actor?.subject],
    queryFn: ({ signal }) => selfProfile(signal),
    enabled: !!actor,
    refetchInterval: 600000,
  })
  const displayName = profile.data?.displayName || actor?.displayName || "Tài khoản quản trị"
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {profile.data?.avatarUrl && <AvatarImage src={profile.data.avatarUrl} referrerPolicy="no-referrer" />}
                <AvatarFallback className="rounded-lg">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
            side={isMobile ? "top" : "left"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuItem onSelect={() => navigate("/profile")}>
              <UserRound />
              Hồ sơ của tôi
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Giao diện</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
              <DropdownMenuRadioItem value="light">
                <Sun /> Sáng
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon /> Tối
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor /> Theo hệ thống
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => void logout()}>
                <LogOut /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
