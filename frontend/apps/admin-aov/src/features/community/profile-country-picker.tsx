import { useId, useState } from "react"
import { Check, ChevronsUpDown, Globe } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { countryReferenceFlag } from "@aov/ui/lib/country-references"
import { commandFilter } from "@/lib/text"
import { findProfileCountry, profileCountryOptions } from "./profile-country-options"

function CountryFlag({ code }: { code: string }) {
  const flags = code
    .split("/")
    .map(countryReferenceFlag)
    .filter((flag) => !!flag)
  return (
    <span aria-hidden="true" className="inline-flex min-w-6 shrink-0 items-center gap-1">
      {flags.length ? (
        flags.map((flag) => (
          <img key={flag} src={flag} alt="" className="h-4 w-6 rounded-sm object-cover ring-1 ring-foreground/10" />
        ))
      ) : (
        <Globe className="size-4 text-muted-foreground" />
      )}
    </span>
  )
}

export function ProfileCountryPicker({
  value,
  disabled = false,
  onChange,
}: {
  value?: string | null
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const selected = findProfileCountry(value)
  const selectedCode = selected?.code || value || ""
  const choices = [
    { code: "", name: "Chưa xác định", aliases: [] },
    ...(!selected && value ? [{ code: value, name: value, aliases: [] }] : []),
    ...profileCountryOptions,
  ].map((option) => ({ ...option, search: [option.code, option.name, ...option.aliases].join(" ").trim() }))
  return (
    <div className="grid min-w-0 gap-2">
      <span id={id} className="type-label">
        Quốc gia / khu vực
      </span>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-labelledby={id}
            aria-expanded={open && !disabled}
            disabled={disabled}
            className="h-9 w-full justify-between gap-2 font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <CountryFlag code={selectedCode} />
              <span className="truncate">{selected?.name || value || "Chưa xác định"}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-2rem)] p-0"
          align="start"
        >
          <Command
            key={String(open)}
            label="Chọn quốc gia / khu vực"
            defaultValue={choices.find((option) => option.code === selectedCode)?.search}
            filter={commandFilter}
          >
            <CommandInput aria-label="Tìm quốc gia / khu vực" placeholder="Tìm tên hoặc mã quốc gia…" />
            <CommandList label="Quốc gia / khu vực" className="max-h-64 overscroll-contain">
              <CommandEmpty>Không tìm thấy quốc gia / khu vực.</CommandEmpty>
              {choices.map((option) => (
                <CommandItem
                  key={option.code}
                  value={option.search}
                  disabled={disabled}
                  onSelect={() => {
                    if (disabled) return
                    if (option.code !== selectedCode) onChange(option.code)
                    setOpen(false)
                  }}
                >
                  <CountryFlag code={option.code} />
                  <span className="min-w-0 flex-1">{option.name}</span>
                  <Check
                    aria-hidden
                    className={`size-4 shrink-0 ${selectedCode === option.code ? "opacity-100" : "opacity-0"}`}
                  />
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
