import type { ComponentType, ReactNode } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { BookOpen, ChartNoAxesCombined, Image, Pencil, Shield, Sparkles, Swords, Clapperboard } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { SECTIONS, type Content, type Section } from "./types"
import { HeroOverview } from "./hero-overview"
import type { StatDefault } from "./combat-attributes"
import { HeroTranslationNotice } from "./hero-translation-notice"
import { translatedText, sectionTextFields, type TranslationTarget } from "./hero-translation-model"
import { SubjectVideosPanel } from "../videos/subject-videos-panel"
import { HeroContentSources } from "./hero-content-sources"
import { AdminEntityText, AdminReferenceProvider } from "../terminology/catalog"
import { HeroReviewNotice } from "./hero-review-notice"
import { reviewTab, type HeroReviewItem } from "./hero-source-review"
import { HeroSkillsView } from "./hero-skills-view"
import type { HeroContentTab } from "./hero-location"
import { HeroAsset } from "./hero-asset"
import { ImageCreditSummary } from "./image-credit-summary"
import { SkinAcquisitionRow, SkinAcquisitionSummary, useHeroShop } from "./hero-shop"
import { SkinCard, skinImageIds } from "./skin-card"
import { visibleSkins } from "./hero-skins"
export { HeroAsset } from "./hero-asset"

const icons = {
  PROFILE: BookOpen,
  OVERVIEW_RATINGS: Shield,
  COMBAT_STATS: ChartNoAxesCombined,
  SKILLS: Swords,
  SKINS: Sparkles,
  MEDIA_BINDINGS: Image,
}

export function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled = false,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            aria-label={label}
            title={label}
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled) onClick()
            }}
          >
            <Icon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function localized<T extends { locale: string }>(translations: T[] | undefined, locale: string): T | undefined {
  return (
    translations?.find((text) => text.locale === locale) ??
    translations?.find((text) => text.locale === "vi-VN") ??
    translations?.[0]
  )
}

function Text({ children }: { children?: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
      {typeof children === "string" ? <AdminEntityText text={children} /> : children || "Chưa có nội dung."}
    </p>
  )
}

export function HeroContent(props: Parameters<typeof HeroContentBody>[0]) {
  return (
    <AdminReferenceProvider locale={props.locale}>
      <HeroContentBody {...props} />
    </AdminReferenceProvider>
  )
}

