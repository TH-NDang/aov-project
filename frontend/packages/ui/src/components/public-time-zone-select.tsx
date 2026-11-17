import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./public-select"
import {
  COMMON_TIME_ZONES,
  browserTimeZone,
  chooseTimeZone,
  timeZoneLabel,
  useTimeZoneChoice,
  useTimeZoneSaveFailed,
  utcOffsetLabel,
} from "../lib/time-zone"
import { isEnglishLocale, localeText } from "@aov/ui/lib/locale-text"

const FOLLOW_DEVICE = "device"
const deviceLabel = (locale: string) =>
  `${localeText(locale)("Theo thiết bị", "This device")} (${utcOffsetLabel(browserTimeZone())})`

/** Lets a reader pick the zone that times are shown in. Rendered inside the settings of each public app. */
export function PublicTimeZoneSelect({
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
  const choice = useTimeZoneChoice()
  const failed = useTimeZoneSaveFailed()
  const english = isEnglishLocale(locale)
  const title = english ? "Time zone" : "Múi giờ"
  const known = COMMON_TIME_ZONES.some((option) => option.value === choice)
  return (
    <>
      <Select
        value={choice ?? FOLLOW_DEVICE}
        onValueChange={(next) => void chooseTimeZone(next === FOLLOW_DEVICE ? null : next)}
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
          <SelectItem value={FOLLOW_DEVICE}>{deviceLabel(locale)}</SelectItem>
          {choice && !known && <SelectItem value={choice}>{timeZoneLabel(choice, Date.now(), locale)}</SelectItem>}
          {COMMON_TIME_ZONES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {timeZoneLabel(option.value, Date.now(), locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {failed && (
        <p className="public-account-error public-time-zone-error" role="alert">
          {english
            ? "Could not save to your account. Please try again."
            : "Chưa lưu được vào tài khoản. Vui lòng thử lại."}
        </p>
      )}
    </>
  )
}
