import { useRef, useState } from "react"
import { Keyboard, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react"
import { AovNavIcon } from "@/app/aov-nav-icon"
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
import { Kbd } from "@aov/ui/components/kbd"
import { cn } from "@aov/ui/lib/utils"
import { HotkeyHelp } from "./hotkey-help"

export const THEME_CHOICES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Sáng", Icon: Sun },
  { value: "dark", label: "Tối", Icon: Moon },
  { value: "system", label: "Theo hệ thống", Icon: Monitor },
]

/** The signed-in account as the navigation shows it. */
export function useAccount() {
  const { actor } = useSession()
  const profile = useQuery({
    queryKey: userKeys.selfOf(actor?.issuer, actor?.subject),
    queryFn: ({ signal }) => selfProfile(signal),
    enabled: !!actor,
    refetchInterval: 600000,
  })
  return {
    displayName: profile.data?.displayName || actor?.displayName || "Tài khoản quản trị",
    avatarUrl: profile.data?.avatarUrl,
  }
}

export function AccountAvatar({ className }: { className?: string }) {
  const { displayName, avatarUrl } = useAccount()
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />}
      <AvatarFallback className="rounded-lg">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/** The navigation marks are Game Icons, whose licence asks for this credit wherever they are shown. */
export function IconCredit({ className }: { className?: string }) {
  return (
    <p className={cn("type-meta", className)}>
      Biểu tượng từ{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://game-icons.net"
        target="_blank"
        rel="noopener noreferrer"
      >
        Game Icons
      </a>
      ,{" "}
      <a
        className="underline underline-offset-2 hover:text-foreground"
        href="https://creativecommons.org/licenses/by/3.0/"
        target="_blank"
        rel="noopener noreferrer"
      >
        CC BY 3.0
      </a>
    </p>
  )
}

/** The account menu at the foot of the rail, opened from the avatar. Phones list the same choices in the system sheet. */
export function UserMenu() {
  const [hotkeyHelpOpen, setHotkeyHelpOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const { displayName } = useAccount()
  const { theme, setTheme } = useTheme()

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button ref={triggerRef} type="button" className="adm-rail-account" aria-label={`Tài khoản: ${displayName}`}>
            <AccountAvatar />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-60 rounded-lg"
          side="right"
          align="end"
          sideOffset={8}
          onCloseAutoFocus={(event) => {
            if (hotkeyHelpOpen) event.preventDefault()
          }}
        >
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void navigate("/profile")}>
            <AovNavIcon name="profile" className="size-5" />
            Hồ sơ của tôi
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void navigate("/settings")}>
            <Settings />
            Cài đặt
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setHotkeyHelpOpen(true)} aria-keyshortcuts="Control+/ Meta+/">
            <Keyboard />
            Phím tắt
            <Kbd className="ml-auto">Ctrl /</Kbd>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Giao diện</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            {THEME_CHOICES.map(({ value, label, Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon /> {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut /> Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <IconCredit className="px-2 py-1.5" />
        </DropdownMenuContent>
      </DropdownMenu>
      <HotkeyHelp open={hotkeyHelpOpen} onOpenChange={setHotkeyHelpOpen} triggerRef={triggerRef} />
    </>
  )
}
