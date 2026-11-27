import { useEffect, useRef, useState } from "react"
import type { DocumentView, GameContent, SeriesContent, TournamentContent } from "@aov/community-contracts"
import { useLocation, useNavigate } from "react-router"
import { PopoverBoundary } from "@aov/ui/components/popover"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useHotkeys } from "@/app/hotkeys"
import { useVideoSettings } from "../components/game/use-video-settings"
import { MatchSwitcher } from "../components/series/match-switcher"
import { StudioHead } from "../components/series/studio-head"
import { useGameSavers } from "../data/use-game-saver"
import { useMatchRecording, useMatchViews } from "../data/use-match-recording"
import type { SeriesRecord } from "../model/competition"
import type { DeskPanel } from "../model/desk"
import { openNumbers } from "../model/game-tabs"
import type { buildGameView, TeamView } from "../model/game-view"
import type { RosterOption } from "../model/line-up"
import { publishRows } from "../model/match-publishing"
import { markSeconds } from "../model/playback-place"
import { openQuickNumbers, quickRows } from "../model/series-score"
import { sourceOf } from "../model/series-vod"
import type { TimelineEvent } from "../model/timeline"
import { youtubeVideoId } from "../model/vod"
import { madeGame } from "./desk-changes"
import { useDeskTools, type MomentForms } from "./desk-tools"
import { StudioPage, tournamentPath, type Access } from "./esports-shell"
import type { GameActions, GameDesk } from "./game-desk"
import { GameDeskView } from "./game-desk-view"
import { GameSetupView, StudioDock } from "./studio-dock"
import { useVideoLink } from "./studio-video"
import { StudioWatch } from "./studio-watch"
import { useStudioWords } from "./studio-words"
import { useStudioKeys } from "./use-desk-keys"
import { useTypedText } from "./use-typed-text"
import { WikiReferences } from "./wiki-references"

/** Where a game recorded from the video starts: its ban/pick phase, at a second of that video. */
export type GameStart = { url: string; second: number }

type MatchStudioProps = {
  series: DocumentView<SeriesContent>
  /** Every match of the tournament, for the way between them. */
  records: readonly SeriesRecord[]
  tournament: DocumentView<TournamentContent>
  games: DocumentView<GameContent>[]
  teams: Parameters<typeof buildGameView>[1]
  team: (id: string) => TeamView
  players: Parameters<typeof buildGameView>[2]
  roster: (teamId: string) => RosterOption[]
  access: Access
  /** Recording: the account may write and the page is in `?edit=1`. */
  editable: boolean
  onMode: (recording: boolean) => void
  addGame: {
    /** The match may get a game beyond those its score counts. */
    allowed: boolean
    pending: boolean
    /** Why the last one could not be made, when it could not. */
    failure: string | null
    onAdd: (number: number, start: GameStart | null) => Promise<string>
  }
  requestedGame: string | null
  fromLink: number | null
  /** Links to the former game data page open the same game with its own data. */
  openInfo: boolean
  onConsumeLink: () => void
  fullscreen: boolean
  onFullscreen: (() => void) | null
}