function HeroContentBody({
  content,
  variantId,
  statDefaults,
  patchCode,
  referenceError,
  locale,
  editable,
  busy,
  onEdit,
  onNeedsDraft,
  onTranslate,
  canWrite = false,
  issues,
  tab: selectedTab,
  onTabChange,
  heroId,
  selectedSkillKey,
  onSkillChange,
  skillLayout,
  onSkillLayoutChange,
  showTabs = true,
  reviewTarget,
  onReviewShown,
}: {
  /** The hero page shows the content sections in its own tab row. */
  showTabs?: boolean
  reviewTarget?: HeroReviewItem | null
  onReviewShown?: () => void
  content: Content
  statDefaults?: StatDefault[]
  variantId?: string
  patchCode?: string
  referenceError?: boolean
  locale: string
  editable: boolean
  busy: boolean
  onEdit: (section: Section, profilePart?: "information" | "lore") => void
  onNeedsDraft?: () => void
  /** Prices and skin acquisition follow the shop, so they only ask for the right to write. */
  canWrite?: boolean
  issues?: string[]
  onTranslate?: (target: TranslationTarget) => void
  tab?: HeroContentTab
  onTabChange?: (tab: HeroContentTab) => void
  heroId?: string
  selectedSkillKey?: string
  onSkillChange?: (key: string) => void
  skillLayout?: "focus" | "flat"
  onSkillLayoutChange?: (layout: "focus" | "flat") => void
}) {
  const profile = translatedText(content.PROFILE?.translations ?? [], locale, sectionTextFields.PROFILE)
  // The base appearance repeats the hero's own images, which the Images tab already shows.
  const skins = visibleSkins(content.SKINS?.skins ?? [])
  const [localTab, setLocalTab] = useState<HeroContentTab>("overview")
  const [localSkill, setLocalSkill] = useState<string>()
  const [localReview, setLocalReview] = useState<HeroReviewItem | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const shop = useHeroShop(heroId)
  const tab = selectedTab ?? localTab
  const activeSkill = selectedSkillKey ?? localSkill
  const target = reviewTarget ?? localReview
  useLayoutEffect(() => {
    if (!target?.section || tab !== reviewTab(target.section) || (target.skillKey && activeSkill !== target.skillKey))
      return
    const section = contentRef.current?.querySelector<HTMLElement>(`#hero-${target.section}`)
    if (!section) return
    const skill = target.skillKey
      ? [...section.querySelectorAll<HTMLElement>("[data-review-skill]")].find(
          (el) => el.dataset.reviewSkill === target.skillKey,
        )
      : undefined
    if (target.skillKey && !skill) return
    const details =
      skill?.querySelector<HTMLDetailsElement>("details[data-review-source]") ??
      section.querySelector<HTMLDetailsElement>("details[data-review-attributes]")
    if (details) details.open = true
    const element = details?.querySelector("summary") ?? skill ?? section
    if (!element.matches("summary")) element.tabIndex = -1
    element.focus({ preventScroll: true })
    element.scrollIntoView?.({ block: "center" })
    if (reviewTarget) onReviewShown?.()
    else setLocalReview(null)
  }, [target, reviewTarget, tab, activeSkill, onReviewShown])
  const visibleSections: Section[] =
    tab === "overview" || tab === "videos"
      ? []
      : tab === "skills"
        ? ["SKILLS"]
        : tab === "skins"
          ? ["SKINS"]
          : ["MEDIA_BINDINGS"]
  return (
    <div ref={contentRef} className="space-y-4" aria-label="Nội dung tướng">
      <div
        className={cn("flex gap-1 overflow-x-auto border-b pb-2", !showTabs && "hidden")}
        role="tablist"
        aria-label="Thông tin hiển thị"
      >
        {(
          [
            ["overview", BookOpen, "Tổng quan", null],
            ["skills", Swords, "Kỹ năng", content.SKILLS?.skills.length ?? 0],
            ["skins", Sparkles, "Trang phục", skins.length],
            ["media", Image, "Ảnh tướng", null],
            ...(heroId ? ([["videos", Clapperboard, "Video", null]] as const) : []),
          ] as const
        ).map(([key, Icon, label, count]) => (
          <Button
            key={key}
            role="tab"
            type="button"
            variant={tab === key ? "secondary" : "ghost"}
            aria-selected={tab === key}
            aria-controls={`hero-content-${key}`}
            className="shrink-0"
            onClick={() => (onTabChange ? onTabChange(key) : setLocalTab(key))}
          >
            <Icon className="size-4" />
            {label}
            {count !== null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
          </Button>
        ))}
        {showTabs && (
          <HeroReviewNotice
            skills={content.SKILLS?.skills ?? []}
            locale={locale}
            disabled={busy}
            onNavigate={(item) => {
              if (!item.section) return
              const selectTab = onTabChange ?? setLocalTab
              selectTab(reviewTab(item.section))
              if (item.skillKey) (onSkillChange ?? setLocalSkill)(item.skillKey)
              setLocalReview(item)
            }}
          />
        )}
      </div>
      <div className="grid items-start gap-4" role="tabpanel" id={`hero-content-${tab}`}>
        {tab === "overview" && (
          <HeroOverview
            heroId={heroId}
            variantId={variantId}
            statDefaults={statDefaults}
            patchCode={patchCode}
            referenceError={referenceError}
            content={content}
            profile={profile}
            locale={locale}
            editable={editable}
            busy={busy}
            onEdit={onEdit}
            onNeedsDraft={onNeedsDraft}
            onTranslate={onTranslate}
            canWrite={canWrite}
            issues={issues}
          />
        )}
        {tab === "videos" && heroId && <SubjectVideosPanel kind="HERO" id={heroId} name={profile?.name || "Tướng"} />}
        {SECTIONS.filter(([key]) => visibleSections.includes(key)).map(([section, , label]) => {
          const Icon = icons[section]
          const data = content[section]
          const editAction = (
            <IconAction
              label={
                editable
                  ? `Chỉnh sửa ${label}`
                  : onNeedsDraft
                    ? `Chỉnh sửa ${label} · tạo bản nháp trước`
                    : `Chỉnh sửa ${label} · cần bản nháp và quyền chỉnh sửa`
              }
              icon={Pencil}
              disabled={(!editable && !onNeedsDraft) || busy}
              onClick={() => (editable ? onEdit(section) : onNeedsDraft?.())}
            />
          )
          let body: ReactNode
          if (section === "SKILLS")
            body = (
              <HeroSkillsView
                action={editAction}
                onTranslate={onTranslate}
                skills={content.SKILLS?.skills ?? []}
                locale={locale}
                heroId={heroId}
                selectedSkillKey={activeSkill}
                onSkillChange={onSkillChange ?? setLocalSkill}
                layout={skillLayout}
                onLayoutChange={onSkillLayoutChange}
              />
            )
          else if (section === "SKINS")
            body = skins.length ? (
              <div className="space-y-4">
                <ImageCreditSummary
                  label="ảnh trang phục"
                  assetIds={skins.flatMap((skin) => Object.values(skinImageIds(skin)))}
                />
                <SkinAcquisitionSummary rows={shop.data?.skins ?? []} total={skins.length} />
                <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2 @min-[1000px]:grid-cols-3">
                  {[...skins]
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((skin) => {
                      const text = translatedText(skin.translations, locale, sectionTextFields.SKINS)
                      return (
                        <SkinCard
                          key={skin.skinKey}
                          skin={skin}
                          name={text?.name || skin.skinKey}
                          locale={locale}
                          action={
                            <HeroTranslationNotice
                              rows={skin.translations}
                              locale={locale}
                              fields={sectionTextFields.SKINS}
                              section="SKINS"
                              entryKey={skin.skinKey}
                              onTranslate={onTranslate}
                              disabled={busy}
                            />
                          }
                        >
                          {text?.description && <Text>{text.description}</Text>}
                          {text?.acquisitionNote && <Text>{text.acquisitionNote}</Text>}
                          {heroId && (
                            <SkinAcquisitionRow
                              heroId={heroId}
                              skinKey={skin.skinKey}
                              skinName={text?.name || skin.skinKey}
                              value={shop.data?.skins.find((row) => row.skinKey === skin.skinKey)}
                              history={shop.data?.skinHistory.filter((row) => row.skinKey === skin.skinKey)}
                              canWrite={canWrite}
                            />
                          )}
                        </SkinCard>
                      )
                    })}
                </div>
              </div>
            ) : (
              <Text>Chưa có trang phục trong bản dữ liệu này.</Text>
            )
          else
            body = (
              <div className="space-y-4">
                {/* Each image's own credit lives in its info button; this line only sums them up. */}
                <ImageCreditSummary
                  label="ảnh tướng"
                  assetIds={(["HEAD", "PORTRAIT", "SPLASH"] as const).map(
                    (role) => content.MEDIA_BINDINGS?.bindings[role],
                  )}
                />
                <div className="grid grid-cols-2 items-start gap-4 @min-[650px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)]">
                  {(["HEAD", "PORTRAIT", "SPLASH"] as const).map((role) => (
                    <div
                      key={role}
                      className={cn("min-w-0 space-y-2", role === "SPLASH" && "col-span-2 @min-[650px]:col-span-1")}
                    >
                      <HeroAsset
                        id={content.MEDIA_BINDINGS?.bindings[role]}
                        alt={`${profile?.name || "Tướng"} · ${role === "HEAD" ? "Đại diện" : role === "PORTRAIT" ? "Chân dung" : "Ảnh nền"}`}
                        className="w-full"
                        naturalAspectRatio={role === "HEAD" ? 1 : role === "PORTRAIT" ? 3 / 4 : 16 / 9}
                        preview
                      />
                      <p className="text-center text-xs text-muted-foreground">
                        {role === "HEAD" ? "Đại diện" : role === "PORTRAIT" ? "Chân dung" : "Ảnh nền"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          return (
            <section
              key={section}
              className={cn(
                "min-w-0 scroll-mt-4",
                section !== "SKILLS" && "admin-section py-4 sm:py-5",
                section === "COMBAT_STATS" && "@min-[900px]:col-span-2",
              )}
              id={`hero-${section}`}
            >
              {section !== "SKILLS" && (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Icon className="size-4 text-muted-foreground" />
                    {section === "PROFILE" ? "Cốt truyện & thông tin" : label}
                  </h3>
                  {editAction}
                </div>
              )}
              {body}
              <HeroContentSources sources={data?.sources ?? []} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
