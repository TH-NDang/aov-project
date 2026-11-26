import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { GameSetup } from "../components/series/game-setup"
import { GameTabs } from "../components/series/game-tabs"
import { NextStep } from "../components/series/next-step"
import { StudioFoot, type FootStatus } from "../components/series/studio-foot"
import { ToolTabs } from "../components/series/tool-tabs"
import { DRAFT_ORDER } from "../model/draft"
import { gameTabs } from "../model/game-tabs"
import { atVideo } from "../model/game-times"
import { isMajorMoment } from "../model/item-lookups"
import { chapterAfter, nextStep, type StepAction, type StepGame } from "../model/next-step"
import { placeAt } from "../model/playback-place"
import { missingGameNumbers } from "../model/series-score"
import { toolMarks } from "../model/tool-state"
import { PanelBody } from "./match-panel"
import type { Studio } from "./match-studio"
import { ScoreCheck } from "./score-check"

/** Two presses this fast are one: the second must not press the step that follows in the same place. */
const ONE_PRESS_MS = 800

/**
 * The body of the dock and its foot. Wide, the foot stands at the bottom edge; on a compact screen it comes first, so
 * the next step is in sight above what scrolls.
 */
export function BodyAndFoot({
  studio,
  shown,
  children,
  foot,
}: {
  studio: Studio
  /** What the body shows; something else starts at its top. */
  shown: string
  children: ReactNode
  foot: ReactNode
}) {
  const body = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0
  }, [shown])
  const parts = [
    <div key="body" ref={body} className="esp-body">
      {children}
    </div>,
    <Fragment key="foot">{foot}</Fragment>,
  ]
  return <>{studio.compact ? parts.reverse() : parts}</>
}

/** The foot while recording: what happened last, and the next step of what is on the desk. */
export function DeskFoot({
  studio,
  game,
  status,
  undo,
  onRun,
}: {
  studio: Studio
  game: StepGame | null
  status: FootStatus
  undo?: () => void
  onRun: (action: StepAction) => unknown
}) {
  const { recording, foot, say, arrival, refusal } = studio
  const { playhead, chapters } = recording
  const [pending, setPending] = useState(false)
  const pressedAt = useRef(0)
  const read = () => {
    const at = Math.floor(playhead.get())
    return nextStep({
      recording: studio.editable,
      busy: !!studio.panel || !!studio.form || studio.linking,
      tool: studio.tool,
      video: recording.videoId !== null,
      empty: !studio.games.length,
      at,
      duration: recording.videoDuration,
      place: placeAt(chapters, at),
      chapters,
      missing: recording.missing,
      toRecord: studio.missing[0] ?? null,
      game,
      waiting: studio.waiting,
      canPublish: studio.access.canPublish,
    })
  }
  const run = async (action: StepAction) => {
    if (pending || Date.now() - pressedAt.current < ONE_PRESS_MS) return
    pressedAt.current = Date.now()
    setPending(true)
    try {
      await onRun(action)
    } finally {
      setPending(false)
    }
  }
  const pressNext = () => {
    const step = read()
    if (!step) return
    if (step.lead === null) return say("Chọn đội thắng.")
    const button = step.buttons[step.lead]!
    if (button.refusal) say(button.refusal)
    else void run(button.action)
  }
  useEffect(() => {
    foot.current = { next: pressNext, undo: () => undo?.() }
    return () => {
      foot.current = null
    }
  })

  const go = arrival?.second
  return (
    <StudioFoot
      status={{
        ...status,
        refusal,
        said: arrival
          ? {
              text: arrival.text,
              act:
                go == null
                  ? null
                  : {
                      label: `Tới ${atVideo(go)}`,
                      undo: false,
                      run: () => {
                        studio.onDone()
                        recording.seek(go)
                      },
                    },
            }
          : status.said,
      }}
    >
      <NextStep
        playhead={playhead}
        read={read}
        pending={pending}
        keycap={!studio.compact}
        onRun={(action) => void run(action)}
        onRefuse={say}
      />
    </StudioFoot>
  )
}

