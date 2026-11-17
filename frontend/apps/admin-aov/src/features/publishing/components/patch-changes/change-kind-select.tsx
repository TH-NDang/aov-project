import { Ellipsis } from "lucide-react"
import { changeKindIcon } from "@aov/ui/components/change-kind-icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"

const NONE = "__none"

/** A picker for what a change did. A native select cannot show images, and the mark is what makes the kinds quick to tell apart. */
export function ChangeKindSelect<K extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  clearLabel,
  disabled,
  className,
}: {
  value: K | ""
  options: readonly (readonly [K, string])[]
  onChange: (kind: K | "") => void
  ariaLabel: string
  placeholder?: string
  /** Offers a way back to no choice, where an empty kind is valid. */
  clearLabel?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => onChange(next === NONE ? "" : (next as K))}>
      <SelectTrigger aria-label={ariaLabel} className={className} size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {clearLabel && <SelectItem value={NONE}>{clearLabel}</SelectItem>}
        {options.map(([kind, label]) => {
          const Art = changeKindIcon(kind)
          return (
            <SelectItem key={kind} value={kind} textValue={label}>
              {Art ? <Art size={18} className="shrink-0" /> : <Ellipsis aria-hidden className="size-4 shrink-0" />}
              {label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
