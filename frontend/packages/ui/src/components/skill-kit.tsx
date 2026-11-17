import type { ReactNode } from "react"
import { ArrowLeftRight, Sparkles } from "lucide-react"
import { cn } from "../lib/utils"
import { useLocaleText } from "@aov/ui/hooks/use-locale-text"

export interface SkillFormOption {
  key: string
  label: string
  icon?: ReactNode
  title?: string
  /** The full name for assistive technology, such as the form and the skill it opens. */
  ariaLabel?: string
}

/**
 * Switches between the forms of one skill, like the switch button beside a hero's skills in the game. Choosing a form
 * keeps the reader on the same skill; only its name, text and numbers change.
 */
export function SkillFormSwitch({
  options,
  value,
  onChange,
  label,
  disabled = false,
  className,
}: {
  options: SkillFormOption[]
  value: string
  onChange: (key: string) => void
  label?: string
  disabled?: boolean
  className?: string
}) {
  const t = useLocaleText()
  if (options.length < 2) return null
  return (
    <div
      role="group"
      aria-label={label ?? t("Dạng của chiêu", "Skill form")}
      data-slot="skill-form-switch"
      className={cn("inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1", className)}
    >
      <ArrowLeftRight aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
      {options.map((option) => {
        const active = option.key === value
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            title={option.title}
            disabled={disabled}
            data-active={active || undefined}
            className={cn(
              "inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option.key)}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Swaps a skill's picture for one of its states, such as a sea-monster form. The name, text and numbers stay the skill's
 * own, so this only changes which icon is shown.
 */
export function SkillStateToggle({
  states,
  value,
  onChange,
  normalLabel,
  label,
  unnamed,
  className,
}: {
  states: string[]
  value: number | null
  onChange: (value: number | null) => void
  normalLabel?: string
  label?: string
  unnamed?: string
  className?: string
}) {
  const t = useLocaleText()
  if (!states.length) return null
  const options: [number | null, string][] = [
    [null, normalLabel ?? t("Thường", "Normal")],
    ...states.map((state, n): [number, string] => [n, state]),
  ]
  return (
    <div
      role="group"
      aria-label={label ?? t("Trạng thái của chiêu", "Skill state")}
      data-slot="skill-state-toggle"
      className={cn("inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1", className)}
    >
      <Sparkles aria-hidden className="mx-1 size-4 shrink-0 text-muted-foreground" />
      {options.map(([state, name]) => (
        <button
          key={state ?? "normal"}
          type="button"
          aria-pressed={value === state}
          className={cn(
            "min-h-8 rounded-md px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === state ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(state)}
        >
          {name || unnamed || t("Chưa đặt tên", "Unnamed")}
        </button>
      ))}
    </div>
  )
}

/** One dot per form of a skill in the kit, the one on screen filled, so a reader sees there is more to switch to. */
export function SkillVariantDots({ count, active }: { count: number; active: number }) {
  if (count < 2) return null
  return (
    <span aria-hidden data-slot="skill-variant-dots" className="flex items-center justify-center gap-1">
      {Array.from({ length: count }, (_, n) => (
        <span key={n} className={cn("size-1.5 rounded-full", n === active ? "bg-primary" : "bg-muted-foreground/35")} />
      ))}
    </span>
  )
}
