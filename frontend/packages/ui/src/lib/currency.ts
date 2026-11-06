import { useEffect, useSyncExternalStore } from "react"
import { createAccountPreference } from "@aov/ui/lib/account-preference"
import { usableLocale } from "@aov/ui/lib/time-zone"

/** The currencies offered in settings: the project's markets and the dollar. Prizes can be recorded in any other. */
export const COMMON_CURRENCIES: readonly { code: string; vi: string; en: string }[] = [
  { code: "VND", vi: "Việt Nam", en: "Vietnam" },
  { code: "USD", vi: "Hoa Kỳ", en: "United States" },
  { code: "THB", vi: "Thái Lan", en: "Thailand" },
  { code: "TWD", vi: "Đài Loan", en: "Taiwan" },
  { code: "IDR", vi: "Indonesia", en: "Indonesia" },
]

const DEFAULT_CURRENCY = "USD"
const REGION_CURRENCIES: Record<string, string> = { VN: "VND", US: "USD", TH: "THB", TW: "TWD", ID: "IDR" }
/** ISO 4217 gives these two decimals, but their amounts are written in whole units. */
const WHOLE_UNITS = new Set(["VND", "IDR", "TWD"])

/** Data holds codes in any case, and sometimes a word for "local currency" that nobody can convert. */
export function normalizeCurrency(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim().toUpperCase() : null
}

export const isCommonCurrency = (value: unknown) =>
  COMMON_CURRENCIES.some((currency) => currency.code === normalizeCurrency(value))

/** The code with its market, short enough for a settings row, or the code alone outside the common list. */
export function currencyLabel(code: string, locale = "vi-VN") {
  const known = COMMON_CURRENCIES.find((currency) => currency.code === code)
  return known ? `${code} · ${locale.startsWith("en") ? known.en : known.vi}` : code
}

let deviceChoice: string | undefined

/** Read once per page. A device outside the listed markets reads prizes in dollars, the widest understood unit. */
export function deviceCurrency() {
  if (deviceChoice !== undefined) return deviceChoice
  deviceChoice = DEFAULT_CURRENCY
  const languages =
    typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    try {
      const region = new Intl.Locale(language).maximize().region
      if (region && REGION_CURRENCIES[region]) {
        deviceChoice = REGION_CURRENCIES[region]
        break
      }
    } catch {
      // Try the next preferred language when an entry is malformed.
    }
  }
  return deviceChoice
}

const preference = createAccountPreference({
  storageKey: "aov:currency:v1",
  read: (value) => (isCommonCurrency(value) ? normalizeCurrency(value) : null),
  accountValue: deviceCurrency,
})

/** The currency the user picked, or null while they follow their device. */
export const currencyChoice = preference.choice

/** The currency every amount is shown in: the user's choice, otherwise the one of their device. */
export const currentCurrency = () => currencyChoice() ?? deviceCurrency()

export const useCurrencyChoice = preference.useChoice

export const useUserCurrency = () => useSyncExternalStore(preference.subscribe, currentCurrency, currentCurrency)

export const useCurrencySaveFailed = preference.useSaveFailed

/** Applies a choice from a settings control at once, keeps it across visits and saves it to a signed-in profile. */
export const chooseCurrency = preference.choose

/**
 * Connects the signed-in profile (`user_profile.profile.currency`), which is shared across the apps. A profile saved
 * before this setting existed holds no currency, so it keeps this browser's choice and receives the next one.
 */
export function useAccountCurrency(
  profile: { id: string | null; currency?: string | null } | null | undefined,
  save?: (currency: string) => Promise<unknown>,
) {
  preference.useAccount(profile?.id ? profile.currency : null, !!profile?.id, save)
}

const digitsByCurrency = new Map<string, number>()

/** How many decimals a currency is written with. VND, IDR and TWD have none. */
export function currencyDigits(currency: string) {
  if (WHOLE_UNITS.has(currency)) return 0
  let digits = digitsByCurrency.get(currency)
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits
    } catch {
      // A free-text label is not a currency to look up.
    }
    digits ??= 2
    digitsByCurrency.set(currency, digits)
  }
  return digits
}

function roundToCurrency(amount: number, currency: string) {
  const scale = 10 ** currencyDigits(currency)
  return Math.round(amount * scale) / scale
}

const formatters = new Map<string, Intl.NumberFormat>()

