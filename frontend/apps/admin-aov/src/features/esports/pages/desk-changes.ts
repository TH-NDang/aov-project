import { useEffect, useRef, useState, type RefObject } from "react"
import type { GameSaver } from "../data/use-game-saver"
import type { ContentChange, RecordedChange } from "../model/desk"
import { setDraftTimes } from "../model/draft"
import { atVideo } from "../model/game-times"
import type { Studio } from "./match-studio"

/** How many changes of the game on screen can be taken back. */
const UNDO_LIMIT = 20

/** A change made on the desk with the answer to its write; `undone` words its undo where the usual words do not fit. */
export type DeskChange = { change: RecordedChange; saved: Promise<boolean>; undone?: string }

/**
 * The last thing done, as the foot says it, and what its undo takes back: the last change of the list, or the last
 * thing a tool kept in this browser.
 */
type Said = { text: string; undo: "list" | "kept" | null }

/** What a tool keeps in this browser before it is saved, such as the turns of an imported game. */
export type KeptChanges = {
  /** Tells what was kept; `more` says whether something kept is left to take back. */
  say: (text: string, more: boolean) => void
  /** Takes back the last thing kept; true when there was one. Ctrl Z asks it first. */
  undo: RefObject<(() => boolean) | null>
  /** How many turns are kept, for the tab of the tool to count them before they are saved. */
  count: (turns: number) => void
}

/** The words of a change after the word for "done", for the sentences that name it. */
export const deed = (text: string) => text.replace(/^Đã /, "")

/**
 * How a game the desk made is told on its own desk. One made at a second of the video is taken back by taking that
 * second back: the game stays, because its number stays taken in the trash and a new game of that number is refused.
 */
export function madeGame(number: number, second: number | null): DeskChange {
  const saved = Promise.resolve(true)
  if (second === null)
    return { change: { text: `Đã tạo ván ${number}`, apply: (content) => content, revert: null }, saved }
  const at = atVideo(second)
  return {
    change: {
      text: `Đã tạo ván ${number}, cấm chọn từ ${at}`,
      apply: (content) => content,
      revert: (content) => setDraftTimes(content, { startSecond: null }),
    },
    saved,
    undone: `Đã hoàn tác: ván ${number} bắt đầu cấm chọn lúc ${at}`,
  }
}

/** What the foot says of a game the desk made, with its undo button when it has a way back. */
const madeSaid = (made: DeskChange): Said => ({ text: made.change.text, undo: made.change.revert ? "list" : null })

/**
 * The changes of the game on the desk and the way back through them. A change is in the list from the moment it is made,
 * so Ctrl Z right after a key takes back that key's change, also while it is still being saved; a change that was
 * refused leaves the list, since the game never had it.
 */
export function useDeskChanges(studio: Studio, gameId: string, saver: GameSaver) {
  const { onDone, onMade, onTypedTurns } = studio
  // A game the studio just made comes on its desk telling so.
  const made = studio.made?.gameId === gameId ? studio.made.done : null
  const list = useRef<DeskChange[]>(made?.change.revert ? [made] : [])
  const [count, setCount] = useState(list.current.length)
  const [said, setSaid] = useState<Said | null>(() => (made ? madeSaid(made) : null))
  const kept = useRef<(() => boolean) | null>(null)
  /** The game made that this desk tells of. */
  const told = useRef(made)
  useEffect(() => {
    if (!made) return
    // The list of games read again may bring the new game on its desk before the studio hears that it made it.
    if (made !== told.current) {
      told.current = made
      if (made.change.revert) {
        list.current = [...list.current, made].slice(-UNDO_LIMIT)
        setCount(list.current.length)
      }
      setSaid(madeSaid(made))
    }
    onMade()
  }, [made, onMade])

  const remember = (next: DeskChange[]) => {
    list.current = next.slice(-UNDO_LIMIT)
    setCount(list.current.length)
  }
  const record = async (change: RecordedChange) => {
    onDone()
    const done: DeskChange = { change, saved: saver.save(change.apply, deed(change.text)) }
    if (change.revert) remember([...list.current, done])
    const saved = await done.saved
    if (!saved) {
      remember(list.current.filter((entry) => entry !== done))
      return false
    }
    setSaid({ text: change.text, undo: change.revert ? "list" : null })
    return true
  }
  const undo = () => {
    if (kept.current?.()) return
    const last = list.current.at(-1)
    if (!last?.change.revert) return
    onDone()
    remember(list.current.slice(0, -1))
    const revert = last.change.revert
    void last.saved.then(async (stored) => {
      if (!stored) return
      const reverted = await saver.save(revert, `hoàn tác ${deed(last.change.text)}`)
      if (reverted) setSaid({ text: last.undone ?? `Đã hoàn tác: ${deed(last.change.text)}`, undo: "list" })
      else remember([...list.current, last])
    })
  }
  /** Forms that keep their own undo say nothing here; the line then tells when it was saved. */
  const saveQuietly = (change: ContentChange) => {
    onDone()
    setSaid(null)
    return saver.save(change)
  }
  const keptChanges: KeptChanges = {
    say: (text, more) => {
      onDone()
      setSaid({ text, undo: more ? "kept" : "list" })
    },
    undo: kept,
    count: (turns) => onTypedTurns(gameId, turns),
  }
  const undoable = said?.undo === "kept" || (said?.undo === "list" && count > 0)

  return {
    record,
    undo,
    saveQuietly,
    kept: keptChanges,
    /** What the foot says of the last change, with its undo button while there is something to take back. */
    said: said && { text: said.text, act: undoable ? { label: "Hoàn tác", undo: true, run: undo } : null },
  }
}
