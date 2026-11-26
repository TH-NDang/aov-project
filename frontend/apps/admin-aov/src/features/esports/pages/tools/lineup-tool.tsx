import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import type { GameContent, Participant, Selection, Side } from "@aov/community-contracts"
import { confirmAction } from "@/components/confirm-dialog"
import { LANE_LABELS } from "@/lib/lanes"
import { CarryOverBar } from "../../components/game/carry-over-bar"
import { LineupBoard, type TeamAction } from "../../components/game/lineup-board"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { carryChange, lineupPlan, loadoutPlan, type CarryChange } from "../../model/carry-over"
import type { ToolTarget } from "../../model/desk"
import { assignHero, readDraft, restoreDraft, teamPicks } from "../../model/draft"
import { referenceIndex, type GameSeat } from "../../model/game-view"
import type { LoadoutPart } from "../../model/loadout"
import { MARK_LABELS } from "../../model/observation-marks"
import { placeAt } from "../../model/playback-place"
import { changeSeats, seatsChange, seenAt, seenWords, teamSeats, withSeen } from "../../model/seat-changes"
import { partState } from "../../model/seat-progress"
import { seatKey, seatSide, type SeatKey } from "../../model/timeline"
import { readTimeline } from "../../model/timeline-io"
import { LoadError } from "../esports-shell"
import type { GameDesk } from "../game-desk"
import { CATALOG_WAIT, SeatEditor } from "./seat-editor"

/** The player and the part on screen in the place of the board. */
type Editing = { seat: SeatKey; part: LoadoutPart }

/** Both line-ups, or the editor of one player in their place. */
export function LineupTool({ desk, target }: { desk: GameDesk; target: ToolTarget | null }) {
  const [editing, setEditing] = useState<Editing | null>(() => asked(desk, target))
  // Asking for a part again, also for the same one, opens it again; asking for none brings the board back.
  const answered = useRef(target)
  const answer = useEffectEvent((value: ToolTarget | null) => setEditing(asked(desk, value)))
  useEffect(() => {
    if (answered.current === target) return
    answered.current = target
    answer(target)
  }, [target])

  if (editing && desk.editable)
    return (
      <SeatEditor
        desk={desk}
        seat={editing.seat}
        part={editing.part}
        onSeat={(seat) => setEditing({ ...editing, seat })}
        onPart={(part) => setEditing({ ...editing, part })}
        onBack={() => setEditing(null)}
      />
    )
  return <Board desk={desk} onOpen={setEditing} />
}

/** The player and part a target means: the player it names, or the first that lacks the part it names. */
function asked(desk: GameDesk, target: ToolTarget | null): Editing | null {
  const part = target?.part
  if (target?.seat) return { seat: target.seat, part: part ?? "spell" }
  if (!part) return null
  const { sides, durationSeconds } = desk.entry.content
  const seats = sides.flatMap(({ side, participants }) =>
    participants.map((participant) => ({ seat: seatKey(side, participant.lane), participant })),
  )
  const first = seats.find(({ participant }) => partState(participant, part, durationSeconds) === "todo") ?? seats[0]
  return first ? { seat: first.seat, part } : null
}

