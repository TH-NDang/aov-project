import { useRef, useState, type ComponentType, type ReactNode } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { ChevronRight, Clapperboard, ImageIcon, Play, Shirt, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { currentMediaSources } from "@aov/ui/lib/media-credit"
import { videoThumbnail } from "@aov/ui/lib/video-playback"
import { cn } from "@aov/ui/lib/utils"
import type { LightboxImage } from "@/components/image-lightbox"
import { SectionHeading, sectionFrame } from "@/components/section-contents"
import { ImageCreditPanel } from "../media/image-credit-panel"
import { visibleSources } from "../media/media-source-gaps"
import { AdminEntityText } from "../terminology/catalog"
import { videoApi, videoKeys } from "../videos/video-api"
import type { AdminVideo } from "../videos/video-model"
import { PURPOSE_LABELS } from "../videos/video-model"
import { VideoPlayerDialog } from "../videos/video-player-dialog"
import { HeroAsset } from "./hero-asset"
import { heroContentAssetQuery } from "./hero-content-asset"
import type { HeroContentTab } from "./hero-location"
import { groupHeroSkills, skillLabel } from "./hero-skills"
import { sectionTextFields, translatedText } from "./hero-translation-model"
import { SkillArtwork, SkillArtworkStack } from "./skill-artwork"
import type { Content, Skill, Skin } from "./types"

/** Opens a content tab in full. */
export type OpenHeroTab = (tab: HeroContentTab) => void

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring"

/**
 * A short look at one tab on the overview. Its items are looked at where they are (a skill's text, a picture in the
 * large view, a video in the player); only its details button moves to the tab.
 */
function PreviewCard({
  tab,
  title,
  icon,
  count,
  onOpen,
  className,
  children,
}: {
  tab: HeroContentTab
  title: string
  icon: ComponentType<{ className?: string }>
  count?: number
  onOpen: OpenHeroTab
  className?: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} data-preview={tab} className={cn(sectionFrame, "min-w-0", className)}>
      <SectionHeading
        title={title}
        icon={icon}
        count={count}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mr-2 text-muted-foreground"
            aria-label={`Xem chi tiết ${title.toLocaleLowerCase("vi")}`}
            onClick={() => onOpen(tab)}
          >
            Xem chi tiết
            <ChevronRight className="size-4" />
          </Button>
        }
      />
      {children}
    </section>
  )
}

/** The large view of pictures that already sit on the page, with their credits, in the order given. */
function useGallery(entries: readonly { id?: string | null; title: string }[]) {
  // One query per picture: an empty slot asks for nothing, and a picture used twice is read once.
  const ids = [...new Set(entries.flatMap(({ id }) => (id ? [id] : [])))]
  const assets = useQueries({ queries: ids.map((id) => heroContentAssetQuery(id)) })
  const images: LightboxImage[] = []
  const positions = new Map<number, number>()
  entries.forEach((entry, order) => {
    const asset = entry.id ? assets[ids.indexOf(entry.id)]?.data : undefined
    if (!asset?.currentUrl) return
    positions.set(order, images.length)
    images.push({
      path: asset.currentUrl,
      title: entry.title,
      meta: (
        <ImageCreditPanel
          sources={visibleSources(currentMediaSources(asset.provenance ?? [], asset.currentVersionId))}
          assetId={asset.id}
        />
      ),
    })
  })
  return (order: number) => {
    const index = positions.get(order)
    return index === undefined ? undefined : { images, index }
  }
}

