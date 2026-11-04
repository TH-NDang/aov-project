import { CheckCircle2, ChevronDown, Languages } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { languageOptions } from "../users/profile-preference-picker"
import { translationStatus, translationStatusLabel } from "./hero-translation-model"
import type { Content } from "./types"

const languageFlags: Record<string, string> = {
  "vi-VN": "vn",
  "en-US": "us",
  "th-TH": "th",
  "zh-TW": "tw",
  "id-ID": "id",
}

export function HeroLanguageIcon({ locale }: { locale: string }) {
  const flag = languageFlags[locale]
  return flag ? (
    <img
      src={`/images/flags/${flag}.svg`}
      alt=""
      aria-hidden
      className="h-4 w-6 shrink-0 rounded-sm object-cover ring-1 ring-foreground/10"
    />
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
}: {
  content?: Content
  locale: string
  revisionNo?: number
  disabled: boolean
  onChange: (locale: string) => void
  label?: string
  compact?: boolean
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
          className={`h-10 min-w-0 gap-2 bg-background px-3 font-normal ${compact ? "shrink-0" : "w-full justify-between"}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <HeroLanguageIcon locale={locale} />
            <span className={`type-body truncate ${compact ? "hidden max-w-40 sm:inline" : ""}`}>{selected}</span>
            {compact && <span className="type-body sm:hidden">{locale.split("-")[0].toUpperCase()}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {!!progress?.missing.length && (
              <span
                className={`type-label rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400 ${compact ? "hidden sm:inline" : ""}`}
              >
                {progress.exists ? `Thiếu ${progress.missing.length}` : "Chưa dịch"}
              </span>
            )}
            {compact && !!progress?.missing.length && (
              <span className="size-1.5 rounded-full bg-amber-500 sm:hidden" aria-hidden />
            )}
            {!!progress?.totalFields && !progress.missing.length && (
              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Đủ nội dung" />
            )}
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)] rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2.5 py-2">
          <span className="type-label block">{label}</span>
          {revisionNo != null && <span className="type-meta mt-0.5 block">Nội dung của bản #{revisionNo}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={locale} onValueChange={onChange}>
          {languageOptions.map((option) => {
            const optionProgress = content ? translationStatus(content, option.value) : undefined
            const complete = optionProgress && optionProgress.totalFields > 0 && !optionProgress.missing.length
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                textValue={option.label}
                data-locale={option.value}
                className="min-h-11 gap-3 rounded-lg py-2.5 pr-2.5 data-[state=checked]:bg-accent/60"
              >
                <HeroLanguageIcon locale={option.value} />
                <span className="min-w-0 flex-1">
                  <span className="type-body block">{option.label}</span>
                  {optionProgress && (
                    <span
                      className={`type-meta mt-0.5 block ${complete ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                    >
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
            )
          })}
        </DropdownMenuRadioGroup>
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
