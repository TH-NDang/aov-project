import { useState } from "react"
import type { DraftKind, Selection, Side } from "@aov/community-contracts"
import { MoreHorizontal, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from "@aov/ui/components/dropdown-menu"
import { DockMenuContent } from "../../components/game/dock-menu"
import { turnWords } from "../../components/game/draft-board"
import { HeroPicker } from "../../components/game/hero-picker"
import { draftSlots, turnUnavailable } from "../../model/draft"
import { otherSide } from "../../model/line-up"
import { allowedOptions, heroKeys, unavailableReason } from "../../model/series-rules"
import type { GameDesk } from "../game-desk"
import { addTurn, changeTurn, dropTurn, type DraftRecorder } from "./draft-recorder"

type Turn = { kind: DraftKind; side: Side }

/**
 * One turn: whose it is and the heroes it may take. A recorded turn is changed here as well. Turns keep their order
 * only; the video marks the start of the draft and the lock.
 */
export function TurnPicker({
  desk,
  recorder,
  index,
  recorded,
  onDone,
}: {
  desk: GameDesk
  recorder: DraftRecorder
  index: number
  recorded: boolean
  onDone: () => void
}) {
  const { draft, write } = recorder
  const { view, heroes, locks } = desk
  // Another format may give the next turn to the other team, or make it a pick for a ban.
  const [changed, setChanged] = useState<(Turn & { index: number }) | null>(null)
  const stored = recorded ? draft.turns[index] : undefined
  const slot: Turn = stored ?? (changed?.index === index ? changed : draftSlots(draft)[index]!)
  const team = view.sides[slot.side].team
  const name = `Lượt ${index + 1}, ${team.shortName} ${turnWords(slot.kind)}`
  // A finger came for the faces: the keyboard of a phone would cover them.
  const fine = !window.matchMedia?.("(pointer: coarse)").matches

  const teamName = (id: string) =>
    Object.values(view.sides).find((side) => side.team.id === id)?.team.shortName ?? "Đội"
  const blocked = turnUnavailable(draft, index, slot, team.id, locks, teamName)
  const allowed = allowedOptions(heroes, blocked, stored?.hero)
  // A game that has its heroes already is asked for them first.
  const wanted = new Set(
    recorder.missing
      .filter((entry) => entry.side === slot.side && entry.kind === slot.kind)
      .flatMap((entry) => heroKeys(entry.hero)),
  )
  const options = wanted.size
    ? [...allowed].sort(
        (a, b) =>
          Number(heroKeys(b).some((key) => wanted.has(key))) - Number(heroKeys(a).some((key) => wanted.has(key))),
      )
    : allowed

  const take = (hero: Selection | null) => {
    const word = hero?.name ?? null
    if (stored) {
      write(
        changeTurn(
          index,
          { hero },
          `Đã đổi lượt ${index + 1}: ${stored.hero?.name ?? "không cấm"} → ${word ?? "không cấm"}`,
        ),
      )
      onDone()
    } else {
      const what = word ? `${turnWords(slot.kind)} ${word}` : "không cấm"
      write(
        addTurn(
          { order: index + 1, kind: slot.kind, side: slot.side, hero },
          `Đã ghi lượt ${index + 1}, ${team.shortName} ${what}`,
        ),
      )
    }
    setChanged(null)
  }
  const change = (turn: Turn) => {
    if (!stored) return setChanged({ ...turn, index })
    write(
      changeTurn(index, turn, `Lượt ${index + 1} là ${view.sides[turn.side].team.shortName} ${turnWords(turn.kind)}`),
    )
  }
  const last = draft.turns.at(-1)

  const ask = (
    <div className="esp-draft-ask">
      <b>Lượt {index + 1}</b>
      <span>
        {team.shortName} {turnWords(slot.kind)}
        {stored?.hero?.name && ` ${stored.hero.name}`}
      </span>
      <span className="esp-draft-asks">
        {!stored && last && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => write(dropTurn(last, `Đã bỏ lượt ${last.order}`))}
          >
            Bỏ lượt {last.order}
          </Button>
        )}
        {slot.kind === "BAN" && !stored && (
          <Button type="button" size="xs" variant="ghost" onClick={() => take(null)}>
            Không cấm
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Thêm thao tác với lượt ${index + 1}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DockMenuContent align="end">
            {slot.kind === "BAN" && stored?.hero && (
              <DropdownMenuItem onSelect={() => take(null)}>Không cấm</DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => change({ side: slot.side, kind: slot.kind === "BAN" ? "PICK" : "BAN" })}>
              Đổi cấm/chọn
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => change({ kind: slot.kind, side: otherSide(slot.side) })}>
              Đổi đội
            </DropdownMenuItem>
          </DockMenuContent>
        </DropdownMenu>
        {stored && (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Thôi sửa lượt ${index + 1}`}
            onClick={onDone}
          >
            <X aria-hidden />
          </Button>
        )}
      </span>
    </div>
  )

  return (
    <HeroPicker
      head={ask}
      label={name}
      turn={index}
      options={options}
      catalog={heroes}
      whyNot={(hero) => unavailableReason(blocked, hero)}
      keepFocus={!desk.compact && fine}
      onPick={take}
      onEscape={() => {
        if (stored) onDone()
        return !!stored
      }}
    />
  )
}
