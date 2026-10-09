import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import type { SkinBadge } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { commandFilter } from "@/lib/text"

export const badgeLabel = (id: string) => id.replace(/-/g, " ")

interface BadgePickerProps {
  badges: SkinBadge[]
  value: string | null
  onChange: (value: string | null) => void
  id?: string
  /** Usage count per badge id, shown to help pick the common ones. */
  usage?: Map<string, number>
}

/** Searchable badge selector with icon previews. */
export function BadgePicker({ badges, value, onChange, id, usage }: BadgePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = badges.find((badge) => badge.id === value)
  const sorted = usage ? [...badges].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)) : badges

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <>
                <MediaImage path={selected.icon} className="h-5 w-auto max-w-10 object-contain" />
                <span className="truncate capitalize">{badgeLabel(selected.id)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Chưa gắn bậc</span>
            )}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command filter={commandFilter}>
          <CommandInput placeholder="Tìm bậc: ss, huu han, christmas…" />
          <CommandList>
            <CommandEmpty>Không có bậc phù hợp.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none chua gan bac"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <Check className={cn(value === null ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">Chưa gắn bậc</span>
              </CommandItem>
              {sorted.map((badge) => (
                <CommandItem
                  key={badge.id}
                  value={badge.id}
                  onSelect={() => {
                    onChange(badge.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn(value === badge.id ? "opacity-100" : "opacity-0")} />
                  <MediaImage path={badge.icon} className="h-5 w-10 object-contain" />
                  <span className="truncate capitalize">{badgeLabel(badge.id)}</span>
                  {usage?.get(badge.id) ? (
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{usage.get(badge.id)}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
