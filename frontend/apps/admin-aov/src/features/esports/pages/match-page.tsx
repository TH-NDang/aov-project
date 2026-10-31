import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent, Reference, SeriesContent } from "@aov/community-contracts"
import {
  CalendarClock,
  Crown,
  Database,
  ExternalLink,
  FastForward,
  Flag,
  Gem,
  Keyboard,
  Link2,
  ListChecks,
  ListVideo,
  Loader2,
  Pause,
  PenLine,
  Pencil,
  Play,
  Plus,
  Rewind,
  ShieldBan,
  Swords,
  Users,
  Youtube,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import { GameEditor } from "@/features/tournaments/game-editor"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { initialGame } from "@/features/tournaments/tournament-model"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/tournament-api"
import { useGameCatalog, useGames, useRecords, useRosters } from "../data/use-esports-data"
import { useTournamentView } from "../data/use-tournament-view"
import { WikiReferences } from "./wiki-references"
import {
  BestOfBadge,
  EmptyState,
  ResultTag,
  TeamLogo,
  TimeTag,
  VIDEO_MARK,
  VideoMark,
  WinPips,
} from "../components/primitives"
import type { RosterOption } from "../components/game/draft-editor"
import { usePhoneLayout } from "../components/game/floating-panel"
import { useSavedPlayhead } from "../components/game/use-saved-playhead"
import { VodPlayer, type VodPlayerHandle } from "../components/game/vod-player"
import { BroadcastTimeline } from "../components/series/broadcast-timeline"
import { broadcastChapters } from "../model/broadcast-timeline"
import { seriesWinner } from "../model/competition"
import { buildGameView, referenceIndex, type GameView, type TeamView } from "../model/game-view"
import { stageInfo } from "../model/labels"
import { RelativeDate } from "../components/relative-date"
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
import { formatClock, parseClock, youtubeLinkTime, youtubeVideoId } from "../model/vod"
import { seriesLocks } from "../model/series-rules"
import { earliestLive, readDraft } from "../model/draft"
import { recordingProgress, type RecordingProgress } from "../model/recording-progress"
import { ProgressBadge } from "../components/game/progress-badge"
import {
  FocusedGame,
  isMajorMoment,
  itemLookups,
  type DetailRequest,
  type GameActions,
  type Panel,
} from "./focused-game"
import { AccessGate, Crumbs, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

const SHORTCUT_KINDS: Record<string, TimelineKind> = { k: "KILL", o: "OBJECTIVE", i: "ITEM", n: "NOTE" }
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (!!target.closest("input, textarea, select, [contenteditable=true]") || target.isContentEditable)
/** Readings far from a requested seek are ignored this long, while YouTube still reports the old position. */
const SEEK_SETTLE_MS = 2500
export type GameStart = { url: string; second: number }

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
  const record = view.records.find((entry) => entry.id === seriesId)
  const sorted = useMemo(
    () => [...(games.data ?? [])].sort((a, b) => a.content.number - b.content.number),
    [games.data],
  )
  const [editing, setEditing] = useState(false)
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
  })
  const roster = useMemo(() => {
    const names = new Map((players.data ?? []).map((player) => [player.id, player.content.nickname]))
    const byTeam = new Map<string, RosterOption[]>()
    for (const { content } of rosters.data ?? []) {
      if (content.status === "INACTIVE") continue
      const members = byTeam.get(content.teamId) ?? []
      members.push({ id: content.playerId, name: names.get(content.playerId) ?? "Tuyển thủ", lane: content.lane })
      byTeam.set(content.teamId, members)
    }
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

  const dataGame = params.get("view") === "data" ? sorted.find((entry) => entry.id === params.get("game")) : null
  if (access.canWrite && dataGame)
    return (
      <div className="esports">
        <GameEditor
          key={dataGame.id}
          entry={dataGame}
          teams={view.teams}
          players={players.data ?? []}
          canWrite={access.canWrite}
          canPublish={access.canPublish}
          actorKey={access.actorKey}
          tournamentRegion={view.tournament.content.region}
          seriesGames={sorted}
          bestOf={record.content.bestOf}
          onBack={() => setParam({ view: null })}
        />
      </div>
    )

  const nextNumber = Math.max(0, ...sorted.map((entry) => entry.content.number)) + 1
  const canAddGame = access.canWrite && sorted.length < record.content.bestOf

  return (
    <EsportsPage>
      <Crumbs
        items={[
          { label: "Giải đấu", to: "/tournaments" },
          { label: view.tournament.content.name, to: tournamentPath(tournamentId) },
          { label: record.content.name || stageInfo(record.content.stage).label },
        ]}
      />
      <MatchHeader content={record.content} team={view.team}>
        {access.canWrite && (
          <>
            <Button
              size="sm"
              variant={params.get("edit") === "1" ? "default" : "secondary"}
              aria-pressed={params.get("edit") === "1"}
              onClick={() => setParam({ edit: params.get("edit") === "1" ? null : "1" })}
            >
              <PenLine size={14} /> {params.get("edit") === "1" ? "Đang ghi" : "Chế độ ghi"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Sửa trận
            </Button>
          </>
        )}
      </MatchHeader>
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
        players={players.data ?? []}
        roster={roster}
        editable={access.canWrite && params.get("edit") === "1"}
        canWrite={access.canWrite}
        canPublish={access.canPublish}
        onEnableEditing={() => setParam({ edit: "1" })}
        requestedGame={params.get("game")}
        fromLink={linkSecond(params.get("t"))}
        onConsumeLink={() => setParam({ game: null, t: null })}
        onOpenData={(gameId) => setParam({ game: gameId, view: "data" })}
        resultNote={
          record.content.result && !sorted.length
            ? `Tỉ số cho biết đã đấu ${(record.content.result.scoreA ?? 0) + (record.content.result.scoreB ?? 0)} ván nhưng chưa ghi ván nào.`
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
        <section className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          {record.content.note}
        </section>
      )}
      {editing && (
        <RegistryEditor
          kind="series"
          entry={record as DocumentView<SeriesContent>}
          open
          onClose={() => setEditing(false)}
          teams={view.teams}
          tournaments={[view.tournament]}
          tournamentId={tournamentId}
        />
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
  players,
  roster,
  editable,
  canWrite,
  canPublish,
  onEnableEditing,
  requestedGame,
  fromLink,
  onConsumeLink,
  onOpenData,
  resultNote,
  addGame,
}: {
  series: { id: string; content: SeriesContent }
  games: DocumentView<GameContent>[]
  teams: Parameters<typeof buildGameView>[1]
  players: Parameters<typeof buildGameView>[2]
  roster: (teamId: string) => RosterOption[]
  editable: boolean
  canWrite: boolean
  canPublish: boolean
  onEnableEditing: () => void
  requestedGame: string | null
  fromLink: number | null
  onConsumeLink: () => void
  onOpenData: (gameId: string) => void
  /** Shown before the first game is recorded. */
  resultNote: string | null
  /** Records the next game; with a video it starts at the playhead, outside every recorded game. */
  addGame: { number: number; pending: boolean; onAdd: (start: GameStart | null) => Promise<string> } | null
}) {
  const phone = usePhoneLayout()
  const client = useQueryClient()
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
    if (requestedGame || fromLink !== null) onConsumeLink()
  }, [requestedGame, fromLink, onConsumeLink])

  const here = chapterAt(chapters, at)
  const [lastFocus, setLastFocus] = useState<string | null>(here?.gameId ?? chapters[0]?.gameId ?? null)
  useEffect(() => {
    if (here && here.gameId !== lastFocus) setLastFocus(here.gameId)
  }, [here, lastFocus])
  const focused = here ?? chapters.find((chapter) => chapter.gameId === lastFocus) ?? chapters[0]
  const focusedEntry = games.find((entry) => entry.id === focused?.gameId)!
  const gameAt = focused ? chapterClock(focused, at) : 0

  const catalog = useGameCatalog(focusedEntry?.content)
  const items: Reference[] = catalog.data?.items ?? []
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
  const [panel, setPanel] = useState<Panel | null>(null)
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
  // One broadcast for the whole match: the link is written to every game, each keeps its own start second.
  const applyVideoToAll = async (url: string) => {
    for (const entry of games) {
      if (entry.content.sourceUrl === url) continue
      const latest = await tournamentApi.read("games", entry.id)
      await tournamentApi.save("games", latest, { ...latest.content, sourceUrl: url })
    }
    await client.invalidateQueries({ queryKey: [...tournamentKeys.all, "games"] })
  }

  const progressOf = useMemo(
    () => Object.fromEntries(games.map((entry) => [entry.id, recordingProgress(entry)])),
    [games],
  ) as Record<string, RecordingProgress | undefined>
  const locks = useMemo(
    () => seriesLocks(games, focusedEntry?.content.number ?? 1, series.content.bestOf),
    [games, focusedEntry?.content.number, series.content.bestOf],
  )
  // A new game starts at the playhead, which must lie outside every game already placed on the video.
  const inside = video
    ? chapterAt(
        chapters.filter((chapter) => chapter.synced),
        at,
      )
    : null
  const startGame = async () => {
    if (!addGame) return
    try {
      await addGame.onAdd(video ? { url: video.url, second: Math.floor(at) } : null)
    } catch {
      return
    }
    setDraftLink("")
    setPanel({ kind: "draft" })
  }
  const useVideo = (url: string) => {
    if (games.length) void applyVideoToAll(url)
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

  const shortcuts = useRef({ seek, step, at, editable, panel, videoId, hasGame, gameFrom })
  shortcuts.current = { seek, step, at, editable, panel, videoId, hasGame, gameFrom }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = shortcuts.current
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      if (state.panel?.kind === "composer") return
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

  const chips = chapters.length > 0 && (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Các ván">
      {chapters.map((chapter) => {
        const view = views[chapter.gameId]
        const winner = chapter.winner ? view?.sides[chapter.winner].team : null
        const active = chapter.gameId === focused?.gameId
        return (
          <button
            key={chapter.gameId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              setLastFocus(chapter.gameId)
              seek(chapter.from)
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
              active ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]" : "bg-card hover:bg-muted",
            )}
          >
            <span className="text-sm font-bold">Ván {chapter.number}</span>
            {progressOf[chapter.gameId] && <ProgressBadge progress={progressOf[chapter.gameId]!} />}
            {winner && (
              <span className="flex items-center gap-1 text-xs">
                <TeamLogo team={winner} size={18} />
                <Crown size={12} className="text-[var(--esp-gold)]" aria-label="thắng" />
              </span>
            )}
            <span className="esp-num text-xs text-muted-foreground" title="Thời lượng ván">
              ⏱ {formatClock(chapter.duration)}
            </span>
            {!chapter.synced && videoId && (
              <span className="rounded bg-muted px-1 text-xs text-muted-foreground">chưa căn video</span>
            )}
          </button>
        )
      })}
    </div>
  )

  const player_ = videoId ? (
    <VodPlayer
      key={videoId}
      ref={player}
      videoId={videoId}
      startAt={at}
      title={series.content.name || "Video trận đấu"}
      onTime={onVideoTime}
      onDuration={setVideoDuration}
      onPlayingChange={setPlaying}
    />
  ) : (
    <VideoLinkCard editable={editable} canWrite={canWrite} onEnableEditing={onEnableEditing} onUse={useVideo} />
  )

  const gameCard = focused && focusedView && score && (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">
        {here ? "Đang phát" : "Ván đang chọn"} · Ván {focused.number}
      </span>
      <span className="esp-num ml-auto flex items-center gap-2 text-lg font-black">
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
    <div className="flex flex-wrap items-center gap-1.5">
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
      {flash && (
        <span
          key={flash.id}
          role="status"
          className="esp-num rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background animate-in fade-in"
        >
          {flash.text}
        </span>
      )}
      <ShortcutList open={keysOpen} onOpenChange={setKeysOpen} editable={editable} />
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

  const startButton = addGame && editable && (
    <Button
      size="sm"
      variant={focused ? "outline" : "default"}
      disabled={addGame.pending || !!inside || (!video && !games.length)}
      title={
        inside
          ? `Đang trong ván ${inside.number}: kết thúc ván ${inside.number} hoặc tua ra ngoài ván`
          : !video && !games.length
            ? "Gắn video của trận trước"
            : undefined
      }
      onClick={() => void startGame()}
    >
      {addGame.pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldBan size={14} />}{" "}
      {video ? "Bắt đầu cấm chọn ván" : "Thêm ván"} {addGame.number}
      {video && (
        <span className="esp-num">
          {" "}
          tại <VideoMark /> {formatClock(at)}
        </span>
      )}
    </Button>
  )

  const focusedProgress = focused ? progressOf[focused.gameId] : undefined
  const progressButton = focused && focusedProgress && (canWrite || canPublish) && (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setPanel({ kind: "progress" })}
      aria-label={`Tiến độ ghi ván ${focused.number}`}
    >
      <ListChecks size={14} /> {phone ? "" : "Tiến độ"}
      <ProgressBadge progress={focusedProgress} />
    </Button>
  )
  const tools = (editable || progressButton) && (
    <span className="flex flex-wrap items-center gap-1.5">
      {progressButton}
      {editable && focused && (
        <>
          <Button size="sm" variant="outline" onClick={() => setPanel({ kind: "sync" })} aria-label="Video & đồng bộ">
            <Link2 size={14} /> {phone ? "" : "Video & đồng bộ"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPanel({ kind: "draft" })} aria-label="Cấm chọn">
            <ShieldBan size={14} /> {phone ? "" : "Cấm chọn"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPanel({ kind: "loadout" })}
            aria-label="Phụ trợ, phù hiệu và bảng ngọc"
          >
            <Gem size={14} /> {phone ? "" : "Phụ trợ & ngọc"}
          </Button>
          {focused.live ? (
            <>
              {!phone && (
                <Button size="sm" onClick={() => setPanel({ kind: "composer", eventKind: "KILL" })}>
                  <Plus size={14} /> Ghi sự kiện
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPanel({ kind: "result" })}
                aria-label="Kết thúc ván"
              >
                <Crown size={14} /> {phone ? "" : `Kết thúc ván ${focused.number}`}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={!canGoLive}
              title={
                canGoLive
                  ? "Đặt 0:00 của đồng hồ game tại vị trí video này"
                  : video
                    ? "Tua video tới lúc vào trận, sau các lượt cấm chọn đã ghi"
                    : "Gắn video của trận trước"
              }
              onClick={goLive}
            >
              <Flag size={14} /> Vào trận {focused.number} tại <VideoMark /> {formatClock(at)}
            </Button>
          )}
          {canWrite && !phone && (
            <Button size="sm" variant="ghost" onClick={() => onOpenData(focused.gameId)}>
              <Database size={14} /> Dữ liệu ván {focused.number}
            </Button>
          )}
        </>
      )}
      {editable && startButton}
    </span>
  )

  // The player, chips and timeline live outside the per-game subtree: switching games must never recreate the
  // YouTube iframe, which would stop playback and reload it at a different position.
  return (
    <WikiReferences rulesetId={catalog.data?.resolvedContext?.rulesetId ?? ""}>
      <div className={cn("esp-viewer", phone && "pb-24")}>
        <div className="esp-area-chips min-w-0">{chips}</div>
        <div className="esp-area-video min-w-0">{player_}</div>
        <section className="esp-area-timeline min-w-0 space-y-2 rounded-xl border bg-card px-3 pt-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            {transport}
            {tools}
          </div>
          {phone && gameCard}
          {timeline}
        </section>
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
            canPublish={canPublish}
            onOpenData={() => onOpenData(focused.gameId)}
            onEnableEditing={onEnableEditing}
            heroes={catalog.data?.heroes ?? []}
            spells={catalog.data?.spells ?? []}
            roster={roster}
            locks={locks}
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
            onVideoUrl={(url) => void applyVideoToAll(url)}
            shareLink={shareLink}
            actions={gameActions}
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

const SHORTCUTS: { keys: string[]; text: string; edit?: boolean }[] = [
  { keys: ["Space"], text: "Phát / tạm dừng" },
  { keys: ["←", "→"], text: "Lùi / tới 5 giây (giữ Shift: 1 giây)" },
  { keys: [",", "."], text: "Lùi / tới 1 giây" },
  { keys: ["J", "L"], text: "Lùi / tới 10 giây (giữ Shift: 30 giây)" },
  { keys: ["Home"], text: "Về đầu ván đang xem (lúc bắt đầu cấm chọn)" },
  { keys: ["[", "]"], text: "Sự kiện trước / sau" },
  { keys: ["E"], text: "Ghi sự kiện", edit: true },
  { keys: ["K", "O", "I", "N"], text: "Ghi hạ gục / mục tiêu / trang bị / khoảnh khắc", edit: true },
  { keys: ["?"], text: "Mở / đóng danh sách này" },
]

/** Every keyboard shortcut of the match page, opened from the transport or with "?". */
function ShortcutList({
  open,
  onOpenChange,
  editable,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editable: boolean
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="ml-auto h-8 text-xs text-muted-foreground">
          <Keyboard size={14} /> Phím tắt
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3 text-xs">
        <p className="font-semibold">Phím tắt khi xem video</p>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
          {SHORTCUTS.filter((entry) => editable || !entry.edit).map((entry) => (
            <div key={entry.text} className="contents">
              <dt className="flex gap-1">
                {entry.keys.map((key) => (
                  <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{entry.text}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Bấm vào video vẫn dùng được phím tắt. Kéo video nổi bằng chuột, hoặc Alt + phím mũi tên.
        </p>
      </PopoverContent>
    </Popover>
  )
}

/** The match video typed before any game exists; once a game is recorded the games carry it. */
function useDraftVideo(seriesId: string) {
  const key = `esports:match-video:${seriesId}`
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ""
    } catch {
      return ""
    }
  })
  const update = (next: string) => {
    setValue(next)
    try {
      if (next) localStorage.setItem(key, next)
      else localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable; the link then lasts until the page closes.
    }
  }
  return [value, update] as const
}

/** Step one of recording a match: the YouTube video the whole match is played in. */
function VideoLinkCard({
  editable,
  canWrite,
  onEnableEditing,
  onUse,
}: {
  editable: boolean
  canWrite: boolean
  onEnableEditing: () => void
  onUse: (url: string) => void
}) {
  const [link, setLink] = useState("")
  const valid = !!youtubeVideoId(link)
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      <Youtube size={32} />
      {editable ? (
        <>
          <p>Gắn video YouTube của cả trận để có dòng thời gian và ghi theo mốc video.</p>
          <form
            className="flex w-full max-w-lg gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (valid) onUse(link.trim())
            }}
          >
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Link YouTube của cả trận"
              aria-invalid={!!link.trim() && !valid}
              className="h-9"
            />
            <Button type="submit" disabled={!valid}>
              <Link2 size={14} /> Gắn video
            </Button>
          </form>
          {!!link.trim() && !valid && (
            <p className="text-xs text-destructive">Chỉ nhận link YouTube (watch, youtu.be, live).</p>
          )}
        </>
      ) : (
        <>
          <p>Trận chưa có video YouTube.</p>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={onEnableEditing}>
              <PenLine size={14} /> Bật chế độ ghi để gắn video
            </Button>
          )}
        </>
      )}
    </div>
  )
}

/** What to do next while the match has no recorded game yet. */
function MatchSetupGuide({
  hasVideo,
  editable,
  canWrite,
  resultNote,
  nextNumber,
  onEnableEditing,
}: {
  hasVideo: boolean
  editable: boolean
  canWrite: boolean
  resultNote: string | null
  nextNumber: number | null
  onEnableEditing: () => void
}) {
  const steps = [
    { done: hasVideo, text: "Gắn video YouTube của cả trận." },
    {
      done: false,
      text: `Tua tới màn cấm chọn rồi bấm “Bắt đầu cấm chọn ván ${nextNumber ?? 1}” trên dòng thời gian.`,
    },
    { done: false, text: "Ghi từng lượt cấm/chọn theo đội, đổi tướng giữa các đường rồi “Chốt” đội hình." },
    { done: false, text: "Tới 0:00 trong game bấm “Vào trận”, ghi diễn biến, rồi “Kết thúc ván” với đội thắng." },
  ]
  return (
    <section className="esp-area-side min-w-0 space-y-3 rounded-xl border bg-card p-4 text-sm">
      {resultNote && <p className="text-muted-foreground">{resultNote}</p>}
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-2">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold",
                step.done ? "bg-[var(--esp-live)] text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <span className={cn(step.done && "text-muted-foreground line-through")}>{step.text}</span>
          </li>
        ))}
      </ol>
      {!editable && canWrite && (
        <Button size="sm" onClick={onEnableEditing}>
          <PenLine size={14} /> Bật chế độ ghi
        </Button>
      )}
      {nextNumber === null && <p className="text-xs text-muted-foreground">Trận đã đủ số ván của BO.</p>}
    </section>
  )
}

