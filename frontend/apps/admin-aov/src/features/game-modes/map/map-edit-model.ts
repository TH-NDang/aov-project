/** Labels and edits of the battlefield map editor; no React here. */
import {
  CATEGORIES,
  CATEGORY_NAMES,
  type Category,
  type Glyph,
  type LaneGlyph,
  type MapArea,
  type MapContent,
  type MapLane,
  type MapObject,
  type MapPoint,
  type MapSpot,
  type MapTerrain,
  type Side,
  type TerrainKind,
} from "@aov/ui/lib/battle-map"

export const CATEGORY_LABEL = Object.fromEntries(
  CATEGORIES.map((category) => [category, CATEGORY_NAMES[category][0]]),
) as Record<Category, string>

export const SIDE_LABEL: Record<Side, string> = { BLUE: "Phe xanh", RED: "Phe đỏ" }

export const GLYPH_LABEL: Record<Glyph, string> = {
  ALTAR: "Tế đàn",
  BASE: "Nhà chính",
  TOWER: "Trụ",
  MINION: "Lính cận chiến",
  RANGED: "Lính đánh xa",
  SIEGE: "Lính công thành",
  SUPER: "Lính siêu cấp",
  VANGUARD: "Tiên phong",
  MONSTER: "Quái rừng",
  GIANT: "Khổng lồ",
  DRAGON: "Rồng",
  CAESAR: "Caesar",
  BOSS: "Bạo chúa",
  KONG: "King Kong",
  EYE: "Tầm nhìn",
  HEAL: "Hồi máu",
  BUSH: "Bụi cỏ",
  PORTAL: "Cổng",
}
export const GLYPHS = Object.keys(GLYPH_LABEL) as Glyph[]

export const LANE_GLYPH_LABEL: Record<LaneGlyph, string> = {
  LANE: "Đường",
  JUNGLE: "Đi rừng",
  MID: "Đường giữa",
  SUPPORT: "Trợ thủ",
}
export const LANE_GLYPHS = Object.keys(LANE_GLYPH_LABEL) as LaneGlyph[]

export const TERRAIN_LABEL: Record<TerrainKind, string> = {
  WALL: "Tường",
  RIVER: "Sông",
  JUNGLE: "Nền rừng",
  BUSH: "Bụi cỏ",
}

/** The symbol a new object of a kind starts with. */
const CATEGORY_GLYPH: Record<Category, Glyph> = {
  STRUCTURE: "TOWER",
  MINION: "MINION",
  MONSTER: "MONSTER",
  EPIC: "GIANT",
  MECHANIC: "EYE",
}

/** A position in percent of the map, kept on the map and to one decimal. */
export const percent = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10

/** The same place on the other side: the map turns half a circle around its centre. */
export const mirrorPoint = (point: MapPoint): MapPoint => ({ x: percent(100 - point.x), y: percent(100 - point.y) })

export const otherSide = (side?: Side | null): Side | null => (side === "BLUE" ? "RED" : side === "RED" ? "BLUE" : null)

/**
 * The side a new place most likely belongs to. Blue's base is at the bottom left, so its half lies below the diagonal
 * from the top left to the bottom right; a place on the river is neutral.
 */
export function guessSide(point: MapPoint): Side | null {
  const lean = point.y - point.x
  return lean > 6 ? "BLUE" : lean < -6 ? "RED" : null
}

/** A key nobody in `taken` uses yet: the wish itself, else the wish with a number. */
export function freeKey(wish: string, taken: ReadonlySet<string>) {
  if (!taken.has(wish)) return wish
  let number = 2
  while (taken.has(`${wish}-${number}`)) number++
  return `${wish}-${number}`
}

const SIDE_WORD: Record<Side, string> = { BLUE: "xanh", RED: "do" }

/**
 * The mirror of a code or key. Words name the side (xanh, do) and the epic a half belongs to (caesar, rong); turning
 * the map half a circle swaps both, so the blue tower of the Caesar lane becomes the red tower of the dragon lane.
 */
export function mirrorKey(key: string) {
  const swap: Record<string, string> = { xanh: "do", do: "xanh", caesar: "rong", rong: "caesar" }
  return key
    .split("-")
    .map((word) => swap[word] ?? word)
    .join("-")
}

