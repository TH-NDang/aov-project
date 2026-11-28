import type { PatchSource } from "@/lib/api/publishing-api"
import { REGION_LABELS, CHANNEL_LABELS, isWebAddress } from "../../../patch-watch/patch-watch-model"
import type { PatchNotePost } from "../../../patch-watch/patch-watch-api"

/** How many links a patch keeps; the server refuses more. */
export const MAX_PATCH_SOURCES = 20
export const MAX_SOURCE_LABEL = 80

/** The languages a source page is offered in, by the tag the server keeps. */
export const SOURCE_LANGUAGES = [
  { code: "vi-VN", label: "Tiếng Việt" },
  { code: "en", label: "English" },
  { code: "th-TH", label: "ภาษาไทย" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "id-ID", label: "Bahasa Indonesia" },
] as const

const REGION_LOCALES: Partial<Record<PatchNotePost["region"], string>> = { VN: "vi-VN", TH: "th-TH", TW: "zh-TW" }

/** The markets a source page can come from, in the order the patch lists them. */
export const SOURCE_MARKETS = [
  { code: "VN", label: "Việt Nam" },
  { code: "TH", label: "Thái Lan" },
  { code: "TW", label: "Đài Loan" },
  { code: "ID", label: "Indonesia" },
] as const

/** A row of the sources form: a link being written, with the key React keeps it by. */
export interface SourceRow extends PatchSource {
  key: string
}

/** A post the patch watch found, as a link the editor can add with one press. */
export function sourceFromPost(post: Pick<PatchNotePost, "url" | "region" | "channel">): PatchSource {
  const label =
    REGION_LABELS[post.region] + (post.channel === "EXPERIMENTAL" ? ` · ${CHANNEL_LABELS.EXPERIMENTAL}` : "")
  const region = post.region === "OTHER" ? null : post.region
  return { url: post.url, label, locale: REGION_LOCALES[post.region] ?? null, region }
}

/** What is wrong with a row, said so the editor knows what to change; null when it can be saved. */
export function sourceProblem(row: PatchSource, rows: PatchSource[]) {
  if (!row.label.trim()) return "Ghi nhãn, ví dụ Tiếng Việt hoặc Thái Lan."
  if (row.label.trim().length > MAX_SOURCE_LABEL) return `Nhãn dài tối đa ${MAX_SOURCE_LABEL} ký tự.`
  if (!isWebAddress(row.url)) return "Dán link http(s) của trang ghi chú."
  const url = row.url.trim()
  if (rows.findIndex((other) => other.url.trim() === url) !== rows.indexOf(row)) return "Link này đã có ở trên."
  return null
}

/** The rows as the server takes them: trimmed, and without a language or market when none was picked. */
export function sourcesToSave(rows: PatchSource[]): PatchSource[] {
  return rows.map((row) => ({
    url: row.url.trim(),
    label: row.label.trim(),
    locale: row.locale || null,
    region: row.region || null,
  }))
}

/** The name of a market in words, for chips and headings. */
export function sourceMarket(region: string | null | undefined) {
  return SOURCE_MARKETS.find((market) => market.code === region)?.label ?? null
}

/** The first page a market published, which its release cites. */
export function marketSourceUrl(sources: PatchSource[], region: string) {
  return sources.find((source) => source.region === region)?.url ?? null
}

/** The language of a link in words, for its chip. */
export function sourceLanguage(locale: string | null) {
  return SOURCE_LANGUAGES.find((language) => language.code === locale)?.label ?? null
}

/** The shared link an entry recorded by hand starts from: the page in the language being written, else the first. */
export function preferredSourceUrl(sources: PatchSource[], locale: string) {
  return (sources.find((source) => source.locale === locale) ?? sources[0])?.url ?? null
}
