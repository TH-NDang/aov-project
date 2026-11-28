// The battlefield map of a game mode as the Wiki and Admin read it: no React and no DOM, so it runs under
// `node --test`.

export type Side = "BLUE" | "RED"
export type Category = "STRUCTURE" | "MINION" | "MONSTER" | "EPIC" | "MECHANIC"
export type Glyph =
  | "ALTAR"
  | "BASE"
  | "TOWER"
  | "MINION"
  | "RANGED"
  | "SIEGE"
  | "SUPER"
  | "VANGUARD"
  | "MONSTER"
  | "GIANT"
  | "DRAGON"
  | "CAESAR"
  | "BOSS"
  | "KONG"
  | "EYE"
  | "HEAL"
  | "BUSH"
  | "PORTAL"
export type LaneGlyph = "LANE" | "JUNGLE" | "MID" | "SUPPORT"

export interface MapPoint {
  x: number
  y: number
}
export interface MapSpot extends MapPoint {
  key?: string | null
  side?: Side | null
  label?: string | null
}
export interface MapTiming {
  seconds?: number | null
  note?: string | null
}
export interface MapSection {
  title: string
  body: string
}
export interface MapObject {
  code: string
  name: string
  category: Category
  glyph?: Glyph | null
  iconAssetId?: string | null
  pictureAssetId?: string | null
  family?: string | null
  tags: string[]
  summary?: string | null
  firstSpawn?: MapTiming | null
  respawn?: MapTiming | null
  sections: MapSection[]
  change?: MapSection | null
  positions: MapSpot[]
}
export interface MapArea {
  code: string
  name: string
  side?: Side | null
  summary?: string | null
  outline: MapPoint[]
}
export interface MapLane {
  code: string
  name: string
  glyph?: LaneGlyph | null
  body?: string | null
  heroCodes: string[]
  positions: MapPoint[]
  path: MapPoint[]
}
/** A shape of the drawn ground: the jungle floor, the river, a bush or a wall. */
export type TerrainKind = "JUNGLE" | "RIVER" | "BUSH" | "WALL"
export interface MapTerrain {
  kind: TerrainKind
  outline: MapPoint[]
}
export interface MapCallout extends MapPoint {
  label: string
  objectCode?: string | null
  spotKey?: string | null
}
export interface TempoMoment {
  seconds: number
  phase?: string | null
  callouts: MapCallout[]
  steps: string[]
}
export interface MapContent {
  name?: string | null
  observedOn?: string | null
  summary?: string | null
  backgroundAssetId?: string | null
  objects: MapObject[]
  areas: MapArea[]
  lanes: MapLane[]
  tempo: TempoMoment[]
  sources: { label: string; url?: string | null; observedOn?: string | null }[]
  /** Only draws the ground; references name areas, never terrain. */
  terrain: MapTerrain[]
}

export const CATEGORIES: readonly Category[] = ["STRUCTURE", "MINION", "MONSTER", "EPIC", "MECHANIC"]

/** Names of the categories, in Vietnamese and English. The Vietnamese ones are the game's own labels. */
export const CATEGORY_NAMES: Record<Category, readonly [string, string]> = {
  STRUCTURE: ["Công trình", "Structures"],
  MINION: ["Lính", "Minions"],
  MONSTER: ["Quái rừng", "Jungle"],
  EPIC: ["Quái to", "Epic monsters"],
  MECHANIC: ["Cơ chế", "Mechanics"],
}

export const SIDE_NAMES: Record<Side, readonly [string, string]> = {
  BLUE: ["Phe xanh", "Blue side"],
  RED: ["Phe đỏ", "Red side"],
}

/** Terrain kinds from the bottom layer up: walls are drawn last so they stand over the floor and the river. */
export const TERRAIN_KINDS: readonly TerrainKind[] = ["JUNGLE", "RIVER", "BUSH", "WALL"]

/** The terrain of one kind, in the order of the snapshot; shapes with fewer than three points are left out. */
export const terrainOf = (content: Pick<MapContent, "terrain">, kind: TerrainKind) =>
  (content.terrain ?? []).filter((shape) => shape.kind === kind && shape.outline.length >= 3)

/** The tabs of the page, as the address names them. */
export type MapTab = "map" | "lanes" | "tempo"
export const MAP_TABS: readonly MapTab[] = ["map", "lanes", "tempo"]
export const readMapTab = (value: string | null | undefined): MapTab => MAP_TABS.find((tab) => tab === value) ?? "map"

