import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { confirmDiscard } from "@/components/confirm-dialog"
import { usePlayheadValue } from "../components/game/use-playhead"
import type { MatchRecording } from "../data/use-match-recording"
import { toolOf, type DeskPanel, type DeskTool, type MomentForm, type ToolTarget } from "../model/desk"
import { placeAt } from "../model/playback-place"
import type { ProgressStep } from "../model/recording-progress"
import { chooseTool, followTool, openingTool, toolOfPlace, type ToolState } from "../model/tool-state"

/** The form of a moment of each game: a refused one comes back to its own game, and only there. */
export type MomentForms = Record<string, MomentForm>

const without = (forms: MomentForms, gameId: string) =>
  Object.fromEntries(Object.entries(forms).filter(([id]) => id !== gameId))

/**
 * What stands on the desk for the game on it: its tool with the part of it asked for, a panel of the match over it and
 * the form of a moment. Whatever would throw away text typed on the desk and not saved asks first.
 */
export function useDeskTools({
  recording,
  editable,
  openInfo,
  unsaved,
  setPanel,
  forms,
  setForms,
  onLeave,
  onRecord,
}: {
  recording: MatchRecording
  editable: boolean
  /** The page was opened on the data of the game. */
  openInfo: boolean
  /** Whether text typed on the desk is not saved yet. */
  unsaved: () => boolean
  setPanel: Dispatch<SetStateAction<DeskPanel | null>>
  forms: MomentForms
  setForms: Dispatch<SetStateAction<MomentForms>>
  /** Another game comes on the desk. */
  onLeave: () => void
  /** A step of a game is opened while the match is only watched. */
  onRecord: () => void
}) {
  const { chapters, entry, focused, playhead } = recording
  const gameId = focused?.gameId ?? null
  /** The form of the game on the desk, kept while a panel stands over it. */
  const momentForm = editable && gameId ? (forms[gameId] ?? null) : null

  const wanted = usePlayheadValue(playhead, (second) => toolOfPlace(placeAt(chapters, second), gameId))
  const [toolState, setToolState] = useState<ToolState>(() => ({
    gameId,
    tool: openInfo ? "game" : (wanted ?? (entry && focused ? openingTool(entry.content, focused) : "draft")),
    chosen: openInfo,
  }))
  const [target, setTarget] = useState<ToolTarget | null>(null)
  const shown = followTool(toolState, gameId, wanted)
  if (shown !== toolState) {
    setToolState(shown)
    // What was asked of the tool before is not asked of it again when it comes back.
    setTarget(null)
  }
  // A form of the game on the desk is in sight whatever the video shows, also one that came back to it refused while
  // another game was on the desk: hidden, it would hold the desk and the keys with nothing to say why.
  const tool: DeskTool = momentForm ? "moments" : shown.tool
  /** Shows the phase of the game on the track again whenever it changes. */
  const [fit, setFit] = useState(0)

  /** Asks before what was typed on the desk and not saved is thrown away; true when it may go. */
  const letGo = () =>
    unsaved()
      ? confirmDiscard({
          title: "Bỏ chữ vừa gõ?",
          description: momentForm
            ? "Diễn biến đang ghi chưa được lưu."
            : `Chữ vừa gõ${focused ? ` ở ván ${focused.number}` : ""} chưa được lưu.`,
          confirmLabel: "Bỏ chữ vừa gõ",
        })
      : Promise.resolve(true)
  const dropForm = (id: string | null) => {
    if (id) setForms((current) => without(current, id))
  }
  const showTool = (next: DeskTool, part?: ToolTarget) => {
    setPanel(null)
    if (next !== "moments") dropForm(gameId)
    // Asking for a tool without naming a part of it brings it back to its beginning.
    setTarget(part ?? {})
    setToolState((state) => chooseTool(state, next))
  }
  const openTool = (next: DeskTool, part?: ToolTarget) => {
    if (next === tool) return showTool(next, part)
    void letGo().then((go) => go && showTool(next, part))
  }
  /** A panel stands over the tool; the form of a moment waits under it with what was typed. */
  const openPanel = (next: DeskPanel | null) => {
    if (next) setTarget(null)
    setPanel(next)
  }
  const formFor = (next: MomentForm | null, id: string | null) => {
    if (!id) return
    if (!next) return dropForm(id)
    const keep = () => setForms((current) => ({ ...current, [id]: next }))
    // The form of another game waits on that game.
    if (id !== gameId) return keep()
    const open = () => {
      keep()
      showTool("moments")
    }
    if (tool !== "moments" || momentForm) void letGo().then((go) => go && open())
    else open()
  }
  // A form handed back once a write is answered comes from the render that sent the write, when another game may have
  // come on the desk since: the desk as it is now takes it.
  const latestFormFor = useRef(formFor)
  useEffect(() => {
    latestFormFor.current = formFor
  })
  const onForm = (next: MomentForm | null, id: string | null = gameId) => latestFormFor.current(next, id)
  /** Closes what is open of the game on the desk before another one comes on it. */
  const leave = () => {
    setPanel(null)
    dropForm(gameId)
    setTarget(null)
    onLeave()
  }
  /** `then` runs once the game is on the desk. */
  const chooseGame = (id: string, then?: () => void) => {
    const go = () => {
      if (id === gameId) {
        setPanel(null)
        setTarget(null)
      } else leave()
      recording.chooseGame(id)
      setFit((count) => count + 1)
      then?.()
    }
    if (id === gameId) go()
    else void letGo().then((ok) => ok && go())
  }
  const openStep = (id: string, step: ProgressStep) => {
    const { tool: next, target: part } = toolOf(step)
    const open = () => {
      if (!editable) onRecord()
      if (id !== gameId) {
        leave()
        recording.chooseGame(id)
        setFit((count) => count + 1)
      } else if (next !== "moments") dropForm(id)
      setPanel(null)
      setTarget(part ?? null)
      setToolState({ gameId: id, tool: next, chosen: true })
    }
    if (id === gameId && next === tool) open()
    else void letGo().then((go) => go && open())
  }

  return {
    tool,
    target,
    momentForm,
    fit,
    openTool,
    openPanel,
    onForm,
    chooseGame,
    openStep,
    chooseMissing: (number: number) =>
      void letGo().then((go) => {
        if (!go) return
        leave()
        recording.chooseMissing(number)
      }),
    /** Any press or key inside a tool keeps that tool on the desk. */
    onTouch: () => setToolState((state) => (state.chosen ? state : { ...state, chosen: true })),
    /** The game has moved on by a step of the foot, so the tool follows what the video shows again. */
    onPhase: () => setToolState((state) => ({ ...state, chosen: false })),
    /** A game was made: the desk starts at its draft, and the tool follows the video from there. */
    onMadeGame: () => setToolState((state) => ({ ...state, tool: "draft", chosen: false })),
  }
}
