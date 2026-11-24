import type { ComponentType } from "react"
import { cn } from "@aov/ui/lib/utils"
import { NativeSelect } from "@/components/native-select"
import type { FacetOption } from "../model/facet-options"

/**
 * One filter of a list, told apart by its icon. `every` is the choice that filters nothing; without it the list always
 * has a value, as an order does. A filter with nothing to choose from does not show.
 */
export function FilterSelect({
  icon: Icon,
  label,
  every,
  value,
  options,
  onChange,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }>
  label: string
  every?: string
  value: string
  options: readonly FacetOption[]
  onChange: (value: string) => void
}) {
  if (every && !options.length) return null
  return (
    <span data-filter className="relative block min-w-0">
      <Icon
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2",
          every && value ? "text-primary" : "text-muted-foreground",
        )}
      />
      <NativeSelect
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full truncate pr-2 pl-8"
      >
        {every && <option value="">{every}</option>}
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </NativeSelect>
    </span>
  )
}
