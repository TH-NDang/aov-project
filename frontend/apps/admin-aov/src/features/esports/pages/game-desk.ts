import type { Catalog, DocumentView, GameContent, Reference } from "@aov/community-contracts"
import type { ContentChange, DeskPanel, DeskTool, MomentForm, RecordedChange, ToolTarget } from "../model/desk"
import type { GameView } from "../model/game-view"
import type { ItemLookups } from "../model/item-lookups"
import type { RosterOption } from "../model/line-up"
import type { Playhead } from "../model/playhead"
import type { RecordingProgress } from "../model/recording-progress"
import type { HeroLocks } from "../model/series-rules"
import type { GameChapter } from "../model/series-vod"

export type GameDesk = {
  entry: DocumentView<GameContent>
  view: GameView
  chapter: GameChapter
  progress: RecordingProgress
  catalog: Catalog | undefined
  catalogError: unknown
  reloadCatalog: () => void
  heroes: Reference[]
  spells: Reference[]
  items: Reference[]
  lookups: ItemLookups
  roster: (teamId: string) => RosterOption[]
  locks: HeroLocks
  previous: GameContent | null
  tournamentId: string
  tournamentRegion?: string
  /** Recording: the account may write and the page is in `?edit=1`. */
  editable: boolean
  canPublish: boolean
  /** Below 900 px: no keycaps, no focus kept in a search field. */
  compact: boolean
  videoId: string | null
  playhead: Playhead
  playing: boolean
  /** The video second a mark takes now, floored; null without a video. Read from the player when it can tell. */
  markNow: () => number | null
  /** Writes at once; the foot says it and offers the undo. False when it was refused. */
  record: (change: RecordedChange) => Promise<boolean>
  /** Writes without an undo of its own, for forms that keep theirs. */
  save: (change: ContentChange) => Promise<boolean>
  saveError: string | null
  publish: () => Promise<boolean>
  withdraw: () => Promise<boolean>
  seekVideo: (second: number, play?: boolean) => void
  seekGame: (gameSecond: number, play?: boolean) => void
  shareLink: (videoSecond: number) => string
  openTool: (tool: DeskTool, target?: ToolTarget) => void
  openPanel: (panel: DeskPanel | null) => void
  /** Puts a refusal into the status line. */
  say: (text: string) => void
  /** Stored id of the selected moment. */
  activeId: string | null
  onActive: (id: string | null) => void
  form: MomentForm | null
  onForm: (form: MomentForm | null) => void
  /** The game on screen was deleted. */
  onDeleted: () => void
}

/** What the keyed dock hands the page: the writes of the game on screen. */
export type GameActions = {
  record: GameDesk["record"]
  save: GameDesk["save"]
  publish: () => Promise<boolean>
  withdraw: () => Promise<boolean>
  settled: () => Promise<void>
}
