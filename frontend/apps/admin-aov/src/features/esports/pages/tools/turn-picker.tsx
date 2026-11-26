import { useState } from "react"
import type { DraftKind, GameContent, Selection, Side } from "@aov/community-contracts"
import { MoreHorizontal, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { DockMenuContent } from "../../components/game/dock-menu"
import { turnWords } from "../../components/game/draft-board"
import { HeroPicker } from "../../components/game/hero-picker"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { draftSlots, turnSecond, turnUnavailable } from "../../model/draft"
import { atVideo } from "../../model/game-times"
import { otherSide } from "../../model/line-up"
import { allowedOptions, heroKeys, unavailableReason } from "../../model/series-rules"
import type { GameDesk } from "../game-desk"
import { addTurn, changeTurn, dropTurn, type DraftRecorder } from "./draft-recorder"

type Turn = { kind: DraftKind; side: Side }

/** One turn: whose it is, its second, and the heroes it may take. A recorded turn is changed here as well. */
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
  const { content, draft, write } = recorder
  const { view, heroes, locks, markNow } = desk
  const [stamp, setStamp] = useState(true)
  // Another format may give the next turn to the other team, or make it a pick for a ban.
  const [changed, setChanged] = useState<(Turn & { index: number }) | null>(null)
  const [began, setBegan] = useState<number | null>(null)
  const stored = recorded ? draft.turns[index] : undefined
  const slot: Turn = stored ?? (changed?.index === index ? changed : draftSlots(draft)[index]!)
  const team = view.sides[slot.side].team
  const name = `Lượt ${index + 1}, ${team.shortName} ${turnWords(slot.kind)}`
  const canStamp = desk.videoId !== null && draft.startSecond != null
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

  const second = () => {
    const at = began ?? markNow()
    return stamp && canStamp && at !== null ? turnSecond(content, at, index) : null
  }
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
      const at = second()
      const what = word ? `${turnWords(slot.kind)} ${word}` : "không cấm"
      const when = at === null ? "" : ` lúc ${atVideo(at)}`
      write(
        addTurn(
          { order: index + 1, kind: slot.kind, side: slot.side, hero, atSecond: at },
          `Đã ghi lượt ${index + 1}, ${team.shortName} ${what}${when}`,
        ),
      )
    }
    setBegan(null)
    setChanged(null)
  }
  const change = (turn: Turn) => {
    if (!stored) return setChanged({ ...turn, index })
    write(
      changeTurn(index, turn, `Lượt ${index + 1} là ${view.sides[turn.side].team.shortName} ${turnWords(turn.kind)}`),
    )
  }
  const mark = (at: number | null) =>
    write(
      changeTurn(
        index,
        { atSecond: at },
        at === null ? `Đã bỏ mốc lượt ${index + 1}` : `Đã đặt mốc lượt ${index + 1} ở ${atVideo(at)}`,
      ),
    )
  const markHere = () => {
    const at = markNow()
    const here = at === null ? null : turnSecond(content, at, index)
    if (here === null) desk.say("Đặt lúc bắt đầu cấm chọn trước.")
    else mark(here)
  }
  const last = draft.turns.at(-1)

  const ask = (
    <div className="esp-draft-ask">
      <b>Lượt {index + 1}</b>
      <span>
        {team.shortName} {turnWords(slot.kind)}
        {stored?.hero?.name && ` ${stored.hero.name}`}
      </span>
      {stored
        ? stored.atSecond != null && <span className="esp-draft-second">{atVideo(stored.atSecond)}</span>
        : stamp && canStamp && <NextSecond desk={desk} content={content} began={began} />}
      <span className="esp-draft-asks">
        {stored ? (
          <>
            {stored.atSecond != null && (
              <Button type="button" size="xs" variant="ghost" onClick={() => desk.seekVideo(stored.atSecond!)}>
                Tới
              </Button>
            )}
            {canStamp && (
              <Button type="button" size="xs" variant="ghost" onClick={markHere}>
                Lấy mốc ở đây
              </Button>
            )}
            {stored.atSecond != null && (
              <Button type="button" size="xs" variant="ghost" onClick={() => mark(null)}>
                Bỏ mốc
              </Button>
            )}
          </>
        ) : (
          last && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => write(dropTurn(last, `Đã bỏ lượt ${last.order}`))}
            >
              Bỏ lượt {last.order}
            </Button>
          )
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
            {desk.videoId !== null && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={stamp} onCheckedChange={setStamp}>
                  Kèm mốc video
                </DropdownMenuCheckboxItem>
              </>
            )}
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
      onTyping={(typing) => setBegan(typing ? markNow() : null)}
      onPick={take}
      onEscape={() => {
        if (stored) onDone()
        return !!stored
      }}
    />
  )
}

/** The second the next turn takes: that of its first key once something is typed, the video's until then. */
function NextSecond({ desk, content, began }: { desk: GameDesk; content: GameContent; began: number | null }) {
  const now = usePlayheadValue(desk.playhead, (second) => Math.floor(second))
  const at = turnSecond(content, began ?? now)
  return at === null ? null : <span className="esp-draft-second">{atVideo(at)}</span>
}
