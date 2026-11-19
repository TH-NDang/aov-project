import { Input } from "@aov/ui/components/input"
import type { PickerContext } from "../api/tournament-api"
import { pickedName, typedName, unlinkedName, type LinkedName } from "../model/final-table-model"
import { RecordPicker } from "./record-picker"

/**
 * A name of the final table. Linked, it is the record itself, with its picture; the picker's clear button takes the
 * link off and leaves the name as text. Not linked, it is the name as written, beside a picker that links a record.
 */
export function LinkedNameField({
  kind,
  value,
  textLabel,
  pickerLabel,
  context,
  exclude,
  onChange,
}: {
  kind: "teams" | "players"
  value: LinkedName
  /** The name of the field, such as the recipient. */
  textLabel: string
  /** What the picker finds, such as players. */
  pickerLabel: string
  context?: PickerContext
  exclude?: readonly string[]
  onChange: (value: LinkedName) => void
}) {
  if (value.id)
    return (
      <RecordPicker
        kind={kind}
        value={value.id}
        label={pickerLabel}
        context={context}
        exclude={exclude}
        onChange={(id, name) => onChange(id ? pickedName(id, name) : unlinkedName(value))}
      />
    )
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Input
        aria-label={textLabel}
        placeholder={textLabel}
        value={value.name}
        onChange={(event) => onChange(typedName(value, event.target.value))}
      />
      <div className="w-36 shrink-0">
        <RecordPicker
          kind={kind}
          value=""
          label={pickerLabel}
          placeholder={`Liên kết ${pickerLabel.toLowerCase()}`}
          context={context}
          exclude={exclude}
          onChange={(id, name) => id && onChange(pickedName(id, name))}
        />
      </div>
    </div>
  )
}