/** Objects that stand on the map themselves; forms of a family are shown with their head. */
export const heads = (content: MapContent) => content.objects.filter((object) => !object.family)

/** The head of a family first, then its forms in the order of the snapshot. */
export function familyOf(content: MapContent, object: MapObject) {
  const headCode = object.family ?? object.code
  const head = content.objects.find((candidate) => candidate.code === headCode) ?? object
  return [head, ...content.objects.filter((candidate) => candidate.family === headCode)]
}

/** One drawn marker: a place of a head object. */
export interface Marker {
  ref: string
  object: MapObject
  spot: MapSpot
  /** Index within markers that stand on the same place, so they can be fanned out. */
  stack: number
  stackSize: number
}

/** How close two places must be to count as one, in percent of the map. */
const SAME_PLACE = 1.5

/** Markers of every head object of the given categories, with the ones on one place grouped. */
export function markers(content: MapContent, categories: ReadonlySet<Category>): Marker[] {
  const drawn = heads(content)
    .filter((object) => categories.has(object.category))
    .flatMap((object) =>
      object.positions.map((spot) => ({ ref: refOf(object.code, spot.key), object, spot, stack: 0, stackSize: 1 })),
    )
  const groups: Marker[][] = []
  for (const marker of drawn) {
    const group = groups.find(
      ([first]) =>
        Math.abs(first!.spot.x - marker.spot.x) < SAME_PLACE && Math.abs(first!.spot.y - marker.spot.y) < SAME_PLACE,
    )
    if (group) group.push(marker)
    else groups.push([marker])
  }
  return groups.flatMap((group) => group.map((marker, index) => ({ ...marker, stack: index, stackSize: group.length })))
}

/** A reference other content uses for a place: an object, area or lane code, or `code.key` for one place of it. */
export const refOf = (code: string, key?: string | null) => (key ? `${code}.${key}` : code)

export type Resolved =
  | { kind: "object"; object: MapObject; head: MapObject; spot: MapSpot | null }
  | { kind: "area"; area: MapArea }
  | { kind: "lane"; lane: MapLane }

/** What a reference names, or null when the map has no such place. */
export function resolveRef(content: MapContent, ref: string | null | undefined): Resolved | null {
  if (!ref) return null
  const [code, key] = ref.split(".", 2) as [string, string | undefined]
  const object = content.objects.find((candidate) => candidate.code === code)
  if (object) {
    const head = familyOf(content, object)[0]!
    const spot = key ? (head.positions.find((candidate) => candidate.key === key) ?? null) : null
    if (key && !spot) return null
    return { kind: "object", object, head, spot }
  }
  if (key) return null
  const area = content.areas.find((candidate) => candidate.code === code)
  if (area) return { kind: "area", area }
  const lane = content.lanes.find((candidate) => candidate.code === code)
  return lane ? { kind: "lane", lane } : null
}

/** A time of the match as the game writes it: minutes and two-digit seconds. */
export function clock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

/** The game's wording when it has one, else the time; null when neither is known. */
export function timingText(timing: MapTiming | null | undefined) {
  if (!timing) return null
  if (timing.note?.trim()) return timing.note.trim()
  return timing.seconds == null ? null : clock(timing.seconds)
}

/** A fixed spawn time as a clock, for lists with room for a few characters only; null when the game gives none. */
export const spawnClock = (timing: MapTiming | null | undefined) =>
  timing?.seconds == null ? null : clock(timing.seconds)

/** Whether a point lies inside a polygon (even-odd rule). */
export function inside(point: MapPoint, outline: readonly MapPoint[]) {
  let within = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!
    const b = outline[j]!
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      within = !within
    }
  }
  return within
}

/** Head objects with at least one place inside the area, each once. */
export function objectsIn(content: MapContent, area: MapArea) {
  return heads(content).filter((object) => object.positions.some((spot) => inside(spot, area.outline)))
}

/** The middle of an outline, where its name is written. */
export function centre(outline: readonly MapPoint[]): MapPoint {
  if (!outline.length) return { x: 50, y: 50 }
  const sum = outline.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 })
  return { x: sum.x / outline.length, y: sum.y / outline.length }
}

/** The SVG path of a polyline or a closed outline. */
export const pathOf = (points: readonly MapPoint[], closed = false) =>
  points.length ? `M${points.map((point) => `${point.x} ${point.y}`).join("L")}${closed ? "Z" : ""}` : ""

