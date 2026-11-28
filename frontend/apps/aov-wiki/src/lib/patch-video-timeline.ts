import type { PublicVideo } from "../components/videos/video-model"
import type { PatchMarketRelease } from "./updates-api"

/** When a video went up; a row with only its day counts from noon in Vietnam, where the channel posts. */
export function videoMoment(video: Pick<PublicVideo, "publishedAt" | "publishedOn">) {
  if (video.publishedAt) return Date.parse(video.publishedAt)
  return video.publishedOn ? Date.parse(`${video.publishedOn}T12:00:00+07:00`) : null
}

/** When the patch reached the market whose videos these are: its exact moment, or the start of its day there. */
export function releaseMoment(release: PatchMarketRelease | undefined) {
  if (!release) return null
  if (release.effectiveAt) return Date.parse(release.effectiveAt)
  if (!release.effectiveOn) return null
  const noon = Date.parse(`${release.effectiveOn}T12:00:00Z`)
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: release.timeZone, timeZoneName: "longOffset" })
    .formatToParts(noon)
    .find((part) => part.type === "timeZoneName")
    ?.value.match(/GMT([+-]\d{2}):(\d{2})/)
  const minutes = offset ? Number(offset[1]) * 60 + Math.sign(Number(offset[1])) * Number(offset[2]) : 0
  return Date.parse(`${release.effectiveOn}T00:00:00Z`) - minutes * 60_000
}

/** The patch's videos oldest first, and where the release falls among them. */
export function splitAtRelease<T extends Pick<PublicVideo, "publishedAt" | "publishedOn">>(
  videos: readonly T[],
  releaseAt: number | null,
) {
  const ordered = [...videos].sort(
    (a, b) => (videoMoment(a) ?? Number.POSITIVE_INFINITY) - (videoMoment(b) ?? Number.POSITIVE_INFINITY),
  )
  if (releaseAt === null) return { ordered, firstAfter: -1 }
  const firstAfter = ordered.findIndex((video) => (videoMoment(video) ?? Number.POSITIVE_INFINITY) >= releaseAt)
  return { ordered, firstAfter: firstAfter === -1 ? ordered.length : firstAfter }
}
