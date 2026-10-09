import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import type { Item } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { commandFilter, formatNumber } from "@/lib/text"

interface ItemPickerProps {
  items: Item[]
  exclude: Set<string>
  onPick: (itemId: string) => void
  label?: string
}

/** Searchable item list grouped by tier, used to add recipe components. */
export function ItemPicker({ items, exclude, onPick, label = "Thêm nguyên liệu" }: ItemPickerProps) {
  const [open, setOpen] = useState(false)
  const candidates = items.filter((item) => !exclude.has(item.id))
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command filter={commandFilter}>
          <CommandInput placeholder="Tìm trang bị…" />
          <CommandList>
            <CommandEmpty>Không có trang bị phù hợp.</CommandEmpty>
            {([1, 2, 3] as const).map((tier) => (
              <CommandGroup key={tier} heading={`Cấp ${tier}`}>
                {candidates
                  .filter((item) => item.tier === tier)
                  .map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.name} ${item.id}`}
                      onSelect={() => {
                        onPick(item.id)
                        setOpen(false)
                      }}
                    >
                      <MediaImage path={item.image} className="size-6 rounded-sm object-contain" />
                      <span className="truncate">{item.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {formatNumber(item.price)}
                      </span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