/** The mirror of a name or label, by the same words as the codes; null when no word of it names a side. */
export function mirrorName(name: string): string | null {
  const swap: Record<string, string> = { xanh: "đỏ", đỏ: "xanh", Caesar: "Rồng", Rồng: "Caesar" }
  const mirrored = name.replace(/(?<![\p{L}])(xanh|đỏ|Caesar|Rồng)(?![\p{L}])/gu, (word) => swap[word] ?? word)
  return mirrored === name ? null : mirrored
}

/** A new place of an object at a point: on the guessed side, keyed once the object stands in more than one place. */
export function addSpot(object: MapObject, point: MapPoint): MapObject {
  const side = object.category === "EPIC" ? null : guessSide(point)
  const spot: MapSpot = { key: null, side, label: null, x: percent(point.x), y: percent(point.y) }
  return { ...object, positions: keyed([...object.positions, spot]) }
}

/** The place mirrored to the other side, right after the original. */
export function mirrorSpotAt(object: MapObject, at: number): MapObject {
  const source = object.positions[at]
  if (!source) return object
  const copy: MapSpot = {
    ...source,
    ...mirrorPoint(source),
    side: otherSide(source.side),
    key: source.key ? mirrorKey(source.key) : null,
    label: source.label ? (mirrorName(source.label) ?? source.label) : null,
  }
  const positions = [...object.positions.slice(0, at + 1), copy, ...object.positions.slice(at + 1)]
  return { ...object, positions: keyed(positions) }
}

/** Every place gets a distinct key once there are several, so notes can name one of them. */
function keyed(spots: MapSpot[]): MapSpot[] {
  if (spots.length < 2) return spots
  const taken = new Set<string>()
  return spots.map((spot) => {
    const wish = spot.key || (spot.side ? SIDE_WORD[spot.side] : "diem")
    const key = spot.key && !taken.has(spot.key) ? spot.key : freeKey(wish, taken)
    taken.add(key)
    return key === spot.key ? spot : { ...spot, key }
  })
}

export function emptyObject(category: Category): MapObject {
  return {
    code: "",
    name: "",
    category,
    glyph: CATEGORY_GLYPH[category],
    iconAssetId: null,
    pictureAssetId: null,
    family: null,
    tags: [],
    summary: null,
    firstSpawn: null,
    respawn: null,
    sections: [],
    change: null,
    positions: [],
  }
}

export const emptyArea = (): MapArea => ({ code: "", name: "", side: null, summary: null, outline: [] })

export const emptyLane = (): MapLane => ({
  code: "",
  name: "",
  glyph: "LANE",
  body: null,
  heroCodes: [],
  positions: [],
  path: [],
})

export const emptyMap = (): MapContent => ({
  name: "Bách khoa chiến trường",
  observedOn: null,
  summary: null,
  backgroundAssetId: null,
  objects: [],
  areas: [],
  lanes: [],
  tempo: [],
  sources: [],
  terrain: [],
})

export const emptyTerrain = (kind: TerrainKind): MapTerrain => ({ kind, outline: [] })

/** The same shape on the other side of the map. */
export const mirrorTerrain = (shape: MapTerrain): MapTerrain => ({ ...shape, outline: shape.outline.map(mirrorPoint) })

/** The name of a shape in lists: its kind and its number among the shapes of that kind, from 1. */
export function terrainName(content: MapContent, index: number) {
  const shape = content.terrain[index]
  if (!shape) return ""
  const number = content.terrain.slice(0, index + 1).filter((other) => other.kind === shape.kind).length
  return `${TERRAIN_LABEL[shape.kind]} ${number}`
}

/** The area on the other side: its outline turned half a circle, its code and name swapped to that side. */
export function mirrorArea(area: MapArea, taken: ReadonlySet<string>): MapArea {
  return {
    ...area,
    code: freeKey(mirrorKey(area.code), taken),
    name: mirrorName(area.name) ?? `${area.name} (đối xứng)`,
    side: otherSide(area.side),
    outline: area.outline.map(mirrorPoint),
  }
}

/**
 * Codes that no longer follow a name: every code of the saved draft, which the public map and notes elsewhere may
 * already name, and every code another entry of the open draft points at.
 */