function Board({ desk, onOpen }: { desk: GameDesk; onOpen: (editing: Editing) => void }) {
  const { entry, view, chapter, editable, record } = desk
  const { content } = entry
  const events = useMemo(() => readTimeline(content), [content])
  const icon = useMemo(() => referenceIndex(desk.heroes), [desk.heroes])
  const at = usePlayheadValue(desk.playhead, (second) => {
    const place = placeAt([chapter], second)
    return place.kind === "play" || place.kind === "pause" ? Math.floor(place.clock) : null
  })

  const picks = (side: Side) => {
    const drafted = teamPicks(readDraft(content), side)
    // Without turns the heroes of the lanes are all the team is known to have picked.
    const heroes = drafted.length
      ? drafted
      : (content.sides.find((value) => value.side === side)?.participants ?? []).map(({ hero }) => hero)
    return heroes.flatMap((hero) => icon(hero) ?? [])
  }
  const swap = (key: SeatKey, hero: Selection) => {
    const side = seatSide(key)
    const seat = seatOf(desk, key)
    const lane = (content.sides.find((value) => value.side === side)?.participants ?? []).findIndex(
      (value) => value.lane === seat.lane,
    )
    void record({
      text: `Đã đổi tướng ${placeOf(desk, seat)}: ${seat.hero?.name ?? "chưa có"} → ${hero.name}`,
      apply: (current) => assignHero(current, side, lane, hero),
      revert: restoreDraft(content),
    })
  }

  return (
    <LineupBoard
      game={view}
      events={events}
      at={at}
      lookups={desk.lookups}
      locks={desk.locks}
      roster={desk.roster}
      picks={picks}
      wait={desk.catalog || desk.catalogError ? undefined : CATALOG_WAIT}
      fill={
        <>
          {!desk.catalog && !!desk.catalogError && <LoadError error={desk.catalogError} onRetry={desk.reloadCatalog} />}
          {editable && (
            <CarryOverBar
              content={content}
              previous={desk.previous}
              roster={desk.roster}
              onRecord={(change) => void record(change)}
            />
          )}
        </>
      }
      onSwap={editable ? swap : undefined}
      onPlayer={editable ? (key, playerId) => void setPlayer(desk, key, playerId) : undefined}
      onPart={editable ? (seat, part) => onOpen({ seat, part }) : undefined}
      teamActions={editable ? (side) => teamActions(desk, side) : undefined}
    />
  )
}

const seatOf = (desk: GameDesk, key: SeatKey): GameSeat =>
  desk.view.sides[seatSide(key)].seats.find((value) => value.key === key)!
const placeOf = (desk: GameDesk, seat: GameSeat) =>
  `${LANE_LABELS[seat.lane].name} của ${desk.view.sides[seat.side].team.shortName}`

/** Names who played a seat. Somebody seated in another lane of the team changes places with the one who leaves this one. */
async function setPlayer(desk: GameDesk, key: SeatKey, playerId: string | null) {
  const { seats, team } = desk.view.sides[seatSide(key)]
  const old = seatOf(desk, key)
  const before = old.playerId ?? null
  const name = (id: string | null) =>
    desk.roster(team.id).find((member) => member.id === id)?.name ??
    seats.find((value) => value.playerId === id)?.playerName ??
    "chưa rõ tuyển thủ"
  const other = playerId ? seats.find((value) => value.key !== key && value.playerId === playerId) : undefined
  if (before) {
    const accepted = await confirmAction({
      title: other ? `Đổi chỗ ${name(before)} và ${name(playerId)}?` : `Đổi tuyển thủ ${placeOf(desk, old)}?`,
      description: other
        ? `${name(playerId)} sang ${LANE_LABELS[old.lane].name}, ${name(before)} sang ${LANE_LABELS[other.lane].name}.`
        : `${name(before)} → ${name(playerId)}.`,
      confirmLabel: other ? "Đổi chỗ" : "Đổi tuyển thủ",
    })
    if (!accepted) return
  }
  const write = (seated: string | null, beside: string | null) => (current: GameContent) => {
    const next = changeSeats([key], (value) => ({ ...value, playerId: seated }))(current)
    return other ? changeSeats([other.key], (value) => ({ ...value, playerId: beside }))(next) : next
  }
  void desk.record({
    text: other
      ? `Đã đổi chỗ ${name(playerId)} và ${before ? name(before) : "ghế trống"}`
      : `Đã ghi ${name(playerId)} ở ${placeOf(desk, old)}`,
    apply: write(playerId, before),
    revert: write(before, playerId),
  })
}