/** The skills as a strip of icons; the chosen one shows its name and the start of its text. */
export function SkillsPreview({
  skills,
  heroId,
  locale,
  selectedSkillKey,
  onSkillChange,
  onOpen,
  className,
}: {
  skills: readonly Skill[]
  heroId?: string
  locale: string
  /** Shared with the skills tab, so its details open on the skill looked at here. */
  selectedSkillKey?: string
  onSkillChange: (key: string) => void
  onOpen: OpenHeroTab
  className?: string
}) {
  const groups = groupHeroSkills(skills)
  const current = skills.find((skill) => skill.skillKey === selectedSkillKey) ?? groups[0]?.skills[0]
  const text = current && translatedText(current.translations, locale, sectionTextFields.SKILLS)
  return (
    <PreviewCard tab="skills" title="Kỹ năng" icon={Swords} count={skills.length} onOpen={onOpen} className={className}>
      {current ? (
        <div className="min-w-0 space-y-3">
          <div role="group" aria-label="Xem nhanh kỹ năng" className="flex min-w-0 gap-1 overflow-x-auto border-b">
            {groups.map((group) => {
              const active = group.skills.includes(current)
              const skill = active ? current : group.skills[0]!
              const name = translatedText(skill.translations, locale, sectionTextFields.SKILLS)?.name
              return (
                <button
                  key={group.key}
                  type="button"
                  aria-pressed={active}
                  title={name || skillLabel(skill)}
                  aria-label={`${skillLabel(skill)}${name ? ` · ${name}` : ""}`}
                  className={cn(
                    "group relative flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 rounded-t-md px-1 pt-1 pb-2.5",
                    focusRing,
                    "focus-visible:ring-inset",
                    active &&
                      "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
                  )}
                  onClick={() => onSkillChange(skill.skillKey)}
                >
                  <span className={cn("transition-opacity", !active && "opacity-55 group-hover:opacity-100")}>
                    {group.skills.length > 1 ? (
                      <SkillArtworkStack skills={group.skills} heroId={heroId} selectedSkillKey={skill.skillKey} />
                    ) : (
                      <SkillArtwork skill={skill} heroId={heroId} className="size-10" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "type-meta max-w-full truncate",
                      active ? "text-foreground" : "group-hover:text-foreground",
                    )}
                  >
                    {skillLabel(skill)}
                  </span>
                </button>
              )
            })}
          </div>
          <div aria-live="polite" className="min-w-0 space-y-1">
            <h3 className="type-section-title break-words">{text?.name || skillLabel(current)}</h3>
            {text?.description ? (
              // Only the start of the text: the whole of it, with sources and videos, is on the skills tab.
              <div className="type-body line-clamp-3 break-words whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                <AdminEntityText text={text.description} />
              </div>
            ) : (
              <p className="type-meta">Chưa có mô tả kỹ năng.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="type-meta">Chưa có kỹ năng trong bản dữ liệu này.</p>
      )}
    </PreviewCard>
  )
}

const SKIN_STEP = 8

/**
 * The skins in shop order on one row of pictures, without names; more come in as the row is scrolled. A picture opens
 * in the large view, which names it.
 */
export function SkinsPreview({
  skins,
  locale,
  onOpen,
  className,
}: {
  skins: readonly Skin[]
  locale: string
  onOpen: OpenHeroTab
  className?: string
}) {
  const strip = useRef<HTMLUListElement>(null)
  const ordered = [...skins].sort((a, b) => a.displayOrder - b.displayOrder)
  const { rows, loader } = useRevealedRows(ordered, ordered.map((skin) => skin.skinKey).join(","), SKIN_STEP)
  const named = rows.map((skin) => ({
    skin,
    name: translatedText(skin.translations, locale, sectionTextFields.SKINS)?.name || skin.skinKey,
  }))
  const gallery = useGallery(
    named.map(({ skin, name }) => ({ id: skin.portraitAssetId ?? skin.artAssetId, title: name })),
  )
  return (
    <PreviewCard tab="skins" title="Trang phục" icon={Shirt} count={skins.length} onOpen={onOpen} className={className}>
      {ordered.length ? (
        <ul
          ref={strip}
          aria-label="Xem nhanh trang phục"
          className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]"
        >
          {named.map(({ skin, name }, order) => (
            <li key={skin.skinKey} className="w-20 shrink-0" title={name}>
              <HeroAsset
                id={skin.portraitAssetId ?? skin.artAssetId}
                alt={name}
                className="aspect-[3/4] w-full rounded-md"
                preview
                gallery={gallery(order)}
              />
            </li>
          ))}
          {loader.hasNextPage && (
            <li className="flex shrink-0 items-center">
              <InfiniteScroll query={loader} label="Đang tải thêm trang phục" rootRef={strip} />
            </li>
          )}
        </ul>
      ) : (
        <p className="type-meta">Chưa có trang phục trong bản dữ liệu này.</p>
      )}
    </PreviewCard>
  )
}

const MEDIA_ROLES = [
  { role: "HEAD", label: "Đại diện", ratio: 1 },
  { role: "PORTRAIT", label: "Chân dung", ratio: 3 / 4 },
  { role: "SPLASH", label: "Ảnh nền", ratio: 16 / 9 },
] as const

/** The three hero images side by side, small; each opens in the large view. */
export function MediaPreview({
  content,
  name,
  onOpen,
  className,
}: {
  content: Content
  name: string
  onOpen: OpenHeroTab
  className?: string
}) {
  const bindings = content.MEDIA_BINDINGS?.bindings
  const present = MEDIA_ROLES.filter(({ role }) => bindings?.[role]).length
  const gallery = useGallery(
    MEDIA_ROLES.map(({ role, label }) => ({ id: bindings?.[role], title: `${name} · ${label}` })),
  )
  return (
    <PreviewCard tab="media" title="Ảnh" icon={ImageIcon} count={present} onOpen={onOpen} className={className}>
      <ul className="grid grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,5fr)] items-end gap-2">
        {MEDIA_ROLES.map(({ role, label, ratio }, order) => (
          <li key={role} className="min-w-0 space-y-1">
            <HeroAsset
              id={bindings?.[role]}
              alt={`${name} · ${label}`}
              className="w-full"
              frameAspectRatio={ratio}
              preview
              gallery={gallery(order)}
            />
            <p className="type-meta truncate text-center">{label}</p>
          </li>
        ))}
      </ul>
    </PreviewCard>
  )
}

const VIDEO_PREVIEW_LIMIT = 3

/** The first videos of the hero, read from the same list the videos tab manages; each plays here. */
export function VideosPreview({
  heroId,
  onOpen,
  className,
}: {
  heroId: string
  onOpen: OpenHeroTab
  className?: string
}) {
  const filter = { subjectKind: "HERO" as const, subjectId: heroId, size: 100 }
  const list = useQuery({
    queryKey: videoKeys.list(filter),
    queryFn: ({ signal }) => videoApi.list(filter, signal),
  })
  const [watching, setWatching] = useState<AdminVideo | null>(null)
  const videos = list.data?.items ?? []
  return (
    <PreviewCard
      tab="videos"
      title="Video"
      icon={Clapperboard}
      count={list.data?.items.length}
      onOpen={onOpen}
      className={className}
    >
      {list.isPending ? (
        <p className="type-meta">Đang tải video…</p>
      ) : list.isError ? (
        <p className="type-meta">Chưa tải được video. Mở tab Video để thử lại.</p>
      ) : !videos.length ? (
        <p className="type-meta">Chưa có video nào.</p>
      ) : (
        <ul className="grid gap-1">
          {videos.slice(0, VIDEO_PREVIEW_LIMIT).map((video) => {
            const thumbnail = videoThumbnail(video, "mq")
            return (
              <li key={video.id} className="min-w-0">
                <button
                  type="button"
                  title={video.title}
                  aria-label={`Xem video ${video.title}`}
                  className={cn(
                    "group flex w-full min-w-0 items-center gap-3 rounded-lg p-1 text-left hover:bg-muted/60",
                    focusRing,
                  )}
                  onClick={() => setWatching(video)}
                >
                  <span className="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {thumbnail ? (
                      <img src={thumbnail} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Clapperboard className="size-4 text-muted-foreground" />
                    )}
                    {/* A darkening over the artwork marks the picture as playable. */}
                    <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <Play className="size-4 fill-white text-white" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-body line-clamp-2 break-words">{video.title}</span>
                    <span className="type-meta block truncate">{PURPOSE_LABELS[video.purpose]}</span>
                  </span>
                </button>
              </li>
            )
          })}
          {videos.length > VIDEO_PREVIEW_LIMIT && (
            <li className="type-meta px-1">và {videos.length - VIDEO_PREVIEW_LIMIT} video khác</li>
          )}
        </ul>
      )}
      <VideoPlayerDialog video={watching} title={watching?.title ?? ""} onClose={() => setWatching(null)} />
    </PreviewCard>
  )
}
