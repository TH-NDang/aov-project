import { useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import type { Hero } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { commandFilter } from "@/lib/text"

interface HeroPickerProps {
  heroes: Hero[]
  value: string | null
  onChange: (heroId: string | null) => void
  placeholder?: string
  allowClear?: boolean
  id?: string
  className?: string
  size?: "sm" | "default"
}

export function HeroPicker({
  heroes,
  value,
  onChange,
  placeholder = "Chọn tướng…",
  allowClear,
  id,
  className,
  size = "default",
}: HeroPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = heroes.find((hero) => hero.id === value)
  const sorted = [...heroes].sort((a, b) => a.name.localeCompare(b.name, "vi"))

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            size={size}
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected ? (
                <>
                  <MediaImage path={selected.head} className="size-5 rounded-sm object-cover" />
                  <span className="truncate">{selected.name}</span>
                </>
              ) : (
                <span className="truncate text-muted-foreground">{placeholder}</span>
              )}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command filter={commandFilter}>
            <CommandInput placeholder="Gõ tên tướng…" />
            <CommandList>
              <CommandEmpty>Không có tướng phù hợp.</CommandEmpty>
              <CommandGroup>
                {sorted.map((hero) => (
                  <CommandItem
                    key={hero.id}
                    value={`${hero.name} ${hero.id}`}
                    onSelect={() => {
                      onChange(hero.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn(value === hero.id ? "opacity-100" : "opacity-0")} />
                    <MediaImage path={hero.head} className="size-6 rounded-sm object-cover" />
                    <span className="truncate">{hero.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{hero.skins.length - 1}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {allowClear && selected && (
        <Button
          type="button"
          variant="ghost"
          size={size === "sm" ? "icon-sm" : "icon"}
          onClick={() => onChange(null)}
          aria-label="Bỏ chọn tướng"
        >
          <X />
        </Button>
      )}
    </div>
  )
}
