import assert from "node:assert/strict"
import { test } from "node:test"
import {
  COMMON_CURRENCIES,
  chooseCurrency,
  convertMoney,
  currencyChoice,
  currencyDigits,
  currencyLabel,
  currentCurrency,
  deviceCurrency,
  formatCompactMoney,
  formatMoney,
  formatRate,
  isCommonCurrency,
  normalizeCurrency,
  parseMoneyNumber,
  parsePrizeText,
  resolveMoney,
  toMoneyAmounts,
} from "../src/lib/currency.ts"

const rates = {
  VND: { unitsPerUsd: 25761, rateDate: "2026-11-02" },
  THB: { unitsPerUsd: 33.753, rateDate: "2026-11-02" },
  IDR: { unitsPerUsd: 18140, rateDate: "2026-10-30" },
  TWD: { unitsPerUsd: 32.496, rateDate: "2026-11-02" },
}
// Number formats put a no-break space or thin space where a plain space reads the same.
const plain = (text) => text.replace(/[  ]/g, " ")

test("an amount converts through the dollar in either direction", () => {
  assert.equal(convertMoney(1000, "USD", "VND", rates).amount, 25761000)
  assert.equal(convertMoney(25761000, "VND", "USD", rates).amount, 1000)
  assert.equal(convertMoney(1000000, "VND", "THB", rates).amount, 1310.24)
})

test("rounding follows the currency: VND, IDR and TWD have no decimals", () => {
  assert.equal(convertMoney(1.2345, "USD", "VND", rates).amount, 31802)
  assert.equal(Number.isInteger(convertMoney(10.5, "USD", "IDR", rates).amount), true)
  assert.equal(Number.isInteger(convertMoney(10.5, "USD", "TWD", rates).amount), true)
  assert.equal(convertMoney(123456, "VND", "USD", rates).amount, 4.79, "dollars keep cents")
  assert.equal(currencyDigits("VND"), 0)
  assert.equal(currencyDigits("USD"), 2)
  assert.equal(currencyDigits("JPY"), 0)
  assert.equal(formatMoney(1234.5, "VND"), "1.235 VND")
  assert.equal(formatMoney(1000, "USD"), "1.000 USD")
  assert.equal(formatMoney(1234.5, "USD"), "1.234,50 USD")
  assert.equal(formatMoney(86193.9, "usd", "en-US"), "86,193.90 USD")
})

test("a missing rate gives no conversion instead of a wrong number", () => {
  assert.equal(convertMoney(1000, "USD", "JPY", rates), null)
  assert.equal(convertMoney(1000, "JPY", "USD", rates), null)
  assert.equal(convertMoney(1000, "VND", "JPY", rates), null)
  assert.equal(convertMoney(1000, "USD", "VND", {}), null)
})

test("the rate date is the older of the two rates involved", () => {
  assert.equal(convertMoney(1000, "USD", "VND", rates).rateDate, "2026-11-02")
  assert.equal(convertMoney(1000, "VND", "IDR", rates).rateDate, "2026-10-30")
})

test("a rate is written from the stronger unit", () => {
  assert.equal(formatRate("USD", "VND", 25761), "1 USD = 25.761 VND")
  assert.equal(formatRate("VND", "USD", 1 / 25761), "1 USD = 25.761 VND")
  assert.equal(formatRate("THB", "USD", 1 / 33.753, "en-US"), "1 USD = 33.753 THB")
})

test("a prize reads from a unit the reader already uses, otherwise from its dollars", () => {
  const both = [
    { amount: 948, currency: "USD" },
    { amount: 22000000, currency: "vnd" },
  ]
  assert.deepEqual(resolveMoney(both, "VND", rates), { kind: "same", shown: both[1] })
  assert.deepEqual(resolveMoney(both, "USD", rates), { kind: "same", shown: both[0] })

  const thai = resolveMoney(both, "THB", rates)
  assert.equal(thai.kind, "converted")
  assert.equal(thai.source, both[0], "the dollars need one rate fewer")
  assert.deepEqual(thai.shown, { amount: 31997.84, currency: "THB" })
})

test("a prize keeps its original unit when nothing can convert it", () => {
  const amounts = [{ amount: 1000, currency: "EUR" }]
  assert.deepEqual(resolveMoney(amounts, "VND", rates), { kind: "original" }, "no rate for this unit")
  assert.deepEqual(resolveMoney(amounts, "VND", undefined), { kind: "original" }, "rates have not loaded")
  assert.deepEqual(resolveMoney([{ amount: 1000, currency: "nội tệ" }], "VND", rates), { kind: "original" })
})

test("a prize converts from the second unit when the first has no rate", () => {
  const amounts = [
    { amount: 1000, currency: "EUR" },
    { amount: 5000, currency: "THB" },
  ]
  const shown = resolveMoney(amounts, "VND", rates)
  assert.equal(shown.kind, "converted")
  assert.equal(shown.source, amounts[1])
})

test("empty prize fields are left out", () => {
  assert.deepEqual(
    toMoneyAmounts([
      { amount: null, currency: "USD" },
      { amount: undefined, currency: "USD" },
      { amount: Number.NaN, currency: "USD" },
      { amount: 10, currency: null },
      { amount: 0, currency: "USD" },
    ]),
    [{ amount: 0, currency: "USD" }],
  )
})

