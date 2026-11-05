import type { CompetitionPlan } from "@aov/community-contracts"
import { normalize } from "@/lib/text"

export type CompetitionOption = { value: string; label: string; keywords?: string; detail?: string }

export function textOptions(values: string[]): CompetitionOption[] {
  const unique = new Map<string, string>()
  for (const value of values) {
    const text = value.trim()
    if (text && !unique.has(normalize(text))) unique.set(normalize(text), text)
  }
  return Array.from(unique.values(), (value) => ({ value, label: value }))
}

export const circuitOptions: CompetitionOption[] = [
  {
    value: "Đấu Trường Danh Vọng (Arena of Glory)",
    label: "Đấu Trường Danh Vọng",
    keywords: "AOG Arena of Glory",
    detail: "AOG · Việt Nam",
  },
  {
    value: "Arena of Valor International Championship",
    label: "Arena of Valor International Championship",
    keywords: "AIC",
    detail: "AIC",
  },
  { value: "Arena of Valor Premier League", label: "Arena of Valor Premier League", keywords: "APL", detail: "APL" },
  { value: "RoV Pro League", label: "RoV Pro League", keywords: "RPL", detail: "RPL · Thái Lan" },
  { value: "Garena Challenger Series", label: "Garena Challenger Series", keywords: "GCS", detail: "GCS · Đài Loan" },
]

const currencyNames = new Intl.DisplayNames(["vi"], { type: "currency" })
export const currencyOptions: CompetitionOption[] = Array.from(
  new Set(["VND", "USD", "THB", "TWD", "IDR", "CNY", "EUR", ...Intl.supportedValuesOf("currency")]),
  (value) => ({ value, label: `${value} · ${currencyNames.of(value) || value}` }),
)

const commonTimezones: CompetitionOption[] = [
  { value: "Asia/Ho_Chi_Minh", label: "Việt Nam · TP. Hồ Chí Minh", keywords: "Hà Nội Hanoi Vietnam UTC+7 GMT+7" },
  { value: "Asia/Bangkok", label: "Thái Lan · Bangkok", keywords: "Thailand UTC+7 GMT+7" },
  { value: "Asia/Taipei", label: "Đài Loan · Đài Bắc", keywords: "Taiwan UTC+8 GMT+8" },
  { value: "Asia/Jakarta", label: "Indonesia · Jakarta", keywords: "UTC+7 GMT+7" },
  { value: "Asia/Singapore", label: "Singapore", keywords: "UTC+8 GMT+8" },
  { value: "UTC", label: "UTC · Giờ quốc tế" },
]
export const competitionTimezoneOptions: CompetitionOption[] = [
  ...commonTimezones,
  ...Intl.supportedValuesOf("timeZone")
    .filter((value) => !commonTimezones.some((option) => option.value === value))
    .map((value) => ({ value, label: value.replaceAll("_", " ").replaceAll("/", " / ") })),
].map((option) => ({ ...option, detail: option.value }))

export const cityOptions = textOptions([
  "Thành phố Hồ Chí Minh",
  "Hà Nội",
  "Đà Nẵng",
  "Bangkok",
  "Đài Bắc",
  "Jakarta",
  "Singapore",
])
export const stageNameOptions = textOptions([
  "Vòng loại",
  "Vòng bảng",
  "Vòng bảng 1",
  "Vòng bảng 2",
  "Playoffs",
  "Chung kết",
])
export const bestOfOptions: CompetitionOption[] = [1, 3, 5, 7, 9].map((value) => ({
  value: String(value),
  label: `BO${value} · Thắng ${Math.ceil(value / 2)} ván`,
}))

/** Existing references stay visible until an editor explicitly replaces them. */
export function venueStageOptions(stages: CompetitionPlan["stages"], current: string): CompetitionOption[] {
  const options = stages.map((stage) => ({ value: stage.code, label: stage.name || stage.code }))
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: `${current} · giai đoạn chưa có trong giải` })
  }
  return options
}
