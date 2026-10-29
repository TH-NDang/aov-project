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
import { LANE_ORDER } from "./labels"
import { seatKey, type SeatKey } from "./timeline"

export type IconRef = { id?: string | null; name: string; iconUrl?: string | null; tier?: number | null }
export type TeamView = { id: string; name: string; shortName: string; logoUrl?: string; country?: string }
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
}

export const teamView = (entry?: DocumentView<TeamContent>, fallbackId = ""): TeamView =>
  entry
    ? {
        id: entry.id,
        name: entry.content.name,
        shortName: entry.content.shortName || initials(entry.content.name),
        logoUrl: entry.content.logoUrl,
        country: entry.content.country,
      }
    : { id: fallbackId, name: "Chưa xác định", shortName: "TBD" }

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.map((word) => word[0]).join("") : name.slice(0, 3)).slice(0, 4).toLocaleUpperCase()
}

/** Catalog lookup by id first, then by display name for selections recorded without an id. */
export function referenceIndex(references: Reference[] = []) {
  const byId = new Map(references.map((entry) => [entry.id, entry]))
  const byName = new Map(references.map((entry) => [entry.name.toLocaleLowerCase(), entry]))
  return (selection?: Selection | null): IconRef | null => {
    if (!selection || (!selection.id && !selection.name)) return null
    const match = (selection.id && byId.get(selection.id)) || byName.get((selection.name ?? "").toLocaleLowerCase())
    return {
      id: selection.id,
      name: selection.name || match?.name || "Chưa rõ",
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
  const snapshots: GameView["snapshots"] = {}
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
  }
}

/** Seats in display order: blue lanes then red lanes. */
export const allSeats = (view: GameView) => [...view.sides.BLUE.seats, ...view.sides.RED.seats]