test("written amounts are read both ways people write them", () => {
  assert.equal(parseMoneyNumber("6650000000"), 6650000000)
  assert.equal(parseMoneyNumber("6,650,000,000"), 6650000000)
  assert.equal(parseMoneyNumber("6.650.000.000"), 6650000000)
  assert.equal(parseMoneyNumber("25,127.37"), 25127.37)
  assert.equal(parseMoneyNumber("25.127,37"), 25127.37)
  assert.equal(parseMoneyNumber("227.79"), 227.79)
  assert.equal(parseMoneyNumber("227,79"), 227.79)
  assert.equal(parseMoneyNumber("2.5"), 2.5)
  assert.equal(parseMoneyNumber("1.500"), 1500, "three digits after one separator is a thousands group")
  assert.equal(parseMoneyNumber("1,500"), 1500)
})

test("a written amount that is not certain is not read at all", () => {
  const uncertain = ["", "abc", "1,50,000", "12,34,567", "1.000,000", "1,000,000.50.1", "1.2.3", "1000,", "1,000.000,5"]
  for (const text of [...uncertain, ".5", "1000.500", "1.2345"]) assert.equal(parseMoneyNumber(text), null, text)
})

test("prize pools from the data read as amounts in their own units", () => {
  assert.deepEqual(parsePrizeText("6,650,000,000 vnd", "vnd"), [{ amount: 6650000000, currency: "VND" }])
  assert.deepEqual(parsePrizeText("948 USD · 22,000,000 vnd", "USD"), [
    { amount: 948, currency: "USD" },
    { amount: 22000000, currency: "VND" },
  ])
  assert.deepEqual(parsePrizeText("6650000000", "VND"), [{ amount: 6650000000, currency: "VND" }], "typed in Admin")
  assert.deepEqual(parsePrizeText("500", "thb"), [{ amount: 500, currency: "THB" }], "the unit may come from the plan")
})

test("a prize pool that cannot be read stays as text", () => {
  assert.equal(parsePrizeText("100 triệu", "VND"), null)
  assert.equal(parsePrizeText("Hơn 1 tỷ đồng", "VND"), null)
  assert.equal(parsePrizeText("1000", null), null, "no unit to read it in")
  assert.equal(parsePrizeText("1000", "nội tệ"), null)
  assert.equal(parsePrizeText("1000 USD · chưa rõ", "USD"), null, "one unreadable part leaves the whole as written")
  assert.equal(parsePrizeText("", "VND"), null)
  assert.equal(parsePrizeText(null, "VND"), null)
})

test("the short form keeps the look each currency's readers use", () => {
  assert.equal(formatCompactMoney(1234, "USD"), "$1.2K")
  assert.equal(plain(formatCompactMoney(23216000, "VND")), "23 Tr ₫")
  assert.equal(plain(formatCompactMoney(38500000000, "VND")), "39 T ₫")
  assert.equal(plain(formatCompactMoney(1500000000, "VND")), "1,5 T ₫")
  assert.equal(formatCompactMoney(1234, "THB"), "฿1.2K")
  assert.equal(formatCompactMoney(1234, "TWD"), "NT$1.2K")
  assert.equal(plain(formatCompactMoney(2300000, "IDR")), "Rp 2.3M")
})

test("a label that is not a currency still reads with its amount", () => {
  assert.equal(formatMoney(10000, "nội tệ"), "10.000 nội tệ")
  assert.equal(formatCompactMoney(10000, "nội tệ"), "10.000 nội tệ")
  assert.equal(normalizeCurrency("nội tệ"), null)
  assert.equal(normalizeCurrency(" vnd "), "VND")
  assert.equal(normalizeCurrency(null), null)
})

test("a locale the browser does not know falls back instead of throwing", () => {
  assert.equal(formatMoney(1000, "USD", "not a locale"), "1.000 USD")
})

test("the settings list holds the common currencies, each with a readable name", () => {
  assert.deepEqual(
    COMMON_CURRENCIES.map((currency) => currency.code),
    ["VND", "USD", "THB", "TWD", "IDR"],
  )
  assert.equal(currencyLabel("VND"), "VND · Việt Nam")
  assert.equal(currencyLabel("VND", "en-US"), "VND · Vietnam")
  assert.equal(currencyLabel("EUR"), "EUR")
  assert.equal(isCommonCurrency("idr"), true)
  assert.equal(isCommonCurrency("EUR"), false)
})

test("a choice wins over the device, survives a visit and clears back to the device", async () => {
  const values = new Map()
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
  try {
    await chooseCurrency(null)
    assert.equal(currencyChoice(), null)
    assert.equal(currentCurrency(), deviceCurrency())

    await chooseCurrency("THB")
    assert.equal(currentCurrency(), "THB")
    assert.deepEqual([...values.values()], ["THB"], "kept for the next visit")

    await chooseCurrency("idr")
    assert.equal(currentCurrency(), "IDR", "stored under the code the list uses")

    await chooseCurrency("EUR")
    assert.equal(currencyChoice(), null, "a currency outside the list falls back to the device")
    assert.equal(values.size, 0)
  } finally {
    delete globalThis.localStorage
  }
})
