import { cn } from "@aov/ui/lib/utils"

/** One of a few views of the same list; the pressed one is the one on screen. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "type-label h-8 rounded px-3 whitespace-nowrap",
            value === option ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
