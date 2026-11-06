import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./public-select"
import { DATE_FORMATS, chooseDateFormat, dateFormatLabel, isDateFormat, useDateFormat } from "../lib/time-zone"

/** Lets a reader pick how dates are written. Rendered inside the settings of each public app. */
export function PublicDateFormatSelect({
  id,
  locale,
  product,
  triggerClassName,
  contentClassName,
}: {
  id?: string
  locale: string
  product?: "wiki" | "stream"
  triggerClassName?: string
  contentClassName?: string
}) {
  const format = useDateFormat()
  const title = locale.startsWith("en") ? "Date format" : "Định dạng ngày"
  return (
    <Select
      value={format}
      onValueChange={(next) => {
        if (isDateFormat(next)) void chooseDateFormat(next)
      }}
    >
      <SelectTrigger id={id} className={triggerClassName} aria-label={title}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        drawerTitle={title}
        className={contentClassName}
        data-product={product}
        position="popper"
        align="end"
        sideOffset={4}
      >
        {DATE_FORMATS.map((option) => (
          <SelectItem key={option} value={option}>
            {dateFormatLabel(option, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
