import { useEffect, useRef, useState } from "react"
import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { useSeriesVideo } from "../data/series-video"
import type { RosterOption } from "../components/game/draft-editor"
import { usePhoneLayout } from "../components/game/floating-panel"
import { VodPlayer } from "../components/game/vod-player"
import { GameChips, GameScoreCard } from "../components/series/match-games"
import { MatchSetupGuide, VideoLinkCard } from "../components/series/match-setup"
import { MatchTransport } from "../components/series/match-transport"
import { useMatchPlayback } from "../components/series/use-match-playback"
import { useMatchShortcuts } from "../components/series/use-match-shortcuts"
import { useTimedNotice, useUndoNotice } from "../components/series/use-timed-notice"
import type { buildGameView } from "../model/game-view"
import { seriesLabel } from "../model/series-label"
import { chapterClock, chapterVideo, sourceOf } from "../model/series-vod"
import type { TimelineEvent } from "../model/timeline"
import { youtubeLinkTime } from "../model/vod"
import { FocusedGame, type DetailRequest, type GameActions, type Panel } from "./focused-game"
import { FocusedGameLayout, type PhoneTab } from "./focused-game-layout"
import { RecordingTools, type NextGame } from "./match-recording-tools"
import { MatchTimeline } from "./match-timeline"
import { useMatchCatalog } from "./use-match-catalog"
import { WikiReferences } from "./wiki-references"

/**
 * The whole match on one official broadcast: one player, one video-axis timeline with every game as a chapter, and
 * the scoreboard, feed and draft of whichever game the video is showing.
 */
