import type { ComponentType, ReactNode } from "react"
import { useState } from "react"
import { AlertTriangle, BookOpen, ChartNoAxesCombined, Image, Pencil, Shield, Sparkles, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Badge } from "@aov/ui/components/badge"
import { cn } from "@aov/ui/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { ROLES, SECTIONS, type Content, type Section, type Source } from "./types"
import { AdminEntityText, AdminReferenceProvider } from "../terminology/catalog"
import { comparisonFieldLabels } from "./hero-comparison"
import { statLabel } from "./patch-change-model"
import { heroReviewNotes } from "./hero-source-details"
import { HeroSkillsView } from "./hero-skills-view"
import type { HeroContentTab } from "./hero-location"
import { HeroImageSource } from "./hero-image-source"
import { HeroAsset } from "./hero-asset"
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

function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null
  return (
    <details className="mt-5 border-t pt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1">Nguồn & đối chiếu ({sources.length})</summary>
      <ul className="mt-3 space-y-2">
        {sources.map((source, index) => (
          <li key={index}>
            {source.sourceUrl && /^https?:\/\//i.test(source.sourceUrl) ? (
              <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                {source.label}
              </a>
            ) : (
              source.label
            )}
            {" · "}
            {source.verificationState === "VERIFIED" ? "Đã đối chiếu" : "Chưa đối chiếu"}
            {source.note && <p className="mt-1 break-words">{source.note}</p>}
          </li>
        ))}
      </ul>
    </details>
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
  onEdit: (section: Section) => void
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
  const [localTab, setLocalTab] = useState<HeroContentTab>("overview")
  const tab = selectedTab ?? localTab
  const visibleSections: Section[] =
    tab === "overview"
      ? ["PROFILE", "OVERVIEW_RATINGS", "COMBAT_STATS"]
      : tab === "skills"
        ? ["SKILLS"]
        : tab === "skins"
          ? ["SKINS"]
          : ["MEDIA_BINDINGS"]
  return (
    <div className="space-y-5" aria-label="Nội dung tướng">
      {tab === "overview" && (
        <section className="relative isolate overflow-hidden rounded-2xl border bg-card">
          <div className="relative flex items-start gap-4 p-4 sm:p-5">
            <HeroAsset
              id={content.MEDIA_BINDINGS?.bindings.HEAD}
              className="size-16 shrink-0 rounded-xl"
              frameAspectRatio={1}
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="break-words text-xl font-bold tracking-tight">{profile?.name || "Tướng chưa đặt tên"}</h2>
              {profile?.title && <p className="text-sm text-muted-foreground">{profile.title}</p>}
              <div className="flex flex-wrap gap-2">
                {content.PROFILE?.roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {ROLES[role]}
                  </Badge>
                ))}
                {profile && profile.locale !== locale && (
                  <Badge variant="outline">
                    Dự phòng: {profile.locale} · chưa có {locale}
                  </Badge>
                )}
              </div>
            </div>
            {editable && (
              <IconAction label="Chỉnh sửa Thông tin" icon={Pencil} disabled={busy} onClick={() => onEdit("PROFILE")} />
            )}
          </div>
          {profile?.summary && (
            <div className="px-4 pb-4 sm:px-5">
              <Text>{profile.summary}</Text>
            </div>
          )}
        </section>
      )}
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
            ["skins", Sparkles, "Trang phục", content.SKINS?.skins.length ?? 0],
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
      <div
        className={`grid items-start gap-5 ${tab === "overview" ? "@min-[900px]:grid-cols-2" : ""}`}
        role="tabpanel"
        id={`hero-content-${tab}`}
      >
        {SECTIONS.filter(([key]) => visibleSections.includes(key)).map(([section, , label]) => {
          const Icon = icons[section]
          const data = content[section]
          let body: ReactNode
          if (section === "PROFILE")
            body = profile?.lore ? (
              <Text>{profile.lore}</Text>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Chưa có cốt truyện.
                {editable && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit("PROFILE")}>
                    Thêm cốt truyện
                  </Button>
                )}
              </div>
            )
          else if (section === "OVERVIEW_RATINGS")
            body = content.OVERVIEW_RATINGS ? (
              <div className="space-y-4">
                {(
                  [
                    ["survivability", "Sinh tồn"],
                    ["attackDamage", "Đánh thường"],
                    ["skillEffects", "Hiệu ứng kỹ năng"],
                    ["difficulty", "Độ khó"],
                  ] as const
                ).map(([key, title]) => {
                  const value = content.OVERVIEW_RATINGS![key]
                  return (
                    <div key={key}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span>{title}</span>
                        <span>{Number.isFinite(value) ? `${value}/10` : "Chưa có"}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Number.isFinite(value) ? Math.max(0, Math.min(100, value * 10)) : 0}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <Text />
            )
          else if (section === "COMBAT_STATS")
            body = content.COMBAT_STATS?.values.length ? (
              <dl className="grid grid-cols-2 gap-2 @min-[600px]:grid-cols-4">
                {content.COMBAT_STATS.values.map((stat) => (
                  <div key={stat.statKey} className="rounded-lg bg-muted/40 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">
                      {comparisonFieldLabels[stat.statKey] ?? statLabel(stat.statKey)}
                    </dt>
                    <dd className="text-base font-semibold tabular-nums">
                      {stat.baseValue ?? "—"}
                      <span className="ml-1 text-xs font-normal">
                        {["POINT", "UNKNOWN"].includes(stat.unit) ? "" : stat.unit === "PERCENT" ? "%" : stat.unit}
                      </span>
                    </dd>
                    {stat.growthPerLevel !== null && (
                      <p className="text-xs text-muted-foreground">+{stat.growthPerLevel} / cấp</p>
                    )}
                  </div>
                ))}
              </dl>
            ) : (
              <Text />
            )
          else if (section === "SKILLS")
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
            body = content.SKINS?.skins.length ? (
              <div className="grid grid-cols-1 gap-5 @min-[520px]:grid-cols-2 @min-[1000px]:grid-cols-3">
                {[...content.SKINS.skins]
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((skin) => {
                    const text = localized(skin.translations, locale)
                    return (
                      <article key={skin.skinKey} className="space-y-2">
                        <HeroAsset id={skin.artAssetId} className="aspect-[4/3]" />
                        <h4 className="text-sm font-medium">{text?.name || skin.skinKey}</h4>
                        {skin.rarityCode && <Badge variant="outline">{skin.rarityCode}</Badge>}
                        {text?.locale !== locale && (
                          <p className="text-xs text-muted-foreground">Dự phòng: {text?.locale ?? "chưa có"}</p>
                        )}
                        {text?.description && <Text>{text.description}</Text>}
                        {text?.acquisitionNote && <Text>{text.acquisitionNote}</Text>}
                      </article>
                    )
                  })}
              </div>
            ) : (
              <Text>Chưa có trang phục trong bản dữ liệu này.</Text>
            )
          else
            body = (
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
                    <HeroImageSource assetId={content.MEDIA_BINDINGS?.bindings[role]} />
                  </div>
                ))}
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
              <Sources sources={data?.sources ?? []} />
            </section>
          )
        })}
      </div>
    </div>
  )
}
