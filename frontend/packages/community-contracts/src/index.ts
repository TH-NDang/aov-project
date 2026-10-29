export type Selection = { id?: string | null; name?: string | null }
/** `PARTIAL`: the source showed part of a loadout, so entries may be incomplete or lack an exact name. */
export type ObservationStatus = "UNKNOWN" | "NOT_SHOWN" | "PARTIAL" | "KNOWN"
export type Lane = "TOP" | "JUNGLE" | "MID" | "DRAGON" | "SUPPORT"
export type Side = "BLUE" | "RED"
export type TeamContent = {
  code: string
  name: string
  shortName?: string
  country?: string
  logoUrl?: string
  aliases?: string[]
}
export type PlayerContent = {
  code: string
  nickname: string
  fullName?: string
  country?: string
  photoUrl?: string
  aliases?: string[]
}
export type RosterStatus = "ACTIVE" | "SUBSTITUTE" | "INACTIVE" | "UNKNOWN"
export type RosterMembershipContent = {
  tournamentId: string
  teamId: string
  playerId: string
  lane?: Lane | null
  jerseyNumber?: string | null
  status?: RosterStatus
  startsOn?: string | null
  endsOn?: string | null
  sourceUrl?: string | null
  verification?: ResultVerification
  note?: string | null
}
export type TournamentTier = "S" | "A" | "B" | "C" | "UNKNOWN"
export type CompetitionType = "LEAGUE" | "CUP" | "QUALIFIER" | "UNKNOWN"
export type VenueMode = "ONLINE" | "OFFLINE" | "HYBRID" | "UNKNOWN"
export type TournamentStatus = "UPCOMING" | "ONGOING" | "FINISHED" | "ANNOUNCED" | "UNKNOWN"
export type ResultVerification =
  "PRIMARY" | "SECONDARY_CORROBORATED" | "SECONDARY_CAPTURE" | "SECONDARY_PRESS_ONLY" | "UNVERIFIED"
export type TournamentResult = {
  winnerName: string
  runnerUpName: string
  winnerScore?: number | null
  runnerUpScore?: number | null
  sourceUrl: string
  verification: ResultVerification
  verifiedOn?: string | null
}
export type TournamentContent = {
  code: string
  name: string
  region: string
  year?: number
  startsOn?: string
  endsOn?: string
  sourceUrl?: string
  note?: string
  logoUrl?: string
  tier?: TournamentTier
  competitionType?: CompetitionType
  venueMode?: VenueMode
  status?: TournamentStatus
  result?: TournamentResult | null
}
export type SeriesContent = {
  code: string
  tournamentId: string
  name?: string
  stage?: string
  teamAId: string
  teamBId: string
  bestOf: number
  scheduledAt?: string
  sourceUrl?: string
  note?: string
  result?: SeriesResult | null
}
export type SeriesResult = {
  scoreA: number
  scoreB: number
  sourceUrl: string
  verification: ResultVerification
  verifiedOn?: string | null
}
export type ArcanaAllocation = { selection: Selection; count: number; color?: "RED" | "PURPLE" | "GREEN" }
export type EnchantmentAllocation = { selection: Selection; primary: boolean; tier: number; branchCode?: string }
/** `observedAtSeconds` is the game second the source showed the loadout. */
export type Loadout<T> = { status: ObservationStatus; entries: T[]; note?: string; observedAtSeconds?: number | null }
export type InventorySlot = { slot: number; known: boolean; item?: Selection | null }
export type EquipmentSnapshot = { atSeconds: number; slots: InventorySlot[]; note?: string }
export type EquipmentEvent = {
  atSeconds: number
  type: "BUY" | "SELL" | "UPGRADE" | "SWAP"
  item?: Selection
  replacedItem?: Selection
  fromSlot?: number
  toSlot?: number
  note?: string
}
export type Participant = {
  playerId?: string | null
  lane: Lane
  hero: Selection
  spell: Selection
  arcana: Loadout<ArcanaAllocation>
  enchantments: Loadout<EnchantmentAllocation>
  equipmentSnapshots: EquipmentSnapshot[]
  equipmentEvents: EquipmentEvent[]
  note?: string
  /** Game second the source showed the spell. */
  spellObservedAtSeconds?: number | null
}
export type GameSide = { side: Side; teamId: string; bans: Selection[]; participants: Participant[] }
/** A participant position inside one game, independent of the player who filled it. */
export type Seat = { side: Side; lane: Lane }
/** Broadcast stoppage: the game clock holds at `atSeconds` for `durationSeconds` of video. */
export type VodPause = { atSeconds: number; durationSeconds: number }
export type TimelineKind = "KILL" | "OBJECTIVE" | "NOTE"
export type ObjectiveKind = "DARK_SLAYER" | "ABYSSAL_DRAGON" | "TURRET" | "BASE" | "OTHER"
/** Kills use killer/victim/assists, objectives side/objective/by, notes title and optional side. */
export type TimelineEvent = {
  id: string
  atSeconds: number
  kind: TimelineKind
  killer?: Seat | null
  victim?: Seat | null
  assists?: Seat[]
  side?: Side | null
  objective?: ObjectiveKind | null
  by?: Seat | null
  title?: string | null
  note?: string | null
}
export type GameTimeline = { pauses: VodPause[]; events: TimelineEvent[] }
export type DraftKind = "BAN" | "PICK"
/** One ban/pick turn in the order it was taken; `atSecond` is a position in the game video. */
export type DraftTurn = {
  order: number
  kind: DraftKind
  side: Side
  hero?: Selection | null
  atSecond?: number | null
}
/**
 * Ban/pick phase in the game video: its start, the turns in order and the lock after teammates swap heroes.
 * Times are video seconds of `sourceUrl`, like `sourceTimestampSeconds`.
 */