export function MatchViewer({
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
  openInfo,
  onConsumeLink,
  tournamentRegion,
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
  openInfo: boolean
  onConsumeLink: () => void
  tournamentRegion?: string
  /** Shown before the first game is recorded. */
  resultNote: string | null
  /** Records the next game; with a video it starts at the playhead, outside every recorded game. */
  addGame: NextGame | null
}) {
  const phone = usePhoneLayout()
  const playback = useMatchPlayback(series, games, { fromLink, requestedGame })
  const { video, videoId, chapters, at, seek, here, focused } = playback
  useEffect(() => {
    if (requestedGame || fromLink !== null || openInfo) onConsumeLink()
  }, [requestedGame, fromLink, openInfo, onConsumeLink])
  const focusedEntry = games.find((entry) => entry.id === focused?.gameId)!
  const gameAt = focused ? chapterClock(focused, at) : 0
  const { catalog, items, lookups, views, events, heroIcon, progressOf, locks } = useMatchCatalog({
    series,
    games,
    chapters,
    focusedEntry,
    teams,
    players,
  })

  const [activeId, setActiveId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel | null>(openInfo ? { kind: "info" } : null)
  const [detail, setDetail] = useState<DetailRequest | null>(null)
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("feed")
  const [keysOpen, setKeysOpen] = useState(false)
  // A short note next to the transport confirms what a key did and where the video went.
  const [flash, showFlash] = useTimedNotice<{ text: string }>(1400)
  const [undo, offerUndo, clearUndo] = useUndoNotice(focused?.gameId)
  const gameActions = useRef<GameActions | null>(null)
  const saveFocused = (change: (content: GameContent) => GameContent) => void gameActions.current?.save(change)

  const seriesVideoWrite = useSeriesVideo(games)
  const applyVideoToAll = (url: string) => seriesVideoWrite.mutate(url)
  const attachVideo = (url: string) => {
    if (games.length) applyVideoToAll(url)
    else playback.setDraftLink(url)
    const start = youtubeLinkTime(url)
    if (start !== null) playback.setPlayhead(start)
  }

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
  const shareLink = (videoSecond: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set("t", String(Math.round(videoSecond)))
    url.searchParams.delete("edit")
    url.searchParams.delete("game")
    return url.toString()
  }

  const hasGame = !!focused?.live
  useMatchShortcuts({
    at,
    gameFrom: focused?.from ?? null,
    hasVideo: !!videoId,
    canRecord: editable && hasGame,
    composing: panel?.kind === "composer",
    seek,
    step,
    togglePlayer: () => playback.player.current?.toggle(),
    say: (text) => showFlash({ text }),
    toggleList: () => setKeysOpen((open) => !open),
    compose: (eventKind) => setPanel({ kind: "composer", eventKind }),
  })

  const focusedView = focused ? views[focused.gameId] : undefined
  const gameCard = focused && focusedView && (
    <GameScoreCard chapter={focused} view={focusedView} playing={!!here} at={at} gameAt={gameAt} />
  )

  // The player, chips and timeline live outside the per-game subtree: switching games must never recreate the
  // YouTube iframe, which would stop playback and reload it at a different position.
  return (
    <WikiReferences rulesetId={catalog?.resolvedContext?.rulesetId ?? ""}>
      <div className={cn("esp-viewer", phone && "pb-24")}>
        <div className="esp-area-chips min-w-0">
          <GameChips
            chapters={chapters}
            views={views}
            progressOf={progressOf}
            focusedGameId={focused?.gameId}
            hasVideo={!!videoId}
            onPick={(chapter) => {
              playback.setLastFocus(chapter.gameId)
              seek(chapter.from)
            }}
          />
        </div>
        <div className="esp-area-video min-w-0">
          {videoId ? (
            <VodPlayer
              key={videoId}
              ref={playback.player}
              videoId={videoId}
              startAt={at}
              title={seriesLabel(series.content) || "Video trận đấu"}
              onTime={playback.onVideoTime}
              onDuration={playback.setVideoDuration}
              onPlayingChange={playback.setPlaying}
            />
          ) : (
            <VideoLinkCard
              editable={editable}
              canWrite={canWrite}
              onEnableEditing={onEnableEditing}
              onUse={attachVideo}
            />
          )}
        </div>
        <section className="esp-area-timeline min-w-0 space-y-2 admin-section px-3 pt-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <MatchTransport
              playing={playback.playing}
              canPlay={!!videoId}
              flash={flash}
              shortcuts={phone ? null : { open: keysOpen, onOpenChange: setKeysOpen }}
              editable={editable}
              onStep={step}
              onTogglePlay={playback.togglePlay}
            />
            <RecordingTools
              phone={phone}
              editable={editable}
              focused={focused}
              focusedContent={focusedEntry?.content}
              progress={focused && (canWrite || canPublish) ? progressOf[focused.gameId] : undefined}
              at={at}
              video={video}
              chapters={chapters}
              hasGames={games.length > 0}
              nextGame={addGame}
              onPanel={setPanel}
              onStarted={() => {
                playback.setDraftLink("")
                setPanel({ kind: "draft" })
              }}
              onSave={saveFocused}
            />
          </div>
          {phone && gameCard}
          <MatchTimeline
            duration={playback.duration}
            at={at}
            chapters={chapters}
            flags={playback.flags}
            events={events}
            views={views}
            lookups={lookups}
            heroIcon={heroIcon}
            videoId={videoId}
            focused={focused}
            activeId={activeId}
            editable={editable}
            undo={undo}
            onUndone={clearUndo}
            onSave={saveFocused}
            onUndoable={offerUndo}
            onPanel={setPanel}
            onNote={(text) => showFlash({ text })}
            seek={seek}
            onActive={setActiveId}
            onSelect={selectTimeline}
            onDetail={setDetail}
          />
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
            catalog={catalog}
            canPublish={canPublish}
            tournamentRegion={tournamentRegion}
            onEnableEditing={onEnableEditing}
            heroes={catalog?.heroes ?? []}
            spells={catalog?.spells ?? []}
            roster={roster}
            locks={locks}
            editable={editable}
            phone={phone}
            gameAt={gameAt}
            videoId={videoId}
            videoNow={playback.videoNow}
            playing={playback.playing}
            activeId={activeId}
            panel={panel}
            detail={detail}
            onActive={setActiveId}
            onPanel={setPanel}
            onDetail={setDetail}
            seekGame={(second, play) => seek(chapterVideo(focused, second), play)}
            onVideoUrl={applyVideoToAll}
            shareLink={shareLink}
            actions={gameActions}
            onUndoable={(text, revert) => offerUndo({ gameId: focused.gameId, text, revert })}
          >
            {(parts) => (
              <FocusedGameLayout
                parts={parts}
                phone={phone}
                gameCard={gameCard}
                tab={phoneTab}
                onTab={setPhoneTab}
                showFab={editable && hasGame}
                onCompose={() => setPanel({ kind: "composer", eventKind: "KILL" })}
              />
            )}
          </FocusedGame>
        )}
      </div>
    </WikiReferences>
  )
}
