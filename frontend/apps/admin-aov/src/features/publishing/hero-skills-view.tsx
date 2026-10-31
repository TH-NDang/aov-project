import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowLeftRight, ChevronDown, Image, Layers3, List, PanelLeft } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../terminology/catalog"
import { HeroAsset } from "./hero-asset"
import { groupHeroSkills, selectSkillTranslation, skillLabel, skillVariantLabel } from "./hero-skills"
import { SkillArtwork, SkillArtworkStack, skillImageMatch, useHeroSkillImages } from "./skill-artwork"
import { SkillSourceDetails } from "./hero-source-details"
import type { Skill } from "./types"

export type HeroSkillsLayout = "focus" | "flat"

export function HeroSkillsView({
  skills,
  locale,
  heroId,
  selectedSkillKey,
  onSkillChange,
  layout: requestedLayout,
  onLayoutChange,
}: {
  skills: Skill[]
  locale: string
  heroId?: string
  selectedSkillKey?: string
  onSkillChange?: (key: string) => void
  layout?: HeroSkillsLayout
  onLayoutChange?: (layout: HeroSkillsLayout) => void
}) {
  const [localKey, setLocalKey] = useState("")
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [localLayout, setLocalLayout] = useState<HeroSkillsLayout>("focus")
  const layout = requestedLayout ?? localLayout
  const changeLayout = (next: HeroSkillsLayout) => (onLayoutChange ? onLayoutChange(next) : setLocalLayout(next))
  const choose = (key: string) => (onSkillChange ? onSkillChange(key) : setLocalKey(key))
  const panelId = useId()
  const rail = useRef<HTMLDivElement>(null)
  const selectedButton = useRef<HTMLButtonElement>(null)
  const ordered = [...skills].sort((a, b) => a.displayOrder - b.displayOrder)
  const current = ordered.find((skill) => skill.skillKey === (selectedSkillKey ?? localKey)) ?? ordered[0]
  const groups = groupHeroSkills(skills)
  const currentGroup = groups.find((group) => group.skills.some((skill) => skill.skillKey === current?.skillKey))
  const orderKey = groups.map((group) => group.key).join("\u0000")
  const manySkills = groups.length > 6
  useLayoutEffect(() => {
    const reveal = () => {
      if (!rail.current || !selectedButton.current) return
      const bounds = rail.current.getBoundingClientRect()
      const selected = selectedButton.current.getBoundingClientRect()
      if (rail.current.scrollWidth > rail.current.clientWidth) {
        if (selected.left < bounds.left) rail.current.scrollLeft += selected.left - bounds.left
        else if (selected.right > bounds.right) rail.current.scrollLeft += selected.right - bounds.right
      }
      if (rail.current.scrollHeight > rail.current.clientHeight) {
        if (selected.top < bounds.top) rail.current.scrollTop += selected.top - bounds.top
        else if (selected.bottom > bounds.bottom) rail.current.scrollTop += selected.bottom - bounds.bottom
      }
    }
    reveal()
    if (typeof ResizeObserver === "undefined" || !rail.current) return
    const observer = new ResizeObserver(reveal)
    observer.observe(rail.current)
    return () => observer.disconnect()
  }, [current?.skillKey, orderKey, locale, layout])
  const images = useHeroSkillImages(heroId)
  const assigned = new Set(
    skills
      .filter((skill) => !skill.iconAssetId)
      .map((skill) => skillImageMatch(skill, images.data ?? [])?.id)
      .filter(Boolean),
  )
  const explicitAssets = new Set(skills.map((skill) => skill.iconAssetId).filter(Boolean))
  const unused = (images.data ?? []).filter((image) => !assigned.has(image.id) && !explicitAssets.has(image.assetId))
  return (
    <div className="@container/skills min-w-0 space-y-5">
      {current && (
        <div
          role="group"
          aria-label="Cách hiển thị kỹ năng"
          className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted/50 p-1"
        >
          {(
            [
              ["focus", PanelLeft, "Tập trung"],
              ["flat", List, "Dạng phẳng"],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={layout === mode}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layout === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => changeLayout(mode)}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}
      {current && layout === "focus" ? (
        <div className="grid min-w-0 gap-5 @min-[760px]/skills:grid-cols-[210px_minmax(0,1fr)] @min-[760px]/skills:gap-6">
          <div
            ref={rail}
            role="group"
            aria-label="Chọn kỹ năng"
            className={cn(
              "flex min-w-0 content-start gap-2 @min-[760px]/skills:flex-col",
              manySkills
                ? "flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 @min-[760px]/skills:max-h-[min(70dvh,42rem)] @min-[760px]/skills:overflow-x-hidden @min-[760px]/skills:overflow-y-auto @min-[760px]/skills:overscroll-y-contain @min-[760px]/skills:pr-1"
                : "flex-wrap",
            )}
          >
            {groups.map((group) => {
              const active = group.skills.some((skill) => skill.skillKey === current.skillKey)
              const skill = active ? current : group.skills[0]!
              const text = selectSkillTranslation(skill, locale)
              const name = text?.name || skillLabel(skill)
              const variant = skillVariantLabel(skill, skills)
              const multiple = group.skills.length > 1
              return (
                <button
                  key={group.key}
                  ref={active ? selectedButton : undefined}
                  type="button"
                  aria-pressed={active}
                  aria-controls={panelId}
                  aria-label={`${skillLabel(skill)} · ${name}${multiple ? ` · ${group.skills.length} biến thể` : skill.formKey ? ` · ${skill.formKey}` : variant ? ` · ${variant}` : ""}`}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring @min-[760px]/skills:basis-auto @min-[760px]/skills:flex-none @min-[760px]/skills:flex-row @min-[760px]/skills:p-3 @min-[760px]/skills:text-left",
                    manySkills ? "w-28 shrink-0 flex-none @min-[760px]/skills:w-full" : "basis-24 flex-1",
                    active ? "border-primary/40 bg-primary/8" : "border-transparent bg-muted/25",
                  )}
                  onClick={() => choose(skill.skillKey)}
                >
                  {multiple ? (
                    <SkillArtworkStack skills={group.skills} heroId={heroId} selectedSkillKey={skill.skillKey} />
                  ) : (
                    <SkillArtwork skill={skill} heroId={heroId} className="size-11" />
                  )}
                  <span className="min-w-0 space-y-1">
                    <span className="block text-xs font-medium tracking-wide text-muted-foreground">
                      {skillLabel(skill)}
                    </span>
                    <span className={cn("block line-clamp-2 text-xs leading-5", active && "font-semibold")}>
                      {name}
                    </span>
                    {skill.formKey && (
                      <span className="block truncate text-xs text-muted-foreground">{skill.formKey}</span>
                    )}
                    {multiple ? (
                      <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground @min-[760px]/skills:justify-start">
                        <ArrowLeftRight className="size-3" />
                        {group.skills.length} biến thể
                      </span>
                    ) : (
                      variant && <span className="block text-xs text-muted-foreground">{variant}</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <div
            id={panelId}
            role="region"
            aria-label="Chi tiết kỹ năng"
            aria-live="polite"
            aria-atomic="false"
            className="min-w-0 space-y-5 @min-[760px]/skills:border-l @min-[760px]/skills:pl-6"
          >
            <SkillDetail
              key={currentGroup?.key ?? current.skillKey}
              skill={current}
              locale={locale}
              heroId={heroId}
              variant={skillVariantLabel(current, skills)}
              states={
                currentGroup &&
                currentGroup.skills.length > 1 && (
                  <div role="group" aria-label="Chuyển biến thể kỹ năng" className="flex flex-wrap gap-2">
                    {currentGroup.skills.map((skill) => {
                      const label = skill.formKey || skillVariantLabel(skill, skills) || skillLabel(skill)
                      const name = selectSkillTranslation(skill, locale)?.name || skillLabel(skill)
                      const active = skill.skillKey === current.skillKey
                      return (
                        <button
                          key={skill.skillKey}
                          type="button"
                          aria-pressed={active}
                          aria-label={`${label} · ${name}`}
                          className={cn(
                            "flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "border-primary/40 bg-primary/8 font-medium"
                              : "border-transparent bg-muted/35 hover:bg-muted/60",
                          )}
                          onClick={() => choose(skill.skillKey)}
                        >
                          <SkillArtwork skill={skill} heroId={heroId} className="size-8" />
                          <span className="min-w-0 break-words">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              }
            />
          </div>
        </div>
      ) : current ? (
        <div role="region" aria-label="Tất cả kỹ năng" className="space-y-5">
          {groups.map((group) => (
            <section
              key={group.key}
              aria-label={
                group.skills.length > 1
                  ? `Nhóm ${skillLabel(group.skills[0]!)} · ${group.skills.length} biến thể`
                  : `Kỹ năng ${selectSkillTranslation(group.skills[0]!, locale)?.name || skillLabel(group.skills[0]!)}`
              }
              className="min-w-0 rounded-2xl border bg-card p-4 @min-[600px]/skills:p-5"
            >
              {group.skills.length > 1 && (
                <header className="mb-5 flex items-center gap-3 border-b pb-4">
                  <SkillArtworkStack skills={group.skills} heroId={heroId} selectedSkillKey={current.skillKey} />
                  <div className="min-w-0">
                    <p className="font-semibold">{skillLabel(group.skills[0]!)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowLeftRight className="size-3" />
                      {group.skills.length} biến thể
                    </p>
                  </div>
                </header>
              )}
              <div className="divide-y">
                {group.skills.map((skill) => (
                  <article
                    key={skill.skillKey}
                    aria-label={`${selectSkillTranslation(skill, locale)?.name || skillLabel(skill)}${skill.formKey ? ` · ${skill.formKey}` : skillVariantLabel(skill, skills) ? ` · ${skillVariantLabel(skill, skills)}` : ""}`}
                    className="space-y-5 py-5 first:pt-0 last:pb-0"
                  >
                    <SkillDetail
                      skill={skill}
                      locale={locale}
                      heroId={heroId}
                      variant={skillVariantLabel(skill, skills)}
                    />
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-muted/30 p-6 text-center">
          <Layers3 className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Chưa có nội dung kỹ năng trong bản dữ liệu này.</p>
        </div>
      )}
      {unused.length > 0 && (
        <details className="group border-t pt-4" onToggle={(event) => setGalleryOpen(event.currentTarget.open)}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <Image className="size-4" aria-hidden="true" />
            Ảnh chưa gắn nội dung
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {unused.length}
            </Badge>
            <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          {galleryOpen && (
            <div className="mt-4 grid grid-cols-3 gap-4 @min-[500px]/skills:grid-cols-5 @min-[760px]/skills:grid-cols-7">
              {unused.map((image) => (
                <div key={image.id} className="min-w-0 space-y-2 text-center">
                  <HeroAsset
                    id={image.assetId}
                    alt={image.label || image.sourceFilename}
                    className="mx-auto size-14 rounded-full"
                    frameAspectRatio={1}
                    preview
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {image.sourceSlot === 0 ? "Nội tại" : `Chiêu ${image.sourceSlot}`}
                    <span className="block">Ảnh {image.variantNo}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </details>
      )}
    </div>
  )
}

function SkillDetail({
  skill,
  locale,
  heroId,
  variant,
  states,
}: {
  skill: Skill
  locale: string
  heroId?: string
  variant?: string
  states?: ReactNode
}) {
  const text = selectSkillTranslation(skill, locale)
  return (
    <>
      <header className="flex items-center gap-3">
        <SkillArtwork skill={skill} heroId={heroId} className="size-14" preview />
        <div className="min-w-0 flex-1 space-y-1.5">
          <h4 className="break-words text-xl font-semibold tracking-tight">{text?.name || skillLabel(skill)}</h4>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{skillLabel(skill)}</span>
            {skill.formKey && (
              <Badge variant="outline" className="max-w-full break-all whitespace-normal">
                {skill.formKey}
              </Badge>
            )}
            {variant && <Badge variant="outline">{variant}</Badge>}
            {text && text.locale !== locale && <Badge variant="secondary">Dự phòng: {text.locale}</Badge>}
          </div>
        </div>
      </header>
      {states}
      {text?.description ? (
        <div className="whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">
          <AdminEntityText text={text.description} />
        </div>
      ) : (
        <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          Chưa có mô tả kỹ năng{text ? ` bằng ${text.locale}` : ` bằng ${locale}`}.
        </p>
      )}
      <SkillSourceDetails skill={skill} collapseSources />
    </>
  )
}
