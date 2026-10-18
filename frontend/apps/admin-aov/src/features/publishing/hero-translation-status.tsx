import { ArrowRight, Check, Languages, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { languageOptions } from "../users/profile-preference-picker"
import type { Content } from "./types"

export function translationStatus(content: Content, locale: string) {
  const profile = content.PROFILE?.translations.find((row) => row.locale === locale)
  const skills = content.SKILLS?.skills ?? []
  const skins = content.SKINS?.skins ?? []
  const translated = Number(!!profile?.name.trim())
  const translatedSkills = skills.filter((skill) => {
    const text = skill.translations.find((row) => row.locale === locale)
    return !!text?.name.trim() && !!text.description.trim()
  }).length
  const translatedSkins = skins.filter((skin) =>
    skin.translations.some((row) => row.locale === locale && row.name.trim()),
  ).length
  return {
    completed: translated + translatedSkills + translatedSkins,
    total: 1 + skills.length + skins.length,
    profile: translated === 1,
    skills: translatedSkills,
    skins: translatedSkins,
    exists:
      !!profile ||
      skills.some((skill) => skill.translations.some((row) => row.locale === locale)) ||
      skins.some((skin) => skin.translations.some((row) => row.locale === locale)),
  }
}

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
          <h2 className="font-semibold">Bản dịch nội dung</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dùng chung chỉ số, kỹ năng và ảnh. Mỗi ngôn ngữ có văn bản riêng; lịch phát hành được thiết lập theo thị
            trường.
          </p>
        </div>
      </div>
      <div className="grid gap-3 @min-[600px]:grid-cols-2 @min-[1100px]:grid-cols-3">
        {languageOptions.map((option) => {
          const progress = translationStatus(content, option.value)
          const complete = progress.completed === progress.total
          return (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label={`${progress.exists ? "Biên dịch" : "Tạo bản dịch"} ${option.label}`}
              aria-pressed={selectedLocale === option.value}
              onClick={() => onSelect(option.value)}
              className={`h-auto min-w-0 flex-col items-stretch gap-3 whitespace-normal p-4 text-left ${selectedLocale === option.value ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium">{option.label}</span>
                {complete ? (
                  <Check className="size-4 shrink-0 text-emerald-600" />
                ) : progress.exists ? (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                )}
              </span>
              <span className="flex items-center justify-between gap-2 text-xs font-normal text-muted-foreground">
                <span>{complete ? "Đủ nội dung chính" : progress.exists ? "Đang hoàn thiện" : "Chưa có bản dịch"}</span>
                <span className="tabular-nums">
                  {progress.completed}/{progress.total}
                </span>
              </span>
              <span className="h-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`block h-full rounded-full ${complete ? "bg-emerald-500" : "bg-primary/70"}`}
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </span>
            </Button>
          )
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Tiến độ tính theo tên tướng, tên và mô tả kỹ năng, tên trang phục. Một bản dịch mới được lưu khi bạn lưu nội
        dung đầu tiên.
      </p>
    </section>
  )
}
