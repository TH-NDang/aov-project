import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@aov/ui/components/sheet"
import type { Hero } from "@/lib/api/types"
import { AdminLiveRichTextField } from "../terminology/rich-text-field"
import { HeroSkillsView, type HeroSkillsLayout } from "./hero-skills-view"
import { HeroReviewEditor } from "./hero-review-editor"
import { SkillSourceDetails } from "./hero-source-details"
import { AssetPicker } from "./asset-picker"
import { SkillArtwork } from "./skill-artwork"
import { SectionSources } from "./fields"
import { SkillSettings } from "./skill-settings"
import { skillLabel, skillVariantLabel } from "./hero-skills"
import type { Skill, Skills } from "./types"

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
  layout,
  onLayoutChange,
  onSkillChange,
  heroId,
  onBusyChange,
  reviewOpen,
  onReviewOpenChange,
}: {
  value: Skills
  locale: string
  onChange: (value: Skills) => void
  resource?: Hero
  initialSkillKey?: string
  layout?: HeroSkillsLayout
  onLayoutChange?: (layout: HeroSkillsLayout) => void
  onSkillChange?: (key: string) => void
  heroId?: string
  onBusyChange?: (busy: boolean) => void
  reviewOpen?: boolean
  onReviewOpenChange?: (open: boolean) => void
}) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const initial =
      value.skills.find((skill) => skill.skillKey === initialSkillKey) ??
      [...value.skills].sort((a, b) => a.displayOrder - b.displayOrder)[0]
    return Math.max(0, value.skills.indexOf(initial))
  })
  const [uploading, setUploading] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
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
  const index = Math.min(selectedIndex, value.skills.length - 1)
  const selected = value.skills[index]
  const translation = selected?.translations.find((text) => text.locale === locale)
  const patch = (change: Partial<Skill>) =>
    onChange({
      ...value,
      skills: value.skills.map((skill, position) => (position === index ? { ...skill, ...change } : skill)),
    })
  function updateText(field: "name" | "description", text: string) {
    if (!selected) return
    const row = { ...(translation ?? { locale, name: "", description: "" }), [field]: text }
    patch({
      translations: translation
        ? selected.translations.map((item) => (item.locale === locale ? row : item))
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
      translations: [{ locale, name: "", description: "" }],
      effects: [],
    }
    setSelectedIndex(value.skills.length)
    onSkillChange?.(skill.skillKey)
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
    <div className="space-y-4">
      <HeroSkillsView
        skills={value.skills}
        locale={locale}
        heroId={heroId}
        selectedSkillKey={selected?.skillKey}
        onSkillChange={(key) => {
          setSelectedIndex(value.skills.findIndex((skill) => skill.skillKey === key))
          onSkillChange?.(key)
        }}
        layout={layout}
        onLayoutChange={onLayoutChange}
        locked={uploading}
        action={
          <div className="flex flex-wrap items-center gap-1">
            <HeroReviewEditor
              skills={value.skills}
              locale={locale}
              onChange={(skills) => onChange({ ...value, skills })}
              open={reviewOpen}
              onOpenChange={onReviewOpenChange}
              disabled={uploading}
            />
            <SectionSources
              sectionLabel="Kỹ năng"
              sources={value.sources}
              onChange={(sources) => onChange({ ...value, sources })}
              disabled={uploading}
            />
            <Button type="button" size="sm" variant="outline" onClick={add} disabled={uploading}>
              <Plus className="size-4" /> Thêm kỹ năng
            </Button>
          </div>
        }
        activeEditor={
          selected && (
            <section key={index} className="@container min-w-0 space-y-5" aria-label="Kỹ năng đang chỉnh sửa">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Sheet
                    open={imageOpen}
                    onOpenChange={(open) => {
                      if (!uploading) setImageOpen(open)
                    }}
                  >
                    <SheetTrigger asChild>
                      <button
                        type="button"
                        aria-label="Chỉnh sửa ảnh kỹ năng"
                        title="Chỉnh sửa ảnh kỹ năng"
                        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <SkillArtwork skill={selected} heroId={heroId} className="size-14" />
                        <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border group-hover:bg-muted">
                          <Pencil aria-hidden className="size-3.5" />
                        </span>
                      </button>
                    </SheetTrigger>
                    <SheetContent showCloseButton={false} className="w-full gap-0 sm:max-w-lg">
                      <SheetHeader className="relative shrink-0 pr-14">
                        <SheetTitle>Chỉnh sửa ảnh kỹ năng</SheetTitle>
                        <SheetDescription>
                          {skillLabel(selected)}
                          {translation?.name && ` · ${translation.name}`}
                        </SheetDescription>
                        <SheetClose asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="absolute top-3 right-3"
                            aria-label="Đóng chỉnh sửa ảnh"
                            disabled={uploading}
                          >
                            <X className="size-4" />
                          </Button>
                        </SheetClose>
                      </SheetHeader>
                      <fieldset disabled={uploading} className="min-h-0 min-w-0 space-y-3 overflow-y-auto px-4 pb-4">
                        <p className="type-meta">
                          Chọn ảnh cho chiêu, sau đó bấm “Lưu phần này” trong trình sửa kỹ năng.
                        </p>
                        <AssetPicker
                          semanticType="HERO_SKILL_ICON"
                          value={selected.iconAssetId}
                          onChange={(iconAssetId) => patch({ iconAssetId })}
                          resourcePath={resourcePath}
                          sourceUrl={resource?.sources.skills}
                          onBusyChange={changeBusy}
                          directUpload
                        />
                      </fieldset>
                    </SheetContent>
                  </Sheet>
                  <div className="min-w-0 flex-1">
                    <label className="block">
                      <span className="sr-only">Tên chiêu</span>
                      <input
                        className="type-section-title w-full rounded-md border-b border-input bg-transparent px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Tên chiêu"
                        required={!!translation}
                        value={translation?.name ?? ""}
                        onChange={(event) => updateText("name", event.target.value)}
                      />
                    </label>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{skillLabel(selected)}</Badge>
                      {!translation && <span className="type-meta">Chưa có bản dịch {locale}</span>}
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
                <SkillSettings
                  skill={selected}
                  locale={locale}
                  disabled={uploading}
                  onApply={(settings) => {
                    patch(settings)
                    if (settings.skillKey !== selected.skillKey) onSkillChange?.(settings.skillKey)
                  }}
                  onRemoveTranslation={() =>
                    patch({ translations: selected.translations.filter((text) => text.locale !== locale) })
                  }
                  onRemove={() => {
                    const remaining = value.skills.filter((_, position) => position !== index)
                    const next = Math.max(0, index - 1)
                    setSelectedIndex(next)
                    onSkillChange?.(remaining[next]?.skillKey ?? "")
                    onChange({ ...value, skills: remaining })
                  }}
                />
              </div>
              <AdminLiveRichTextField
                key={locale}
                label="Mô tả"
                locale={locale}
                required={!!translation}
                value={translation?.description ?? ""}
                onChange={(text) => updateText("description", text)}
              />
              <SkillSourceDetails
                skill={selected}
                collapseSources
                locale={locale}
                onChange={(effects) => patch({ effects })}
              />
            </section>
          )
        }
      />
    </div>
  )
}
