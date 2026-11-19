import { useCallback, useEffect, useEffectEvent, useState } from "react"
import { CopyPlus, Pencil, Plus, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@aov/ui/components/sheet"
import { AdminDescriptionField } from "../../../terminology/rich-text-field"
import { HeroSkillsView, type HeroSkillsLayout } from "./hero-skills-view"
import { HeroReviewEditor } from "../editing/hero-review-editor"
import { SkillSourceDetails } from "../import/hero-source-details"
import { AssetPicker } from "../assets/asset-picker"
import { SkillArtwork, useHeroSkillImages, type SkillImage } from "./skill-artwork"
import { SkillStateIconsEditor, knownStateLabels, stateIconsOf, stateLabelHints } from "./skill-state-icons"
import { SkillImageTray } from "./skill-image-tray"
import { addSkillVariant, unusedSkillImages } from "../../model/skills/skill-variants"
import { applyCostStyle, sharedCostStyle } from "./skill-cost-fields"
import { SectionSources } from "../editing/fields"
import { SkillSettings } from "./skill-settings"
import { SkillSummaryField, summaryValue } from "./skill-summary-field"
import { skillLabel, skillSlot, skillVariantLabel } from "../../model/skills/hero-skills"
import type { Skill, Skills } from "@/lib/hero-types"

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
  initialSkillKey,
  layout,
  onLayoutChange,
  onSkillChange,
  heroId,
  onBusyChange,
  reviewOpen,
  onReviewOpenChange,
  savedKeys,
}: {
  /** Keys already saved on the server; they stay as they are. */
  savedKeys?: ReadonlySet<string>
  value: Skills
  locale: string
  onChange: (value: Skills) => void
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
  // A state added from the tray opens the picture sheet on its name, which is all it still needs.
  const [focusState, setFocusState] = useState<number | null>(null)
  const library = useHeroSkillImages(heroId).data ?? []
  const unused = unusedSkillImages(value.skills, library)
  const stateLabels = knownStateLabels(value.skills)
  const changeBusy = useCallback(
    (busy: boolean) => {
      setUploading(busy)
      onBusyChange?.(busy)
    },
    [onBusyChange],
  )
  // A newly requested skill is selected; editing the skills afterwards must not take the selection back to it.
  const indexOfSkill = useEffectEvent((key: string) => value.skills.findIndex((skill) => skill.skillKey === key))
  useEffect(() => {
    if (!initialSkillKey) return
    const index = indexOfSkill(initialSkillKey)
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
  function updateText(field: "name" | "description" | "summary", text: string) {
    if (!selected) return
    const written = field === "summary" ? summaryValue(text) : text
    const row = { ...(translation ?? { locale, name: "", description: "" }), [field]: written }
    patch({
      translations: translation
        ? selected.translations.map((item) => (item.locale === locale ? row : item))
        : [...selected.translations, row],
    })
  }
  function applyVariant(result: ReturnType<typeof addSkillVariant>) {
    if (!result) return
    setSelectedIndex(result.skills.length - 1)
    onSkillChange?.(result.added.skillKey)
    onChange({ ...value, skills: result.skills })
  }
  function addInSlot(slot: number) {
    applyVariant(addSkillVariant(value.skills, undefined, { locale, slot, library }))
  }
  function addVariant(copy: boolean) {
    applyVariant(addSkillVariant(value.skills, selected, { locale, copy, library }))
  }
  function addState(image: SkillImage) {
    if (!selected) return
    const icons = stateIconsOf(selected)
    patch({
      stateIcons: [...icons, { assetId: image.assetId, label: stateLabelHints(selected, stateLabels)[0] ?? "" }],
    })
    setFocusState(icons.length)
    setImageOpen(true)
  }
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" disabled={uploading}>
                  <Plus className="size-4" /> Thêm kỹ năng
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {[0, 1, 2, 3, 4].map((slot) => {
                  const count = value.skills.filter((skill) => skillSlot(skill) === slot).length
                  return (
                    <DropdownMenuItem key={slot} onSelect={() => addInSlot(slot)}>
                      <span className="flex-1">{slot === 0 ? "Nội tại" : `Chiêu ${slot}`}</span>
                      <span className="type-meta">{count ? "thêm biến thể" : "chiêu mới"}</span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
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
                    <SheetContent
                      showCloseButton={false}
                      className="w-full gap-0 sm:max-w-lg"
                      // A state added from the tray takes the focus on its name instead of the sheet's first field.
                      onOpenAutoFocus={(event) => {
                        if (focusState !== null) event.preventDefault()
                      }}
                      onCloseAutoFocus={() => setFocusState(null)}
                    >
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
                          onBusyChange={changeBusy}
                          directUpload
                        />
                        <div className="border-t pt-4">
                          <SkillStateIconsEditor
                            skill={selected}
                            suggestions={stateLabelHints(selected, stateLabels)}
                            focusIndex={imageOpen ? focusState : null}
                            onChange={(stateIcons) => patch({ stateIcons })}
                            onBusyChange={changeBusy}
                          />
                        </div>
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
                      {stateIconsOf(selected).length > 0 && (
                        <Badge variant="outline">{stateIconsOf(selected).length} ảnh trạng thái</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={uploading || skillSlot(selected) === null}
                        title={
                          skillSlot(selected) === null
                            ? "Chiêu chưa rõ ô nên chưa thêm được biến thể"
                            : "Biến thể là dạng khác của chiêu, có tên và mô tả riêng"
                        }
                      >
                        <CopyPlus className="size-4" />
                        Thêm biến thể
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuItem onSelect={() => addVariant(false)}>Biến thể trống</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => addVariant(true)}>
                        Chép tên, mô tả và thông số của chiêu này
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <SkillSettings
                    usedKeys={
                      new Set(value.skills.filter((_, position) => position !== index).map((skill) => skill.skillKey))
                    }
                    locked={!!savedKeys?.has(selected.skillKey)}
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
              </div>
              {/* The summary sits right above the full description it is written from. */}
              <SkillSummaryField
                key={`summary-${locale}`}
                value={translation?.summary ?? ""}
                onChange={(text) => updateText("summary", text)}
              />
              <AdminDescriptionField
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
                costStyles={{
                  cooldown: sharedCostStyle(value.skills, "cooldown"),
                  energyCost: sharedCostStyle(value.skills, "energyCost"),
                }}
                onCostStyle={(field, style) =>
                  onChange({ ...value, skills: applyCostStyle(value.skills, field, style) })
                }
              />
            </section>
          )
        }
      />
      <SkillImageTray
        images={unused}
        selected={selected}
        selectedName={selected ? `${skillLabel(selected)}${translation?.name ? ` · ${translation.name}` : ""}` : ""}
        disabled={uploading}
        onUseAsIcon={(image) => patch({ iconAssetId: image.assetId })}
        onAddState={addState}
        onCreateVariant={(image) => applyVariant(addSkillVariant(value.skills, selected, { locale, image, library }))}
      />
    </div>
  )
}
