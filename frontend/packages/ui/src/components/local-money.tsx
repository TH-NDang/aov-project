import type { ReactNode } from "react"
import {
  formatCompactMoney,
  formatMoney,
  formatRate,
  normalizeCurrency,
  parseMoneyNumber,
  parsePrizeText,
  resolveMoney,
  toMoneyAmounts,
  useExchangeRates,
  useUserCurrency,
  type MoneyInput,
} from "../lib/currency"
import { formatCalendarDate } from "../lib/time-zone"
import { ValueReveal } from "./value-reveal"

type LocalMoneyProps = {
  /** The same prize in every unit it was recorded in, such as its dollars and its local amount. */
  amounts: readonly MoneyInput[]
  /** The yyyy-mm-dd day whose rate applies, usually when the prize was awarded. Without one, the newest rate applies. */
  on?: string | null
  /** For tight spaces: "$1.2K" instead of "1.234 USD". */
  compact?: boolean
  locale?: string
  /** Shown when there is no amount. */
  fallback?: ReactNode
  className?: string
}

/**
 * An amount shown in the user's chosen currency, with dashes underneath. Hovering, tapping or focusing it reveals the
 * original amount and the date of the rate. An amount already in that currency reads as plain text, and an amount with
 * no rate keeps its original unit, since a missing rate must never become a wrong number.
 */
export function LocalMoney({
  amounts,
  on,
  compact = false,
  locale = "vi-VN",
  fallback = null,
  className,
}: LocalMoneyProps) {
  const target = useUserCurrency()
  const originals = toMoneyAmounts(amounts)
  const needsRates = !!originals.length && !originals.some((money) => normalizeCurrency(money.currency) === target)
  const rates = useExchangeRates(on, needsRates)
  if (!originals.length) return <>{fallback}</>

  const english = locale.startsWith("en")
  const write = compact ? formatCompactMoney : formatMoney
  const resolved = resolveMoney(originals, target, rates)
  const original = originals.map((money) => formatMoney(money.amount, money.currency, locale)).join(" · ")

  if (resolved.kind === "original" || (resolved.kind === "same" && originals.length === 1))
    return (
      <span className={className}>
        {originals.map((money) => write(money.amount, money.currency, locale)).join(" · ")}
      </span>
    )

  const originalTitle = english ? "Original amount" : "Số tiền gốc"
  const shown = resolved.shown
  const exact = formatMoney(shown.amount, shown.currency, locale)
  const rateDate = resolved.kind === "converted" ? formatCalendarDate(resolved.rateDate, undefined, locale) : null
  const rateTitle = `${english ? "Rate on" : "Tỷ giá ngày"} ${rateDate}`

  return (
    <ValueReveal
      className={className ? `local-money ${className}` : "local-money"}
      hiddenText={` (${originalTitle}: ${original}${rateDate ? `, ${rateTitle}` : ""})`}
      popupLabel={originalTitle}
      popup={
        <>
          <div className="local-time-popup-row">
            <span>{originalTitle}</span>
            <strong>{original}</strong>
          </div>
          {compact && (
            <div className="local-time-popup-row">
              <span>{english ? "Your currency" : "Đơn vị của bạn"}</span>
              <strong>{exact}</strong>
            </div>
          )}
          {resolved.kind === "converted" && (
            <div className="local-time-popup-row">
              <span>{rateTitle}</span>
              <strong>
                {formatRate(
                  normalizeCurrency(resolved.source.currency) as string,
                  shown.currency,
                  resolved.rate,
                  locale,
                )}
              </strong>
            </div>
          )}
        </>
      }
    >
      {write(shown.amount, shown.currency, locale)}
    </ValueReveal>
  )
}

/** The words of a prize pool that is not a plain amount, with its unit unless the words already name it. */
function writtenPrize(text: string, currency: string | null | undefined, locale: string) {
  const unit = currency?.trim() ?? ""
  const number = parseMoneyNumber(text)
  const words = number === null ? text : number.toLocaleString(locale)
  return unit && !text.toLowerCase().includes(unit.toLowerCase()) ? `${words} ${unit}` : words
}

type LocalPrizeTextProps = Omit<LocalMoneyProps, "amounts" | "fallback"> & {
  /** Free text such as "6,650,000,000 vnd" or "948 USD · 22,000,000 vnd". */
  text: string
  /** The unit of a part that does not name its own. */
  currency?: string | null
}

/** A prize pool written as text. Text that cannot be read with certainty stays exactly as written. */
export function LocalPrizeText({ text, currency, locale = "vi-VN", className, ...rest }: LocalPrizeTextProps) {
  const amounts = parsePrizeText(text, currency)
  if (!amounts) return <span className={className}>{writtenPrize(text, currency, locale)}</span>
  return <LocalMoney amounts={amounts} locale={locale} className={className} {...rest} />
}