function MatchHeader({
  content,
  team,
  children,
}: {
  content: SeriesContent
  team: (id: string) => TeamView
  children?: ReactNode
}) {
  const winner = seriesWinner(content)
  const side = (view: TeamView, wins: number | undefined, won: boolean, align: "left" | "right") => (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3",
        align === "right" && "flex-row-reverse text-right",
        winner && !won && "esp-loser",
      )}
    >
      <span className="relative shrink-0">
        <TeamLogo
          team={view}
          size={48}
          className={cn("bg-white/5", won && "shadow-[0_0_0_2px_var(--esp-win),0_0_22px_-4px_var(--esp-win)]")}
        />
        {won && <Crown size={16} className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[var(--esp-gold)]" />}
      </span>
      <span className={cn("flex min-w-0 flex-col gap-1", align === "right" ? "items-end" : "items-start")}>
        <span className="block max-w-full truncate font-bold @3xl:text-lg">
          <span className="@xl:hidden">{view.shortName}</span>
          <span className="hidden @xl:inline">{view.name}</span>
        </span>
        <span className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
          {winner && <ResultTag won={won} />}
          <WinPips wins={wins} bestOf={content.bestOf} align={align === "right" ? "end" : "start"} won={won} />
        </span>
      </span>
    </div>
  )
  return (
    <section className="esp-banner rounded-2xl">
      <div className="space-y-3 p-4 @3xl:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/70">
          <span className="font-semibold text-white">{stageInfo(content.stage).label}</span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} />
            <RelativeDate value={content.scheduledAt} withTime fallback="Chưa xếp lịch" />
          </span>
          <BestOfBadge bestOf={content.bestOf} />
          {content.sourceUrl && /^https?:\/\//.test(content.sourceUrl) && (
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:text-white"
            >
              <ExternalLink size={12} /> Nguồn
            </a>
          )}
          <span className="ml-auto flex flex-wrap gap-2">{children}</span>
        </div>
        <div className="flex items-center gap-3 @3xl:gap-8">
          {side(team(content.teamAId), content.result?.scoreA, winner === "A", "left")}
          <div className="esp-num flex shrink-0 items-center gap-2 text-3xl font-black @3xl:text-4xl">
            <span className={winner === "B" ? "text-white/35" : winner === "A" ? "text-[var(--esp-gold)]" : ""}>
              {content.result?.scoreA ?? "–"}
            </span>
            <span className="text-xl text-white/40">:</span>
            <span className={winner === "A" ? "text-white/35" : winner === "B" ? "text-[var(--esp-gold)]" : ""}>
              {content.result?.scoreB ?? "–"}
            </span>
          </div>
          {side(team(content.teamBId), content.result?.scoreB, winner === "B", "right")}
        </div>
      </div>
    </section>
  )
}
