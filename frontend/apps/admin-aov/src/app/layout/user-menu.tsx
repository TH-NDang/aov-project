import { useState } from "react"
import { ChevronsUpDown, DatabaseBackup, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react"
import { useNavigate } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { selfProfile, userKeys } from "@/features/users/user-api"
import { useSession } from "@/app/auth/auth-gate"
import { logout } from "@/app/auth/session"
import { useTheme, type Theme } from "@/app/theme"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"
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
import { api } from "@/lib/api/client"
import { useResetLocalChanges } from "@/lib/queries"

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
  const [confirmReset, setConfirmReset] = useState(false)
  const reset = useResetLocalChanges()

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
                <span className="truncate text-xs text-muted-foreground">
                  {api.mode === "mock" ? "Đã đăng nhập · dữ liệu mẫu" : "Đã đăng nhập"}
                </span>
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
            <DropdownMenuLabel className="font-normal">
              <div className="grid text-sm leading-tight">
                <span className="font-medium">{displayName}</span>
                <span className="max-w-72 whitespace-normal break-words text-xs text-muted-foreground">
                  Quyền: {actor?.capabilities.join(", ")}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
              {api.mode === "mock" && (
                <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
                  <DatabaseBackup /> Bỏ mọi thay đổi trên dữ liệu mẫu
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => void logout()}>
                <LogOut /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ mọi thay đổi trên dữ liệu mẫu?</AlertDialogTitle>
            <AlertDialogDescription>
              Các chỉnh sửa đã lưu trong trình duyệt này (tướng, trang phục, portrait, trang bị, phù hiệu) và nhật ký
              hoạt động sẽ bị xoá. Dữ liệu trong thư mục resources không bị ảnh hưởng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reset.mutate(undefined, { onSuccess: () => toast.success("Đã khôi phục dữ liệu mẫu ban đầu.") })
              }
            >
              Bỏ thay đổi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenu>
  )
}
