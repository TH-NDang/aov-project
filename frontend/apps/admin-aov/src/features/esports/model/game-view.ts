import type {
  Catalog,
  ObservationStatus,
  DocumentView,
  EquipmentSnapshot,
  GameContent,
  Lane,
  PlayerContent,
  Reference,
  Selection,
  Side,
  TeamContent,
} from "@aov/community-contracts"
import { IMPORTED_HERO_CODES } from "./imported-hero-names"
import { compactKey, nameKey } from "./name-key"
import { seatKey, type ItemRef, type SeatKey, type SlotState } from "./timeline"
import { LANE_ORDER } from "@/lib/lanes"

export type IconRef = { id?: string | null; name: string; iconUrl?: string | null; tier?: number | null }
export type TeamView = {
  id: string
  name: string
  shortName: string
  logoUrl?: string
  logoDarkUrl?: string | null
  country?: string
}
export type GameSeat = {
  key: SeatKey
  side: Side
  lane: Lane
  playerId?: string | null
  playerName: string
  photoUrl?: string
  hero: IconRef | null
  spell: IconRef | null
  /** `UNKNOWN`/`NOT_SHOWN` keep their meaning: an empty list is never read as "used nothing". */
  enchantments: { status: ObservationStatus; entries: (IconRef & { primary: boolean; level: number })[] }
  arcana: { status: ObservationStatus; entries: (IconRef & { count: number; color?: string })[] }
}
export type GameSideView = { side: Side; team: TeamView; bans: (IconRef | null)[]; seats: GameSeat[] }
/** An item a player still held when the game ended, with the second they had it where that is known. */
export type KeptItem = ItemRef & { atSeconds: number | null }
export type GameView = {
  id: string
  number: number
  winner: Side | null
  durationSeconds: number | null
  published: boolean
  missingFields: string[]
  sourceUrl: string
  sourceStartSecond: number | null
  sides: Record<Side, GameSideView>
  snapshots: Partial<Record<SeatKey, EquipmentSnapshot[]>>
  /** The items of a list somebody wrote for a seat; a list read off a snapshot is that snapshot. */
  kept?: Partial<Record<SeatKey, KeptItem[]>>
}

export const teamView = (entry?: DocumentView<TeamContent>, fallbackId = ""): TeamView =>
  entry
    ? {
        id: entry.id,
        name: entry.content.name,
        shortName: entry.content.shortName || initials(entry.content.name),
        logoUrl: entry.content.logoUrl,
        logoDarkUrl: entry.content.logoDarkUrl,
        country: entry.content.country,
      }
    : { id: fallbackId, name: "Chưa xác định", shortName: "TBD" }

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.map((word) => word[0]).join("") : name.slice(0, 3)).slice(0, 4).toLocaleUpperCase()
}

/**
 * Catalog lookup by id first. A selection recorded without an id is matched by name, then by the catalog code the
 * name spells ("Lu Bu" is `lu-bu`), then through the names imported games use for heroes the catalog calls otherwise.
 * A name match shows the catalog's spelling; an id match keeps the name recorded with it.
 */
export function referenceIndex(references: Reference[] = []) {
  const byId = new Map(references.map((entry) => [entry.id, entry]))
  const byName = new Map(references.map((entry) => [nameKey(entry.name), entry]))
  const byCode = new Map(references.flatMap((entry) => (entry.code ? [[compactKey(entry.code), entry] as const] : [])))
  const byRecordedName = (name: string) => {
    const imported = IMPORTED_HERO_CODES[nameKey(name)]
    return (
      byName.get(nameKey(name)) ??
      byCode.get(compactKey(name)) ??
      (imported ? byCode.get(compactKey(imported)) : undefined)
    )
  }
  return (selection?: Selection | null): IconRef | null => {
    if (!selection || (!selection.id && !selection.name)) return null
    const byIdMatch = selection.id ? byId.get(selection.id) : undefined
    const match = byIdMatch ?? (selection.name ? byRecordedName(selection.name) : undefined)
    return {
      id: selection.id,
      name: (byIdMatch ? selection.name || match?.name : match?.name || selection.name) || "Chưa rõ",
      iconUrl: match?.iconUrl,
      tier: match?.tier,
    }
  }
}

