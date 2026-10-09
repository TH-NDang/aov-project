import { useState } from "react"
import { ChevronsUpDown, DatabaseBackup, LogIn, Monitor, Moon, Sun } from "lucide-react"
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
import { Avatar, AvatarFallback } from "@aov/ui/components/avatar"
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
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const [confirmReset, setConfirmReset] = useState(false)
  const reset = useResetLocalChanges()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">BT</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Biên tập viên</span>
                <span className="truncate text-xs text-muted-foreground">
                  {api.mode === "mock" ? "Dữ liệu mẫu · chưa đăng nhập" : "Đã đăng nhập"}
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
                <span className="font-medium">Biên tập viên</span>
                <span className="text-xs text-muted-foreground">Quyền: catalog:read, *:write</span>
              </div>
            </DropdownMenuLabel>
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
              <DropdownMenuItem disabled>
                <LogIn /> Đăng nhập Keycloak (sắp có)
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
