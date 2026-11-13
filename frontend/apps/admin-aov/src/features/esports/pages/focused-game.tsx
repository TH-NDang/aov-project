import { currentTimeZone, formatInZone } from "@aov/ui/lib/time-zone"
import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react"
import type { Catalog, DocumentView, GameContent, Reference, Side } from "@aov/community-contracts"
import {
  CircleAlert,
  CircleCheck,
  Gem,
  Info,
  Link2,
  ListChecks,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldBan,
} from "lucide-react"
import { useGameSaver, type SaveState } from "../data/use-game-saver"
import type { ItemLookups } from "../components/game/cluster-card"
import { DraftEditor, type RosterOption } from "../components/game/draft-editor"
import { EventComposer, type VideoClock } from "../components/game/event-composer"
import { EventDetailDialog } from "../components/game/event-detail-dialog"
import { EventFeed, type FeedFilter } from "../components/game/event-feed"
import { FloatingPanel } from "../components/game/floating-panel"
import { Scoreboard } from "../components/game/scoreboard"
import { VodSyncPanel } from "../components/game/vod-sync-panel"
import { referenceIndex, type GameView } from "../model/game-view"
import type { HeroLocks } from "../model/series-rules"
import { recordingProgress, type ProgressTarget } from "../model/recording-progress"
import { GameInfoPanel } from "./game-info-panel"
import { LoadoutPanel } from "./loadout-panel"
import type { LoadoutPart } from "../model/loadout"
import { ProgressPanel } from "./progress-panel"
import { chapterVideo, type GameChapter } from "../model/series-vod"
import { videoToGame } from "../model/vod"
import { readTimeline, upsertEvent, withPlayback, writeTimeline } from "../model/timeline-io"
import {
  clusterEvents,
  eventSeats,
  type EventCluster,
  type ItemRef,
  type SeatKey,
  type TimelineEvent,
  type TimelineKind,
} from "../model/timeline"
import { youtubeWatchUrl } from "../model/vod"

export type Panel =
  | {
      kind: "composer"
      editing?: TimelineEvent
      eventKind?: TimelineKind
      /** Video second the moment was asked for on the timeline; the playhead when absent. */
      at?: number
      side?: Side
    }
  | { kind: "sync"; focus?: "end" }
  | { kind: "draft" }
  | { kind: "loadout"; seat?: SeatKey; part?: LoadoutPart }
  | { kind: "progress" }
  | { kind: "info" }
/** Moments of one game to show in the detail dialog, by stored id. */
export type DetailRequest = { gameId: string; ids: string[] }

/** Saves through the focused game's own queue, for actions the page renders outside the game subtree. */
export type GameActions = {
  save: (change: (content: GameContent) => GameContent) => Promise<boolean>
  publish: () => Promise<boolean>
  withdraw: () => Promise<boolean>
}

export type FocusedGameParts = {
  feed: (className: string) => ReactNode
  board: ReactNode
  status: ReactNode
  popups: ReactNode
  focusChip: ReactNode
  publishedNote: ReactNode
}

/** Only finished (tier 3) items reach the timeline; components stay in the scoreboard and behind a feed toggle. */
export const isMajorMoment = (lookups: ItemLookups) => (event: TimelineEvent) =>
  event.kind !== "ITEM" || (!!event.item && lookups.itemTier(event.item) === 3)

export function itemLookups(items: Reference[]): ItemLookups {
  const icons = referenceIndex(items)
  return { itemIcon: (item: ItemRef) => icons(item)?.iconUrl, itemTier: (item: ItemRef) => icons(item)?.tier }
}

/**
 * Everything about the game the video is currently showing: its feed, scoreboard, draft and the recording tools.
 * Saving goes through that game's own versioned queue. Layout is left to the page through `children`.
 */