const at = (point: MapPoint) => `${Math.round(point.x * 100) / 100} ${Math.round(point.y * 100) / 100}`

/** The point `length` along the way from `from` to `to`, at most half way. */
function toward(from: MapPoint, to: MapPoint, length: number): MapPoint {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  if (!distance) return from
  const share = Math.min(length, distance / 2) / distance
  return { x: from.x + dx * share, y: from.y + dy * share }
}

/**
 * The SVG path of a closed outline with every corner rounded by up to `radius`, so a traced wall reads as rock rather
 * than as a polygon. Short sides round fully, long straight sides stay straight; the curve never leaves the outline's
 * corners.
 */
export function roundedPath(outline: readonly MapPoint[], radius = 2) {
  if (outline.length < 3) return pathOf(outline, true)
  const corners = outline.map((point, index) => ({
    point,
    enter: toward(point, outline[(index + outline.length - 1) % outline.length]!, radius),
    leave: toward(point, outline[(index + 1) % outline.length]!, radius),
  }))
  const first = corners[0]!
  const rest = [...corners.slice(1), first]
  return `M${at(first.leave)}${rest.map((corner) => `L${at(corner.enter)}Q${at(corner.point)} ${at(corner.leave)}`).join("")}Z`
}

/**
 * The wall that closes the map in, as in the game where the outer lanes run along it: the square's edge with an
 * opening `width` in from it, its corners rounded. Fill it with the even-odd rule. Maps with traced terrain draw it.
 */
export function frameWallPath(width = 1.3, radius = 3) {
  const near = width
  const far = 100 - width
  const opening = [
    { x: near, y: near },
    { x: far, y: near },
    { x: far, y: far },
    { x: near, y: far },
  ]
  return `M0 0H100V100H0Z${roundedPath(opening, radius)}`
}

/** The last mark of the timeline reached at `seconds`, or null before the first one. */
export function momentAt(tempo: readonly TempoMoment[], seconds: number) {
  return tempo.filter((moment) => moment.seconds <= seconds).at(-1) ?? null
}

/** Marks passed when the clock moves from `from` (excluded) to `to` (included); none when it goes back. */
export const crossed = <Mark extends { seconds: number }>(marks: readonly Mark[], from: number, to: number) =>
  to <= from ? [] : marks.filter((mark) => mark.seconds > from && mark.seconds <= to)

/** A time of the match when big monsters appear or change: the game's own words for them, and the first one's symbol. */
export interface EpicCall {
  seconds: number
  labels: string[]
  glyph: Glyph | null
}

/**
 * The marks of the timeline that name a big monster, each with only the callouts that do, for reminders while a match
 * plays. The opening mark is left out: nothing is called at 0:00.
 */
export function epicCalls(content: MapContent): EpicCall[] {
  const epics = new Map(
    content.objects.filter((object) => object.category === "EPIC").map((object) => [object.code, object]),
  )
  return content.tempo.flatMap((moment) => {
    const named = moment.callouts.flatMap((callout) => {
      const object = callout.objectCode ? epics.get(callout.objectCode) : undefined
      return object ? [{ label: callout.label, object }] : []
    })
    if (moment.seconds <= 0 || !named.length) return []
    return [
      { seconds: moment.seconds, labels: named.map((entry) => entry.label), glyph: named[0]!.object.glyph ?? null },
    ]
  })
}

/** The timeline's phases: each mark with a phase starts one that runs to the next such mark. */
export function phases(tempo: readonly TempoMoment[], end: number) {
  const starts = tempo.filter((moment) => moment.phase)
  return starts.map((moment, index) => ({
    name: moment.phase!,
    from: moment.seconds,
    to: starts[index + 1]?.seconds ?? end,
  }))
}

/**
 * Where a time sits on the timeline's rail, from 0 to 1. The rail grows as a square root, so the busy first minutes get
 * more room than the long late game.
 */
export const railAt = (seconds: number, end: number) => Math.sqrt(Math.max(0, Math.min(end, seconds)) / end)

/** The time at a place of the rail; the inverse of `railAt`. */
export const railTime = (at: number, end: number) => Math.max(0, Math.min(1, at)) ** 2 * end

/** Where the timeline ends: a while after its last mark, so the last phase has room. */
export const timelineEnd = (tempo: readonly TempoMoment[]) => Math.max(60, (tempo.at(-1)?.seconds ?? 0) + 300)
