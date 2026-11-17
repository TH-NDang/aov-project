import { useRef, useState } from "react"
import { Languages } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { languageOptions } from "../users/profile-preference-picker"
import { HeroLanguageIcon } from "./hero-language-picker"
import {
  missingTranslationFields,
  translationFieldLabel,
  type TranslatableSection,
  type TranslationField,
  type TranslationTarget,
  type TranslationText,
} from "./hero-translation-model"

export const translationLanguageLabel = (locale: string) =>
  languageOptions.find((option) => option.value === locale)?.label ?? locale

export function HeroTranslationNotice({
  rows,
  locale,
  fields,
  section,
  entryKey,
  onTranslate,
  disabled,
}: {
  rows: readonly TranslationText[]
  locale: string
  fields: readonly TranslationField[]
  section: TranslatableSection
  entryKey: string
  onTranslate?: (target: TranslationTarget) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const navigating = useRef(false)
  const missing = missingTranslationFields(rows, locale, fields)
  if (!missing.length) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 shrink-0 gap-1.5 rounded-full bg-(--aov-warning-soft) px-2 text-(--aov-warning) hover:bg-(--aov-warning)/15"
          aria-label={`Xem ${missing.length} mục chưa dịch: ${fields.map((field) => translationFieldLabel(section, field)).join(", ")}`}
        >
          <Languages className="size-3.5" />
          <span className="type-label">
            <span className="hidden sm:inline">Chưa dịch · </span>
            {missing.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-80 max-w-[calc(100vw-2rem)] rounded-xl p-0"
        aria-label="Nội dung chưa dịch"
        onCloseAutoFocus={(event) => {
          if (navigating.current) event.preventDefault()
          navigating.current = false
        }}
      >
        <div className="space-y-2 border-b p-4">
          <div className="flex items-center gap-2">
            <HeroLanguageIcon locale={locale} />
            <h3 className="type-section-title">{translationLanguageLabel(locale)}</h3>
          </div>
          <p className="type-meta leading-5">Còn {missing.length} mục chưa dịch trong phần này ở phiên bản đang xem.</p>
        </div>
        <div className="max-h-72 divide-y overflow-y-auto px-4">
          {missing.map((entry) => (
            <div key={entry.field} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="type-body">{translationFieldLabel(section, entry.field)}</p>
                <p className="type-meta mt-0.5 leading-5">
                  Đang hiển thị {translationLanguageLabel(entry.sourceLocale)}.
                </p>
              </div>
              {onTranslate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  className="shrink-0"
                  aria-label={`Dịch phần này: ${translationFieldLabel(section, entry.field)}`}
                  onClick={() => {
                    navigating.current = true
                    setOpen(false)
                    onTranslate({ ...entry, section, key: entryKey })
                  }}
                >
                  Dịch phần này
                </Button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
