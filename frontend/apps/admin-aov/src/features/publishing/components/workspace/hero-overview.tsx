import { useId, useState, type ReactNode } from "react"
import { BookOpen, ChartNoAxesCombined, ListChecks, Pencil, Shield } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../../../terminology/catalog"
import { HeroAsset } from "../editing/hero-asset"
import { HeroPositionBadges, HeroRoleBadge } from "./hero-classification-badges"
import { HeroShopPanel } from "../skins/hero-shop"
import { HeroContentSources } from "./hero-content-sources"
import { heroRatingScale } from "@aov/ui/lib/hero-rating-scale"
import type { ProfileEditorPart } from "../editing/hero-profile-editor"
import { HeroTranslationNotice } from "./hero-translation-notice"
import type { TranslationTarget } from "../../model/hero-translation-model"
import { HeroCombatAttributes } from "../assessment/hero-combat-attributes"
import { PatchCaptureLink } from "../captures/patch-capture-buttons"
import { captureGroupKeys } from "../../model/captures/patch-capture-model"
import type { StatDefault } from "../../model/assessment/combat-attributes"
import type { Content, Profile, Section } from "@/lib/hero-types"

// Groups are divided by a line between them; the card's own edge already opens the first one. `admin-section` is not
// used here: its unlayered border would win over `first:border-t-0`.
const panel = "min-w-0 border-t py-4 first:border-t-0 first:pt-0 last:pb-0"

export interface HeroOverviewProps {
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
  /** Another part of the page is open in its editor; this one waits until it is saved or closed. */
  locked?: boolean
  onEdit: (section: Section, profilePart?: ProfileEditorPart) => void
  /** A revision that cannot change still offers its pencil to someone who can start a draft from it. */
  onNeedsDraft?: () => void
  /** Prices follow the shop and change without a draft, so they only ask for the right to write. */
  canWrite?: boolean
  /** What still stands in the way of publishing this draft. */
  issues?: string[]
  onTranslate?: (target: TranslationTarget) => void
}

/** The pencils of the overview: who may start editing, what each button says, and what a click opens. */
function useOverviewEditing({ editable, busy, locked = false, onEdit, onNeedsDraft }: HeroOverviewProps) {
  const canStartEditing = editable || !!onNeedsDraft
  const editLabel = (label: string) =>
    locked
      ? `Chỉnh sửa ${label} · lưu hoặc hủy phần đang sửa trước`
      : editable
        ? `Chỉnh sửa ${label}`
        : `Chỉnh sửa ${label} · tạo bản nháp trước`
  const start = (section: Section, part?: ProfileEditorPart) => {
    if (busy || locked) return
    if (editable) onEdit(section, part)
    else onNeedsDraft?.()
  }
  const edit = (section: Section, label: string) =>
    canStartEditing && (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        disabled={busy}
        aria-disabled={locked}
        aria-label={editLabel(label)}
        title={editLabel(label)}
        onClick={() => start(section)}
      >
        <Pencil className="size-4" />
      </Button>
    )
  return { canStartEditing, editLabel, start, edit, locked }
}

// A group of the overview is labelled smaller than the page's sections, so the two levels read apart.
function GroupHeader({ title, icon, action }: { title: string; icon: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-2">
      <h3 className="type-label flex items-center gap-2 text-muted-foreground">
        {icon}
        {title}
      </h3>
      {action}
    </div>
  )
}

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