function useStudio(props: MatchStudioProps) {
  const { series, games, editable, requestedGame, fromLink, openInfo, onConsumeLink, addGame } = props
  const compact = usePageLayout() === "compact"
  const settings = useVideoSettings()
  const savers = useGameSavers()
  useEffect(() => savers.seen(games), [savers, games])
  const typed = useTypedText()
  const words = useStudioWords()
  const [panelState, setPanel] = useState<DeskPanel | null>(null)
  const [forms, setForms] = useState<MomentForms>({})
  /** A mark of the game on the desk is pressed on the timeline, so the video that follows it chooses no other game. */
  const [moving, setMoving] = useState(false)
  // The quick entry closes with the last number it could fill in.
  const quick = editable && openQuickNumbers(quickRows(series.content, games)).length > 0
  const panel = panelState === "quick" && !quick ? null : panelState
  const recording = useMatchRecording({
    series,
    games,
    requestedGame,
    fromLink,
    editable,
    held: (id) => !!panel || moving || typed.typing || (editable && !!id && !!forms[id]),
  })
  const { chapters, focused, playhead, seek } = recording
  const gameId = focused?.gameId ?? null
  const content = useMatchViews({
    tournamentId: series.content.tournamentId,
    games,
    teams: props.teams,
    players: props.players,
    recording,
  })
  useEffect(() => {
    if (requestedGame || fromLink !== null || openInfo) onConsumeLink()
  }, [requestedGame, fromLink, openInfo, onConsumeLink])
  const tools = useDeskTools({
    recording,
    editable,
    openInfo,
    unsaved: typed.unsaved,
    setPanel,
    forms,
    setForms,
    onLeave: () => words.setArrival(null),
    onRecord: () => {
      if (props.access.canWrite) props.onMode(true)
    },
  })
  const [selected, setSelected] = useState<{ gameId: string; id: string } | null>(null)
  const activeId = selected && selected.gameId === gameId ? selected.id : null

  /** The writes of the game on the desk, the game itself, and what its foot does on a key. */
  const actions = useRef<GameActions | null>(null)
  const desk = useRef<GameDesk | null>(null)
  const foot = useRef<{ next: () => void; undo: () => void } | null>(null)

  const createGame = async (number: number, second: number | null) => {
    const start = recording.video && second !== null ? { url: recording.video.url, second } : null
    let id: string
    try {
      id = await addGame.onAdd(number, start)
    } catch {
      return
    }
    words.onDone()
    words.setMade({ gameId: id, done: madeGame(number, start?.second ?? null) })
    recording.awaitGame(id)
    recording.setDraftLink("")
    tools.onMadeGame()
  }

  const selectEvent = (event: TimelineEvent) => {
    const source = sourceOf(event.id)
    setSelected({ gameId: source.gameId, id: source.id })
    seek(event.at)
  }
  const step = (direction: 1 | -1) => {
    const now = playhead.get()
    const marks = markSeconds(chapters, content.events)
    const mark =
      direction === 1
        ? marks.find((candidate) => candidate.second > now + 0.5)
        : [...marks].reverse().find((candidate) => candidate.second < now - 0.5)
    const event = mark?.eventId ? content.events.find((candidate) => candidate.id === mark.eventId) : undefined
    if (event) selectEvent(event)
    else if (mark) seek(mark.second)
  }
  const video = useVideoLink({ games, recording, savers, actions, onArrival: words.setArrival })

  return {
    ...props,
    ...content,
    recording,
    settings,
    compact,
    savers,
    missing: editable ? openNumbers(series.content, games, addGame.allowed) : [],
    waiting: publishRows(games).filter((row) => row.state === "ready").length,
    publishing: games.length > 0 && (props.access.canWrite || props.access.canPublish),
    tool: tools.tool,
    target: tools.target,
    panel,
    /** The form the keys and the next step see; a panel over it comes first. */
    form: panel ? null : tools.momentForm,
    momentForm: tools.momentForm,
    activeId,
    fit: tools.fit,
    refusal: words.refusal,
    arrival: words.arrival,
    made: words.made,
    onMade: words.onMade,
    typedTurns: words.typedTurns,
    onTypedTurns: words.onTypedTurns,
    actions,
    desk,
    foot,
    say: words.say,
    onDone: words.onDone,
    onActive: (id: string | null) => setSelected(id && gameId ? { gameId, id } : null),
    onForm: tools.onForm,
    onTouch: tools.onTouch,
    onPhase: tools.onPhase,
    onMoving: setMoving,
    openTool: tools.openTool,
    openPanel: tools.openPanel,
    openStep: tools.openStep,
    chooseGame: tools.chooseGame,
    chooseMissing: tools.chooseMissing,
    createGame,
    selectEvent,
    step,
    link: video.link,
    setLink: video.setLink,
    /** A link stands ready, so the button beside it is the one thing to press. */
    linking: editable && !recording.videoId && !!youtubeVideoId(video.link),
    attachVideo: video.attachVideo,
    attaching: video.attaching,
    shareLink: (second: number) => {
      const url = new URL(window.location.href)
      url.searchParams.set("t", String(Math.round(second)))
      url.searchParams.delete("edit")
      url.searchParams.delete("game")
      return url.toString()
    },
  }
}

/** Everything the desk shows and does, handed to its parts. */
export type Studio = ReturnType<typeof useStudio>

/**
 * The whole match on one desk: the video with its controls and its timeline, and the dock with the game that is
 * recorded. The video lives outside the part that belongs to one game, so choosing another game never re-creates the
 * player, which would stop playback and reload it at a different position.
 */
export function MatchStudio(props: MatchStudioProps) {
  const studio = useStudio(props)
  useStudioKeys(studio)
  const navigate = useNavigate()
  // Opened from the schedule, the trail returns by Back, so the schedule comes back with its place and open match.
  const fromSchedule = !!(useLocation().state as { fromSchedule?: boolean } | null)?.fromSchedule
  const hotkeys = useHotkeys().enabled
  const [dock, setDock] = useState<HTMLElement | null>(null)
  const [room, setRoom] = useState<HTMLElement | null>(null)
  const { series, team, access, editable, tournament, panel, waiting } = studio
  const { focused, entry } = studio.recording
  return (
    <WikiReferences rulesetId={studio.catalog?.resolvedContext?.rulesetId ?? ""}>
      <StudioPage fullscreen={studio.fullscreen}>
        {/* Popovers of the dock and the head open over the dock, never over the picture or the timeline. */}
        <PopoverBoundary.Provider value={studio.compact ? (room ?? dock) : dock}>
          <div className="esp-desk" data-video={studio.recording.videoId ? undefined : "none"}>
            <StudioHead
              tournament={{
                name: tournament.content.name,
                path: `${tournamentPath(tournament.id)}?step=schedule&match=${series.id}`,
                back: fromSchedule ? () => void navigate(-1) : undefined,
              }}
              content={series.content}
              team={team}
              mode={editable ? "record" : "view"}
              onMode={access.canWrite ? (mode) => studio.onMode(mode === "record") : undefined}
              publish={
                studio.publishing
                  ? {
                      waiting,
                      open: panel === "publish",
                      onOpen: () => studio.openPanel(panel === "publish" ? null : "publish"),
                    }
                  : null
              }
              menuOpen={panel === "match"}
              onMenu={() => studio.openPanel(panel === "match" ? null : "match")}
              switcher={
                <MatchSwitcher
                  records={studio.records}
                  seriesId={series.id}
                  team={team}
                  editing={editable}
                  keysEnabled={hotkeys}
                />
              }
            />
            <StudioWatch studio={studio} onRoom={setRoom} />
            <StudioDock studio={studio} onDock={setDock}>
              {focused && entry ? (
                <GameDeskView key={focused.gameId} studio={studio} entry={entry} chapter={focused} />
              ) : (
                <GameSetupView studio={studio} />
              )}
            </StudioDock>
          </div>
        </PopoverBoundary.Provider>
      </StudioPage>
    </WikiReferences>
  )
}
