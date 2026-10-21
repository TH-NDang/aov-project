import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Languages, Image, Plus, Settings2, Swords, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import type { Hero } from "@/lib/api/types"
import { languageOptions } from "../users/profile-preference-picker"
import { AssetPicker } from "./asset-picker"
import { SkillArtwork } from "./skill-artwork"
import { Field, control } from "./fields"
import { skillLabel, skillVariantLabel } from "./hero-skills"
import type { Skill, Skills } from "./types"

const kindLabels: Record<Skill["kind"], string> = { PASSIVE: "Nội tại", ACTIVE: "Chủ động", OTHER: "Khác" }
const skillName = (skill: Skill, locale: string) =>
  skill.translations.find((text) => text.locale === locale)?.name ||
  skill.translations.find((text) => text.locale === "vi-VN")?.name ||
  skill.translations.find((text) => text.name.trim())?.name ||
  "Kỹ năng chưa đặt tên"

export function nextSkillKey(skills: readonly Pick<Skill, "skillKey">[]): string {
  const used = new Set(skills.map((skill) => skill.skillKey))
  let number = 1
  while (used.has(`skill-${number}`)) number++
  return `skill-${number}`
}

export function HeroSkillsEditor({
  value,
  locale,
  onChange,
  resource,
  initialSkillKey,
  heroId,
  onBusyChange,
}: {
  value: Skills
  locale: string
  onChange: (value: Skills) => void
  resource?: Hero
  initialSkillKey?: string
  heroId?: string
  onBusyChange?: (busy: boolean) => void
}) {
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(
      0,
      value.skills.findIndex((skill) => skill.skillKey === initialSkillKey),
    ),
  )
  const [translationLocale, setTranslationLocale] = useState(locale)
  const rail = useRef<HTMLDivElement>(null)
  const selectedButton = useRef<HTMLButtonElement>(null)
  const [uploading, setUploading] = useState(false)
  const changeBusy = useCallback(
    (busy: boolean) => {
      setUploading(busy)
      onBusyChange?.(busy)
    },
    [onBusyChange],
  )
  useEffect(() => {
    if (!initialSkillKey) return
    const index = value.skills.findIndex((skill) => skill.skillKey === initialSkillKey)
    if (index >= 0) setSelectedIndex(index)
  }, [initialSkillKey])
  useEffect(() => setTranslationLocale(locale), [locale])
  const index = Math.min(selectedIndex, value.skills.length - 1)
  useEffect(() => {
    if (!rail.current || !selectedButton.current) return
    const bounds = rail.current.getBoundingClientRect()
    const selected = selectedButton.current.getBoundingClientRect()
    if (selected.left < bounds.left) rail.current.scrollLeft += selected.left - bounds.left
    else if (selected.right > bounds.right) rail.current.scrollLeft += selected.right - bounds.right
  }, [index, value.skills.length])
  const selected = value.skills[index]
  const translation = selected?.translations.find((text) => text.locale === translationLocale)
  const locales = [
    ...new Set([
      ...languageOptions.map((option) => option.value),
      ...(selected?.translations.map((text) => text.locale) ?? []),
      translationLocale,
    ]),
  ]
  const patch = (change: Partial<Skill>) =>
    onChange({
      ...value,
      skills: value.skills.map((skill, position) => (position === index ? { ...skill, ...change } : skill)),
    })
  function updateText(field: "name" | "description", text: string) {
    if (!selected) return
    const row = { ...(translation ?? { locale: translationLocale, name: "", description: "" }), [field]: text }
    patch({
      translations: translation
        ? selected.translations.map((item) => (item.locale === translationLocale ? row : item))
        : [...selected.translations, row],
    })
  }
  function add() {
    const skill: Skill = {
      skillKey: nextSkillKey(value.skills),
      kind: "ACTIVE",
      formKey: null,
      displayOrder: Math.max(-1, ...value.skills.map((item) => item.displayOrder)) + 1,
      iconAssetId: null,
      translations: [{ locale: translationLocale, name: "", description: "" }],
      effects: [],
    }
    setSelectedIndex(value.skills.length)
    onChange({ ...value, skills: [...value.skills, skill] })
  }
  const resourcePath = resource?.skills
    .flatMap((skill) =>
      skill.variants.map((variant) => ({
        key: skill.variants.length > 1 ? `skill-${skill.slot}-variant-${variant.index}` : `skill-${skill.slot}`,
        icon: variant.icon,
      })),
    )
    .find((item) => item.key === selected?.skillKey)?.icon
  return (
    <div className="@container min-w-0 space-y-4" aria-label="Biên tập kỹ năng">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{value.skills.length} kỹ năng</p>
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={uploading}>
          <Plus className="size-4" />
          Thêm kỹ năng
        </Button>
      </div>
      {value.skills.length > 0 && (
        <div ref={rail} role="group" aria-label="Chọn kỹ năng để sửa" className="flex gap-2 overflow-x-auto pb-2">
          {value.skills
            .map((skill, position) => ({ skill, position }))
            .sort((a, b) => a.skill.displayOrder - b.skill.displayOrder || a.position - b.position)
            .map(({ skill, position }) => (
              <button
                key={position}
                ref={position === index ? selectedButton : undefined}
                type="button"
                aria-label={`Chọn sửa kỹ năng ${position + 1}: ${skillName(skill, locale)}`}
                aria-pressed={position === index}
                disabled={uploading}
                className={cn(
                  "flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  position === index ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
                )}
                onClick={() => setSelectedIndex(position)}
              >
                <SkillArtwork
                  skill={skill}
                  heroId={heroId}
                  className={cn(
                    "size-12 rounded-full",
                    position === index && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                />
                <span className="line-clamp-2 w-full break-words font-medium text-foreground">
                  {skillName(skill, locale)}
                </span>
                <span className="line-clamp-2 break-words">
                  {skillLabel(skill)}
                  {(skill.formKey || skillVariantLabel(skill, value.skills)) && (
                    <span className="block">{skill.formKey || skillVariantLabel(skill, value.skills)}</span>
                  )}
                </span>
              </button>
            ))}
        </div>
      )}
      {selected ? (
        <section
          className="min-w-0 space-y-5 rounded-xl border bg-card p-4 @min-[600px]:p-5"
          aria-label="Kỹ năng đang chỉnh sửa"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <SkillArtwork skill={selected} heroId={heroId} className="size-12 shrink-0 rounded-full" />
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{skillName(selected, locale)}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{skillLabel(selected)}</Badge>
                  {selected.formKey && (
                    <Badge variant="outline" className="max-w-full break-all whitespace-normal">
                      {selected.formKey}
                    </Badge>
                  )}
                  {!selected.formKey && skillVariantLabel(selected, value.skills) && (
                    <Badge variant="outline">{skillVariantLabel(selected, value.skills)}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <label className="grid min-w-0 gap-1.5 text-sm @min-[600px]:max-w-64">
            <span className="flex items-center gap-2">
              <Languages className="size-4 text-muted-foreground" />
              Ngôn ngữ chiêu
            </span>
            <select
              aria-label="Ngôn ngữ chiêu"
              value={translationLocale}
              className={control}
              onChange={(event) => setTranslationLocale(event.target.value)}
            >
              {locales.map((code) => (
                <option key={code} value={code}>
                  {languageOptions.find((option) => option.value === code)?.label ?? (code || "Chưa xác định ngôn ngữ")}
                  {selected.translations.some((text) => text.locale === code) ? "" : " · Chưa có bản dịch"}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Tên chiêu"
            required
            value={translation?.name ?? ""}
            onChange={(text) => updateText("name", text)}
          />
          <Field
            label="Mô tả đã xác minh"
            multiline
            richTextLocale={translationLocale}
            required
            value={translation?.description ?? ""}
            onChange={(text) => updateText("description", text)}
          />
          {translation && selected.translations.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() =>
                patch({ translations: selected.translations.filter((text) => text.locale !== translationLocale) })
              }
            >
              <Trash2 className="size-3.5" />
              Bỏ bản dịch {translationLocale || "chưa xác định"}
            </Button>
          )}
          <details className="group border-t pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <Image className="size-4 text-muted-foreground" />
              Ảnh kỹ năng
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3">
              <AssetPicker
                key={index}
                semanticType="HERO_SKILL_ICON"
                value={selected.iconAssetId}
                onChange={(iconAssetId) => patch({ iconAssetId })}
                resourcePath={resourcePath}
                sourceUrl={resource?.sources.skills}
                onBusyChange={changeBusy}
                directUpload
              />
            </div>
          </details>
          <details className="group border-t pt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <Settings2 className="size-4 text-muted-foreground" />
              Thiết lập kỹ năng
              <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 grid min-w-0 gap-4 @min-[600px]:grid-cols-2">
              <Field
                label="Khóa kỹ năng"
                required
                value={selected.skillKey}
                onChange={(skillKey) => patch({ skillKey })}
              />
              <label className="grid gap-1.5 text-sm">
                Loại
                <select
                  className={control}
                  value={selected.kind}
                  onChange={(event) => patch({ kind: event.target.value as Skill["kind"] })}
                >
                  {Object.entries(kindLabels).map(([kind, name]) => (
                    <option key={kind} value={kind}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Dạng tướng (nếu có)"
                value={selected.formKey ?? ""}
                onChange={(formKey) => patch({ formKey: formKey || null })}
              />
              <div className="@min-[600px]:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setSelectedIndex(Math.max(0, index - 1))
                    onChange({ ...value, skills: value.skills.filter((_, position) => position !== index) })
                  }}
                >
                  <Trash2 className="size-4" />
                  Bỏ kỹ năng
                </Button>
              </div>
            </div>
          </details>
        </section>
      ) : (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Swords className="mx-auto mb-3 size-6" />
          Chưa có kỹ năng. Thêm kỹ năng đã thu thập để bắt đầu.
        </div>
      )}
    </div>
  )
}
