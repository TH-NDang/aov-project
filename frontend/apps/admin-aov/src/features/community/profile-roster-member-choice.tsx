import { useState } from "react"
import { Input } from "@aov/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { RosterRoleIcon } from "./profile-roster-lineup"

export function ProfileRosterMemberChoice({
  label,
  value,
  options,
  required,
  onChange,
  roleIcons,
  disabled,
}: {
  label: string
  value: string
  options: string[]
  required?: boolean
  onChange: (value: string) => void
  roleIcons?: boolean
  disabled?: boolean
}) {
  const [custom, setCustom] = useState(!!value && !options.includes(value))
  return (
    <div className="grid gap-2">
      <label className="grid gap-2">
        <span className="type-label">{label}</span>
        {roleIcons ? (
          <Select
            value={custom ? "__custom" : value}
            disabled={disabled}
            required={required && !custom}
            onValueChange={(next) => {
              setCustom(next === "__custom")
              onChange(next === "__custom" ? "" : next)
            }}
          >
            <SelectTrigger aria-label={label} className="h-10 w-full">
              <SelectValue placeholder="Chọn vị trí" />
            </SelectTrigger>
            <SelectContent position="popper">
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  <span aria-hidden="true">
                    <RosterRoleIcon role={option} size={18} />
                  </span>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value="__custom">
                <span aria-hidden="true">
                  <RosterRoleIcon role={value} size={18} />
                </span>
                Tùy chỉnh…
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <select
            className="type-body h-10 w-full rounded-md border bg-background px-3"
            aria-label={label}
            required={required && !custom}
            value={custom ? "__custom" : value}
            onChange={(e) => {
              setCustom(e.target.value === "__custom")
              onChange(e.target.value === "__custom" ? "" : e.target.value)
            }}
          >
            <option value="">Chưa chọn</option>
            {options.map((option) => (
              <option key={option}>{option}</option>
            ))}
            <option value="__custom">Tùy chỉnh…</option>
          </select>
        )}
      </label>
      {custom && (
        <Input
          aria-label={`${label} tùy chỉnh`}
          required={required}
          maxLength={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
