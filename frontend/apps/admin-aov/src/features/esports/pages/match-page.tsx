import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent, Reference, SeriesContent } from "@aov/community-contracts"
import {
  FastForward,
  ListVideo,
  Pause,
  PenLine,
  Play,
  Plus,
  Rewind,
  ShieldCheck,
  Swords,
  Undo2,
  Users,
  Zap,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { formatClock, parseClock } from "@/lib/clock"
import { initialGame } from "@/features/tournaments/model/tournament-model"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { useGameCatalog, useGamePatches, useGames, useRecords, useRosters } from "../data/use-esports-data"
import { useTournamentView } from "../data/use-tournament-view"
import { useSeriesVideo } from "../data/series-video"
import { WikiReferences } from "./wiki-references"
import { EmptyState, TeamLogo, TimeTag, VIDEO_MARK } from "../components/primitives"
import { FloatingPanel, usePhoneLayout } from "../components/game/floating-panel"
import { useSavedPlayhead } from "../components/game/use-saved-playhead"
import { VodPlayer, type VodPlayerHandle } from "../components/game/vod-player"
import { BroadcastTimeline, type TimelineRow } from "../components/series/broadcast-timeline"
import { AddGameButton, GameChips, QuickGamesButton } from "../components/series/game-chips"
import { GamePrimary, GameTools } from "../components/series/game-toolbar"
import { MatchHeader } from "../components/series/match-header"
import { MatchSetupGuide, useDraftVideo, VideoLinkCard } from "../components/series/match-setup"
import { MatchSwitcher } from "../components/series/match-switcher"
import { isTyping, ShortcutList } from "../components/series/shortcut-list"
import { broadcastChapters, type RetimeTarget } from "../model/broadcast-timeline"
import { previousGame } from "../model/carry-over"
import { seriesLabel } from "../model/series-label"
import { buildGameView, referenceIndex, type GameView, type TeamView } from "../model/game-view"
import { stageInfo } from "../model/labels"
import { byStanding, type RosterOption } from "../model/line-up"
import { publishRows } from "../model/match-publishing"
import { hasEveryGame, nextGameNumber, openQuickNumbers, quickRows } from "../model/series-score"
import {
  axisLength,
  broadcastEvents,
  chapterAt,
  chapterClock,
  chapterVideo,
  layoutChapters,
  seriesVideo,
  sourceOf,
  type GameChapter,
} from "../model/series-vod"
import { killScoreAt, type TimelineEvent, type TimelineKind } from "../model/timeline"
import { youtubeLinkTime, youtubeVideoId } from "../model/vod"
import { seriesLocks } from "../model/series-rules"
import { earliestLive, moveTurn, readDraft, setDraftTimes } from "../model/draft"
import { MARK_LABELS, moveMark } from "../model/observation-marks"
import { moveEvent, withPlayback } from "../model/timeline-io"
import { recordingProgress, type RecordingProgress } from "../model/recording-progress"
import {
  FocusedGame,
  isMajorMoment,
  itemLookups,
  panelFor,
  type DetailRequest,
  type GameActions,
  type Panel,
} from "./focused-game"
import { EditMatchButton } from "./edit-match-button"
import { MatchPublishPanel } from "./match-publish-panel"
import { QuickGamesPanel } from "./quick-games-panel"
import { ScoreCheck } from "./score-check"
import { AccessGate, Crumbs, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

const SHORTCUT_KINDS: Record<string, TimelineKind> = { k: "KILL", o: "OBJECTIVE", i: "ITEM", n: "NOTE" }
/** Readings far from a requested seek are ignored this long, while YouTube still reports the old position. */
const SEEK_SETTLE_MS = 2500
/** How long a moved marker can be put back with one click. */
const UNDO_MS = 8000
/** The catalog's items until it loads; one array, so the lookups built from it are not rebuilt on every render. */
const NO_ITEMS: Reference[] = []
/** A marker moved on the timeline: what happened, and how to put it back. */
type MoveUndo = { id: number; gameId: string; text: string; revert: () => void }
export type GameStart = { url: string; second: number }
/** The panels of the whole match, opened from its header: publishing, and the quick entry of its games. */
export type MatchPanel = "publish" | "quick"

const linkSecond = (value: string | null) =>
  value === null ? null : /^\d+$/.test(value) ? Number(value) : parseClock(value)

export function MatchPage() {
  return <AccessGate>{(access) => <MatchView access={access} />}</AccessGate>
}

function MatchView({ access }: { access: Access }) {
  const { tournamentId = "", seriesId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const view = useTournamentView(tournamentId)
  const players = useRecords("players")
  const games = useGames(seriesId)
  const rosters = useRosters(tournamentId)
  const record = view.records.find((entry) => entry.id === seriesId) as DocumentView<SeriesContent> | undefined
  const sorted = useMemo(
    () => [...(games.data ?? [])].sort((a, b) => a.content.number - b.content.number),
    [games.data],
  )
  const [matchPanel, setMatchPanel] = useState<MatchPanel | null>(null)
  const setParam = useCallback(
    (values: Record<string, string | null>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(values)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const create = useMutation({
    mutationFn: async ({ number, start }: { number: number; start: GameStart | null }) => {
      if (!record) throw new Error("Không tìm thấy trận.")
      const content = initialGame(record.id, record.content, number, view.tournament?.content.region ?? "VN")
      // A game recorded from the broadcast opens with its ban/pick phase where the admin paused the video.
      const created = await tournamentApi.create(
        "games",
        start
          ? { ...content, sourceUrl: start.url, draft: { startSecond: start.second, lockedSecond: null, turns: [] } }
          : content,
      )
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      if (start && created.content.draft?.startSecond == null)
        throw new Error(
          `Đã tạo ván ${number} nhưng máy chủ giải đấu chưa lưu được giai đoạn cấm chọn. Khởi động lại community-service bản mới, rồi dùng “Vào trận” để đặt mốc ván.`,
        )
      return created.id
    },
    meta: { silent: true },
  })
  const roster = useMemo(() => {
    const profiles = new Map((players.data ?? []).map((player) => [player.id, player.content]))
    const byTeam = new Map<string, RosterOption[]>()
    // Members who left stay listed, last, so a game they played can still name them; filling never seats them.
    for (const { content } of rosters.data ?? []) {
      const members = byTeam.get(content.teamId) ?? []
      members.push({
        id: content.playerId,
        name: profiles.get(content.playerId)?.nickname ?? "Tuyển thủ",
        photoUrl: profiles.get(content.playerId)?.photoUrl,
        lane: content.lane,
        status: content.status,
      })
      byTeam.set(content.teamId, members)
    }
    for (const members of byTeam.values()) members.sort(byStanding)
    return (teamId: string) => byTeam.get(teamId) ?? []
  }, [players.data, rosters.data])

  if (view.error || games.error)
    return (
      <EsportsPage>
        <LoadError
          error={view.error ?? games.error}
          onRetry={() => void Promise.all([view.refetch(), games.refetch()])}
        />
      </EsportsPage>
    )
  if (view.pending || games.isPending || players.isPending)
    return (
      <EsportsPage>
        <div className="aspect-video max-h-[60vh] animate-pulse rounded-2xl bg-muted" />
      </EsportsPage>
    )
  if (!record || !view.tournament)
    return (
      <EsportsPage>
        <EmptyState icon={<Swords size={28} />} title="Không tìm thấy trận đấu">
          <Link to={tournamentPath(tournamentId)} className="underline">
            Về trang giải
          </Link>
        </EmptyState>
      </EsportsPage>
    )

  const editable = access.canWrite && params.get("edit") === "1"
  const nextNumber = nextGameNumber(sorted)
  // A match whose score is complete gets another game only after its score changed.
  const canAddGame = access.canWrite && sorted.length < record.content.bestOf && !hasEveryGame(record.content, sorted)
  const waiting = publishRows(sorted).filter((row) => row.state === "ready").length

  return (
    <EsportsPage>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Crumbs
          items={[
            { label: "Giải đấu", to: "/tournaments" },
            { label: view.tournament.content.name, to: tournamentPath(tournamentId) },
            { label: seriesLabel(record.content) || stageInfo(record.content.stage).label },
          ]}
        />
        <MatchSwitcher
          records={view.records}
          seriesId={seriesId}
          team={view.team}
          editing={params.get("edit") === "1"}
        />
      </div>
      <MatchHeader content={record.content} team={view.team}>
        {access.canWrite && (
          <Button
            size="sm"
            variant={editable ? "default" : "secondary"}
            aria-pressed={editable}
            onClick={() => setParam({ edit: editable ? null : "1" })}
          >
            <PenLine aria-hidden /> {editable ? "Đang ghi" : "Chế độ ghi"}
          </Button>
        )}
        {sorted.length > 0 && (access.canWrite || access.canPublish) && (
          <Button
            size="sm"
            variant="secondary"
            aria-pressed={matchPanel === "publish"}
            onClick={() => setMatchPanel(matchPanel === "publish" ? null : "publish")}
          >
            <ShieldCheck aria-hidden /> Xuất bản
            {waiting > 0 && (
              <span className="esp-num rounded-full bg-[var(--esp-gold)] px-1.5 text-xs font-bold text-[var(--esp-ink)]">
                {waiting}
              </span>
            )}
          </Button>
        )}
        {access.canWrite && <EditMatchButton key={seriesId} record={record} actorKey={access.actorKey} />}
      </MatchHeader>
      {access.canWrite && (
        <ScoreCheck
          key={`score-${seriesId}`}
          record={record}
          games={sorted}
          team={view.team}
          fallbackSource={view.tournament.content.sourceUrl}
        />
      )}
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {tournamentError(create.error)}
        </p>
      )}
      <MatchViewer
        key={seriesId}
        series={record}
        games={sorted}
        teams={view.teams}
        team={view.team}
        players={players.data ?? []}
        roster={roster}
        editable={editable}
        canWrite={access.canWrite}
        canPublish={access.canPublish}
        matchPanel={matchPanel}
        onMatchPanel={setMatchPanel}
        onEnableEditing={() => setParam({ edit: "1" })}
        requestedGame={params.get("game")}
        fromLink={linkSecond(params.get("t"))}
        // Links to the former game data page open the same game with its info panel.
        openInfo={params.get("view") === "data"}
        onConsumeLink={() => setParam({ game: null, t: null, view: null })}
        tournamentRegion={view.tournament.content.region}
        resultNote={
          record.content.result && !sorted.length
            ? `Tỷ số cho biết đã đấu ${(record.content.result.scoreA ?? 0) + (record.content.result.scoreB ?? 0)} ván nhưng chưa ghi ván nào.`
            : null
        }
        addGame={
          canAddGame
            ? {
                number: nextNumber,
                pending: create.isPending,
                onAdd: (start) => create.mutateAsync({ number: nextNumber, start }),
              }
            : null
        }
      />
      {record.content.note && (
        <section className="admin-section px-4 py-3 text-sm text-muted-foreground">{record.content.note}</section>
      )}
    </EsportsPage>
  )
}

/**
 * The whole match on one official broadcast: one player, one video-axis timeline with every game as a chapter, and
 * the scoreboard, feed and draft of whichever game the video is showing.
 */
function MatchViewer({
  series,
  games,
  teams,
  team,
  players,
  roster,
  editable,
  canWrite,
  canPublish,
  matchPanel,
  onMatchPanel,
  onEnableEditing,
  requestedGame,
  fromLink,
  openInfo,
  onConsumeLink,
  tournamentRegion,
  resultNote,
  addGame,
}: {
  series: DocumentView<SeriesContent>
  games: DocumentView<GameContent>[]
  teams: Parameters<typeof buildGameView>[1]
  team: (id: string) => TeamView
  players: Parameters<typeof buildGameView>[2]
  roster: (teamId: string) => RosterOption[]
  editable: boolean
  canWrite: boolean
  canPublish: boolean
  matchPanel: MatchPanel | null
  onMatchPanel: (panel: MatchPanel | null) => void
  onEnableEditing: () => void
  requestedGame: string | null
  fromLink: number | null
  openInfo: boolean
  onConsumeLink: () => void
  tournamentRegion?: string
  /** Shown before the first game is recorded. */
  resultNote: string | null
  /** Records the next game: at the playhead of the video, outside every recorded game, or empty without a video. */
  addGame: { number: number; pending: boolean; onAdd: (start: GameStart | null) => Promise<string> } | null
}) {
  const phone = usePhoneLayout()
  const [draftLink, setDraftLink] = useDraftVideo(series.id)
  const draftId = youtubeVideoId(draftLink)
  const video = seriesVideo(series.content, games) ?? (draftId ? { videoId: draftId, url: draftLink } : null)
  const videoId = video?.videoId ?? null
  const chapters = useMemo(() => layoutChapters(games, videoId), [games, videoId])
  const flags = videoId ? broadcastChapters(videoId, series.content.sourceUrl, games) : []
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const duration = axisLength(chapters, videoDuration)
  const requested = chapters.find((chapter) => chapter.gameId === requestedGame)
  const [savedAt, setPlayhead] = useSavedPlayhead(
    `series:${series.id}`,
    fromLink ?? requested?.from ?? null,
    chapters[0]?.from ?? 0,
  )
  const at = Math.min(savedAt, duration)
  useEffect(() => {
    if (requestedGame || fromLink !== null || openInfo) onConsumeLink()
  }, [requestedGame, fromLink, openInfo, onConsumeLink])

  const here = chapterAt(chapters, at)
  const [lastFocus, setLastFocus] = useState<string | null>(here?.gameId ?? chapters[0]?.gameId ?? null)
  useEffect(() => {
    if (here && here.gameId !== lastFocus) setLastFocus(here.gameId)
  }, [here, lastFocus])
  const focused = here ?? chapters.find((chapter) => chapter.gameId === lastFocus) ?? chapters[0]
  const focusedEntry = games.find((entry) => entry.id === focused?.gameId)!
  const gameAt = focused ? chapterClock(focused, at) : 0

  const patches = useGamePatches(series.content.tournamentId)
  const catalog = useGameCatalog(focusedEntry?.content, patches.data?.get(focusedEntry?.id ?? ""))
  const items = catalog.data?.items ?? NO_ITEMS
  const lookups = useMemo(() => itemLookups(items), [items])
  const views = useMemo(
    () => Object.fromEntries(games.map((entry) => [entry.id, buildGameView(entry, teams, players, catalog.data)])),
    [games, teams, players, catalog.data],
  ) as Record<string, GameView>
  const events = useMemo(() => broadcastEvents(chapters, isMajorMoment(lookups)), [chapters, lookups])
  const heroIcon = useMemo(() => {
    const icons = referenceIndex(catalog.data?.heroes)
    return (hero: { id?: string | null; name?: string | null }) => icons({ id: hero.id, name: hero.name })?.iconUrl
  }, [catalog.data?.heroes])

  const player = useRef<VodPlayerHandle>(null)
  const seekGuard = useRef<{ video: number; until: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [videoNow, setVideoNow] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(openInfo ? { kind: "info" } : null)
  const [detail, setDetail] = useState<DetailRequest | null>(null)
  const [phoneTab, setPhoneTab] = useState<"feed" | "board">("feed")

  const onVideoTime = useCallback(
    (second: number) => {
      setVideoNow(second)
      const guard = seekGuard.current
      if (guard && Date.now() < guard.until) {
        if (Math.abs(second - guard.video) > 2) return
      }
      seekGuard.current = null
      setPlayhead(Math.max(0, second))
    },
    [setPlayhead],
  )
  const seek = useCallback(
    (second: number, play = false) => {
      const target = Math.min(duration, Math.max(0, second))
      setPlayhead(target)
      if (!videoId || !player.current) return
      seekGuard.current = { video: target, until: Date.now() + SEEK_SETTLE_MS }
      player.current.seek(target, play)
    },
    [duration, videoId, setPlayhead],
  )
  const seekChapter = (chapter: GameChapter, gameSecond: number, play = false) =>
    seek(chapterVideo(chapter, gameSecond), play)
  const selectTimeline = (event: TimelineEvent) => {
    setActiveId(sourceOf(event.id).id)
    seek(event.at)
    if (phone) setDetail({ gameId: sourceOf(event.id).gameId, ids: [sourceOf(event.id).id] })
  }
  const step = (direction: 1 | -1) => {
    const target =
      direction === 1
        ? events.find((event) => event.at > at + 0.5)
        : [...events].reverse().find((event) => event.at < at - 0.5)
    if (target) selectTimeline(target)
  }
  const togglePlay = () => (player.current?.currentTime() === null ? seek(at, true) : player.current?.toggle())
  const shareLink = (videoSecond: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set("t", String(Math.round(videoSecond)))
    url.searchParams.delete("edit")
    url.searchParams.delete("game")
    return url.toString()
  }
  const seriesVideoWrite = useSeriesVideo(games)
  const applyVideoToAll = (url: string) => seriesVideoWrite.mutate(url)

  const progressOf = useMemo(
    () => Object.fromEntries(games.map((entry) => [entry.id, recordingProgress(entry)])),
    [games],
  ) as Record<string, RecordingProgress | undefined>
  const locks = useMemo(
    () =>
      seriesLocks(games, focusedEntry?.content.number ?? 1, series.content.bestOf, series.content.repeatPicksAllowed),
    [games, focusedEntry?.content.number, series.content.bestOf, series.content.repeatPicksAllowed],
  )
  // A new game starts at the playhead, which must lie outside every game already placed on the video.
  const inside = video
    ? chapterAt(
        chapters.filter((chapter) => chapter.synced),
        at,
      )
    : null
  const focusGame = (chapter: GameChapter) => {
    setLastFocus(chapter.gameId)
    seek(chapter.from)
  }
  const [newGame, setNewGame] = useState<string | null>(null)
  const startGame = async () => {
    if (!addGame) return
    try {
      setNewGame(await addGame.onAdd(video ? { url: video.url, second: Math.floor(at) } : null))
    } catch {
      return
    }
    setDraftLink("")
    setPanel({ kind: "draft" })
  }
  // A game made without a video has no position of its own to play, so it is brought forward once it is listed.
  const showNewGame = useEffectEvent((id: string) => {
    const chapter = chapters.find((candidate) => candidate.gameId === id)
    if (!chapter) return
    if (!chapter.synced) focusGame(chapter)
    setNewGame(null)
  })
  useEffect(() => {
    if (newGame) showNewGame(newGame)
  }, [newGame, chapters])
  const useVideo = (url: string) => {
    if (games.length) applyVideoToAll(url)
    else setDraftLink(url)
    const start = youtubeLinkTime(url)
    if (start !== null) setPlayhead(start)
  }

  const gameActions = useRef<GameActions | null>(null)
  const liveFrom = focusedEntry ? earliestLive(readDraft(focusedEntry.content)) : 0
  const canGoLive = !!focused && !focused.live && !!video && at >= liveFrom
  const goLive = () =>
    void gameActions.current?.save((content) => ({
      ...content,
      sourceUrl: content.sourceUrl || video?.url,
      sourceTimestampSeconds: Math.floor(at),
    }))

  const hasGame = !!focused?.live
  // Phones record moments from a floating action button, which the floating player must not cover.
  const showFab = phone && editable && hasGame
  // A short note next to the transport confirms what a key did and where the video went.
  const [flash, setFlash] = useState<{ text: string; id: number } | null>(null)
  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 1400)
    return () => window.clearTimeout(timer)
  }, [flash])
  const [keysOpen, setKeysOpen] = useState(false)
  const gameFrom = focused?.from ?? null

  // Recording on the bar. A moment is recorded in the game the position belongs to; seeking there first makes that
  // game the focused one, so the composer opens in it.
  const createAt = (row: TimelineRow, second?: number) => {
    const target = second ?? at
    const chapter = chapterAt(chapters, target)
    if (!chapter?.live || target < chapter.start) {
      setFlash({ text: "Vị trí này chưa nằm trong ván nào đã vào trận", id: Date.now() })
      return
    }
    if (second !== undefined) seek(second)
    setPanel({
      kind: "composer",
      eventKind: row === "MID" ? "OBJECTIVE" : "KILL",
      at: target,
      side: row === "MID" ? undefined : row,
    })
  }
  const [undo, setUndo] = useState<MoveUndo | null>(null)
  useEffect(() => {
    if (!undo) return
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS)
    return () => window.clearTimeout(timer)
  }, [undo])
  // The saver belongs to the focused game, so a move can only be undone while that game is still the focused one.
  const undoGame = undo?.gameId
  useEffect(() => {
    if (undoGame && undoGame !== focused?.gameId) setUndo(null)
  }, [undoGame, focused?.gameId])
  const offerUndo = (gameId: string, text: string, revert: () => void) =>
    setUndo({ id: Date.now(), gameId, text, revert })
  const retime = (target: RetimeTarget, second: number) => {
    const chapter = chapters.find((candidate) => candidate.gameId === target.gameId)
    if (!chapter || target.gameId !== focused?.gameId) return
    const view = views[target.gameId]
    type Change = (content: GameContent) => GameContent | null
    const save = (change: Change) => void gameActions.current?.save((content) => change(content) ?? content)
    const move = (text: string, apply: Change, revert: Change) => {
      save(apply)
      offerUndo(target.gameId, `Đã đổi giây · ${text}`, () => save(revert))
    }
    const onVideo = (before: number) => `${VIDEO_MARK} ${formatClock(before)} → ${formatClock(second)}`
    const game = `Ván ${view?.number ?? chapter.number}`

    if (target.kind === "turn") {
      const turn = chapter.draft?.turns.find((candidate) => candidate.order === target.order)
      if (turn?.atSecond == null || turn.atSecond === second) return
      const before = turn.atSecond
      move(
        `Lượt ${turn.order} · ${turn.hero?.name ?? (turn.kind === "BAN" ? "cấm" : "chọn")}: ${onVideo(before)}`,
        (content) => moveTurn(content, target.order, second),
        (content) => moveTurn(content, target.order, before),
      )
      return
    }
    if (target.kind === "draftStart" || target.kind === "draftLock") {
      const start = target.kind === "draftStart"
      const before = start ? chapter.draft?.start : chapter.draft?.locked
      if (before == null || before === second) return
      const at = (value: number) => (start ? { startSecond: value } : { lockedSecond: value })
      move(
        `${start ? "Bắt đầu cấm chọn" : "Chốt đội hình"} · ${game}: ${onVideo(before)}`,
        (content) => setDraftTimes(content, at(second)),
        (content) => setDraftTimes(content, at(before)),
      )
      return
    }
    if (target.kind === "gameStart") {
      if (!chapter.live || chapter.start === second) return
      const before = chapter.start
      // Moments are stored on the game clock, so they travel with its 0:00.
      move(
        `Vào trận · ${game}: ${onVideo(before)} · sự kiện của ván dời theo`,
        (content) => withPlayback(content, { startSecond: second }),
        (content) => withPlayback(content, { startSecond: before }),
      )
      return
    }
    if (target.kind === "mark") {
      const next = Math.round(chapterClock(chapter, second))
      if (next === target.at) return
      move(
        `Video hiện ${MARK_LABELS[target.part]} · ${view?.sides[target.side].team.shortName ?? game}: ⏱ ${formatClock(target.at)} → ${formatClock(next)}`,
        (content) => moveMark(content, target, next),
        (content) => moveMark(content, { ...target, at: next }, target.at),
      )
      return
    }
    const event = chapter.events.find((candidate) => candidate.id === target.id)
    const next = Math.round(chapterClock(chapter, second))
    if (!event || next === Math.round(event.at)) return
    const before = event.at
    const name =
      event.kind === "KILL"
        ? "Hạ gục"
        : event.kind === "OBJECTIVE"
          ? "Mục tiêu"
          : event.kind === "NOTE"
            ? event.title || "Khoảnh khắc"
            : "Trang bị"
    move(
      `${name} · ${game}: ⏱ ${formatClock(before)} → ${formatClock(next)}`,
      (content) => moveEvent(content, target.id, next),
      (content) => moveEvent(content, target.id, before),
    )
  }

  const shortcuts = useRef({ seek, step, at, editable, panel, videoId, hasGame, gameFrom })
  shortcuts.current = { seek, step, at, editable, panel, videoId, hasGame, gameFrom }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = shortcuts.current
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      if (state.panel?.kind === "composer") return
      // Shift + P and Shift + N belong to the match switcher.
      if (event.shiftKey && /^[pn]$/i.test(event.key)) return
      const key = event.key.toLowerCase()
      const jump = (seconds: number) => {
        const target = Math.max(0, state.at + seconds)
        state.seek(target)
        setFlash({
          text: `${seconds < 0 ? "−" : "+"}${Math.abs(seconds)} giây · ${VIDEO_MARK} ${formatClock(target)}`,
          id: Date.now(),
        })
      }
      if (key === " " && state.videoId) {
        player.current?.toggle()
        setFlash({ text: "Phát / tạm dừng", id: Date.now() })
      } else if (key === "arrowleft") jump(event.shiftKey ? -1 : -5)
      else if (key === "arrowright") jump(event.shiftKey ? 1 : 5)
      else if (key === ",") jump(-1)
      else if (key === ".") jump(1)
      else if (key === "j") jump(event.shiftKey ? -30 : -10)
      else if (key === "l") jump(event.shiftKey ? 30 : 10)
      else if (key === "home" && state.gameFrom !== null) {
        state.seek(state.gameFrom)
        setFlash({ text: `Về đầu ván · ${VIDEO_MARK} ${formatClock(state.gameFrom)}`, id: Date.now() })
      } else if (key === "[") state.step(-1)
      else if (key === "]") state.step(1)
      else if (key === "?" || (key === "/" && event.shiftKey)) setKeysOpen((open) => !open)
      else if (state.editable && state.hasGame && (key === "e" || SHORTCUT_KINDS[key]))
        setPanel({ kind: "composer", eventKind: SHORTCUT_KINDS[key] ?? "KILL" })
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const focusedView = focused ? views[focused.gameId] : undefined
  const score = focused ? killScoreAt(focused.events, gameAt) : null

  const quick = editable ? quickRows(series.content, games) : []
  const missingGames = quick.filter((row) => !row.entry).length
  const chips = (
    <GameChips
      chapters={chapters}
      views={views}
      progressOf={progressOf}
      focusedId={focused?.gameId ?? null}
      hasVideo={!!videoId}
      onSelect={focusGame}
    >
      {editable && (addGame || missingGames > 0) && (
        <>
          {addGame && (
            <AddGameButton
              number={addGame.number}
              first={!focused}
              pending={addGame.pending}
              insideGame={inside?.number ?? null}
              videoAt={video ? at : null}
              onAdd={() => void startGame()}
            />
          )}
          {missingGames > 0 && <QuickGamesButton missing={missingGames} onOpen={() => onMatchPanel("quick")} />}
        </>
      )}
    </GameChips>
  )

  const player_ = videoId ? (
    <VodPlayer
      key={videoId}
      ref={player}
      videoId={videoId}
      startAt={at}
      title={seriesLabel(series.content) || "Video trận đấu"}
      onTime={onVideoTime}
      onDuration={setVideoDuration}
      onPlayingChange={setPlaying}
    />
  ) : (
    <VideoLinkCard
      editable={editable}
      canWrite={canWrite}
      compact={games.length > 0}
      onEnableEditing={onEnableEditing}
      onUse={useVideo}
    />
  )

  const gameCard = focused && focusedView && score && (
    <div className="flex items-center gap-3 admin-section px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">
        {here && videoId ? "Đang phát" : "Ván đang chọn"} · Ván {focused.number}
      </span>
      <span className="esp-num ml-auto flex items-center gap-2 text-base font-bold">
        <TeamLogo team={focusedView.sides.BLUE.team} size={22} />
        <span className="text-[var(--esp-blue)]">{score.BLUE}</span>
        <span className="text-muted-foreground">–</span>
        <span className="text-[var(--esp-red)]">{score.RED}</span>
        <TeamLogo team={focusedView.sides.RED.team} size={22} />
      </span>
      {focused.live && at >= focused.start ? (
        <TimeTag kind="game" seconds={gameAt} className="rounded bg-muted px-2 text-xs font-semibold" />
      ) : (
        <span className="rounded bg-muted px-2 text-xs font-semibold">
          {focused.draft && at >= focused.from ? "Cấm chọn" : "Chưa vào trận"}
        </span>
      )}
    </div>
  )

  const transport = (
    <div className="flex items-center gap-1.5">
      <Button size="icon" variant="ghost" className="size-8" onClick={() => step(-1)} aria-label="Sự kiện trước ( [ )">
        <Rewind size={15} />
      </Button>
      <Button
        size="icon"
        className="size-9 rounded-full"
        disabled={!videoId}
        onClick={togglePlay}
        aria-label={playing ? "Tạm dừng (Space)" : "Phát (Space)"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={() => step(1)}
        aria-label="Sự kiện tiếp theo ( ] )"
      >
        <FastForward size={15} />
      </Button>
      {/* Drawn over the edge of the section, so a note never moves the buttons under the pointer. */}
      {flash && (
        <span
          key={flash.id}
          role="status"
          className="esp-num pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-background animate-in fade-in"
        >
          {flash.text}
        </span>
      )}
    </div>
  )

  const timeline = (
    <BroadcastTimeline
      duration={duration}
      current={at}
      chapters={chapters}
      flags={flags}
      events={events}
      views={views}
      chapterTitle={(chapter) => {
        const winner = chapter.winner ? views[chapter.gameId]?.sides[chapter.winner].team.shortName : null
        return winner ? `${winner} thắng` : ""
      }}
      focusedGameId={focused?.gameId ?? null}
      activeId={activeId && focused ? `${focused.gameId}|${activeId}` : null}
      isDimmed={() => false}
      lookups={lookups}
      label={videoId ? "Dòng thời gian video" : "Dòng thời gian trận"}
      heroIcon={heroIcon}
      notice={
        undo && (
          <span
            key={undo.id}
            role="status"
            className="esp-num flex items-center gap-2 text-foreground animate-in fade-in"
          >
            {undo.text}
            <Button
              size="sm"
              variant="secondary"
              className="h-6 rounded-full px-2.5 text-xs"
              onClick={() => {
                undo.revert()
                setUndo(null)
              }}
            >
              <Undo2 size={12} /> Hoàn tác
            </Button>
          </span>
        )
      }
      editing={
        editable && focused
          ? { gameId: focused.gameId, canCreate: focused.live, onCreate: createAt, onRetime: retime }
          : undefined
      }
      onSeek={(second) => {
        setActiveId(null)
        seek(second)
      }}
      onSelect={selectTimeline}
      onOpen={(cluster) => {
        const { gameId } = sourceOf(cluster.id)
        seek(cluster.start)
        setDetail({ gameId, ids: cluster.events.map((event) => sourceOf(event.id).id) })
      }}
    />
  )

  const focusedProgress = focused ? progressOf[focused.gameId] : undefined
  const tools = focused && focusedProgress && (
    <GameTools
      number={focused.number}
      progress={focusedProgress}
      editable={editable}
      canSeeProgress={canWrite || canPublish}
      phone={phone}
      openTool={panel?.kind ?? null}
      onOpen={(tool) => setPanel(panel?.kind === tool ? null : { kind: tool })}
    />
  )
  // A phone records moments from the floating button.
  const primary = editable && focused && !(phone && focused.live) && (
    <GamePrimary
      number={focused.number}
      live={focused.live}
      hasVideo={!!video}
      canGoLive={canGoLive}
      at={at}
      onRecord={() => setPanel({ kind: "composer", eventKind: "KILL" })}
      onGoLive={goLive}
    />
  )
  // Without a video and without moments there is nothing to lay out in time.
  const onAxis = !!videoId || events.length > 0
  const matchPanels = (
    <>
      {matchPanel === "publish" && (
        <FloatingPanel
          title="Xuất bản các ván"
          icon={<ShieldCheck size={15} />}
          onClose={() => onMatchPanel(null)}
          width={480}
        >
          <MatchPublishPanel
            games={games}
            team={team}
            canPublish={canPublish}
            beforePublish={async () => gameActions.current?.settled()}
            onOpenStep={(gameId, target) => {
              const chapter = chapters.find((candidate) => candidate.gameId === gameId)
              if (!chapter) return
              if (!editable) onEnableEditing()
              focusGame(chapter)
              onMatchPanel(null)
              setPanel(panelFor(target, chapter.live))
            }}
          />
        </FloatingPanel>
      )}
      {matchPanel === "quick" && editable && openQuickNumbers(quick).length > 0 && (
        <FloatingPanel
          title={`Ghi nhanh các ván · tỷ số ${series.content.result?.scoreA ?? 0} – ${series.content.result?.scoreB ?? 0}`}
          icon={<Zap size={15} />}
          onClose={() => onMatchPanel(null)}
          width={520}
        >
          <QuickGamesPanel
            series={series}
            games={games}
            team={team}
            region={tournamentRegion}
            onDone={() => onMatchPanel(null)}
          />
        </FloatingPanel>
      )}
    </>
  )

  // The player, chips and timeline live outside the per-game subtree: switching games must never recreate the
  // YouTube iframe, which would stop playback and reload it at a different position.
  return (
    <WikiReferences rulesetId={catalog.data?.resolvedContext?.rulesetId ?? ""}>
      <div className={cn("esp-viewer", phone && "pb-24")}>
        <div className="esp-area-chips min-w-0">{chips}</div>
        <div className="esp-area-video min-w-0">{player_}</div>
        {(videoId || chapters.length > 0) && (
          <section className="esp-area-timeline relative min-w-0 space-y-2 admin-section px-3 pt-3 pb-2">
            {/* One row where there is room; otherwise the tools take a row of their own under the transport. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {onAxis && transport}
              <div className={cn("min-w-0", onAxis && "order-3 w-full @5xl:order-2 @5xl:w-auto")}>{tools}</div>
              <div className="order-2 ml-auto flex items-center gap-1.5 @5xl:order-3">
                {primary}
                {/* A phone has no keyboard to use them with. */}
                {!phone && <ShortcutList open={keysOpen} onOpenChange={setKeysOpen} editable={editable} />}
              </div>
            </div>
            {phone && gameCard}
            {onAxis && timeline}
          </section>
        )}
        {matchPanels}
        {!focused || !focusedEntry || !focusedView ? (
          <MatchSetupGuide
            hasVideo={!!video}
            editable={editable}
            canWrite={canWrite}
            resultNote={resultNote}
            nextNumber={addGame?.number ?? null}
            onEnableEditing={onEnableEditing}
          />
        ) : (
          <FocusedGame
            key={focused.gameId}
            entry={focusedEntry}
            view={focusedView}
            chapter={focused}
            items={items}
            catalog={catalog.data}
            catalogError={catalog.isLoadingError ? catalog.error : undefined}
            onReloadCatalog={() => void catalog.refetch()}
            canPublish={canPublish}
            tournamentId={series.content.tournamentId}
            tournamentRegion={tournamentRegion}
            onEnableEditing={onEnableEditing}
            heroes={catalog.data?.heroes ?? []}
            spells={catalog.data?.spells ?? []}
            roster={roster}
            locks={locks}
            previous={previousGame(games, focused.number)}
            editable={editable}
            phone={phone}
            gameAt={gameAt}
            videoId={videoId}
            videoNow={videoNow}
            playing={playing}
            activeId={activeId}
            panel={panel}
            detail={detail}
            onActive={setActiveId}
            onPanel={setPanel}
            onDetail={setDetail}
            seekGame={(second, play) => seekChapter(focused, second, play)}
            onVideoUrl={applyVideoToAll}
            shareLink={shareLink}
            actions={gameActions}
            onUndoable={(text, revert) => offerUndo(focused.gameId, text, revert)}
          >
            {(parts) =>
              phone ? (
                <>
                  <div className="esp-area-side min-w-0 space-y-3">
                    <nav className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Nội dung ván">
                      {(
                        [
                          { id: "feed", label: "Diễn biến", icon: ListVideo },
                          { id: "board", label: "Bảng điểm", icon: Users },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          aria-pressed={phoneTab === tab.id}
                          onClick={() => setPhoneTab(tab.id)}
                          className={cn(
                            "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition",
                            phoneTab === tab.id ? "bg-background shadow-sm" : "text-muted-foreground",
                          )}
                        >
                          <tab.icon size={14} /> {tab.label}
                        </button>
                      ))}
                    </nav>
                    <div className="flex flex-wrap items-center gap-2">
                      {parts.status}
                      {parts.focusChip}
                    </div>
                    {phoneTab === "feed" && parts.feed("h-[65vh]")}
                    {phoneTab === "board" && parts.board}
                    {parts.publishedNote}
                  </div>
                  {showFab && (
                    <button
                      type="button"
                      onClick={() => setPanel({ kind: "composer", eventKind: "KILL" })}
                      className="fixed right-5 bottom-5 z-30 grid size-14 place-items-center rounded-full bg-[var(--esp-gold)] text-[var(--esp-ink)] shadow-xl"
                      aria-label="Ghi sự kiện"
                    >
                      <Plus size={24} />
                    </button>
                  )}
                  {parts.popups}
                </>
              ) : (
                <>
                  <div className="esp-area-side flex min-h-[380px] min-w-0 flex-col gap-2">
                    {gameCard}
                    {(parts.status || parts.focusChip) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {parts.status}
                        {parts.focusChip}
                      </div>
                    )}
                    <div className="relative min-h-[320px] flex-1">{parts.feed("absolute inset-0")}</div>
                  </div>
                  <div className="esp-area-board min-w-0 space-y-3">
                    {parts.board}
                    {parts.publishedNote}
                  </div>
                  {parts.popups}
                </>
              )
            }
          </FocusedGame>
        )}
      </div>
    </WikiReferences>
  )
}
