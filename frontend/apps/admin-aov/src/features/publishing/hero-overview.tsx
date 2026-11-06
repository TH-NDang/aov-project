import { useId, useState, type ReactNode } from "react"
import { BookOpen, ChartNoAxesCombined, ChevronDown, ListChecks, Pencil, Shield } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../terminology/catalog"
import { HeroAsset } from "./hero-asset"
import { HeroPositionBadges, HeroRoleBadge } from "./hero-classification-badges"
import { HeroShopPanel } from "./hero-shop"
import { HeroContentSources } from "./hero-content-sources"
import { heroRatingScale } from "./hero-rating-scale"
import type { ProfileEditorPart } from "./hero-profile-editor"
import { HeroTranslationNotice } from "./hero-translation-notice"
import type { TranslationTarget } from "./hero-translation-model"
import { HeroCombatAttributes } from "./hero-combat-attributes"
import { PatchCaptureLink } from "./patch-capture-panel"
import { captureGroupKeys } from "./patch-capture-model"
import type { StatDefault } from "./combat-attributes"
import type { Content, Profile, Section } from "./types"

const panel = "min-w-0 admin-section py-4"

function OverviewSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const collapsible = text.length > 320
  return (
    <div className="mt-3">
      <p
        id={id}
        className={cn(
          "type-body whitespace-pre-wrap break-words leading-6 text-muted-foreground",
          collapsible && !expanded && "line-clamp-3",
        )}
      >
        <AdminEntityText text={text} />
      </p>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
          className="type-meta mt-1 min-h-8 rounded px-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {expanded ? "Thu gọn giới thiệu" : "Xem đầy đủ giới thiệu"}
        </button>
      )}
    </div>
  )
}

