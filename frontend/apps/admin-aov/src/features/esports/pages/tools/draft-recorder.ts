import { useEffect, useEffectEvent, useRef } from "react"
import type { DraftTurn, GameContent } from "@aov/community-contracts"
import { usePendingTurns, useShownGame } from "../../data/pending-turns"
import type { RecordedChange } from "../../model/desk"
import { lacksTurns, readDraft, restoreDraft, unnamed, withCollectedTurns, withTurns } from "../../model/draft"
import { otherSide, swapSides } from "../../model/line-up"
import { heroKeys } from "../../model/series-rules"
import type { KeptChanges } from "../desk-changes"
import type { GameDesk } from "../game-desk"

/** A change of the turns, as a function of the turns there are when it is applied, so changes in a row add up. */
export type TurnEdit = { text: string; apply: (turns: DraftTurn[]) => DraftTurn[] }

const sameTurn = (a: DraftTurn | undefined, b: DraftTurn) =>
  !!a && a.kind === b.kind && a.side === b.side && heroKeys(a.hero).join() === heroKeys(b.hero).join()

export const addTurn = (turn: DraftTurn, text: string): TurnEdit => ({ text, apply: (turns) => [...turns, turn] })

export const changeTurn = (index: number, change: Partial<DraftTurn>, text: string): TurnEdit => ({
  text,
  apply: (turns) => turns.map((turn, position) => (position === index ? { ...turn, ...change } : turn)),
})

/** Takes the last turn away, as long as it is still the one that was last when the editor asked. */
export const dropTurn = (turn: DraftTurn, text: string): TurnEdit => ({
  text,
  apply: (turns) => (turns.length === turn.order && sameTurn(turns.at(-1), turn) ? turns.slice(0, -1) : turns),
})

const numbered = (turns: DraftTurn[]) => turns.map((turn, index) => ({ ...turn, order: index + 1 }))

/**
 * A change of the draft that is taken back to the game it was applied to: turns, bans and lanes come back as they were,
 * and what was saved since by other ways, such as a turn dragged on the track, stays.
 */
function draftChange(text: string, apply: (content: GameContent) => GameContent): RecordedChange {
  // The saver applies the change last, to the game as saved; that is the game the change is taken back to.
  let before: GameContent | null = null
  return {
    text,
    apply: (content) => {
      before = content
      return apply(content)
    },
    revert: (content) => (before ? restoreDraft(before)(content) : content),
  }
}

/**
 * The turns of the game and the writes that change them. A game whose heroes were recorded without turns collects them
 * first: the service refuses turns that leave one of its bans or heroes unnamed, so they are saved together. Until then
 * each typed turn is told in the foot, and Ctrl Z takes the last one back.
 */
export function useDraftRecorder(desk: GameDesk, kept?: KeptChanges) {
  const saved = desk.entry.content
  const [shown, show] = useShownGame(saved)
  const [pending, keep] = usePendingTurns(desk.entry.id)
  const collecting = desk.editable && lacksTurns(shown)
  const content = collecting ? { ...shown, draft: { ...readDraft(shown), turns: pending } } : shown
  // Turns another editor saved meanwhile make those typed here obsolete.
  const stale = pending.length > 0 && readDraft(saved).turns.length > 0
  useEffect(() => {
    if (stale) keep(() => [])
  }, [stale, keep])
  /** Turns saved from here in one change; taking that change back gives them back to go on with. */
  const collected = useRef<DraftTurn[] | null>(null)
  useEffect(() => {
    if (!collected.current || !lacksTurns(saved)) return
    const turns = collected.current
    collected.current = null
    keep(() => turns)
  }, [saved, keep])

  const save = (change: RecordedChange) => show(change.apply, () => desk.record(change))
  const saveCollected = async (turns: DraftTurn[]) => {
    const accepted = await save(
      draftChange(`Đã ghi ${turns.length} lượt cấm chọn`, (current) => withCollectedTurns(current, turns)),
    )
    if (!accepted) return
    collected.current = turns
    keep(() => [])
  }
  const write = (edit: TurnEdit) => {
    if (!collecting)
      return void save(draftChange(edit.text, (current) => withTurns(current, edit.apply(readDraft(current).turns))))
    let turns: DraftTurn[] = []
    keep((typed) => (turns = numbered(edit.apply(typed))))
    if (turns.length && !unnamed(shown, turns).length) return void saveCollected(turns)
    kept?.say(`${edit.text}, chưa lưu`, turns.length > 0)
  }
  // The tab counts the turns kept here as well, since they are the ones the board shows.
  const count = useEffectEvent((turns: number) => kept?.count(turns))
  const typed = collecting ? pending.length : 0
  useEffect(() => count(typed), [typed])
  // While turns are collected, Ctrl Z takes back the last one typed, as the button that drops a turn does.
  useEffect(() => {
    if (!kept) return
    const last = pending.at(-1)
    kept.undo.current =
      collecting && last
        ? () => {
            keep((typed) => typed.slice(0, -1))
            kept.say(`Đã bỏ lượt ${last.order}, chưa lưu`, pending.length > 1)
            return true
          }
        : null
    return () => {
      kept.undo.current = null
    }
  })
  const swap = async () => {
    const { BLUE, RED } = desk.view.sides
    const flip = () => collecting && keep((turns) => turns.map((turn) => ({ ...turn, side: otherSide(turn.side) })))
    flip()
    const accepted = await save({
      text: `Đã đổi bên: ${RED.team.shortName} bên xanh, ${BLUE.team.shortName} bên đỏ`,
      apply: swapSides,
      revert: (current) => {
        flip()
        return swapSides(current)
      },
    })
    if (!accepted) flip()
  }
  return {
    content,
    draft: readDraft(content),
    collecting,
    /** Recorded bans and heroes the typed turns do not name yet. */
    missing: collecting ? unnamed(shown, pending) : [],
    write,
    saveCollected,
    drop: () => keep(() => []),
    swap,
  }
}

export type DraftRecorder = ReturnType<typeof useDraftRecorder>
