import type { Market, Release } from "../../api/publication-overview"

/**
 * The release plan of one patch (ADR-038): one moment shared by the markets that update together, a moment of its own
 * for a market that does not, or no release where nothing is known. The server keeps one release per market; the shared
 * moment lives only here, read back from the markets that agree most.
 */
export type PlanMode = "shared" | "own" | "none"

/** A moment as an editor writes it, on the wall clock of a zone. A blank time means only the day is known. */
export interface PlanMoment {
  date: string
  time: string
}

export interface PlanRow {
  regionId: string
  code: string
  name: string
  timeZone: string
  mode: PlanMode
  own: PlanMoment
}

export interface ReleasePlanDraft {
  shared: PlanMoment
  /** The market whose wall clock the shared moment is written on. */
  sharedZoneCode: string
  rows: PlanRow[]
}

export interface PlannedRelease {
  regionId: string
  effectiveAt?: string
  effectiveOn?: string
  sourceUrl?: string
}

/** The zone of each market as the server keeps it (patch.region); a market missing here is shown in UTC. */
export const MARKET_TIME_ZONES: Record<string, string> = {
  VN: "Asia/Ho_Chi_Minh",
  TH: "Asia/Bangkok",
  TW: "Asia/Taipei",
  ID: "Asia/Jakarta",
  GLOBAL: "UTC",
}

export const marketTimeZone = (code: string) => MARKET_TIME_ZONES[code] ?? "UTC"

const EMPTY: PlanMoment = { date: "", time: "" }

const wallClock = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

/** The wall clock of a moment in a zone. */
export function wallMoment(instant: string, timeZone: string): PlanMoment {
  const parts = Object.fromEntries(
    wallClock(timeZone)
      .formatToParts(Date.parse(instant))
      .map((part) => [part.type, part.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

/** The instant a wall clock names in a zone; the offset is read twice so a time beside a clock change lands right. */
export function instantOf(moment: PlanMoment, timeZone: string) {
  const asUtc = Date.parse(`${moment.date}T${moment.time}:00Z`)
  if (Number.isNaN(asUtc)) return null
  let guess = asUtc
  for (let round = 0; round < 2; round++) {
    const wall = wallMoment(new Date(guess).toISOString(), timeZone)
    guess = asUtc - (Date.parse(`${wall.date}T${wall.time}:00Z`) - guess)
  }
  return new Date(guess).toISOString()
}

/** A release as a key two markets share when they update together: the same day, or the same instant. */
function momentKey(release: Release) {
  if (release.effectiveOn) return `D${release.effectiveOn}`
  return release.effectiveAt ? `I${Date.parse(release.effectiveAt)}` : null
}

function momentOf(release: Release, timeZone: string): PlanMoment {
  if (release.effectiveOn) return { date: release.effectiveOn, time: "" }
  return release.effectiveAt ? wallMoment(release.effectiveAt, timeZone) : EMPTY
}

/**
 * Reads a plan back from a patch's releases. The shared moment is the one most markets have, Vietnam winning a tie, so
 * a patch every market got on one day reads as one moment and the market that differs as its own.
 */
export function draftFromReleases(markets: Market[], releases: Release[], variantId: string): ReleasePlanDraft {
  const ordered = [...markets].sort((a, b) => Number(b.code === "VN") - Number(a.code === "VN"))
  const byMarket = new Map(
    releases
      .filter((release) => release.variantId === variantId && release.status !== "CANCELLED")
      .map((release) => [release.regionId, release]),
  )
  const counts = new Map<string, number>()
  for (const market of ordered) {
    const key = byMarket.has(market.id) ? momentKey(byMarket.get(market.id)!) : null
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let sharedKey: string | null = null
  for (const [key, count] of counts) if (!sharedKey || count > counts.get(sharedKey)!) sharedKey = key
  const anchor = ordered.find((market) => {
    const release = byMarket.get(market.id)
    return release && momentKey(release) === sharedKey
  })
  const anchorZone = anchor ? marketTimeZone(anchor.code) : marketTimeZone("VN")
  const anchorRelease = anchor && byMarket.get(anchor.id)
  const fresh = !byMarket.size

  return {
    shared: anchorRelease ? momentOf(anchorRelease, anchorZone) : EMPTY,
    sharedZoneCode: anchor?.code ?? "VN",
    rows: markets.map((market): PlanRow => {
      const release = byMarket.get(market.id)
      const zone = marketTimeZone(market.code)
      const base = { regionId: market.id, code: market.code, name: market.displayName, timeZone: zone }
      if (!release) return { ...base, mode: fresh && market.code !== "GLOBAL" ? "shared" : "none", own: EMPTY }
      return {
        ...base,
        mode: momentKey(release) === sharedKey ? "shared" : "own",
        own: momentOf(release, zone),
      }
    }),
  }
}

/** The moment a row stands for, with the zone its wall clock is in; null without a release. */
export function rowMoment(draft: ReleasePlanDraft, row: PlanRow) {
  if (row.mode === "none") return null
  if (row.mode === "own") return { moment: row.own, timeZone: row.timeZone }
  return { moment: draft.shared, timeZone: marketTimeZone(draft.sharedZoneCode) }
}

/**
 * What the row shows on its own market's clock. A shared day is that same day everywhere, since a day-only post means the
 * markets' own calendars; a shared hour moves with each market's offset.
 */
export function localMoment(draft: ReleasePlanDraft, row: PlanRow): PlanMoment | null {
  const picked = rowMoment(draft, row)
  if (!picked || !picked.moment.date) return null
  if (!picked.moment.time) return { date: picked.moment.date, time: "" }
  const instant = instantOf(picked.moment, picked.timeZone)
  return instant ? wallMoment(instant, row.timeZone) : null
}

/** What stops the plan from being saved, said so the editor knows what to fix; null when it can be sent. */
export function planProblem(draft: ReleasePlanDraft) {
  for (const row of draft.rows) {
    const picked = rowMoment(draft, row)
    if (!picked) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(picked.moment.date))
      return row.mode === "shared" ? "Chọn ngày phát hành chung." : `Chọn ngày cho ${row.name}.`
    if (picked.moment.time && !/^\d{2}:\d{2}$/.test(picked.moment.time)) return `Giờ của ${row.name} chưa đúng.`
  }
  return null
}

/** The plan as the server takes it; each market cites the first page it published, else the link it had. */
export function planToRequest(
  draft: ReleasePlanDraft,
  sourceOf: (code: string) => string | null,
  existing: Release[],
): PlannedRelease[] {
  const releases: PlannedRelease[] = []
  for (const row of draft.rows) {
    const picked = rowMoment(draft, row)
    if (!picked) continue
    const sourceUrl = sourceOf(row.code) ?? existing.find((release) => release.regionId === row.regionId)?.sourceUrl
    const planned: PlannedRelease = { regionId: row.regionId }
    if (picked.moment.time) planned.effectiveAt = instantOf(picked.moment, picked.timeZone) ?? undefined
    else planned.effectiveOn = picked.moment.date
    if (sourceUrl) planned.sourceUrl = sourceUrl
    releases.push(planned)
  }
  return releases
}

/** How many days a market's own moment sits before (negative) or after the shared one, for its chip. */
export function daysFromShared(draft: ReleasePlanDraft, row: PlanRow) {
  if (row.mode !== "own" || !row.own.date || !draft.shared.date) return null
  const own = Date.parse(`${row.own.date}T00:00:00Z`)
  const shared = Date.parse(`${draft.shared.date}T00:00:00Z`)
  if (Number.isNaN(own) || Number.isNaN(shared)) return null
  return Math.round((own - shared) / 86_400_000)
}
