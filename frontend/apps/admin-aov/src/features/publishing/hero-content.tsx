import type { ComponentType, ReactNode } from "react"
import { useState } from "react"
import { AlertTriangle, BookOpen, ChartNoAxesCombined, Image, Pencil, Shield, Sparkles, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { SECTIONS, type Content, type Section } from "./types"
import { HeroOverview } from "./hero-overview"
import { HeroContentSources } from "./hero-content-sources"
import { AdminEntityText, AdminReferenceProvider } from "../terminology/catalog"
import { heroReviewNotes } from "./hero-source-details"
import { HeroSkillsView } from "./hero-skills-view"
import type { HeroContentTab } from "./hero-location"
import { HeroAsset } from "./hero-asset"
import { ImageCreditSummary } from "./image-credit-summary"
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
  locale,
  editable,
  busy,
  onEdit,
  tab: selectedTab,
  onTabChange,
  heroId,
  selectedSkillKey,
  onSkillChange,
  skillLayout,
  onSkillLayoutChange,
  showTabs = true,
}: {
  /** The hero page shows the content sections in its own tab row. */
  showTabs?: boolean
  content: Content
  locale: string
  editable: boolean
  busy: boolean
  onEdit: (section: Section, profilePart?: "information" | "lore") => void
  tab?: HeroContentTab
  onTabChange?: (tab: HeroContentTab) => void
  heroId?: string
  selectedSkillKey?: string
  onSkillChange?: (key: string) => void
  skillLayout?: "focus" | "flat"
  onSkillLayoutChange?: (layout: "focus" | "flat") => void
}) {
  const profile = localized(content.PROFILE?.translations, locale)
  const reviewNotes = heroReviewNotes(content.SKILLS?.skills ?? [])
  // The base appearance repeats the hero's own images, which the Images tab already shows.
  const skins = visibleSkins(content.SKINS?.skins ?? [])
  const [localTab, setLocalTab] = useState<HeroContentTab>("overview")
  const tab = selectedTab ?? localTab
  const visibleSections: Section[] =
    tab === "overview" ? [] : tab === "skills" ? ["SKILLS"] : tab === "skins" ? ["SKINS"] : ["MEDIA_BINDINGS"]
  return (
    <div className="space-y-4" aria-label="Nội dung tướng">
      {reviewNotes.length > 0 && (
        <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            {reviewNotes.length} ghi chú cần đối chiếu từ nguồn
          </summary>
          <ul className="mt-3 space-y-2 pl-6 text-sm leading-6 text-muted-foreground">
            {reviewNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
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
      </div>
      <div className="grid items-start gap-4" role="tabpanel" id={`hero-content-${tab}`}>
        {tab === "overview" && (
          <HeroOverview
            content={content}
            profile={profile}
            locale={locale}
            editable={editable}
            busy={busy}
            onEdit={onEdit}
          />
        )}
        {SECTIONS.filter(([key]) => visibleSections.includes(key)).map(([section, , label]) => {
          const Icon = icons[section]
          const data = content[section]
          let body: ReactNode
          if (section === "SKILLS")
            body = (
              <HeroSkillsView
                skills={content.SKILLS?.skills ?? []}
                locale={locale}
                heroId={heroId}
                selectedSkillKey={selectedSkillKey}
                onSkillChange={onSkillChange}
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
                <div className="grid grid-cols-1 gap-4 @min-[520px]:grid-cols-2 @min-[1000px]:grid-cols-3">
                  {[...skins]
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map((skin) => {
                      const text = localized(skin.translations, locale)
                      return (
                        <SkinCard key={skin.skinKey} skin={skin} name={text?.name || skin.skinKey} locale={locale}>
                          {text?.locale !== locale && (
                            <p className="type-meta">Dự phòng: {text?.locale ?? "chưa có"}</p>
                          )}
                          {text?.description && <Text>{text.description}</Text>}
                          {text?.acquisitionNote && <Text>{text.acquisitionNote}</Text>}
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
                "min-w-0 scroll-mt-4 rounded-2xl border bg-card p-4 sm:p-5",
                section === "COMBAT_STATS" && "@min-[900px]:col-span-2",
              )}
              id={`hero-${section}`}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Icon className="size-4 text-muted-foreground" />
                  {section === "PROFILE" ? "Cốt truyện & thông tin" : label}
                </h3>
                <IconAction
                  label={editable ? `Chỉnh sửa ${label}` : `Chỉnh sửa ${label} · cần bản nháp và quyền chỉnh sửa`}
                  icon={Pencil}
                  disabled={!editable || busy}
                  onClick={() => onEdit(section)}
                />
              </div>
              {body}
              <HeroContentSources sources={data?.sources ?? []} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
