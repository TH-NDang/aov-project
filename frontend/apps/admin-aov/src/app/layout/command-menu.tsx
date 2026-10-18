import { useState } from "react"
import { useNavigate } from "react-router"
import { Moon, Search, Sun } from "lucide-react"
import { useTheme } from "@/app/theme"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@aov/ui/components/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { MEDIA_NAV, NAV_ITEMS } from "@/app/nav"
import { NavIcon } from "@/app/nav-icon"
import { MediaImage } from "@/components/media-image"
import { useEnchantments, useItemCatalog } from "@/lib/queries"
import { commandFilter, formatNumber } from "@/lib/text"
import { useSession } from "@/app/auth/auth-gate"

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const { actor } = useSession()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const [search, setSearch] = useState("")
  const items = useItemCatalog()
  const enchantments = useEnchantments()

  const run = (action: () => void) => {
    onOpenChange(false)
    setSearch("")
    action()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Tìm kiếm</DialogTitle>
        <DialogDescription>Tìm trang, tướng, trang bị hoặc phù hiệu</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        {/* Same styling as CommandDialog, plus an accent-insensitive word filter instead of cmdk's fuzzy match. */}
        <Command
          filter={commandFilter}
          className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder="Gõ tên tướng, trang bị, phù hiệu hoặc trang…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Không tìm thấy kết quả.</CommandEmpty>
            <CommandGroup heading="Trang">
              {[...NAV_ITEMS, ...MEDIA_NAV]
                .filter((item) => !item.capability || actor?.capabilities.includes(item.capability))
                .map((item) => (
                  <CommandItem
                    key={`${item.to}:${item.title}`}
                    value={`trang ${item.title} ${item.description}`}
                    onSelect={() => run(() => navigate(item.to))}
                  >
                    <NavIcon item={item} />
                    <span>{item.title}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{item.description}</span>
                  </CommandItem>
                ))}
            </CommandGroup>
            {search.trim().length > 1 && (
              <CommandGroup heading="Tìm nhanh">
                {actor?.capabilities.includes("catalog:read") && (
                  <CommandItem
                    value={`tim tuong ${search}`}
                    onSelect={() => run(() => navigate(`/publishing?q=${encodeURIComponent(search.trim())}`))}
                  >
                    <Search />
                    Tìm tướng “{search.trim()}”
                  </CommandItem>
                )}
                <CommandItem
                  value={`tim portrait ${search}`}
                  onSelect={() => run(() => navigate(`/portraits?q=${encodeURIComponent(search.trim())}`))}
                >
                  <Search />
                  Tìm portrait “{search.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandSeparator />
            {items.data && (
              <CommandGroup heading="Trang bị">
                {items.data.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`trang bi ${item.name} ${item.id}`}
                    onSelect={() => run(() => navigate(`/items?item=${item.id}`))}
                  >
                    <MediaImage path={item.image} className="size-6 rounded-sm object-contain" />
                    <span>{item.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.category} · {formatNumber(item.price)} vàng
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {enchantments.data && (
              <CommandGroup heading="Phù hiệu">
                {enchantments.data.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`phu hieu ${item.name} ${item.id}`}
                    onSelect={() => run(() => navigate(`/enchantments?item=${item.id}`))}
                  >
                    <MediaImage path={item.image.file} className="size-6 rounded-sm object-contain" />
                    <span>{item.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.position.group} · Cấp {item.tierLabel}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="Giao diện">
              <CommandItem
                value="giao diện sáng tối theme"
                onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                Chuyển sang giao diện {resolvedTheme === "dark" ? "sáng" : "tối"}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
