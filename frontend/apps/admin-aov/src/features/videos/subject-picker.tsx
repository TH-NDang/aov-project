import { useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@aov/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import { KIND_LABELS, subjectId, subjectMatches, type VideoSubject, type VideoSubjectKind } from "./video-model"

const KIND_ORDER: VideoSubjectKind[] = ["HERO", "SKIN", "ITEM", "ENCHANTMENT", "ARCANA", "SPELL"]
/** Rendering the whole catalog at once makes the list sluggish, and nobody scrolls past this many rows. */
const MAX_ROWS_PER_GROUP = 60

/** Names a skin with its hero when the picker spans several heroes. */
function rowLabel(subject: VideoSubject, heroNames: Map<string, string>, showHero: boolean) {
  if (subject.kind === "HERO") return showHero ? subject.name : `Cả tướng · ${subject.name}`
  if (!subject.key || !showHero) return subject.name
  return `${heroNames.get(subject.id) ?? subject.code} · ${subject.name}`
}

/** Chooses what a video is attached to from existing subjects, so nobody has to type an identifier. */
export function SubjectPicker({
  label,
  subjects,
  value,
  onChange,
  disabled,
  showHero = false,
}: {
  label: string
  subjects: readonly VideoSubject[]
  value: VideoSubject | null
  onChange: (subject: VideoSubject) => void
  disabled?: boolean
  showHero?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const heroNames = useMemo(
    () => new Map(subjects.filter((subject) => subject.kind === "HERO").map((hero) => [hero.id, hero.name])),
    [subjects],
  )
  const groups = useMemo(() => {
    const matches = (subject: VideoSubject) => subjectMatches(search, subject, rowLabel(subject, heroNames, true))
    return KIND_ORDER.map((kind) => ({
      kind,
      rows: subjects.filter((subject) => subject.kind === kind && matches(subject)),
    })).filter((group) => group.rows.length)
  }, [heroNames, search, subjects])

  return (
    <div className="grid gap-1.5">
      <span className="text-sm">{label}</span>
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{value ? rowLabel(value, heroNames, showHero) : "Chọn mục gắn video…"}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
          <Command shouldFilter={false}>
            <CommandInput aria-label="Tìm mục" placeholder="Tìm mục…" value={search} onValueChange={setSearch} />
            <CommandList className="max-h-72 overscroll-contain">
              <CommandEmpty>Không tìm thấy mục nào.</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.kind} heading={KIND_LABELS[group.kind]}>
                  {group.rows.slice(0, MAX_ROWS_PER_GROUP).map((subject) => {
                    const id = subjectId(subject)
                    const selected = !!value && subjectId(value) === id
                    return (
                      <CommandItem
                        key={id}
                        value={id}
                        onSelect={() => {
                          onChange(subject)
                          setOpen(false)
                        }}
                      >
                        <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{rowLabel(subject, heroNames, showHero)}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