export function FocusedGame({
  entry,
  view,
  chapter,
  items,
  heroes,
  spells,
  catalog,
  roster,
  locks,
  editable,
  canPublish,
  phone,
  gameAt,
  videoId,
  videoNow,
  playing,
  activeId,
  panel,
  detail,
  onActive,
  onPanel,
  onDetail,
  seekGame,
  onVideoUrl,
  shareLink,
  actions,
  tournamentRegion,
  onEnableEditing,
  children,
}: {
  entry: DocumentView<GameContent>
  view: GameView
  chapter: GameChapter
  items: Reference[]
  heroes: Reference[]
  spells: Reference[]
  catalog?: Catalog
  roster: (teamId: string) => RosterOption[]
  locks: HeroLocks
  editable: boolean
  canPublish: boolean
  phone: boolean
  gameAt: number
  videoId: string | null
  videoNow: number | null
  playing: boolean
  activeId: string | null
  panel: Panel | null
  detail: DetailRequest | null
  onActive: (id: string | null) => void
  onPanel: (panel: Panel | null) => void
  onDetail: (detail: DetailRequest | null) => void
  seekGame: (second: number, play?: boolean) => void
  /** Applies a broadcast link to every game of the match. */
  onVideoUrl: (url: string) => void
  shareLink: (videoSecond: number) => string
  actions?: MutableRefObject<GameActions | null>
  /** Market of the tournament, to say so when a game is still recorded under another one. */
  tournamentRegion?: string
  onEnableEditing: () => void
  children: (parts: FocusedGameParts) => ReactNode
}) {
  const { save, publish, withdraw, state: saveState, reload } = useGameSaver(entry)
  useEffect(() => {
    if (!actions) return
    actions.current = { save, publish, withdraw }
    return () => {
      actions.current = null
    }
  }, [actions, save, publish, withdraw])
  const progress = useMemo(() => recordingProgress(entry), [entry])
  const openTarget = (target: ProgressTarget) => {
    if (!editable) onEnableEditing()
    // The result of a game is recorded where it ends, in the video panel; what the service still reports usually
    // comes down to the game's market, season or patch, which the info panel holds.
    onPanel(
      target === "composer"
        ? chapter.live
          ? { kind: "composer", eventKind: "KILL" }
          : { kind: "draft" }
        : target === "result"
          ? { kind: "sync", focus: "end" }
          : target === "data"
            ? { kind: "info" }
            : { kind: target },
    )
  }
  const events = useMemo(() => readTimeline(entry.content), [entry.content])
  const lookups = useMemo(() => itemLookups(items), [items])
  const majorEvents = useMemo(() => events.filter(isMajorMoment(lookups)), [events, lookups])
  const [filter, setFilter] = useState<FeedFilter>("ALL")
  const [focusSeat, setFocusSeat] = useState<SeatKey | null>(null)
  const [showAllItems, setShowAllItems] = useState(false)
  const feedBase = showAllItems ? events : majorEvents
  const feedEvents = focusSeat ? feedBase.filter((event) => eventSeats(event).includes(focusSeat)) : feedBase
  const videoLink = (event: TimelineEvent) =>
    videoId && chapter.synced ? youtubeWatchUrl(videoId, chapterVideo(chapter, event.at)) : null

  const videoAt = chapter.synced ? (event: TimelineEvent) => chapterVideo(chapter, event.at) : undefined
  const videoClock: VideoClock | undefined =
    chapter.live && chapter.sync.startSecond != null
      ? {
          now: videoNow,
          toVideo: (second) => chapterVideo(chapter, second),
          toGame: (second) => (second < chapter.sync.startSecond! ? null : videoToGame(chapter.sync, second)),
        }
      : undefined
  const heroIcon = useMemo(() => {
    const icons = referenceIndex(heroes)
    return (hero: { id?: string | null; name: string }) => icons(hero)?.iconUrl
  }, [heroes])
  const select = (event: TimelineEvent) => {
    onActive(event.id)
    seekGame(event.at)
  }
  const saveEvent = (event: TimelineEvent) => {
    onPanel(null)
    onActive(event.id)
    void save((content) => writeTimeline(content, upsertEvent(readTimeline(content), event)))
  }
  const deleteEvent = (event: TimelineEvent) =>
    void save((content) =>
      writeTimeline(
        content,
        readTimeline(content).filter((candidate) => candidate.id !== event.id),
      ),
    )
  const openCluster = (cluster: EventCluster) => onDetail({ gameId: entry.id, ids: cluster.events.map((e) => e.id) })
  const detailCluster: EventCluster | null = useMemo(() => {
    if (!detail || detail.gameId !== entry.id) return null
    const picked = events.filter((event) => detail.ids.includes(event.id))
    return picked.length ? (clusterEvents(picked, Number.POSITIVE_INFINITY)[0] ?? null) : null
  }, [detail, entry.id, events])

  const parts: FocusedGameParts = {
    feed: (className) => (
      <EventFeed
        className={className}
        game={view}
        events={feedEvents}
        at={gameAt}
        activeId={activeId}
        filter={filter}
        onFilter={setFilter}
        follow={playing}
        lookups={lookups}
        hiddenItems={events.length - majorEvents.length}
        showAllItems={showAllItems}
        onShowAllItems={setShowAllItems}
        onSelect={select}
        onOpen={openCluster}
        videoLink={videoLink}
        videoAt={videoAt}
        onEdit={editable ? (event) => onPanel({ kind: "composer", editing: event }) : undefined}
        onDelete={editable ? deleteEvent : undefined}
      />
    ),
    board: (
      <Scoreboard
        game={view}
        events={events}
        at={gameAt}
        focusSeat={focusSeat}
        onFocusSeat={setFocusSeat}
        itemIcon={lookups.itemIcon}
        itemTier={lookups.itemTier}
        locks={locks}
        heroIcon={heroIcon}
        onEditLoadout={editable && catalog ? (seat, part) => onPanel({ kind: "loadout", seat, part }) : undefined}
      />
    ),
    status: editable ? <SaveStatus state={saveState} onReload={() => void reload()} compact={phone} /> : null,
    focusChip: focusSeat && (
      <button type="button" className="rounded-full bg-muted px-2.5 py-1 text-xs" onClick={() => setFocusSeat(null)}>
        Đang lọc theo 1 tuyển thủ · bỏ lọc
      </button>
    ),
    publishedNote: editable && view.published && (
      <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        Ván {view.number} đã xuất bản: thay đổi ở đây chỉ vào bản nháp, trang công khai giữ bản cũ cho tới khi xuất bản
        lại trong “Dữ liệu ván”.
      </p>
    ),
    popups: (
      <>
        {editable && panel?.kind === "composer" && (
          <FloatingPanel
            title={`${panel.editing ? "Sửa sự kiện" : "Ghi sự kiện"} · Ván ${view.number}`}
            icon={<Plus size={15} />}
            onClose={() => onPanel(null)}
          >
            <EventComposer
              key={panel.editing?.id ?? `new-${panel.eventKind}-${panel.at ?? ""}-${panel.side ?? ""}`}
              game={view}
              at={gameAt}
              video={videoClock}
              knownDuration={view.durationSeconds}
              items={items}
              editing={panel.editing}
              initialKind={panel.eventKind}
              start={{ videoSecond: panel.at, side: panel.side }}
              snapshotsFor={(seat) => view.snapshots[seat]}
              events={events}
              onSave={saveEvent}
              onCancel={() => onPanel(null)}
            />
          </FloatingPanel>
        )}
        {editable && panel?.kind === "draft" && (
          <FloatingPanel
            title={`Cấm chọn · Ván ${view.number}`}
            icon={<ShieldBan size={15} />}
            onClose={() => onPanel(null)}
            width={600}
          >
            <DraftEditor
              content={entry.content}
              view={view}
              heroes={heroes}
              spells={spells}
              roster={roster}
              locks={locks}
              videoNow={videoNow}
              onChange={(change) => void save(change)}
            />
          </FloatingPanel>
        )}
        {editable && panel?.kind === "loadout" && catalog && (
          <FloatingPanel
            // A phone shows the title on one line.
            title={
              phone
                ? `Tuyển thủ, trang bị · Ván ${view.number}`
                : `Tuyển thủ · phụ trợ · phù hiệu · ngọc · trang bị · Ván ${view.number}`
            }
            icon={<Gem size={15} />}
            onClose={() => onPanel(null)}
            width={760}
          >
            <LoadoutPanel
              content={entry.content}
              view={view}
              catalog={catalog}
              roster={roster}
              clock={
                videoId && chapter.synced
                  ? {
                      videoNow,
                      toGame: (second) =>
                        chapter.live && second >= chapter.sync.startSecond! ? videoToGame(chapter.sync, second) : 0,
                      toVideo: (second) => chapterVideo(chapter, second),
                    }
                  : undefined
              }
              target={panel}
              error={saveState.status === "error" ? saveState.error : null}
              onSeekGame={(second) => seekGame(second)}
              onChange={(change) => save(change)}
            />
          </FloatingPanel>
        )}
        {editable && panel?.kind === "info" && (
          <FloatingPanel
            title={`Thông tin ván ${view.number}`}
            icon={<Info size={15} />}
            onClose={() => onPanel(null)}
            width={560}
          >
            <GameInfoPanel
              key={entry.version}
              entry={entry}
              tournamentRegion={tournamentRegion}
              canPublish={canPublish}
              onSave={(change) => void save((content) => ({ ...content, ...change }))}
              onWithdraw={() => void withdraw()}
              onDeleted={() => onPanel(null)}
              onOpenProgress={() => onPanel({ kind: "progress" })}
            />
          </FloatingPanel>
        )}
        {panel?.kind === "progress" && (
          <FloatingPanel
            title={`Tiến độ ghi · Ván ${view.number}`}
            icon={<ListChecks size={15} />}
            onClose={() => onPanel(null)}
            width={460}
          >
            <ProgressPanel
              progress={progress}
              game={view}
              publishedAt={entry.publishedAt}
              canPublish={canPublish}
              onOpen={openTarget}
              onConfirm={publish}
            />
          </FloatingPanel>
        )}
        {editable && panel?.kind === "sync" && (
          <FloatingPanel
            title={phone ? `Video · Ván ${view.number}` : `Video · đồng bộ · kết thúc · Ván ${view.number}`}
            icon={<Link2 size={15} />}
            onClose={() => onPanel(null)}
            width={520}
          >
            <VodSyncPanel
              key={panel.focus ?? "all"}
              url={view.sourceUrl}
              startSecond={view.sourceStartSecond}
              pauses={chapter.sync.pauses}
              recordedDuration={view.durationSeconds}
              gameAt={gameAt}
              videoNow={videoNow}
              number={view.number}
              teams={{ BLUE: view.sides.BLUE.team, RED: view.sides.RED.team }}
              winner={view.winner}
              focus={panel.focus}
              onChange={(change) => {
                if (change.url !== undefined) onVideoUrl(change.url)
                const rest = { ...change, url: undefined }
                if (rest.startSecond === undefined && !rest.pauses && !rest.duration && rest.winner === undefined)
                  return
                void save((content) => ({
                  ...withPlayback(content, {
                    startSecond: rest.startSecond,
                    pauses: rest.pauses,
                    durationSeconds: rest.duration,
                  }),
                  ...(rest.winner !== undefined ? { winner: rest.winner } : {}),
                }))
              }}
            />
          </FloatingPanel>
        )}
        <EventDetailDialog
          cluster={detailCluster}
          game={view}
          lookups={lookups}
          videoLink={videoLink}
          shareLink={(second) => shareLink(chapterVideo(chapter, second))}
          videoTime={videoAt}
          onWatch={(event) => {
            onActive(event.id)
            seekGame(event.at, !!videoId)
          }}
          onEdit={editable ? (event) => onPanel({ kind: "composer", editing: event }) : undefined}
          onDelete={editable ? deleteEvent : undefined}
          onClose={() => onDetail(null)}
        />
      </>
    ),
  }
  return <>{children(parts)}</>
}

const savedTime: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit" }

function SaveStatus({ state, onReload, compact }: { state: SaveState; onReload: () => void; compact?: boolean }) {
  if (state.status === "idle") return null
  if (state.status === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <LoaderCircle size={13} className="animate-spin" /> {!compact && "Đang lưu…"}
      </span>
    )
  if (state.status === "saved")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <CircleCheck size={13} className="text-[var(--esp-live)]" />
        {!compact && `Đã lưu ${formatInZone(state.savedAt, currentTimeZone(), savedTime)}`}
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-xs text-destructive" role="alert" title={state.error}>
      <CircleAlert size={13} /> {!compact && state.error}
      <button type="button" className="inline-flex items-center gap-1 font-medium underline" onClick={onReload}>
        <RefreshCw size={12} /> {!compact && "Tải bản mới"}
      </button>
    </span>
  )
}
