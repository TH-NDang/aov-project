import type { ComponentType, ReactNode } from "react"
import { useLayoutEffect, useRef, useState } from "react"
import { BookOpen, Clapperboard, ImageIcon, Pencil, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { catalogIcons } from "@aov/ui/components/catalog-icons"
import { cn } from "@aov/ui/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { ContentsSection, SectionContents, useSectionContents, type ContentsEntry } from "@/components/section-contents"
import { SECTIONS, type Content, type Section } from "./types"
import { HeroOverview } from "./hero-overview"
import type { StatDefault } from "./combat-attributes"
import { translatedText, sectionTextFields, type TranslationTarget } from "./hero-translation-model"
import { SubjectVideosPanel } from "../videos/subject-videos-panel"
import { HeroContentSources } from "./hero-content-sources"
import { AdminEntityText, AdminReferenceProvider } from "../terminology/catalog"
import { reviewTab, type HeroReviewItem } from "./hero-source-review"
import { HeroSkillsView } from "./hero-skills-view"
import type { HeroContentTab } from "./hero-location"
import { HeroAsset } from "./hero-asset"
import { ImageCreditSummary } from "./image-credit-summary"
import { HeroSkinsView } from "./hero-skins-view"
import { visibleSkins } from "./hero-skins"
export { HeroAsset } from "./hero-asset"

/** The element id of a content section; links and the old tab keys (`?tab=skills`) land on it. */
export const heroContentSectionId = (tab: HeroContentTab) => `hero-content-${tab}`

const sectionTab = (id: string | undefined) =>
  (id?.startsWith("hero-content-") ? id.slice("hero-content-".length) : "overview") as HeroContentTab

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

/**
 * The hero's content as one page: overview, skills, skins, images and videos in that order, with a contents list that
 * follows the reader. Sections after the overview load as they come near the screen, as their tabs used to.
 */
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
  tab = "overview",
  onTabChange,
  onVisibleTabChange,
  heroId,
  selectedSkillKey,
  onSkillChange,
  skillLayout,
  onSkillLayoutChange,
  reviewTarget,
  onReviewShown,
}: {
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
  /** The section an address asks for; the page opens on it. */
  tab?: HeroContentTab
  /** The reader picked a section from the contents list. */
  onTabChange?: (tab: HeroContentTab) => void
  /** The section being read changed while scrolling. */
  onVisibleTabChange?: (tab: HeroContentTab) => void
  heroId?: string
  selectedSkillKey?: string
  onSkillChange?: (key: string) => void
  skillLayout?: "focus" | "flat"
  onSkillLayoutChange?: (layout: "focus" | "flat") => void
}) {
  const profile = translatedText(content.PROFILE?.translations ?? [], locale, sectionTextFields.PROFILE)
  // The base appearance repeats the hero's own images, which the Images section already shows.
  const skins = visibleSkins(content.SKINS?.skins ?? [])
  const [localSkill, setLocalSkill] = useState<string>()
  const contentRef = useRef<HTMLDivElement>(null)
  const contents = useSectionContents({
    requested: heroContentSectionId(tab === "videos" && !heroId ? "overview" : tab),
    first: heroContentSectionId("overview"),
  })
  const activeSkill = selectedSkillKey ?? localSkill
  const target = reviewTarget
  const { revealed, prepare } = contents
  useLayoutEffect(() => {
    if (!target?.section) return
    // A lazy section has to be on the page before the warning inside it can be found, and the ones above it loaded so
    // the warning stays where it is brought.
    if (!prepare(heroContentSectionId(reviewTab(target.section)))) return
    if (target.skillKey && activeSkill !== target.skillKey) return
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
    onReviewShown?.()
  }, [target, activeSkill, onReviewShown, revealed, prepare])

  const editAction = (section: Section) => {
    const label = SECTIONS.find(([key]) => key === section)![2]
    return (
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
  }
  const entries: ContentsEntry[] = [
    { id: heroContentSectionId("overview"), label: "Tổng quan", icon: BookOpen },
    { id: heroContentSectionId("skills"), label: "Kỹ năng", icon: Swords, count: content.SKILLS?.skills.length ?? 0 },
    { id: heroContentSectionId("skins"), label: "Trang phục", icon: catalogIcons.skins, count: skins.length },
    { id: heroContentSectionId("media"), label: "Ảnh", icon: ImageIcon },
    ...(heroId ? [{ id: heroContentSectionId("videos"), label: "Video", icon: Clapperboard }] : []),
  ]
  const roles = ["HEAD", "PORTRAIT", "SPLASH"] as const
  const roleLabel = (role: (typeof roles)[number]) =>
    role === "HEAD" ? "Đại diện" : role === "PORTRAIT" ? "Chân dung" : "Ảnh nền"

  return (
    <div ref={contentRef} aria-label="Nội dung tướng">
      <SectionContents
        contents={contents}
        entries={entries}
        // The scrolled hero name (48px) and the workspace tab row stay stuck above the sections.
        className="[--contents-offset:85px] @max-2xl:[--contents-offset:105px]"
        onNavigate={(id) => onTabChange?.(sectionTab(id))}
        onActiveChange={onVisibleTabChange && ((id) => onVisibleTabChange(sectionTab(id)))}
      >
        <ContentsSection id={heroContentSectionId("overview")} title="Tổng quan" icon={BookOpen}>
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
        </ContentsSection>
        <ContentsSection
          id={heroContentSectionId("skills")}
          title="Kỹ năng"
          icon={Swords}
          count={content.SKILLS?.skills.length ?? 0}
          lazy
        >
          <div id="hero-SKILLS" className="min-w-0">
            <HeroSkillsView
              action={editAction("SKILLS")}
              onTranslate={onTranslate}
              skills={content.SKILLS?.skills ?? []}
              locale={locale}
              heroId={heroId}
              selectedSkillKey={activeSkill}
              onSkillChange={onSkillChange ?? setLocalSkill}
              layout={skillLayout}
              onLayoutChange={onSkillLayoutChange}
            />
            <HeroContentSources sources={content.SKILLS?.sources ?? []} />
          </div>
        </ContentsSection>
        <ContentsSection
          id={heroContentSectionId("skins")}
          title="Trang phục"
          icon={catalogIcons.skins}
          count={skins.length}
          actions={editAction("SKINS")}
          lazy
          placeholderHeight={480}
        >
          <div id="hero-SKINS" className="min-w-0">
            {skins.length ? (
              <HeroSkinsView
                skins={skins}
                locale={locale}
                heroId={heroId}
                canWrite={canWrite}
                busy={busy}
                onTranslate={onTranslate}
              />
            ) : (
              <Text>Chưa có trang phục trong bản dữ liệu này.</Text>
            )}
            <HeroContentSources sources={content.SKINS?.sources ?? []} />
          </div>
        </ContentsSection>
        <ContentsSection
          id={heroContentSectionId("media")}
          title="Ảnh"
          icon={ImageIcon}
          actions={editAction("MEDIA_BINDINGS")}
          lazy
        >
          <div id="hero-MEDIA_BINDINGS" className="min-w-0 space-y-4">
            {/* Each image's own credit lives in its info button; this line only sums them up. */}
            <ImageCreditSummary
              label="ảnh tướng"
              assetIds={roles.map((role) => content.MEDIA_BINDINGS?.bindings[role])}
            />
            <div className="grid grid-cols-2 items-start gap-4 @min-[650px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)]">
              {roles.map((role) => (
                <div
                  key={role}
                  className={cn("min-w-0 space-y-2", role === "SPLASH" && "col-span-2 @min-[650px]:col-span-1")}
                >
                  <HeroAsset
                    id={content.MEDIA_BINDINGS?.bindings[role]}
                    alt={`${profile?.name || "Tướng"} · ${roleLabel(role)}`}
                    className="w-full"
                    naturalAspectRatio={role === "HEAD" ? 1 : role === "PORTRAIT" ? 3 / 4 : 16 / 9}
                    preview
                  />
                  <p className="type-meta text-center">{roleLabel(role)}</p>
                </div>
              ))}
            </div>
            <HeroContentSources sources={content.MEDIA_BINDINGS?.sources ?? []} />
          </div>
        </ContentsSection>
        {heroId && (
          // The video panel brings its own heading and add button.
          <ContentsSection id={heroContentSectionId("videos")} label="Video" lazy placeholderHeight={240}>
            <SubjectVideosPanel kind="HERO" id={heroId} name={profile?.name || "Tướng"} />
          </ContentsSection>
        )}
      </SectionContents>
    </div>
  )
}