function numberFormat(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`
  let cached = formatters.get(key)
  if (!cached) {
    // A stored locale this browser does not know must not take the page down.
    cached = new Intl.NumberFormat(usableLocale(locale), options)
    formatters.set(key, cached)
  }
  return cached
}

/** Whole amounts drop their decimals; others keep the currency's own, so "1.000 USD" and "1.234,50 USD" both read well. */
export function formatMoney(amount: number, currency: string, locale = "vi-VN") {
  const code = normalizeCurrency(currency)
  const digits = currencyDigits(code ?? currency)
  const rounded = roundToCurrency(amount, code ?? currency)
  const number = numberFormat(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(rounded)
  return `${number} ${code ?? currency}`
}

/**
 * A short form for tight spaces: "$1.2K", "23 Tr ₫". Each currency keeps the form its readers use, so the reader's
 * locale does not apply. TWD needs its full symbol because the narrow one is a bare dollar sign. VND and IDR run long
 * and would lose the unit that says millions or billions when cut, so they keep two digits.
 */
export function formatCompactMoney(amount: number, currency: string, locale = "vi-VN") {
  const code = normalizeCurrency(currency)
  if (!code) return formatMoney(amount, currency, locale)
  return numberFormat(code === "VND" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: code,
    notation: "compact",
    ...(code === "VND" || code === "IDR" ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: 1 }),
    currencyDisplay: code === "TWD" ? "symbol" : "narrowSymbol",
  }).format(amount)
}

export type ExchangeRate = { unitsPerUsd: number; rateDate: string }
/** Rates by currency for one day. The dollar is the base and has no entry. */
export type ExchangeRateTable = Readonly<Record<string, ExchangeRate>>

export type Conversion = {
  amount: number
  /** Units of the new currency for one unit of the old. */
  rate: number
  /** The older of the two dates involved, since that is how old the result can be. */
  rateDate: string
}

/** Returns null when a rate is missing, so callers keep the original amount instead of showing a wrong one. */
export function convertMoney(amount: number, from: string, to: string, rates: ExchangeRateTable): Conversion | null {
  const source = from === "USD" ? null : rates[from]
  const target = to === "USD" ? null : rates[to]
  if ((from !== "USD" && !source) || (to !== "USD" && !target) || (!source && !target)) return null
  const rate = (target?.unitsPerUsd ?? 1) / (source?.unitsPerUsd ?? 1)
  const dates = [source?.rateDate, target?.rateDate].filter((date): date is string => !!date).sort()
  return { amount: roundToCurrency(amount * rate, to), rate, rateDate: dates[0] }
}

/** "1 USD = 25.761 VND", written from the stronger unit so it never reads as 0,00004. */
export function formatRate(from: string, to: string, rate: number, locale = "vi-VN") {
  const [strong, weak, value] = rate >= 1 ? [from, to, rate] : [to, from, 1 / rate]
  return `1 ${strong} = ${numberFormat(locale, { maximumSignificantDigits: 6 }).format(value)} ${weak}`
}

export type MoneyAmount = { amount: number; currency: string }
/** Fields as they arrive from the API, where a prize often has one of its units empty. */
export type MoneyInput = { amount?: number | null; currency?: string | null }

export const toMoneyAmounts = (inputs: readonly MoneyInput[]): MoneyAmount[] =>
  inputs.flatMap(({ amount, currency }) =>
    typeof amount === "number" && Number.isFinite(amount) && currency ? [{ amount, currency }] : [],
  )

export type ResolvedMoney =
  | { kind: "original" }
  | { kind: "same"; shown: MoneyAmount }
  | { kind: "converted"; shown: MoneyAmount; source: MoneyAmount; rate: number; rateDate: string }

/**
 * Picks what to show for a prize recorded in one or more units. A unit the reader already uses needs no conversion.
 * Otherwise the dollar amount is converted first, because it needs the fewest rates.
 */
export function resolveMoney(
  originals: readonly MoneyAmount[],
  target: string,
  rates: ExchangeRateTable | undefined,
): ResolvedMoney {
  const same = originals.find((money) => normalizeCurrency(money.currency) === target)
  if (same) return { kind: "same", shown: same }
  if (!rates) return { kind: "original" }

  const sources = [...originals].sort(
    (left, right) =>
      Number(normalizeCurrency(right.currency) === "USD") - Number(normalizeCurrency(left.currency) === "USD"),
  )
  for (const source of sources) {
    const from = normalizeCurrency(source.currency)
    const conversion = from ? convertMoney(source.amount, from, target, rates) : null
    if (conversion)
      return {
        kind: "converted",
        shown: { amount: conversion.amount, currency: target },
        source,
        rate: conversion.rate,
        rateDate: conversion.rateDate,
      }
  }
  return { kind: "original" }
}

/**
 * Reads a written amount. Three digits after a single separator are a thousands group in both ways people write
 * numbers here, because a prize of "1.500" means one thousand five hundred, never one and a half.
 */
export function parseMoneyNumber(text: string): number | null {
  const value = text.trim()
  if (!/^\d[\d.,]*$/.test(value)) return null

  const separators = value.replace(/\d/g, "")
  let digits: string
  if (!separators) digits = value
  else if (new Set(separators).size === 2) {
    // The last separator marks the decimals: 25,127.37 or 25.127,37.
    const decimal = separators.at(-1) as string
    const group = decimal === "." ? "," : "."
    const [whole, fraction] = value.split(decimal)
    if (separators.indexOf(decimal) !== separators.length - 1 || !fraction || fraction.length > 2) return null
    if (!isGrouped(whole, group)) return null
    digits = `${whole.replaceAll(group, "")}.${fraction}`
  } else if (separators.length > 1) {
    if (!isGrouped(value, separators[0])) return null
    digits = value.replaceAll(separators[0], "")
  } else {
    const [whole, fraction] = value.split(separators)
    if (!fraction || fraction.length > 3 || (fraction.length === 3 && whole.length > 3)) return null
    digits = fraction.length === 3 ? whole + fraction : `${whole}.${fraction}`
  }

  const amount = Number(digits)
  return Number.isFinite(amount) ? amount : null
}

const isGrouped = (value: string, separator: string) => {
  const [first, ...groups] = value.split(separator)
  return first.length >= 1 && first.length <= 3 && groups.every((group) => group.length === 3)
}

/**
 * A prize pool is free text: "6,650,000,000 vnd" or "948 USD · 22,000,000 vnd". Returns null when any part cannot be
 * read with certainty, so the text stays as it was written.
 */
export function parsePrizeText(text: string | null | undefined, currency?: string | null): MoneyAmount[] | null {
  const parts = (text ?? "").split("·").map((part) => part.trim())
  const amounts: MoneyAmount[] = []
  for (const part of parts) {
    const match = part.match(/^(\d[\d.,]*)\s*([A-Za-z]{3})?$/)
    const amount = match ? parseMoneyNumber(match[1]) : null
    const unit = normalizeCurrency(match?.[2]) ?? normalizeCurrency(currency)
    if (amount === null || !unit) return null
    amounts.push({ amount, currency: unit })
  }
  return amounts.length ? amounts : null
}

const RATES_PATH = "/api/community/v1/exchange-rates"
const MAX_DAYS_PER_REQUEST = 60
const RETRY_AFTER = 60_000
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

const tables = new Map<string, ExchangeRateTable>()
const loading = new Set<string>()
const failedAt = new Map<string, number>()
const queue = new Set<string>()
const rateListeners = new Set<() => void>()
let flushing: ReturnType<typeof setTimeout> | null = null

function subscribeRates(listener: () => void) {
  rateListeners.add(listener)
  return () => {
    rateListeners.delete(listener)
  }
}

type RatesResponse = {
  days?: { on?: string; rates?: { currency?: string; unitsPerUsd?: number; rateDate?: string }[] }[]
}

function tableOf(rates: NonNullable<RatesResponse["days"]>[number]["rates"]): ExchangeRateTable {
  const table: Record<string, ExchangeRate> = {}
  for (const { currency, unitsPerUsd, rateDate } of rates ?? []) {
    const code = normalizeCurrency(currency)
    if (code && typeof unitsPerUsd === "number" && unitsPerUsd > 0 && rateDate && CALENDAR_DAY.test(rateDate))
      table[code] = { unitsPerUsd, rateDate }
  }
  return table
}

async function loadRates(days: string[]) {
  try {
    const response = await fetch(`${RATES_PATH}?on=${days.join(",")}`, {
      credentials: "omit",
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as RatesResponse
    for (const day of body.days ?? []) if (day.on) tables.set(day.on, tableOf(day.rates))
    // A day the answer leaves out has no rates, which is an answer and needs no second request.
    for (const day of days) if (!tables.has(day)) tables.set(day, {})
  } catch {
    // Amounts keep their original unit. A later mount asks again once RETRY_AFTER has passed.
    for (const day of days) failedAt.set(day, Date.now())
  } finally {
    for (const day of days) loading.delete(day)
    rateListeners.forEach((listener) => listener())
  }
}

function flushQueue() {
  flushing = null
  const days = [...queue]
  queue.clear()
  for (let start = 0; start < days.length; start += MAX_DAYS_PER_REQUEST)
    void loadRates(days.slice(start, start + MAX_DAYS_PER_REQUEST))
}

/** Waits for the rest of the render, so a list of prizes asks for all of its days in one request. */
function requestRates(day: string) {
  if (tables.has(day) || loading.has(day)) return
  const failed = failedAt.get(day)
  if (failed !== undefined && Date.now() - failed < RETRY_AFTER) return
  loading.add(day)
  queue.add(day)
  flushing ??= setTimeout(flushQueue, 0)
}

/** Today in UTC. The server answers with the newest rate on or before a day, so a clock that is ahead does no harm. */
const today = () => new Date().toISOString().slice(0, 10)

/**
 * The rates that applied on a day, so an old prize reads at the rate of its own time. Without a day it reads at the
 * newest rates. The result is undefined until they load or when they cannot be loaded.
 */
export function useExchangeRates(on: string | null | undefined, enabled = true) {
  const day = on && CALENDAR_DAY.test(on) ? on : today()
  useEffect(() => {
    if (enabled) requestRates(day)
  }, [day, enabled])
  const read = () => (enabled ? tables.get(day) : undefined)
  return useSyncExternalStore(subscribeRates, read, read)
}