export function fixedMapCodes(saved: MapContent | null, content: MapContent): ReadonlySet<string> {
  const codes = new Set<string>()
  if (saved) for (const rows of [saved.objects, saved.areas, saved.lanes]) rows.forEach((row) => codes.add(row.code))
  content.objects.forEach((object) => object.family && codes.add(object.family))
  content.tempo.forEach((moment) =>
    moment.callouts.forEach((callout) => callout.objectCode && codes.add(callout.objectCode)),
  )
  return codes
}

/** Every code in use by an object, area or lane: one set, since a reference names any of them. */
export const takenCodes = (content: MapContent) =>
  new Set([...content.objects, ...content.areas, ...content.lanes].map((row) => row.code).filter(Boolean))

/** Renames an object and everything that points at it: the forms of its family and the timeline's callouts. */
export function renameObject(content: MapContent, from: string, to: string): MapContent {
  if (!from || from === to) return content
  return {
    ...content,
    objects: content.objects.map((object) => ({
      ...object,
      code: object.code === from ? to : object.code,
      family: object.family === from ? to : object.family,
    })),
    tempo: content.tempo.map((moment) => ({
      ...moment,
      callouts: moment.callouts.map((callout) =>
        callout.objectCode === from ? { ...callout, objectCode: to } : callout,
      ),
    })),
  }
}

/** Renames one place of an object and the callouts that name it. */
export function renameSpot(content: MapContent, objectCode: string, from: string, to: string): MapContent {
  if (!from || from === to) return content
  return {
    ...content,
    tempo: content.tempo.map((moment) => ({
      ...moment,
      callouts: moment.callouts.map((callout) =>
        callout.objectCode === objectCode && callout.spotKey === from ? { ...callout, spotKey: to } : callout,
      ),
    })),
  }
}

export interface PlaceOption {
  value: string
  label: string
  objectCode: string
  spotKey: string | null
  point: MapPoint
}

/** Every place a callout can point at: an object standing in one place, or one place of an object in several. */
export function placeOptions(content: MapContent): PlaceOption[] {
  return content.objects.flatMap((object): PlaceOption[] => {
    if (object.positions.length === 1) {
      const spot = object.positions[0]!
      return [
        {
          value: object.code,
          label: object.name,
          objectCode: object.code,
          spotKey: null,
          point: { x: spot.x, y: spot.y },
        },
      ]
    }
    return object.positions
      .filter((spot) => spot.key)
      .map((spot) => ({
        value: `${object.code}.${spot.key}`,
        label: `${object.name} · ${spot.label || spot.key}`,
        objectCode: object.code,
        spotKey: spot.key!,
        point: { x: spot.x, y: spot.y },
      }))
  })
}

/** m:ss as the game writes it, or plain seconds, read back into seconds; null when it does not read. */
export function readClock(text: string): number | null {
  const value = text.trim()
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(value)
  if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  return /^\d{1,4}$/.test(value) ? Number(value) : null
}

/** The server's names of missing fields, said for the editor. */
export function missingMapLabel(path: string, content: MapContent) {
  if (path === "name") return "tên bản đồ"
  if (path === "objects") return "ít nhất một đối tượng"
  const object = /^objects\[(\d+)]\.positions$/.exec(path)
  if (object) return `${content.objects[Number(object[1])]?.name || "Đối tượng"}: chưa đặt vị trí`
  const area = /^areas\[(\d+)]\.outline$/.exec(path)
  if (area) return `${content.areas[Number(area[1])]?.name || "Khu vực"}: khung cần ít nhất 3 điểm`
  const shape = /^terrain\[(\d+)]\.outline$/.exec(path)
  if (shape) return `${terrainName(content, Number(shape[1])) || "Địa hình"}: cần ít nhất 3 điểm`
  return path
}

const asList = (value: unknown, name: string) => {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error(`"${name}" phải là danh sách.`)
  return value
}

/** A map read from JSON, such as an export of another mode or the seed file; throws with a reason it can be fixed by. */
export function readMapJson(text: string): MapContent {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tệp không phải một bản đồ.")
  const map = value as Partial<MapContent>
  return {
    ...emptyMap(),
    ...map,
    objects: asList(map.objects, "objects"),
    areas: asList(map.areas, "areas"),
    lanes: asList(map.lanes, "lanes"),
    tempo: asList(map.tempo, "tempo"),
    sources: asList(map.sources, "sources"),
    terrain: asList(map.terrain, "terrain"),
  }
}
