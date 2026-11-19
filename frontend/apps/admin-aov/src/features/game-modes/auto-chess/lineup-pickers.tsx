import { type ReactNode } from "react"
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { moveAt } from "./guide-model"

interface PickOption {
  code: string
  name: string
  thumb: ReactNode
}

/** A grid of choices in a popover, grouped, each toggled in place; full once `max` are chosen. */
export function CodePicker({
  label,
  groups,
  chosen,
  max,
  onToggle,
  iconOnly,
}: {
  label: string
  groups: { key: string; title: ReactNode; options: PickOption[] }[]
  chosen: string[]
  max: number
  onToggle: (code: string) => void
  iconOnly?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {iconOnly ? (
          <Button type="button" size="icon-sm" variant="outline" aria-label={label} title={label}>
            <Plus />
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="justify-self-start">
            <Plus /> {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(440px,92vw)] p-2">
        <p className="type-meta px-1 pb-1">
          Đã chọn {chosen.length}/{max}
        </p>
        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {groups.map((group) =>
            group.options.length ? (
              <section key={group.key} className="grid gap-1">
                <h4 className="type-label flex items-center gap-1.5 px-1">{group.title}</h4>
                <div className="flex flex-wrap gap-1">
                  {group.options.map((option) => {
                    const on = chosen.includes(option.code)
                    return (
                      <button
                        key={option.code}
                        type="button"
                        aria-pressed={on}
                        disabled={!on && chosen.length >= max}
                        title={option.name}
                        onClick={() => onToggle(option.code)}
                        className={`type-meta inline-flex items-center gap-1.5 rounded-md border py-1 pr-2 pl-1 text-foreground transition-colors disabled:opacity-35 ${
                          on ? "border-primary bg-primary/15" : "hover:border-foreground/40"
                        }`}
                      >
                        {option.thumb}
                        <span className="max-w-32 truncate">{option.name}</span>
                        {on && <Check className="size-3.5" />}
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null,
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Chosen entries in priority order: a rank, the picture and name, arrows to reorder and a way out. */
export function OrderedChips({
  codes,
  describe,
  onChange,
  empty,
}: {
  codes: string[]
  describe: (code: string) => { name: string; thumb: ReactNode }
  onChange: (codes: string[]) => void
  empty: string
}) {
  if (!codes.length) return <p className="type-meta">{empty}</p>
  return (
    <ol className="flex flex-wrap gap-1.5">
      {codes.map((code, at) => {
        const { name, thumb } = describe(code)
        return (
          <li
            key={code}
            className="type-meta inline-flex items-center gap-1 rounded-full border bg-muted/30 py-0.5 pr-1 pl-1"
          >
            <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
              {at + 1}
            </span>
            {thumb}
            <span className="max-w-32 truncate text-foreground">{name}</span>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label={`Đưa ${name} lên trước`}
              disabled={at === 0}
              onClick={() => onChange(moveAt(codes, at, -1))}
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label={`Đưa ${name} ra sau`}
              disabled={at === codes.length - 1}
              onClick={() => onChange(moveAt(codes, at, 1))}
            >
              <ArrowRight className="size-3.5" />
            </button>
            <button
              type="button"
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:text-destructive"
              aria-label={`Bỏ ${name}`}
              onClick={() => onChange(codes.filter((entry) => entry !== code))}
            >
              <X className="size-3.5" />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
