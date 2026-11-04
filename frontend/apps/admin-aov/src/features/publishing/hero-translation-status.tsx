import { ArrowRight, Check, Languages, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { languageOptions } from "../users/profile-preference-picker"
import type { Content } from "./types"
import { HeroLanguageIcon } from "./hero-language-picker"

import { translationStatus, translationStatusLabel } from "./hero-translation-model"
export { translationStatus } from "./hero-translation-model"

export function HeroTranslationStatus({
  content,
  selectedLocale,
  onSelect,
  disabled,
}: {
  content: Content
  selectedLocale: string
  onSelect: (locale: string) => void
  disabled: boolean
}) {
  return (
    <section className="space-y-4" aria-label="Tiến độ bản dịch">
      <div className="flex items-start gap-3">
        <Languages className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="type-section-title">Bản dịch nội dung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiến độ của phiên bản đang xem. Chỉ tính các trường có nội dung nguồn; chỉ số, đánh giá và ảnh dùng chung.
          </p>
        </div>
      </div>
      <div className="grid gap-3 @min-[600px]:grid-cols-2 @min-[1100px]:grid-cols-3">
        {languageOptions.map((option) => {
          const progress = translationStatus(content, option.value)
          const complete = progress.totalFields > 0 && !progress.missing.length
          return (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={`${progress.exists ? "Biên dịch" : "Tạo bản dịch"} ${option.label}`}
              aria-pressed={selectedLocale === option.value}
              onClick={() => onSelect(option.value)}
              className={`h-auto min-w-0 flex-col items-stretch gap-2 whitespace-normal p-3 text-left ${selectedLocale === option.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <HeroLanguageIcon locale={option.value} />
                  <span>{option.label}</span>
                </span>
                {complete ? (
                  <Check className="size-4 shrink-0 text-emerald-600" />
                ) : progress.exists ? (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                )}
              </span>
              <span className="flex items-center justify-between gap-2 text-xs font-normal text-muted-foreground">
                <span>{translationStatusLabel(progress)}</span>
                <span className="tabular-nums">
                  {progress.completedFields}/{progress.totalFields}
                </span>
              </span>
              <span className="h-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${complete ? "bg-emerald-500" : "bg-primary/70"}`}
                  style={{
                    width: `${progress.totalFields ? (progress.completedFields / progress.totalFields) * 100 : 0}%`,
                  }}
                />
              </span>
            </Button>
          )
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Nội dung đang mượn từ ngôn ngữ khác không được tính là đã dịch. Thay đổi chưa lưu chỉ thuộc bản nháp đang mở.
      </p>
    </section>
  )
}