/** The lore sits behind one icon on the hero card and opens in its own window when someone wants to read it. */
function LoreButton(props: HeroOverviewProps & { name: string }) {
  const { content, profile, locale, busy, onTranslate, name } = props
  const { canStartEditing, editLabel, start, locked } = useOverviewEditing(props)
  const [open, setOpen] = useState(false)
  if (!profile?.lore && !canStartEditing) return null
  const label = profile?.lore ? "Đọc cốt truyện" : "Cốt truyện · chưa có"
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-8 shrink-0", !profile?.lore && "text-muted-foreground")}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <BookOpen className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="flex-row items-center gap-2 pr-8">
            <DialogTitle className="type-section-title flex min-w-0 flex-1 items-center gap-2">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Cốt truyện · {name}</span>
            </DialogTitle>
            <HeroTranslationNotice
              rows={content.PROFILE?.translations ?? []}
              locale={locale}
              fields={["lore"]}
              section="PROFILE"
              entryKey="profile"
              onTranslate={onTranslate}
              disabled={busy}
            />
            {canStartEditing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-disabled={locked}
                className="size-8 shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                aria-label={editLabel("cốt truyện")}
                title={editLabel("cốt truyện")}
                onClick={() => {
                  if (locked) return
                  setOpen(false)
                  start("PROFILE", "lore")
                }}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            <DialogDescription className="sr-only">Cốt truyện của tướng theo ngôn ngữ đang đọc.</DialogDescription>
          </DialogHeader>
          {profile?.lore ? (
            <p className="type-body whitespace-pre-wrap break-words leading-7">
              <AdminEntityText text={profile.lore} />
            </p>
          ) : (
            <p className="type-meta">Chưa có cốt truyện.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The hero as a card: picture, name and title with the shop price under them, roles, summary; the lore behind an icon. */
export function HeroOverviewCard(props: HeroOverviewProps) {
  const { content, heroId, profile, locale, busy, onTranslate, canWrite = false } = props
  const { edit } = useOverviewEditing(props)
  const name = profile?.name || "Tướng chưa đặt tên"
  return (
    <section id="hero-PROFILE" className="flex min-w-0 flex-1 flex-col" aria-label="Thông tin tướng">
      <div className="flex items-start gap-3">
        <HeroAsset
          id={content.MEDIA_BINDINGS?.bindings.HEAD}
          alt={profile?.name ?? "Tướng"}
          className="size-20 shrink-0 rounded-xl"
          frameAspectRatio={1}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <h3 className="type-section-title break-words">{name}</h3>
            {profile?.title && <p className="type-body text-muted-foreground">{profile.title}</p>}
          </div>
          {heroId && <HeroShopPanel heroId={heroId} canWrite={canWrite} />}
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
          <LoreButton {...props} name={name} />
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
      <div className="mt-auto pt-2">
        <HeroContentSources sources={content.PROFILE?.sources ?? []} compact />
      </div>
    </section>
  )
}

/** What the hero is weighed by: what still blocks publishing, the ratings, then the combat attributes. */
/**
 * The ratings and the combat attributes. `part` draws one of them alone, so a page can place the ratings beside the
 * hero card and the attributes in a wider row of their own.
 */
export function HeroOverviewFacts({
  part = "all",
  ...props
}: HeroOverviewProps & { part?: "all" | "ratings" | "attributes" }) {
  const { content, heroId, variantId, statDefaults, patchCode, referenceError, issues = [] } = props
  const { edit } = useOverviewEditing(props)
  const ratings = content.OVERVIEW_RATINGS
  const scale = heroRatingScale(ratings?.scaleCode ?? "GAME_OVERVIEW_10")
  return (
    <div className="min-w-0">
      {part !== "attributes" && issues.length > 0 && (
        <section className={panel} aria-label="Còn thiếu trước khi xuất bản">
          <GroupHeader title="Còn thiếu trước khi xuất bản" icon={<ListChecks className="size-3.5" />} />
          <ul className="type-body list-disc space-y-1 pl-5 text-muted-foreground">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}
      {part !== "attributes" && (
        <section id="hero-OVERVIEW_RATINGS" className={panel} aria-label="Đánh giá tướng">
          <GroupHeader
            title="Đánh giá"
            icon={<Shield className="size-3.5" />}
            action={
              <span className="flex shrink-0 items-center gap-1">
                <PatchCaptureLink groupKey={captureGroupKeys.overview} name="Đánh giá" />
                {edit("OVERVIEW_RATINGS", "Đánh giá")}
              </span>
            }
          />
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
        </section>
      )}
      {part !== "ratings" && (
        <section id="hero-COMBAT_STATS" className={cn(panel, "@container/stats")} aria-label="Chỉ số tướng">
          <GroupHeader
            title="Thuộc tính chiến đấu"
            icon={<ChartNoAxesCombined className="size-3.5" />}
            action={
              <span className="flex shrink-0 items-center gap-1">
                <PatchCaptureLink groupKey={captureGroupKeys.attributes} name="Chỉ số" />
                {edit("COMBAT_STATS", "Chỉ số")}
              </span>
            }
          />
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
      )}
    </div>
  )
}
