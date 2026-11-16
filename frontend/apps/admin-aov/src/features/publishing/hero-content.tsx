import type { ComponentType, ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ImageIcon, LayoutDashboard, Pencil, Shirt, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { SectionHeading, sectionFrame } from "@/components/section-contents"
import { SECTIONS, type Content, type Section } from "./types"
import { HeroOverviewCard, HeroOverviewFacts, type HeroOverviewProps } from "./hero-overview"
import type { StatDefault } from "./combat-attributes"
import { translatedText, sectionTextFields, type TranslationTarget } from "./hero-translation-model"
import { SubjectVideosPanel } from "../videos/subject-videos-panel"
import { HeroContentSources } from "./hero-content-sources"
import { AdminEntityText, AdminReferenceProvider } from "../terminology/catalog"
import { reviewTab, type HeroReviewItem } from "./hero-source-review"
import { HeroSkillsView } from "./hero-skills-view"
import type { HeroContentTab } from "./hero-location"
import { HeroAsset } from "./hero-asset"
import { HeroGallery } from "./hero-gallery"
import { HeroSkinsView } from "./hero-skins-view"
import { visibleSkins } from "./hero-skins"
import { heroContentSectionId, heroContentTabs } from "./hero-content-tabs"
import { HeroEvaluation } from "./hero-evaluation"
import type { Revision } from "./types"
export { HeroAsset } from "./hero-asset"

/** An editor open on the page: it takes the place of the section it changes, the rest of the page stays readable. */
export interface HeroSectionEditing {
  section: Section
  /** The part being changed, shown next to the section title, such as the profile details or the lore. */
  title: string
  node: ReactNode
}

const LOCKED = "lưu hoặc hủy phần đang sửa trước"

/** Shows that a section is open in its editor; the editor itself says what can be changed. */
function EditingStatus({ part }: { part?: string }) {
  return (
    <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
      <Pencil className="size-3" />
      {part ? `Đang sửa · ${part}` : "Đang sửa"}
    </span>
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
 * The hero's content on one page: the profile beside its ratings and attributes, then skills, skins, images and videos
 * in full. Each part keeps its own pencil while the version is a draft.
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
  heroId,
  selectedSkillKey,
  onSkillChange,
  skillLayout,
  onSkillLayoutChange,
  reviewTarget,
  onReviewShown,
  reveal,
  editing,
  sharedTitle = false,
  revision,
}: {
  /** The hero is a form: its own title is not shown, since the shared one of the hero that holds it is. */
  sharedTitle?: boolean
  /** The version on screen; the evaluation saves straight into it while it is a draft. */
  revision?: Revision
  /** The editor open on the page, if any. */
  editing?: HeroSectionEditing | null
  /** A part of the overview to bring into view, such as the one a source image was picked for; `at` makes it new. */
  reveal?: { section: Section; at: number } | null
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
  /** `focus` names the one skin to open, when the pencil of a single skin was used. */
  onEdit: (section: Section, profilePart?: "information" | "lore", focus?: string) => void
  onNeedsDraft?: () => void
  /** Prices and skin acquisition follow the shop, so they only ask for the right to write. */
  canWrite?: boolean
  issues?: string[]
  onTranslate?: (target: TranslationTarget) => void
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
  const activeSkill = selectedSkillKey ?? localSkill
  const target = reviewTarget
  const editingTab = editing ? reviewTab(editing.section) : null
  const name = profile?.name || "Tướng"

  useLayoutEffect(() => {
    if (!target?.section) return
    if (target.skillKey && activeSkill !== target.skillKey) return
    const section = contentRef.current?.querySelector<HTMLElement>(`#hero-${target.section}`)
    if (!section) return
    const skill = target.skillKey
      ? [...section.querySelectorAll<HTMLElement>("[data-review-skill]")].find(
          (el) => el.dataset.reviewSkill === target.skillKey,
        )
      : undefined
    if (target.skillKey && !skill) return
    // The whole attribute list opens in its own window, which takes the focus.
    const attributes = skill ? null : section.querySelector<HTMLButtonElement>("button[data-review-attributes]")
    if (attributes) {
      section.scrollIntoView?.({ block: "center" })
      attributes.click()
      onReviewShown?.()
      return
    }
    const details = skill?.querySelector<HTMLDetailsElement>("details[data-review-source]")
    if (details) details.open = true
    const element = details?.querySelector("summary") ?? skill ?? section
    if (!element.matches("summary")) element.tabIndex = -1
    element.focus({ preventScroll: true })
    element.scrollIntoView?.({ block: "center" })
    onReviewShown?.()
  }, [target, activeSkill, onReviewShown])

  // Runs after the bars have put the tab back where it was left, so the part asked for wins. A short ring shows which
  // part was meant once the page settles.
  useEffect(() => {
    if (!reveal) return
    const part = contentRef.current?.querySelector<HTMLElement>(`#hero-${reveal.section}`)
    if (!part) return
    part.scrollIntoView?.({ block: "center", behavior: "smooth" })
    part.animate?.([{ boxShadow: "0 0 0 2px var(--primary)" }, { boxShadow: "0 0 0 2px transparent" }], {
      duration: 1400,
      easing: "ease-out",
    })
  }, [reveal])

  // The section open in an editor shows its state instead of the button; the others wait until it is saved or closed.
  const editAction = (section: Section) => {
    // A published version is edited through the pencil in the header, which starts the draft first.
    if (editing?.section === section || !editable) return null
    const label = SECTIONS.find(([key]) => key === section)![2]
    const buttonLabel = editing
      ? `Chỉnh sửa ${label} · ${LOCKED}`
      : editable
        ? `Chỉnh sửa ${label}`
        : onNeedsDraft
          ? `Chỉnh sửa ${label} · tạo bản nháp trước`
          : `Chỉnh sửa ${label} · cần bản nháp và quyền chỉnh sửa`
    const disabled = (!editable && !onNeedsDraft) || busy || !!editing
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={buttonLabel}
        title={buttonLabel}
        aria-disabled={disabled}
        className="size-8 shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (disabled) return
          if (editable) onEdit(section)
          else onNeedsDraft?.()
        }}
      >
        <Pencil className="size-4" />
      </Button>
    )
  }
  const sectionStatus = (tab: HeroContentTab) =>
    editingTab === tab ? <EditingStatus part={tab === "overview" ? editing!.title : undefined} /> : undefined
  const editorIn = (tab: HeroContentTab) => (editingTab === tab ? editing!.node : null)
  const overview: HeroOverviewProps = {
    heroId,
    variantId,
    statDefaults,
    patchCode,
    referenceError,
    content,
    profile: sharedTitle && profile ? { ...profile, title: null } : profile,
    locale,
    editable,
    busy,
    locked: !!editing,
    onEdit,
    onNeedsDraft,
    onTranslate,
    canWrite,
    issues,
  }
  const roles = ["HEAD", "PORTRAIT", "SPLASH"] as const
  const roleLabel = (role: (typeof roles)[number]) =>
    role === "HEAD" ? "Đại diện" : role === "PORTRAIT" ? "Chân dung" : "Ảnh nền"

  const panels: Record<HeroContentTab, () => ReactNode> = {
    overview: () =>
      editingTab === "overview" ? (
        // An editor gets the whole tab; the previews come back once it is saved or closed.
        <TabSection title="Tổng quan" icon={LayoutDashboard} status={sectionStatus("overview")}>
          {editing!.node}
        </TabSection>
      ) : (
        // The hero card and its ratings form one row of equal height; the combat attributes take a full row under
        // them, and the skills follow. A narrow page stacks everything in that order.
        <div className="@container/overview">
          <div className="grid items-stretch gap-6 @min-[820px]/overview:grid-cols-[minmax(0,1fr)_22rem]">
            <div className={cn("flex min-w-0 flex-col", sectionFrame)}>
              <HeroOverviewCard {...overview} />
            </div>
            <aside aria-label="Đánh giá" className={cn("min-w-0", sectionFrame)}>
              <HeroOverviewFacts {...overview} part="ratings" />
            </aside>
          </div>
          {/* The combat attributes read across the page, under the card and its ratings, before the skills. */}
          <div className={cn("mt-6 min-w-0", sectionFrame)}>
            <HeroOverviewFacts {...overview} part="attributes" />
          </div>
        </div>
      ),
    skills: () => (
      <TabSection
        title="Kỹ năng"
        icon={Swords}
        count={content.SKILLS?.skills.length ?? 0}
        status={sectionStatus("skills")}
        actions={editAction("SKILLS")}
      >
        {editorIn("skills") ?? (
          <div id="hero-SKILLS" className="min-w-0">
            <HeroSkillsView
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
        )}
      </TabSection>
    ),
    // Traits and notes save through their own endpoints, so they keep their own pencils and never take the page editor.
    evaluation: () => (
      <HeroEvaluation
        heroId={heroId}
        revision={revision}
        content={content}
        locale={locale}
        editable={editable && !!heroId && !!revision}
        busy={busy}
        locked={!!editing}
        onNeedsDraft={onNeedsDraft}
      />
    ),
    skins: () => (
      <TabSection
        title="Trang phục"
        icon={Shirt}
        count={skins.length}
        status={sectionStatus("skins")}
        actions={editAction("SKINS")}
      >
        {editorIn("skins") ?? (
          <div id="hero-SKINS" className="min-w-0">
            {skins.length ? (
              <HeroSkinsView
                skins={skins}
                locale={locale}
                heroId={heroId}
                canWrite={canWrite}
                busy={busy}
                onTranslate={onTranslate}
                onEditSkin={
                  editable || onNeedsDraft
                    ? (key) => {
                        if (editing) return
                        if (editable) onEdit("SKINS", undefined, key)
                        else onNeedsDraft?.()
                      }
                    : undefined
                }
                editSkinLabel={(skin) =>
                  editing
                    ? `Chỉnh sửa trang phục ${skin} · lưu hoặc hủy phần đang sửa trước`
                    : editable
                      ? `Chỉnh sửa trang phục ${skin}`
                      : `Chỉnh sửa trang phục ${skin} · tạo bản nháp trước`
                }
              />
            ) : (
              <Text>Chưa có trang phục trong bản dữ liệu này.</Text>
            )}
            <HeroContentSources sources={content.SKINS?.sources ?? []} />
          </div>
        )}
      </TabSection>
    ),
    media: () => (
      <TabSection title="Ảnh" icon={ImageIcon} status={sectionStatus("media")} actions={editAction("MEDIA_BINDINGS")}>
        {editorIn("media") ?? (
          <div id="hero-MEDIA_BINDINGS" className="min-w-0 space-y-4">
            {/* No credit summary line here: each image keeps its own credit in its info button and the large view. */}
            {/* A saved hero shows its whole gallery: every version's images and those attached to it (ADR-027). */}
            {heroId ? (
              <HeroGallery
                heroId={heroId}
                name={name}
                locale={locale}
                content={content}
                canWrite={canWrite}
                reloadKey={roles.map((role) => content.MEDIA_BINDINGS?.bindings[role] ?? "").join(",")}
              />
            ) : (
              <div className="grid grid-cols-2 items-start gap-4 @min-[650px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)]">
                {roles.map((role) => (
                  <div
                    key={role}
                    className={cn("min-w-0 space-y-2", role === "SPLASH" && "col-span-2 @min-[650px]:col-span-1")}
                  >
                    <HeroAsset
                      id={content.MEDIA_BINDINGS?.bindings[role]}
                      alt={`${name} · ${roleLabel(role)}`}
                      className="w-full"
                      naturalAspectRatio={role === "HEAD" ? 1 : role === "PORTRAIT" ? 3 / 4 : 16 / 9}
                      preview
                    />
                    <p className="type-meta text-center">{roleLabel(role)}</p>
                  </div>
                ))}
              </div>
            )}
            <HeroContentSources sources={content.MEDIA_BINDINGS?.sources ?? []} />
          </div>
        )}
      </TabSection>
    ),
    // The video panel brings its own heading and add button.
    videos: () =>
      heroId ? (
        <div className={sectionFrame}>
          <SubjectVideosPanel kind="HERO" id={heroId} name={name} />
        </div>
      ) : null,
  }

  // Every part is on one page, in reading order, so nothing waits behind a tab.
  return (
    <div ref={contentRef} aria-label="Nội dung tướng" className="@container min-w-0 space-y-6">
      {heroContentTabs(!!heroId).map((key) => (
        <div key={key} id={heroContentSectionId(key)} className="min-w-0 scroll-mt-28">
          {panels[key]()}
        </div>
      ))}
    </div>
  )
}

/** A detail tab's card: the heading carries the count, the editing state and the pencil. */
function TabSection({
  title,
  icon,
  count,
  status,
  actions,
  children,
}: {
  title: string
  icon: ComponentType<{ className?: string }>
  count?: number
  status?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className={cn("min-w-0", sectionFrame)}>
      <SectionHeading title={title} icon={icon} count={count} status={status} actions={actions} />
      {children}
    </section>
  )
}