/** Steps that need no game on the desk. */
export function runWithoutGame(studio: Studio, action: StepAction) {
  if (action.kind === "create") return studio.createGame(action.number, action.second)
  if (action.kind === "skip") return studio.recording.seek(action.second)
  if (action.kind === "publish") return studio.openPanel("publish")
}

/** The desk where no game is: what the number nobody recorded asks for, or a panel of the match. */
export function GameSetupView({ studio }: { studio: Studio }) {
  const { recording, games, series, editable, panel } = studio
  const number = recording.missing ?? studio.missing[0] ?? null
  return (
    <BodyAndFoot
      studio={studio}
      shown={panel ?? `setup-${number}`}
      foot={
        editable && (
          <DeskFoot studio={studio} game={null} status={{}} onRun={(action) => runWithoutGame(studio, action)} />
        )
      }
    >
      {panel ? (
        <PanelBody studio={studio} panel={panel} desk={null} />
      ) : (
        <GameSetup
          number={number}
          empty={!games.length}
          result={series.content.result}
          hasVideo={recording.videoId !== null}
          recording={editable}
          missing={missingGameNumbers(series.content, games).length}
          adding={studio.addGame.pending}
          onAdd={(wanted) => void studio.createGame(wanted, null)}
          onQuick={() => studio.openPanel("quick")}
        />
      )}
    </BodyAndFoot>
  )
}

/** The dock: the games of the match, the parts of the one on the desk and, as `children`, what is recorded of it. */
export function StudioDock({
  studio,
  onDock,
  children,
}: {
  studio: Studio
  onDock: (dock: HTMLElement | null) => void
  children: ReactNode
}) {
  const { series, games, team, access, editable, recording, views, progressOf, issues } = studio
  const { chapters, focused, entry } = recording
  // A write of a game that left the desk is still answered; a refusal of it is told here, the desk tells its own.
  const refused = useSyncExternalStore(studio.savers.subscribe, studio.savers.refused).filter(
    (refusal) => refusal.gameId !== focused?.gameId,
  )
  const tabs = gameTabs(games, chapters, views, progressOf, issues, recording.videoId !== null)
  const progress = focused ? progressOf[focused.gameId] : undefined
  const saved =
    focused && entry && progress
      ? toolMarks(entry.content, focused, progress, focused.events.filter(isMajorMoment(studio.lookups)).length, {
          recording: editable,
          followed: chapterAfter(chapters, focused, focused.from) !== null,
        })
      : null
  // Turns typed for a game without an order are on the board before they are saved, so they are counted too.
  const typed = focused ? (studio.typedTurns[focused.gameId] ?? 0) : 0
  const marks =
    saved && typed > 0 ? { ...saved, draft: { ...saved.draft, count: `${typed}/${DRAFT_ORDER.length}` } } : saved
  const notices: ReactNode[] = [
    access.canWrite && (
      <ScoreCheck
        key="score"
        record={series}
        games={games}
        team={team}
        fallbackSource={studio.tournament.content.sourceUrl}
      />
    ),
    studio.addGame.failure && (
      <p key="failure" role="alert" className="type-body text-destructive">
        {studio.addGame.failure}
      </p>
    ),
    ...refused.map((refusal) => (
      <p key={`refused-${refusal.gameId}`} role="alert" className="type-body text-destructive">
        {refusal.text}
      </p>
    )),
  ]
  return (
    <aside ref={onDock} className="esp-dock" aria-label="Các ván của trận">
      <GameTabs
        tabs={tabs}
        missing={studio.missing}
        // A match without any game is at the first number it can take.
        chosen={focused?.gameId ?? recording.missing ?? (games.length ? null : (studio.missing[0] ?? null))}
        onGame={studio.chooseGame}
        onMissing={studio.chooseMissing}
      />
      <ToolTabs open={studio.panel || !focused ? null : studio.tool} marks={marks} onOpen={studio.openTool} />
      <div className="esp-notice">{notices}</div>
      {children}
    </aside>
  )
}
