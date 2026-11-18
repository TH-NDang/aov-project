import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react"
import { ChevronDown, Languages, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { HeroLanguageIcon } from "../../../publishing/components/editing/hero-language-picker"
import { AdminRichTextPreview } from "../../../terminology/rich-text-field"
import { languageOptions } from "../../../users/profile-preference-picker"
import { control } from "../../../publishing/components/editing/fields"
import { joinWrappedLines } from "./warehouse-sheet"
import type { WarehouseTranslation } from "@aov/ui/lib/warehouse-content"

type Text = WarehouseTranslation

export const languageName = (code: string) => languageOptions.find((option) => option.value === code)?.label ?? code

/**
 * The language a page opens in: the account's own when the entry has it, otherwise English before Vietnamese, since
 * more readers share English than any other translation.
 */
export function pickDisplayLanguage(translations: Text[], account: string) {
  const has = (code: string) => translations.some((text) => text.locale === code)
  if (has(account)) return account
  if (has("en-US")) return "en-US"
  if (has("vi-VN")) return "vi-VN"
  return translations[0]?.locale ?? account
}

/** The language the others are translated from: Vietnamese when the entry has it, else its first language. */
export function baseLanguage(translations: Text[]) {
  return translations.some((text) => text.locale === "vi-VN") ? "vi-VN" : (translations[0]?.locale ?? "vi-VN")
}

/** How many of the base language's texts already have a translation in the target. */
export function translationProgress(
  translations: Text[],
  source: string,
  target: string,
  options: { summary?: boolean; statKeys?: string[]; variantKeys?: string[] } = {},
) {
  const from = translations.find((text) => text.locale === source)
  const to = translations.find((text) => text.locale === target)
  if (!from) return { done: 0, total: 0 }
  const pairs: [unknown, unknown][] = [
    [from.name, to?.name],
    ...(options.summary ? [[from.summary, to?.summary] as [unknown, unknown]] : []),
    [from.description, to?.description],
    ...(from.effects ?? []).map(
      (effect) =>
        [effect.description || effect.name, to?.effects?.find((entry) => entry.key === effect.key)?.description] as [
          unknown,
          unknown,
        ],
    ),
    ...(options.statKeys ?? []).map((key) => [from.statLabels?.[key], to?.statLabels?.[key]] as [unknown, unknown]),
    ...(options.variantKeys ?? []).map(
      (key) => [from.variantLabels?.[key], to?.variantLabels?.[key]] as [unknown, unknown],
    ),
  ]
  const needed = pairs.filter(([original]) => typeof original === "string" && original.trim())
  return {
    done: needed.filter(([, translated]) => typeof translated === "string" && translated.trim()).length,
    total: needed.length,
  }
}

/**
 * The language icon at the top of a sheet, drawn like the hero page's: the flag of the language the page reads and
 * edits in, a dot while it is not fully translated, and a menu with each language's progress and its own pencil.
 */
export function LanguagePicker({
  translations,
  value,
  onChange,
  progress,
  disabled,
  onEdit,
}: {
  translations: Text[]
  value: string
  onChange: (language: string) => void
  progress: (language: string) => { done: number; total: number }
  disabled?: boolean
  /** Starts writing in a language straight from its row; offered while the version is a draft. */
  onEdit?: (language: string) => void
}) {
  const base = baseLanguage(translations)
  const baseTotal = progress(base).total
  const state = (code: string) => {
    const written = translations.some((text) => text.locale === code)
    if (code === base) return { done: baseTotal, total: baseTotal, label: "Ngôn ngữ gốc", complete: true }
    if (!written) return { done: 0, total: baseTotal, label: "Chưa có bản dịch", complete: false }
    const { done, total } = progress(code)
    const complete = done >= total
    return { done, total, label: complete ? "Đủ nội dung" : `Thiếu ${total - done} mục`, complete }
  }
  const current = state(value)
  const label = `Ngôn ngữ: ${languageName(value)}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 bg-background px-2"
          disabled={disabled}
          title={`${label} · ${current.label}`}
          aria-label={label}
          aria-description={current.label}
        >
          <HeroLanguageIcon locale={value} />
          {!current.complete && <span className="size-1.5 rounded-full bg-(--aov-warning)" aria-hidden />}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={16}
        className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl p-1.5"
      >
        <DropdownMenuLabel className="px-2.5 py-2">
          <span className="type-label block">Ngôn ngữ hiển thị nội dung</span>
          <span className="type-meta mt-0.5 block">Bút bên cạnh mở trang bằng ngôn ngữ đó để dịch.</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {languageOptions.map((option) => {
            const row = state(option.value)
            return (
              <div key={option.value} className="flex items-center gap-1">
                <DropdownMenuRadioItem
                  value={option.value}
                  textValue={option.label}
                  className="min-h-11 min-w-0 flex-1 gap-3 rounded-lg py-2.5 pr-2.5 data-[state=checked]:bg-accent/60"
                >
                  <HeroLanguageIcon locale={option.value} />
                  <span className="min-w-0 flex-1">
                    <span className="type-body block">{option.label}</span>
                    <span
                      className={`type-meta mt-0.5 block ${row.complete && row.total ? "text-(--aov-success)" : ""}`}
                    >
                      {row.label}
                    </span>
                  </span>
                  {!!row.total && (
                    <span className="type-meta shrink-0 tabular-nums" aria-label="Số mục đã dịch">
                      {row.done}/{row.total}
                    </span>
                  )}
                </DropdownMenuRadioItem>
                {onEdit && (
                  <DropdownMenuItem
                    className="size-9 shrink-0 justify-center rounded-lg p-0 text-muted-foreground"
                    aria-label={`Sửa bằng ${option.label}`}
                    title={`Sửa bằng ${option.label}`}
                    onSelect={() => onEdit(option.value)}
                  >
                    <Pencil />
                  </DropdownMenuItem>
                )}
              </div>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type Localized = { locale: string }

/*
 * The reference language chosen in any floating box. It is kept for the whole session, so moving to another field,
 * another part of the page or another entry shows the same language again.
 */
let chosenReference = ""
const referenceListeners = new Set<() => void>()
function chooseReference(language: string) {
  chosenReference = language
  referenceListeners.forEach((listener) => listener())
}
function useChosenReference() {
  return useSyncExternalStore(
    (listener) => {
      referenceListeners.add(listener)
      return () => referenceListeners.delete(listener)
    },
    () => chosenReference,
  )
}

const ReferenceContext = createContext<{ translations: Localized[]; editing: string } | null>(null)

/** The reference while writing `editing`: the chosen one if the rows have it, else English, Vietnamese, then any. */
function referenceFor(translations: Localized[], editing: string, chosen: string) {
  const others = translations.filter((text) => text.locale !== editing).map((text) => text.locale)
  if (others.includes(chosen)) return chosen
  return others.includes("en-US") ? "en-US" : others.includes("vi-VN") ? "vi-VN" : (others[0] ?? "")
}

/** The rows a group of fields is translated from, and the language being written. */
export function ReferenceLanguage({
  translations,
  editing,
  children,
}: {
  translations: Localized[]
  editing: string
  children: ReactNode
}) {
  return <ReferenceContext.Provider value={{ translations, editing }}>{children}</ReferenceContext.Provider>
}

/**
 * A field with a floating box that opens while it is being written: the same text in another language the entry
 * already has, to translate from. The box sits inside the field, so it stays open while its language is changed.
 */
export function WithReference<T extends Localized>({
  read,
  children,
}: {
  read: (text: T | undefined) => string | null | undefined
  children: ReactNode
}) {
  const reference = useContext(ReferenceContext)
  const chosen = useChosenReference()
  const language = reference ? referenceFor(reference.translations, reference.editing, chosen) : ""
  if (!reference || !language) return <>{children}</>
  const others = reference.translations.filter((text) => text.locale !== reference.editing) as T[]
  const current = { language, setLanguage: chooseReference }
  const value = read(others.find((text) => text.locale === current.language))
  return (
    <div className="group/reference relative">
      {children}
      <div
        role="note"
        aria-label="Nội dung tham khảo"
        className="absolute inset-x-0 top-full z-30 mt-1 hidden space-y-2 rounded-lg border bg-popover p-3 shadow-lg group-focus-within/reference:block"
      >
        <label className="type-meta flex items-center gap-2">
          <Languages aria-hidden className="size-3.5" />
          Tham khảo
          <select
            className={`${control} h-7 w-auto py-0`}
            aria-label="Ngôn ngữ tham khảo"
            value={current.language}
            onChange={(event) => current.setLanguage(event.target.value)}
          >
            {others.map((text) => (
              <option key={text.locale} value={text.locale}>
                {languageName(text.locale)}
              </option>
            ))}
          </select>
        </label>
        {value?.trim() ? (
          <div className="type-body max-h-48 overflow-y-auto whitespace-pre-line">
            <AdminRichTextPreview text={joinWrappedLines(value)} locale={current.language} />
          </div>
        ) : (
          <p className="type-meta">Ngôn ngữ này chưa có nội dung ở đây.</p>
        )}
      </div>
    </div>
  )
}
