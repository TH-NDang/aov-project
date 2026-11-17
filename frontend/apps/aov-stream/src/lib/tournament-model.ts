import type {
  Catalog,
  EquipmentSnapshot,
  GameSide,
  Participant,
  PublishedGame,
  Selection,
} from "@aov/community-contracts"

export type CatalogKind = "heroes" | "items" | "arcana" | "enchantments" | "spells"

/** Each lane in Vietnamese and in English, in the order a lineup is listed. */
export const LANE_NAMES = {
  TOP: ["Đường Caesar", "Dark Slayer lane"],
  JUNGLE: ["Đi rừng", "Jungle"],
  MID: ["Đường giữa", "Mid lane"],
  DRAGON: ["Đường Rồng", "Abyssal Dragon lane"],
  SUPPORT: ["Hỗ trợ", "Support"],
} as const
export const LANE_SHORT = { TOP: "DSL", JUNGLE: "JUG", MID: "MID", DRAGON: "ADL", SUPPORT: "SUP" } as const
/** How much of a loadout the source showed, in Vietnamese and in English. */
export const OBSERVATION_NAMES = {
  UNKNOWN: ["Chưa thu thập", "Not collected"],
  NOT_SHOWN: ["Nguồn không hiển thị", "Not shown by the source"],
  PARTIAL: ["Hiện một phần", "Partly shown"],
  KNOWN: ["Đã ghi nhận", "Recorded"],
} as const
/** The name used when a pick is not linked to the wiki and carries no name of its own. */
export const UNKNOWN_REFERENCE = ["Chưa xác định", "Unknown"] as const
export function findReference(catalog: Catalog, kind: CatalogKind, selection?: Selection | null) {
  return selection?.id ? catalog[kind].find((item) => item.id === selection.id) : undefined
}
export function referenceName(
  catalog: Catalog,
  kind: CatalogKind,
  selection?: Selection | null,
  unknown: string = UNKNOWN_REFERENCE[0],
) {
  return findReference(catalog, kind, selection)?.name || selection?.name || unknown
}

/** Two letters standing in for a missing picture: the first letters of two words, or the start of a single one. */
export function nameInitials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) => Array.from(word))
  const [first, second] = words
  if (!first) return "?"
  const capital = first[0]!.toLocaleUpperCase("vi-VN")
  return second
    ? capital + second[0]!.toLocaleUpperCase("vi-VN")
    : capital + (first[1] ?? "").toLocaleLowerCase("vi-VN")
}

/** A name that never breaks at its hyphen: "HCM-UTE" stays one word on a narrow row. */
export const unbroken = (name: string) => name.replace(/-/g, "\u2011")

export function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`
}
export function snapshotAt(snapshots: EquipmentSnapshot[], seconds: number) {
  return snapshots
    .filter((snapshot) => snapshot.atSeconds <= seconds)
    .reduce<EquipmentSnapshot | undefined>(
      (last, next) => (!last || next.atSeconds > last.atSeconds ? next : last),
      undefined,
    )
}
export function observationTimes(sides: GameSide[]) {
  return [
    ...new Set(
      sides.flatMap((side) =>
        side.participants.flatMap((participant) => [
          ...participant.equipmentSnapshots.map((snapshot) => snapshot.atSeconds),
          ...participant.equipmentEvents.map((event) => event.atSeconds),
        ]),
      ),
    ),
  ].sort((a, b) => a - b)
}
export function orderedParticipants(participants: Participant[]) {
  const order = Object.keys(LANE_NAMES)
  return [...participants].sort((a, b) => order.indexOf(a.lane) - order.indexOf(b.lane))
}

/**
 * A note as plain lines. Notes imported from a wiki keep its markup: a template is replaced by the value it names
 * ("{{Player|NuNu|flag=th}}" reads "NuNu", "{{Abbr/ICT}}" reads "ICT", a flag reads nothing) and a line tag starts
 * a new line.
 */
export function plainNote(note: string) {
  return note
    .replace(/<\s*(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{([^{}]*)\}\}/g, (_, body: string) => {
      const [name = "", ...values] = body.split("|").map((part) => part.trim())
      if (/^flag$/i.test(name)) return ""
      return values.find((part) => !part.includes("=")) ?? (name.includes("/") ? name.slice(name.indexOf("/") + 1) : "")
    })
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
}

/** A series name without the pairing ("Round 18 · FPL vs SGP" reads "Round 18"): the teams stand beside it. */
export function seriesRound(name?: string | null) {
  const parts = (name ?? "")
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !/\bvs\.?\b/i.test(part))
  return parts.join(" · ") || null
}

/** The sides of a game in the order of its series, so a team keeps its place from one game to the next. */
export function seriesSides(game: Pick<PublishedGame, "content" | "series">) {
  const first = game.content.sides.find((side) => side.teamId === game.series.teamAId)
  return first ? [first, ...game.content.sides.filter((side) => side !== first)] : game.content.sides
}

export type SeriesTeam = {
  teamId: string
  name: string
  shortName: string
  logoUrl?: string
  /** Games won in the series, once its result is recorded. */
  score: number | null
  won: boolean
  lost: boolean
}

/**
 * Both teams of the series a game belongs to, with the series score and its winner once the score decides it. A team
 * the data does not name reads in `locale`.
 */
export function seriesTeams(game: Pick<PublishedGame, "series" | "teams">, locale = "vi-VN"): [SeriesTeam, SeriesTeam] {
  const english = locale.startsWith("en")
  const { teamAId, teamBId, bestOf, result } = game.series
  const a = result?.scoreA ?? null
  const b = result?.scoreB ?? null
  const decided = a != null && b != null && a !== b && Math.max(a, b) >= Math.floor(bestOf / 2) + 1
  return [teamAId, teamBId].map((teamId, index) => {
    const team = game.teams[teamId]
    const score = index === 0 ? a : b
    const ahead = decided && score === Math.max(a!, b!)
    return {
      teamId,
      name: team?.name || (english ? "No team information yet" : "Đội chưa có thông tin"),
      shortName: team?.shortName || team?.name || (english ? "Team" : "Đội"),
      logoUrl: team?.logoUrl,
      score,
      won: ahead,
      lost: decided && !ahead,
    }
  }) as [SeriesTeam, SeriesTeam]
}

export type LoadoutKind = "equipment" | "arcana" | "enchantments"
const LOADOUT_KINDS: LoadoutKind[] = ["equipment", "arcana", "enchantments"]

/** Whether a source showed anything of this kind for a player. A status alone, without entries, is not a record. */
export function hasLoadout(participant: Participant, kind: LoadoutKind) {
  if (kind === "equipment") return participant.equipmentSnapshots.length > 0
  const loadout = participant[kind]
  return (loadout.status === "KNOWN" || loadout.status === "PARTIAL") && loadout.entries.length > 0
}

/** The kinds of loadout recorded for at least one player of a game, in the order they are shown. */
export function recordedLoadouts(sides: GameSide[]) {
  const players = sides.flatMap((side) => side.participants)
  return LOADOUT_KINDS.filter(
    (kind) =>
      players.some((participant) => hasLoadout(participant, kind)) ||
      (kind === "equipment" && players.some((participant) => participant.equipmentEvents.length > 0)),
  )
}
