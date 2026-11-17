import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./public-select"
import {
  COMMON_CURRENCIES,
  chooseCurrency,
  currencyLabel,
  deviceCurrency,
  useCurrencyChoice,
  useCurrencySaveFailed,
} from "../lib/currency"
import { isEnglishLocale } from "@aov/ui/lib/locale-text"

const FOLLOW_DEVICE = "device"

/** Lets a reader pick the currency that amounts are shown in. Rendered inside the settings of each public app. */
export function PublicCurrencySelect({
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
  const choice = useCurrencyChoice()
  const failed = useCurrencySaveFailed()
  const english = isEnglishLocale(locale)
  const title = english ? "Currency" : "Tiền tệ"
  return (
    <>
      <Select
        value={choice ?? FOLLOW_DEVICE}
        onValueChange={(next) => void chooseCurrency(next === FOLLOW_DEVICE ? null : next)}
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
          <SelectItem value={FOLLOW_DEVICE}>
            {`${english ? "This device" : "Theo thiết bị"} (${deviceCurrency()})`}
          </SelectItem>
          {COMMON_CURRENCIES.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {currencyLabel(option.code, locale)}
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
