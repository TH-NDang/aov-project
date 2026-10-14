import { useEffect, useId, useState } from "react"
import { Check, ChevronsUpDown, Languages, type LucideIcon } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"

interface Option {
  value: string
  label: string
  language?: boolean
}

const languageNames = new Intl.DisplayNames(["vi"], { type: "language" })
function languageLabel(code: string) {
  try {
    return languageNames.of(code) || code
  } catch {
    return code
  }
}
const languageCodes = ["vi-VN", "en-US", "th-TH", "zh-TW", "id-ID"]
export const languageOptions: Option[] = languageCodes.map((value) => ({
  value,
  label: languageLabel(value),
  language: true,
}))
export const timeZoneOptions: Option[] = Array.from(
  new Set([...Intl.supportedValuesOf("timeZone"), "Asia/Ho_Chi_Minh", "UTC"]),
  (value) => ({ value, label: value.replaceAll("_", " ").replaceAll("/", " / ") }),
)

const flagRegions = new Set(["VN", "US", "GB", "TH", "TW", "CN", "ID", "JP", "KR"])
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function localTime(timeZone: string, now: number) {
  try {
    let formatter = timeFormatters.get(timeZone)
    if (!formatter) {
      formatter = new Intl.DateTimeFormat("vi-VN", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
      timeFormatters.set(timeZone, formatter)
    }
    return formatter.format(now)
  } catch {
    return "—"
  }
}

function LanguageImage({ code }: { code: string }) {
  const region = new Intl.Locale(code).region
  return region && flagRegions.has(region) ? (
    <img
      src={`/images/flags/${region.toLowerCase()}.svg`}
      alt=""
      aria-hidden="true"
      className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-foreground/10"
    />
  ) : (
    <span aria-hidden="true" className="flex h-5 w-6 shrink-0 items-center justify-center rounded-sm bg-muted">
      <Languages className="size-3.5 text-muted-foreground" />
    </span>
  )
}

export function ProfilePreferencePicker({
  label,
  icon: Icon,
  value,
  options,
  disabled,
  showTime = false,
  onChange,
}: {
  label: string
  icon: LucideIcon
  value: string
  options: Option[]
  disabled: boolean
  showTime?: boolean
  onChange: (value: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000)
  useEffect(() => {
    if (!showTime) return
    const update = () => setNow(Math.floor(Date.now() / 60000) * 60000)
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [showTime])
  const selected = options.find((option) => option.value === value)
  const choices = selected ? options : [{ value, label: languageLabel(value) }, ...options]
  return (
    <div className="min-w-0 space-y-2">
      <span id={id} className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby={id}
            disabled={disabled}
            className="h-11 w-full justify-between gap-2 bg-background font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              {selected?.language && <LanguageImage code={value} />}
              <span className="truncate">{selected?.label || value}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {showTime && <span className="text-xs tabular-nums text-muted-foreground">{localTime(value, now)}</span>}
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[calc(100vw-2rem)] p-0"
          align="start"
        >
          <Command key={String(open)}>
            <CommandInput aria-label={`Tìm ${label.toLowerCase()}`} placeholder={`Tìm ${label.toLowerCase()}…`} />
            <CommandList className="max-h-64 overscroll-contain">
              <CommandEmpty>Không tìm thấy lựa chọn phù hợp.</CommandEmpty>
              {choices.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check className={`size-4 shrink-0 ${value === option.value ? "opacity-100" : "opacity-0"}`} />
                  {option.language && <LanguageImage code={option.value} />}
                  <span className="min-w-0 flex-1">
                    <span className="block">{option.label}</span>
                    {option.label !== option.value && (
                      <span className="text-xs text-muted-foreground">{option.value}</span>
                    )}
                  </span>
                  {showTime && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {localTime(option.value, now)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