export function HeroOverview({
  content,
  heroId,
  variantId,
  statDefaults,
  patchCode,
  referenceError,
  profile,
  locale,
  editable,
  busy,
  onEdit,
  onNeedsDraft,
  onTranslate,
  canWrite = false,
  issues = [],
}: {
  content: Content
  heroId?: string
  variantId?: string
  statDefaults?: StatDefault[]
  patchCode?: string
  referenceError?: boolean
  profile: Profile["translations"][number] | undefined
  locale: string
  editable: boolean
  busy: boolean
  onEdit: (section: Section, profilePart?: ProfileEditorPart) => void
  /** A revision that cannot change still offers its pencil to someone who can start a draft from it. */
  onNeedsDraft?: () => void
  /** Prices follow the shop and change without a draft, so they only ask for the right to write. */
  canWrite?: boolean
  /** What still stands in the way of publishing this draft. */
  issues?: string[]
  onTranslate?: (target: TranslationTarget) => void
}) {
  const ratings = content.OVERVIEW_RATINGS
  const scale = heroRatingScale(ratings?.scaleCode ?? "GAME_OVERVIEW_10")
  const canStartEditing = editable || !!onNeedsDraft
  const editLabel = (label: string) => (editable ? `Chỉnh sửa ${label}` : `Chỉnh sửa ${label} · tạo bản nháp trước`)
  const edit = (section: Section, label: string) =>
    canStartEditing && (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        disabled={busy}
        aria-label={editLabel(label)}
        title={editLabel(label)}
        onClick={() => (editable ? onEdit(section) : onNeedsDraft?.())}
      >
        <Pencil className="size-4" />
      </Button>
    )
  const header = (title: string, icon: ReactNode, action: ReactNode) => (
    <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
      <h3 className="type-section-title flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {action}
    </div>
  )
  return (
    <div className="@container/overview">
      <div className="grid items-start gap-3 @min-[820px]/overview:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="contents @min-[820px]/overview:block @min-[820px]/overview:space-y-3">
          <section id="hero-PROFILE" className={cn(panel, "order-1")} aria-label="Thông tin tướng">
            <div className="flex items-start gap-3">
              <HeroAsset
                id={content.MEDIA_BINDINGS?.bindings.HEAD}
                alt={profile?.name ?? "Tướng"}
                className="size-20 shrink-0 rounded-xl"
                frameAspectRatio={1}
              />
              <div className="min-w-0 flex-1">
                <h2 className="type-section-title break-words">{profile?.name || "Tướng chưa đặt tên"}</h2>
                {profile?.title && <p className="type-body mt-0.5 text-muted-foreground">{profile.title}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <HeroTranslationNotice
                  rows={content.PROFILE?.translations ?? []}
                  locale={locale}
                  fields={["name", "title", "summary"]}
                  section="PROFILE"
                  entryKey="profile"
                  onTranslate={onTranslate}
                  disabled={busy}
                />
                <PatchCaptureLink groupKey={captureGroupKeys.overview} name="Tổng quan" />
                {edit("PROFILE", "Thông tin")}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              {!!content.PROFILE?.roles.length && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vai trò">
                  {content.PROFILE.roles.map((role) => (
                    <HeroRoleBadge key={role} role={role} />
                  ))}
                </div>
              )}
              <HeroPositionBadges positions={content.PROFILE?.positions ?? []} />
            </div>
            {profile?.summary && <OverviewSummary key={profile.summary} text={profile.summary} />}
            <HeroContentSources sources={content.PROFILE?.sources ?? []} compact />
          </section>
          <section id="hero-COMBAT_STATS" className={cn(panel, "order-3")} aria-label="Chỉ số tướng">
            {header(
              "Thuộc tính chiến đấu",
              <ChartNoAxesCombined className="size-4 text-muted-foreground" />,
              <span className="flex shrink-0 items-center gap-1">
                <PatchCaptureLink groupKey={captureGroupKeys.attributes} name="Chỉ số" />
                {edit("COMBAT_STATS", "Chỉ số")}
              </span>,
            )}
            <HeroCombatAttributes
              heroId={heroId}
              variantId={variantId}
              stats={content.COMBAT_STATS}
              skills={content.SKILLS}
              roles={content.PROFILE?.roles}
              defaults={statDefaults}
              patchCode={patchCode}
              referenceError={referenceError}
            />
            <HeroContentSources sources={content.COMBAT_STATS?.sources ?? []} compact />
          </section>
        </div>
        <div className="contents @min-[820px]/overview:block @min-[820px]/overview:space-y-3">
          {issues.length > 0 && (
            <section className={cn(panel, "order-1")} aria-label="Còn thiếu trước khi xuất bản">
              <h3 className="type-section-title mb-2 flex items-center gap-2">
                <ListChecks className="size-4 text-muted-foreground" />
                Còn thiếu trước khi xuất bản
              </h3>
              <ul className="type-body list-disc space-y-1 pl-5 text-muted-foreground">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </section>
          )}
          {heroId && <HeroShopPanel heroId={heroId} canWrite={canWrite} className={cn(panel, "order-2")} />}
          <section id="hero-OVERVIEW_RATINGS" className={cn(panel, "order-2")} aria-label="Đánh giá tướng">
            {header(
              "Đánh giá",
              <Shield className="size-4 text-muted-foreground" />,
              <span className="flex shrink-0 items-center gap-1">
                <PatchCaptureLink groupKey={captureGroupKeys.overview} name="Đánh giá" />
                {edit("OVERVIEW_RATINGS", "Đánh giá")}
              </span>,
            )}
            {ratings ? (
              <dl className="space-y-3">
                {(
                  [
                    ["survivability", "Sinh tồn"],
                    ["attackDamage", "Đánh thường"],
                    ["skillEffects", "Hiệu ứng kỹ năng"],
                    ["difficulty", "Độ khó"],
                  ] as const
                ).map(([key, title]) => {
                  const stored = ratings[key]
                  const value = Number.isFinite(stored) ? stored / scale.factor : NaN
                  return (
                    <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <dt className="type-body text-muted-foreground">{title}</dt>
                      <dd className="type-body grid grid-cols-[5rem_3.5rem] items-center gap-2 text-right tabular-nums">
                        <div className="flex gap-0.5" aria-hidden="true">
                          {Array.from({ length: scale.maximum }, (_, index) => (
                            <span key={index} className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                              <span
                                className="block h-full bg-primary"
                                style={{
                                  width: `${Number.isFinite(value) ? Math.max(0, Math.min(1, value - index)) * 100 : 0}%`,
                                }}
                              />
                            </span>
                          ))}
                        </div>
                        <span>{Number.isFinite(value) ? `${value}/${scale.maximum}` : "Chưa có"}</span>
                      </dd>
                    </div>
                  )
                })}
              </dl>
            ) : (
              <p className="type-meta">Chưa ghi nhận đánh giá trong bản dữ liệu này.</p>
            )}
            <HeroContentSources sources={ratings?.sources ?? []} compact />
          </section>
          {(profile?.lore || canStartEditing) && (
            <details id="hero-lore" className={cn(panel, "group/lore order-4")}>
              <summary className="type-section-title flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <BookOpen className="size-4 text-muted-foreground" />
                Cốt truyện
                <span className="ml-auto flex items-center gap-2">
                  <HeroTranslationNotice
                    rows={content.PROFILE?.translations ?? []}
                    locale={locale}
                    fields={["lore"]}
                    section="PROFILE"
                    entryKey="profile"
                    onTranslate={onTranslate}
                    disabled={busy}
                  />
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/lore:rotate-180" />
                </span>
              </summary>
              <div className="mt-3">
                {profile?.lore ? (
                  <p className="type-body whitespace-pre-wrap break-words leading-6 text-muted-foreground">
                    <AdminEntityText text={profile.lore} />
                  </p>
                ) : (
                  <p className="type-meta">Chưa có cốt truyện.</p>
                )}
                {canStartEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    title={editLabel("cốt truyện")}
                    onClick={() => (editable ? onEdit("PROFILE", "lore") : onNeedsDraft?.())}
                  >
                    <Pencil className="size-4" />
                    Chỉnh sửa cốt truyện
                  </Button>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
