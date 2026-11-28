import type { MatchTitle } from "./match-titles"
import type { PersonRole } from "./pages"

export * from "./pages"
export * from "./channels"
export * from "./competition"
export * from "./match-titles"
export * from "./references"
export * from "./translation"
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
  /** The logo drawn for a dark background; without it logoUrl serves both themes. */
  logoDarkUrl?: string | null
  aliases?: string[]
}
export type CareerStatus = "ACTIVE" | "INACTIVE" | "RETIRED" | "UNKNOWN"
export type PlayerContent = {
  code: string
  nickname: string
  /** Admin only: published competitions and games carry no real name. */
  fullName?: string | null
  country?: string
  photoUrl?: string
  aliases?: string[]
  /** Admin only, like the real name. */
  birthDate?: string | null
  /** Usual position; a position in one tournament stays on its roster entry. */
  lane?: Lane | null
  careerStatus?: CareerStatus
  signatureHeroes?: string[]
}
export type RosterStatus = "ACTIVE" | "SUBSTITUTE" | "INACTIVE" | "UNKNOWN"
export type DirectoryTeamRef = {
  id: string
  name: string
  shortName?: string | null
  logoUrl?: string | null
  logoDarkUrl?: string | null
}
export type DirectoryTournamentRef = {
  id: string
  name: string
  logoUrl?: string | null
  logoDarkUrl?: string | null
  tier?: TournamentTier
  year?: number | null
  startsOn?: string | null
  endsOn?: string | null
}
export type DirectoryLineupMember = {
  playerId: string
  name: string
  photoUrl?: string | null
  lane?: Lane | null
  status: RosterStatus
}
/** A team with figures derived from its tournaments, series and most recent roster. */
export type TeamDirectoryEntry = {
  id: string
  code: string
  name: string
  shortName?: string | null
  country?: string | null
  logoUrl?: string | null
  logoDarkUrl?: string | null
  tournaments: number
  matches: number
  wins: number
  losses: number
  titles: number
  prizeUsd?: number | null
  latestTournament?: DirectoryTournamentRef | null
  lineup: DirectoryLineupMember[]
  lineupTournament?: DirectoryTournamentRef | null
  lastActiveOn?: string | null
}
/** `latestTeam` is the team of the most recent roster line, not a claim about today's contract. */
export type PlayerDirectoryEntry = {
  id: string
  code: string
  nickname: string
  fullName?: string | null
  country?: string | null
  photoUrl?: string | null
  birthDate?: string | null
  lane?: Lane | null
  careerStatus: CareerStatus
  signatureHeroes: string[]
  tournaments: number
  titles: number
  latestTeam?: DirectoryTeamRef | null
  latestTournament?: DirectoryTournamentRef | null
  lastActiveOn?: string | null
}
/** Tournaments gathered under an organizer's or a circuit's page. */
export type CompetitionPageEntry = {
  pageId: string
  tournaments: number
  firstYear?: number | null
  lastYear?: number | null
  tiers: TournamentTier[]
  latestTournament?: DirectoryTournamentRef | null
}
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
  /** The team's captain in this tournament; absent means no. */
  captain?: boolean | null
}
export type TournamentTier = "S" | "A" | "B" | "C" | "D" | "UNKNOWN"
export type CompetitionType = "LEAGUE" | "CUP" | "QUALIFIER" | "SHOWMATCH" | "OTHER" | "UNKNOWN"
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
/** One line of a final table; `place` is text because a line can be shared ("5-8"). */
export type TournamentPlacement = {
  place: string
  teamId?: string | null
  teamName: string
  prizeUsd?: number | null
  prizeLocal?: number | null
  lastOpponent?: string | null
  lastScore?: string | null
}
/** `playerId` and `teamId` link the registered player and team; the names stay readable either way. */
export type TournamentAward = {
  title: string
  playerId?: string | null
  recipientName: string
  teamId?: string | null
  teamName?: string | null
  prizeUsd?: number | null
  prizeLocal?: number | null
}
/** What a person did on the broadcast of a tournament or a match (spec 04, ADR-032). */
export type BroadcastRole = Extract<PersonRole, "HOST" | "CASTER" | "INTERVIEWER" | "GUEST_ANALYST">
export const broadcastRoles: BroadcastRole[] = ["HOST", "CASTER", "INTERVIEWER", "GUEST_ANALYST"]
/** What a person did for a team at one tournament. */
export type StaffRole = Extract<PersonRole, "COACH" | "TEAM_ANALYST">
export const staffRoles: StaffRole[] = ["COACH", "TEAM_ANALYST"]
/** A person of the broadcast, named by their PERSON or PLAYER profile page. */
export type CrewMember = { pageId: string; role: BroadcastRole }
/** A member of a team's staff at one tournament; `title` is the wording shown as written, such as an assistant coach's title. */
export type StaffMember = { teamId: string; pageId: string; role: StaffRole; title?: string | null }
export type TournamentLink = { label: string; url: string }
export type TournamentStats = { tournamentId: string; teams: number; matches: number; played: number }
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
  /** The logo drawn for a dark background; without it logoUrl serves both themes. */
  logoDarkUrl?: string | null
  tier?: TournamentTier
  competitionType?: CompetitionType
  venueMode?: VenueMode
  status?: TournamentStatus
  result?: TournamentResult | null
  localCurrency?: string | null
  placements?: TournamentPlacement[]
  awards?: TournamentAward[]
  links?: TournamentLink[]
  /** The main event this tournament is a part of: its qualifier, wildcard, weekly stop or show match. */
  parentTournamentId?: string | null
  /** The broadcast crew of the whole tournament. */
  broadcast?: CrewMember[]
  /** The staff of each team at this tournament. */
  staff?: StaffMember[]
}
/** A part of a main event as a tab or a list line shows it; opening the part reads its full record. */
export type TournamentPart = {
  id: string
  parentId: string
  name: string
  logoUrl?: string | null
  logoDarkUrl?: string | null
  competitionType?: CompetitionType
  status?: TournamentStatus
  tier?: TournamentTier
  region?: string
  startsOn?: string | null
  endsOn?: string | null
}
/** `name` is a name an editor typed; a series made from a generated match carries its `title` instead. */
export type SeriesContent = {
  code: string
  tournamentId: string
  name?: string | null
  title?: MatchTitle | null
  stage?: string
  teamAId: string
  teamBId: string
  bestOf: number
  scheduledAt?: string
  sourceUrl?: string
  note?: string
  result?: SeriesResult | null
  /** The match was played without the rule against re-picking a hero in later games. */
  repeatPicksAllowed?: boolean
  /** The people who worked this match's broadcast, besides the tournament's crew. */
  broadcast?: CrewMember[]
  mvpPlayerId?: string | null
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
/**
 * Where the first lists put an item (25/11/2026). The service reads it into `role` and `sold` and never answers it, so a
 * client only ever writes the current shape.
 */
export type BuildPlace = "KEPT" | "REPLACED" | "SITUATIONAL"
/**
 * What an item was bought for: the build itself, or protection, such as a revive or an item that saves its holder for
 * a moment. An active effect says nothing of it.
 */
export type BuildRole = "CORE" | "PROTECTIVE"
/**
 * An item of tier 2 or 3 a player built, in the order it was built; buying it again is no second step. `from` are the
 * items that went into it, `replaces` the earlier steps sold for it, `sold` that it was sold for nothing recorded, and
 * `atSeconds` the game second it was held, where one is known. What became of each item is read from the later steps.
 */
export type BuildStep = {
  item: Selection
  from?: Selection[]
  replaces?: Selection[]
  role: BuildRole
  sold?: boolean
  atSeconds?: number | null
}
/** The role last recorded for each item by its id, for the hero first and else for any hero. */
export type BuildRoles = { items: Record<string, BuildRole> }
export type Participant = {
  playerId?: string | null
  lane: Lane
  hero: Selection
  spell?: Selection | null
  arcana: Loadout<ArcanaAllocation>
  enchantments: Loadout<EnchantmentAllocation>
  equipmentSnapshots: EquipmentSnapshot[]
  equipmentEvents: EquipmentEvent[]
  note?: string
  /** Game second the source showed the spell. */
  spellObservedAtSeconds?: number | null
  /** The items the player built; empty while nobody wrote them down, so the last snapshot is read instead. */
  build?: BuildStep[]
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
  mvpPlayerId?: string | null
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
  /** The day of the last activity of a team or player, in a list ordered by recency. */
  lastActiveOn?: string | null
  /** How the row relates to what its picker was opened in; absent when it does not. */
  context?: RankContext
}
export type RankContext = "TEAM_IN_TOURNAMENT" | "TEAM" | "TOURNAMENT" | "PARTICIPANT"
/**
 * How many tournaments each value of a filter leaves beside the search and the other filters; a value that leaves none
 * is missing. `total` counts every tournament of the level.
 */
export type TournamentFacets = {
  total: number
  statuses: Record<string, number>
  tiers: Record<string, number>
  regions: Record<string, number>
  years: Record<string, number>
}
/** What the team directory can be narrowed by, counted like `TournamentFacets`. */
export type TeamFacets = { countries: Record<string, number> }
/** What the player directory can be narrowed by, counted like `TournamentFacets`. */
export type PlayerFacets = {
  countries: Record<string, number>
  lanes: Record<string, number>
  statuses: Record<string, number>
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
/** A place where text names someone that no link names yet; see spec 04, links to review. */
export type LinkMentionKind = "GAME_MVP" | "SERIES_MVP" | "SERIES_BROADCAST" | "AWARD_PLAYER" | "AWARD_TEAM"
/**
 * `recordId` is the game, series or tournament to open; `label` is the match ("Team A vs Team B") or the award title;
 * `text` is the name as the text writes it.
 */
export type LinkMention = {
  kind: LinkMentionKind
  recordId: string
  tournamentId: string
  tournamentName: string
  seriesId?: string | null
  gameNumber?: number | null
  label?: string | null
  text: string
}
export type LinkMentionCount = { kind: LinkMentionKind; count: number }
export type Reference = {
  id: string
  code: string
  name: string
  iconUrl?: string | null
  tier?: number | null
  color?: string | null
  branchCode?: string | null
  revisionId?: string | null
  /** The items an item is made of, where the wiki has verified its recipe. */
  components?: string[]
  /** The wiki gives the item an effect its holder activates. */
  active?: boolean
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