export type GameDraft = { startSecond?: number | null; lockedSecond?: number | null; turns: DraftTurn[] }
export type GameContent = {
  seriesId: string
  number: number
  region: string
  locale: string
  seasonId?: string | null
  patchVariantId?: string | null
  startedAt?: string
  durationSeconds?: number | null
  winner?: Side | null
  sourceUrl?: string
  sourceTimestampSeconds?: number
  note?: string
  sides: GameSide[]
  includeUnscoped?: boolean
  /** Kill, objective and note moments plus broadcast pauses; equipment changes stay on participants. */
  timeline?: GameTimeline
  draft?: GameDraft
}
export type DocumentView<T> = {
  id: string
  version: number
  createdAt: string
  updatedAt: string
  content: T
  missingFields: string[]
  publishedAt?: string | null
  deletedAt?: string | null
}
export type RegistryRecordState = "ACTIVE" | "DELETED" | "ALL"
export type DeletionUsage = { type: string; count: number; adminPath: string }
export type RecordDeletionImpact = {
  id: string
  version: number
  deletedAt: string | null
  canDelete: boolean
  usages: DeletionUsage[]
}
export type RecordLifecycleState = { id: string; version: number; deletedAt: string | null }
export type PageSlice<T> = { items: T[]; totalElements: number; page: number; size: number }
export type Reference = {
  id: string
  code: string
  name: string
  iconUrl?: string | null
  tier?: number | null
  color?: string | null
  branchCode?: string | null
  revisionId?: string | null
}
export type ResolvedContext = {
  region: string
  locale: string
  rulesetId?: string | null
  seasonId?: string | null
  seasonName?: string | null
  patchVariantId?: string | null
  patchCode?: string | null
  patchTitle?: string | null
  unknown: boolean
  includeUnscoped: boolean
}
export type Catalog = {
  heroes: Reference[]
  items: Reference[]
  arcana: Reference[]
  enchantments: Reference[]
  spells: Reference[]
  resolvedContext?: ResolvedContext
}
export type PublishedGame = {
  id: string
  publishedAt: string
  content: GameContent
  teams: Record<string, TeamContent>
  players: Record<string, PlayerContent>
  catalog: Catalog
  series: SeriesContent
  tournament: TournamentContent
  resolvedContext: ResolvedContext
}
