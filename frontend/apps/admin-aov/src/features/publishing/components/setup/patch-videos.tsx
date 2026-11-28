import { Fragment, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Clapperboard, Plus, Sparkles } from "lucide-react"
import type { ProfileLink, YouTubeVideoPage } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Checkbox } from "@aov/ui/components/checkbox"
import { LocalTime } from "@aov/ui/components/local-time"
import { videoThumbnail } from "@aov/ui/lib/video-playback"
import { communityRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { videoApi, videoKeys } from "../../../videos/video-api"
import { VideoFormDialog } from "../../../videos/video-form-dialog"
import { VideoRow } from "../../../videos/video-row"
import { useVideoActions, useVideoSubjects } from "../../../videos/use-video-actions"
import { PURPOSE_LABELS, type AdminVideo, type VideoSubject } from "../../../videos/video-model"
import type { PublicationOverview, Variant } from "../../api/publication-overview"
import {
  releaseInstant,
  SUGGESTION_WINDOW,
  suggestPatchVideos,
  type ChannelVideo,
} from "../../model/setup/patch-video-model"

/** The channel suggestions come from; its page lists the YouTube link the reader follows (ADR-034). */
const CHANNEL_PAGE = "trai-nghiem-game"
const CHANNEL_NAME = "Trải Nghiệm Game"
const VN_OFFSET_HOURS = 7
const MAX_CHANNEL_PAGES = 80

const momentOf = (video: AdminVideo) =>
  video.publishedAt
    ? Date.parse(video.publishedAt)
    : video.publishedOn
      ? Date.parse(`${video.publishedOn}T12:00:00+07:00`)
      : null

/**
 * Videos about one patch in Vietnam, oldest first with the release between them, and suggestions read from the channel
 * around the release for an editor to check (ADR-037).
 */
export function PatchVideos({ variant, data }: { variant: Variant; data: PublicationOverview }) {
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes("patch:write")
  const filter = { patchVariantId: variant.id, size: 100 }
  const list = useQuery({ queryKey: videoKeys.list(filter), queryFn: ({ signal }) => videoApi.list(filter, signal) })
  const directory = useVideoSubjects()
  const actions = useVideoActions()
  const [form, setForm] = useState<{ video: AdminVideo | null; subject: VideoSubject } | null>(null)

  const vietnam = data.markets.find((market) => market.code === "VN")
  const vnReleases = data.releases.filter(
    (release) => release.regionId === vietnam?.id && release.status !== "CANCELLED",
  )
  const own = vnReleases.find((release) => release.variantId === variant.id)
  const releaseAt = own ? releaseInstant(own, VN_OFFSET_HOURS) : null
  const otherReleases = vnReleases
    .map((release) => releaseInstant(release, VN_OFFSET_HOURS))
    .filter((at): at is number => at !== null && at !== releaseAt)
    .sort((a, b) => a - b)
  const nextReleaseAt = releaseAt === null ? null : (otherReleases.find((at) => at > releaseAt) ?? null)
  const previousReleaseAt = releaseAt === null ? null : (otherReleases.filter((at) => at < releaseAt).at(-1) ?? null)

  const videos = useMemo(
    () =>
      [...(list.data?.items ?? [])].sort(
        (a, b) => (momentOf(a) ?? Number.POSITIVE_INFINITY) - (momentOf(b) ?? Number.POSITIVE_INFINITY),
      ),
    [list.data],
  )
  const firstAfter = releaseAt === null ? -1 : videos.findIndex((video) => (momentOf(video) ?? Infinity) >= releaseAt)
  const heroName = (video: AdminVideo) =>
    directory.data?.find((subject) => subject.kind === "HERO" && subject.id === video.subjectId)?.name
  const patchSubject: VideoSubject = {
    kind: "PATCH",
    id: variant.id,
    key: null,
    code: variant.patchCode,
    name: variant.patchTitle || variant.patchCode,
    aliases: [],
  }
  const subjectOf = (video: AdminVideo): VideoSubject =>
    video.subjectKind === "PATCH"
      ? patchSubject
      : (directory.data?.find((subject) => subject.kind === video.subjectKind && subject.id === video.subjectId) ?? {
          kind: video.subjectKind,
          id: video.subjectId,
          key: video.subjectKey,
          code: "",
          name: heroName(video) ?? video.title,
          aliases: [],
        })
  const releaseMark = releaseAt !== null && (
    <li aria-label="Phát hành tại Việt Nam" className="flex items-center gap-2 py-1">
      <span className="h-px flex-1 bg-(--aov-accent)" />
      <span className="type-label rounded-full border border-(--aov-accent) px-2.5 py-0.5">
        Phát hành · <LocalTime value={new Date(releaseAt).toISOString()} locale="vi-VN" />
      </span>
      <span className="h-px flex-1 bg-(--aov-accent)" />
    </li>
  )

  return (
    <section className="grid gap-4" aria-label="Video của patch">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-meta">
          {releaseAt === null
            ? "Đặt lịch phát hành tại Việt Nam để chia video trước và sau."
            : "Video tiếng Việt, cũ trước. Video từng tướng gắn ở trang tướng với loại Thay đổi theo bản."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canWrite}
          onClick={() => setForm({ video: null, subject: patchSubject })}
        >
          <Plus aria-hidden className="size-4" /> Thêm video
        </Button>
      </div>

      {[list.error, actions.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="type-body text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {list.isPending && <p className="type-meta">Đang tải video…</p>}
      {list.isSuccess && !videos.length && (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-6 text-center">
          <Clapperboard aria-hidden className="size-6 text-muted-foreground" />
          <p className="type-body">Patch này chưa có video.</p>
        </div>
      )}
      {videos.length > 0 && (
        <ul className="grid gap-2">
          {firstAfter === 0 && releaseMark}
          {videos.map((video, index) => (
            <Fragment key={video.id}>
              <VideoRow
                video={video}
                context={
                  video.subjectKind === "HERO"
                    ? `Tướng · ${heroName(video) ?? "?"}`
                    : (PURPOSE_LABELS[video.purpose] ?? video.purpose)
                }
                busy={actions.busy}
                onEdit={() => setForm({ video, subject: subjectOf(video) })}
                onStatus={(status) => actions.setStatus.mutate({ video, status })}
                onDelete={() => actions.remove.mutate(video)}
              />
              {index + 1 === firstAfter && releaseMark}
            </Fragment>
          ))}
          {firstAfter === -1 && releaseMark}
        </ul>
      )}

      {canWrite && releaseAt !== null && (
        <ChannelSuggestions
          variantId={variant.id}
          releaseAt={releaseAt}
          nextReleaseAt={nextReleaseAt}
          previousReleaseAt={previousReleaseAt}
          attached={new Set(videos.map((video) => video.providerVideoId).filter(Boolean) as string[])}
          heroes={(directory.data ?? []).filter((subject) => subject.kind === "HERO")}
        />
      )}

      <VideoFormDialog
        open={!!form}
        video={form?.video ?? null}
        subjects={form ? [form.subject] : [patchSubject]}
        initialSubject={form?.subject ?? patchSubject}
        onClose={() => setForm(null)}
      />
    </section>
  )
}

/** Reads the channel back from its newest upload until it passes the start of the window. */
async function readChannel(releaseAt: number, onProgress: (count: number) => void) {
  const page = await communityRequest<{ id: string; links: ProfileLink[] }>(`/pages/by-code/${CHANNEL_PAGE}`)
  const link = page.links.find((entry) => /youtube\.com|youtu\.be/i.test(entry.url))
  if (!link) throw new Error("Trang kênh chưa có link YouTube.")
  const start = releaseAt - SUGGESTION_WINDOW.beforeDays * 86_400_000
  const videos: ChannelVideo[] = []
  let token: string | null = null
  for (let round = 0; round < MAX_CHANNEL_PAGES; round++) {
    const query = new URLSearchParams(token ? { url: link.url, pageToken: token } : { url: link.url })
    const result: YouTubeVideoPage = await communityRequest<YouTubeVideoPage>(
      `/pages/${page.id}/youtube-channel/videos?${query}`,
    )
    videos.push(...result.videos)
    onProgress(videos.length)
    token = result.nextPageToken
    const oldest = result.videos.at(-1)
    if (!token || !oldest || Date.parse(oldest.publishedAt) < start) break
  }
  return videos
}

function ChannelSuggestions({
  variantId,
  releaseAt,
  nextReleaseAt,
  previousReleaseAt,
  attached,
  heroes,
}: {
  variantId: string
  releaseAt: number
  nextReleaseAt: number | null
  previousReleaseAt: number | null
  attached: Set<string>
  heroes: VideoSubject[]
}) {
  const cache = useQueryClient()
  const canPublish = !!useSession().actor?.capabilities.includes("patch:publish")
  const [read, setRead] = useState(0)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const names = useMemo(() => heroes.map((hero) => ({ id: hero.id, names: [hero.name, ...hero.aliases] })), [heroes])
  const scan = useMutation({
    mutationFn: () => readChannel(releaseAt, setRead),
    onSuccess: (videos) => {
      const guesses = suggestPatchVideos(videos, releaseAt, names, nextReleaseAt, previousReleaseAt).filter(
        (guess) => !attached.has(guess.video.id),
      )
      setPicked(new Set(guesses.map((guess) => guess.video.id)))
    },
    meta: { silent: true },
  })
  const guesses = suggestPatchVideos(scan.data ?? [], releaseAt, names, nextReleaseAt, previousReleaseAt).filter(
    (guess) => !attached.has(guess.video.id),
  )
  const save = useMutation({
    mutationFn: (status: "DRAFT" | "PUBLISHED") =>
      videoApi.importBatch(
        guesses
          .filter((guess) => picked.has(guess.video.id))
          .map((guess) => ({
            subjectKind: guess.heroId ? "HERO" : "PATCH",
            subjectId: guess.heroId ?? variantId,
            subjectKey: null,
            purpose: guess.purpose,
            title: guess.video.title,
            url: `https://www.youtube.com/watch?v=${guess.video.id}`,
            durationSeconds: guess.video.durationSeconds,
            channelName: CHANNEL_NAME,
            publishedOn: new Date(Date.parse(guess.video.publishedAt) + VN_OFFSET_HOURS * 3_600_000)
              .toISOString()
              .slice(0, 10),
            publishedAt: guess.video.publishedAt,
            locale: "vi-VN",
            patchVariantId: variantId,
            displayOrder: null,
            status,
          })),
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: videoKeys.lists }),
    meta: { silent: true },
  })

  return (
    <section aria-labelledby="patch-video-suggestions" className="grid gap-3 rounded-xl border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="patch-video-suggestions" className="type-label flex items-center gap-1.5">
          <Sparkles aria-hidden className="size-4" /> Gợi ý từ {CHANNEL_NAME}
        </h3>
        <Button type="button" size="sm" variant="outline" disabled={scan.isPending} onClick={() => scan.mutate()}>
          {scan.isPending ? `Đang đọc… ${read}` : scan.data ? "Đọc lại" : "Tìm quanh ngày phát hành"}
        </Button>
      </div>
      <p className="type-meta">
        Từ {SUGGESTION_WINDOW.beforeDays} ngày trước tới {SUGGESTION_WINDOW.afterDays} ngày sau. Xem trước, tổng hợp,
        trải nghiệm và từng tướng, đoán theo tiêu đề.
      </p>
      {scan.isError && (
        <p role="alert" className="type-body text-destructive">
          {errorMessage(scan.error)}
        </p>
      )}
      {scan.isSuccess && !guesses.length && <p className="type-meta">Không có video mới phù hợp.</p>}
      {guesses.length > 0 && (
        <>
          <ul className="grid gap-1.5">
            {guesses.map((guess) => {
              const checked = picked.has(guess.video.id)
              const thumbnail = videoThumbnail({ providerVideoId: guess.video.id }, "mq")
              return (
                <li key={guess.video.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setPicked((current) => {
                          const copy = new Set(current)
                          if (next) copy.add(guess.video.id)
                          else copy.delete(guess.video.id)
                          return copy
                        })
                      }
                    />
                    {thumbnail && (
                      <img
                        src={thumbnail}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="aspect-video w-24 shrink-0 rounded-md object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="type-body line-clamp-2">{guess.video.title}</span>
                      <span className="type-meta block">
                        {guess.side === "before" ? "Trước" : "Sau"} ·{" "}
                        {guess.heroName ? `Tướng ${guess.heroName}` : PURPOSE_LABELS[guess.purpose]} ·{" "}
                        <LocalTime value={guess.video.publishedAt} locale="vi-VN" />
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {save.isError && (
            <p role="alert" className="type-body text-destructive">
              {errorMessage(save.error)}
            </p>
          )}
          {save.isSuccess && (
            <p className="type-meta" role="status">
              Đã thêm {save.data.created} video, bỏ qua {save.data.skipped}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!picked.size || save.isPending}
              onClick={() => save.mutate("DRAFT")}
            >
              Thêm {picked.size} video chờ duyệt
            </Button>
            {canPublish && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!picked.size || save.isPending}
                onClick={() => save.mutate("PUBLISHED")}
              >
                Thêm và hiện ngay
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
