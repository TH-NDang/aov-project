import { CheckCircle2, ChevronDown, Languages, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { countryReferenceFlag } from "@aov/ui/lib/country-references"
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
import { languageOptions } from "../../../users/profile-preference-picker"
import { translationStatus, translationStatusLabel } from "../../model/hero-translation-model"
import type { Content } from "@/lib/hero-types"

const languageFlags: Record<string, string> = {
  "vi-VN": "VN",
  "en-US": "US",
  "th-TH": "TH",
  "zh-TW": "TW",
  "id-ID": "ID",
}

export function HeroLanguageIcon({ locale }: { locale: string }) {
  const flag = Object.hasOwn(languageFlags, locale) ? countryReferenceFlag(languageFlags[locale]) : undefined
  return flag ? (
    <img src={flag} alt="" aria-hidden className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-foreground/10" />
  ) : (
    <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  )
}

export function HeroLanguagePicker({
  content,
  locale,
  revisionNo,
  disabled,
  onChange,
  label = "Ngôn ngữ hiển thị nội dung",
  compact = true,
  onTranslate,
  languagesDisabled = false,
}: {
  content?: Content
  locale: string
  revisionNo?: number
  disabled: boolean
  onChange: (locale: string) => void
  label?: string
  compact?: boolean
  /** Gives each language a pencil that opens translating into it; the hero's editors write the reading language. */
  onTranslate?: (locale: string) => void
  /** Locks the language list but keeps the menu open, so translating can still be reached. */
  languagesDisabled?: boolean
}) {
  const progress = content ? translationStatus(content, locale) : undefined
  const selected = languageOptions.find((option) => option.value === locale)?.label ?? locale
  const status = progress ? translationStatusLabel(progress) : ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          value={locale}
          aria-label={label}
          aria-description={`${selected}${status ? ` · ${status}` : ""}`}
          title={`${label} · ${selected}${status ? ` · ${status}` : ""}`}
          className={`min-w-0 gap-2 bg-background font-normal ${compact ? "h-8 shrink-0 px-2" : "h-10 w-full justify-between px-3"}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <HeroLanguageIcon locale={locale} />
            {/* A header line has no room for the region: the tooltip and the list keep the full name, a phone the flag. */}
            {/* A header keeps only the flag; the title and the list carry the language's name. */}
            {!compact && <span className="type-body truncate">{selected}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {!!progress?.missing.length && (
              <span
                className={`type-label rounded bg-(--aov-warning-soft) px-1.5 py-0.5 text-(--aov-warning) ${compact ? "hidden" : ""}`}
              >
                {progress.exists ? `Thiếu ${progress.missing.length}` : "Chưa dịch"}
              </span>
            )}
            {compact && !!progress?.missing.length && (
              <span className="size-1.5 rounded-full bg-(--aov-warning)" aria-hidden />
            )}
            {!compact && !!progress?.totalFields && !progress.missing.length && (
              <CheckCircle2 className="size-3.5 text-(--aov-success)" aria-label="Đủ nội dung" />
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={16}
        className="w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl p-1.5"
      >
        <DropdownMenuLabel className="px-2.5 py-2">
          <span className="type-label block">{label}</span>
          {revisionNo != null && <span className="type-meta mt-0.5 block">Nội dung của bản #{revisionNo}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <HeroLanguageItems
          content={content}
          locale={locale}
          onChange={onChange}
          disabled={languagesDisabled}
          onTranslate={onTranslate}
        />
        {content && (
          <>
            <DropdownMenuSeparator />
            <p className="type-meta px-2.5 py-2 leading-5">Phần chưa dịch sẽ hiển thị nội dung từ ngôn ngữ nguồn.</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The languages to read in, each with how much of this version it covers; shared by the picker and narrow menus. */
export function HeroLanguageItems({
  content,
  locale,
  onChange,
  disabled = false,
  onTranslate,
}: {
  content?: Content
  locale: string
  onChange: (locale: string) => void
  /** The reading language stays put while a section is being edited in it. */
  disabled?: boolean
  /** Opens translating into one language from its own row. */
  onTranslate?: (locale: string) => void
}) {
  return (
    <DropdownMenuRadioGroup value={locale} onValueChange={onChange}>
      {languageOptions.map((option) => {
        const optionProgress = content ? translationStatus(content, option.value) : undefined
        const complete = optionProgress && optionProgress.totalFields > 0 && !optionProgress.missing.length
        return (
          <div key={option.value} className="flex items-center gap-1">
            <DropdownMenuRadioItem
              value={option.value}
              textValue={option.label}
              data-locale={option.value}
              disabled={disabled}
              className="min-h-11 min-w-0 flex-1 gap-3 rounded-lg py-2.5 pr-2.5 data-[state=checked]:bg-accent/60"
            >
              <HeroLanguageIcon locale={option.value} />
              <span className="min-w-0 flex-1">
                <span className="type-body block">{option.label}</span>
                {optionProgress && (
                  <span className={`type-meta mt-0.5 block ${complete ? "text-(--aov-success)" : ""}`}>
                    {translationStatusLabel(optionProgress)}
                  </span>
                )}
              </span>
              {optionProgress && (
                <span className="type-meta shrink-0 tabular-nums" aria-label="Số mục đã dịch">
                  {optionProgress.completedFields}/{optionProgress.totalFields}
                </span>
              )}
            </DropdownMenuRadioItem>
            {onTranslate && (
              <DropdownMenuItem
                className="size-9 shrink-0 justify-center rounded-lg p-0 text-muted-foreground"
                aria-label={`Dịch sang ${option.label}`}
                title={`Dịch sang ${option.label}`}
                onSelect={() => onTranslate(option.value)}
              >
                <Pencil />
              </DropdownMenuItem>
            )}
          </div>
        )
      })}
    </DropdownMenuRadioGroup>
  )
}