/** What the source showed, or never showed, of a whole team at once, and what can be taken over from the game before. */
function teamActions(desk: GameDesk, side: Side): TeamAction[] {
  const { view, previous, videoId, chapter } = desk
  const { content } = desk.entry
  const { team } = view.sides[side]
  const write = (change: (participant: Participant) => Participant, text: string) => {
    const done = seatsChange(content, teamSeats(content, side), change, text)
    if (done) void desk.record(done)
    else desk.say(`Không còn tuyển thủ nào của ${team.shortName} để ghi.`)
  }
  const mark = (part: "spell" | "enchantments" | "arcana"): TeamAction => ({
    label: `Mốc ${MARK_LABELS[part]} cả đội`,
    title: `Video hiện ${MARK_LABELS[part]} của cả đội ở giây này`,
    group: "mark",
    onSelect: () => {
      const seen = seenAt(chapter, desk.markNow() ?? desk.playhead.get())
      if (seen.refusal !== null) return desk.say(seen.refusal)
      const { second } = seen
      write((value) => withSeen(value, part, second), seenWords(MARK_LABELS[part], `cả đội ${team.shortName}`, second))
    },
  })
  const hide = (part: "enchantments" | "arcana"): TeamAction => ({
    label: `${part === "arcana" ? "Bảng ngọc" : "Phù hiệu"} không hiển thị`,
    title: `Đánh dấu cho tuyển thủ chưa ghi ${MARK_LABELS[part]}`,
    group: "hidden",
    onSelect: () =>
      write(
        (value) =>
          value[part].status === "UNKNOWN"
            ? { ...value, [part]: { ...value[part], status: "NOT_SHOWN", entries: [] } }
            : value,
        `${part === "arcana" ? "Bảng ngọc" : "Phù hiệu"} chưa ghi của ${team.shortName}: video không hiển thị`,
      ),
  })
  const own = (changes: CarryChange[]) => changes.filter((change) => change.teamId === team.id)
  const replace = (what: string, changes: CarryChange[]): TeamAction[] =>
    changes.length
      ? [
          {
            label: `Thay ${what} bằng ván ${previous!.number}…`,
            group: "previous",
            onSelect: () => void replaceFromPrevious(desk, what, changes),
          },
        ]
      : []
  return [
    ...(videoId === null ? [] : (["spell", "enchantments", "arcana"] as const).map(mark)),
    hide("enchantments"),
    hide("arcana"),
    ...(previous
      ? [
          ...replace("tuyển thủ", own(lineupPlan(content, previous).conflicts)),
          ...replace("phụ trợ, phù hiệu, ngọc", own(loadoutPlan(content, previous).conflicts)),
        ]
      : []),
  ]
}

const PART_LABELS: Record<CarryChange["part"], string> = {
  playerId: "Tuyển thủ",
  spell: "Phụ trợ",
  enchantments: "Phù hiệu",
  arcana: "Bảng ngọc",
}

/** Replaces what is recorded of a team by what it had in the game before, once the old and new values were read. */
async function replaceFromPrevious(desk: GameDesk, what: string, changes: CarryChange[]) {
  const number = desk.previous!.number
  const { seats, team } = desk.view.sides[changes[0]!.side]
  const name = (id: unknown) =>
    desk.roster(team.id).find((member) => member.id === id)?.name ??
    seats.find((value) => value.playerId === id)?.playerName ??
    "Tuyển thủ ngoài đội hình"
  const accepted = await confirmAction({
    title: `Thay ${what} của ${team.shortName} bằng ván ${number}?`,
    description: `${changes.length} chỗ đã ghi sẽ được thay.`,
    details: (
      <ul className="max-h-60 space-y-1.5 overflow-y-auto">
        {changes.map((change) => (
          <li key={`${change.lane}-${change.part}`}>
            <span className="text-muted-foreground">
              {LANE_LABELS[change.lane].name}, {PART_LABELS[change.part].toLocaleLowerCase("vi")}:
            </span>{" "}
            {change.part === "playerId"
              ? `${name(change.before)} → ${name(change.after)}`
              : `bản đã ghi → bản của ván ${number}`}
          </li>
        ))}
      </ul>
    ),
    confirmLabel: "Thay bằng ván trước",
  })
  if (accepted) void desk.record(carryChange(changes, `Đã thay ${what} của ${team.shortName} bằng ván ${number}`))
}