export function buildGameView(
  entry: DocumentView<GameContent>,
  teams: DocumentView<TeamContent>[],
  players: DocumentView<PlayerContent>[],
  catalog?: Catalog,
): GameView {
  const hero = referenceIndex(catalog?.heroes)
  const spell = referenceIndex(catalog?.spells)
  const enchantment = referenceIndex(catalog?.enchantments)
  const arcanum = referenceIndex(catalog?.arcana)
  const item = referenceIndex(catalog?.items)
  const snapshots: GameView["snapshots"] = {}
  const kept: NonNullable<GameView["kept"]> = {}
  const side = (code: Side): GameSideView => {
    const source = entry.content.sides.find((candidate) => candidate.side === code)
    const team = teamView(
      teams.find((candidate) => candidate.id === source?.teamId),
      source?.teamId,
    )
    const seats = LANE_ORDER.map((lane): GameSeat => {
      const participant = source?.participants.find((candidate) => candidate.lane === lane)
      const player = players.find((candidate) => candidate.id === participant?.playerId)
      const key = seatKey(code, lane)
      if (participant?.equipmentSnapshots.length) snapshots[key] = participant.equipmentSnapshots
      if (participant?.build?.length)
        kept[key] = participant.build.flatMap((step) => {
          const ref = step.place === "KEPT" ? item(step.item) : null
          return ref ? [{ id: ref.id, name: ref.name, atSeconds: step.atSeconds ?? null }] : []
        })
      return {
        key,
        side: code,
        lane,
        playerId: participant?.playerId,
        playerName: player?.content.nickname ?? "Chưa ghi tuyển thủ",
        photoUrl: player?.content.photoUrl,
        hero: hero(participant?.hero),
        spell: spell(participant?.spell),
        enchantments: {
          status: participant?.enchantments.status ?? "UNKNOWN",
          entries: (participant?.enchantments.entries ?? []).flatMap((entry) => {
            const ref = enchantment(entry.selection)
            return ref ? [{ ...ref, primary: entry.primary, level: entry.tier }] : []
          }),
        },
        arcana: {
          status: participant?.arcana.status ?? "UNKNOWN",
          entries: (participant?.arcana.entries ?? []).flatMap((entry) => {
            const ref = arcanum(entry.selection)
            return ref ? [{ ...ref, count: entry.count, color: entry.color }] : []
          }),
        },
      }
    })
    return { side: code, team, bans: (source?.bans ?? []).map((ban) => hero(ban)), seats }
  }
  return {
    id: entry.id,
    number: entry.content.number,
    winner: entry.content.winner ?? null,
    durationSeconds: entry.content.durationSeconds ?? null,
    published: !!entry.publishedAt,
    missingFields: entry.missingFields,
    sourceUrl: entry.content.sourceUrl ?? "",
    sourceStartSecond: entry.content.sourceTimestampSeconds ?? null,
    sides: { BLUE: side("BLUE"), RED: side("RED") },
    snapshots,
    kept,
  }
}

/**
 * The six slots of a seat at a moment. What the sources showed comes first. Where they showed nothing the slots are the
 * items kept to the end, each from the second the player had it, and once the game has ended they are just those.
 */
export function slotsAt(kept: KeptItem[] | undefined, observed: SlotState[], at: number, ended: boolean): SlotState[] {
  if (!kept?.length || (!ended && observed.some((slot) => slot !== undefined))) return observed
  return observed.map((_, slot) => {
    const held = kept[slot]
    return held && (ended || held.atSeconds == null || held.atSeconds <= at)
      ? { id: held.id, name: held.name }
      : undefined
  })
}
