import type { GameContent, Loadout, Participant, Selection, Side } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { RecordedChange } from "./desk"
import { arcanaLabel } from "./loadout"
import { chapterClock, type GameChapter } from "./series-vod"
import { seatKey, type SeatKey } from "./timeline"

export const participantAt = (content: GameContent, key: SeatKey): Participant | undefined =>
  content.sides.flatMap(({ side, participants }) =>
    participants.filter((participant) => seatKey(side, participant.lane) === key),
  )[0]

/** The seats of a team in the order they are stored. */
export const teamSeats = (content: GameContent, team: Side): SeatKey[] =>
  content.sides.flatMap(({ side, participants }) =>
    side === team ? participants.map((participant) => seatKey(side, participant.lane)) : [],
  )

/** The game with some of its players changed. */
export const changeSeats =
  (keys: readonly SeatKey[], change: (participant: Participant, key: SeatKey) => Participant) =>
  (content: GameContent): GameContent => ({
    ...content,
    sides: content.sides.map((side) => ({
      ...side,
      participants: side.participants.map((participant) => {
        const key = seatKey(side.side, participant.lane)
        return keys.includes(key) ? change(participant, key) : participant
      }),
    })),
  })

/** What a change touches of a player, as it was before. */
function touched(old: Participant, next: Participant): Partial<Participant> {
  const fields = [...new Set([...Object.keys(old), ...Object.keys(next)])] as (keyof Participant)[]
  return Object.fromEntries(fields.filter((field) => old[field] !== next[field]).map((field) => [field, old[field]]))
}

/**
 * One change of some players of a game. Taking it back puts what it touched of each of them back and leaves the rest of
 * the player alone. Null when it changes nobody.
 */
export function seatsChange(
  content: GameContent,
  keys: readonly SeatKey[],
  change: (participant: Participant) => Participant,
  text: string,
): RecordedChange | null {
  const old = new Map<SeatKey, Partial<Participant>>()
  for (const key of keys) {
    const participant = participantAt(content, key)
    const was = participant ? touched(participant, change(participant)) : {}
    if (Object.keys(was).length) old.set(key, was)
  }
  if (!old.size) return null
  return {
    text,
    apply: changeSeats(keys, change),
    revert: changeSeats([...old.keys()], (participant, key) => ({ ...participant, ...old.get(key) })),
  }
}

/**
 * The game second a loadout is seen at where the video stands, or why none can be taken there. A broadcast shows them in
 * the draft and while the game loads as well, which counts as 0:00.
 */
export function seenAt(
  chapter: GameChapter,
  videoSecond: number,
): { second: number; refusal: null } | { second: null; refusal: string } {
  const outside = videoSecond < chapter.from || (chapter.live && chapter.ended && videoSecond > chapter.end)
  if (!chapter.synced || outside) return { second: null, refusal: `Video đang ở ngoài ván ${chapter.number}.` }
  const begun = chapter.live && videoSecond >= chapter.start
  return { second: begun ? Math.round(chapterClock(chapter, videoSecond)) : 0, refusal: null }
}

/** The player with the second the source showed a part of their loadout. */
export const withSeen = (
  participant: Participant,
  part: "spell" | "enchantments" | "arcana",
  second: number | null,
): Participant =>
  part === "spell"
    ? { ...participant, spellObservedAtSeconds: second }
    : { ...participant, [part]: { ...participant[part], observedAtSeconds: second } }

/** What a mark of a loadout says once it is written or taken away. */
export const seenWords = (what: string, who: string, second: number | null | undefined) =>
  second == null ? `Đã bỏ mốc ${what} của ${who}` : `Đã đặt mốc ${what} của ${who} lúc ${formatClock(second)}`

const sentence = (text: string) => text.charAt(0).toLocaleUpperCase("vi") + text.slice(1)
const named = (selection: Selection | null | undefined) => selection?.name?.trim() || "chưa rõ tên"

function loadoutWords<T extends { selection: Selection }>(
  what: string,
  who: string,
  old: Loadout<T>,
  next: Loadout<T>,
  name: (entry: T) => string,
): string {
  const hidden = next.status === "NOT_SHOWN"
  if (hidden !== (old.status === "NOT_SHOWN") && (hidden || !next.entries.length))
    return hidden
      ? `${sentence(what)} của ${who}: video không hiển thị`
      : `Đã bỏ đánh dấu không hiển thị ${what} của ${who}`
  if ((old.observedAtSeconds ?? null) !== (next.observedAtSeconds ?? null))
    return seenWords(what, who, next.observedAtSeconds)
  if ((old.note ?? "") !== (next.note ?? "")) return `Đã sửa ghi chú ${what} của ${who}`

  const had = old.entries.map(name)
  const has = next.entries.map(name)
  const gone = had.filter((value) => !has.includes(value)).join(", ")
  const come = has.filter((value) => !had.includes(value)).join(", ")
  if (gone && come) return `Đã đổi ${what} của ${who}: ${gone} → ${come}`
  if (come) return `Đã ghi ${what} của ${who}: ${come}`
  return gone ? `Đã bỏ ${what} của ${who}: ${gone}` : `Đã sửa ${what} của ${who}`
}

type Timed = { atSeconds: number }

/** What a list of moments says once one of them was added, changed or taken out. */
function timedWords(what: string, who: string, old: readonly Timed[], next: readonly Timed[]): string {
  const gone = old.filter((entry) => !next.includes(entry))
  const come = next.filter((entry) => !old.includes(entry))
  const verb = gone.length && come.length ? "sửa" : come.length ? "thêm" : "bỏ"
  const at = (come[0] ?? gone[0])?.atSeconds
  return `Đã ${verb} ${what}${at === undefined ? "" : ` ${formatClock(at)}`} của ${who}`
}

/** What a change of one player did, as the foot says it. */
export function seatWords(old: Participant, next: Participant, who: string): string {
  if (old.spell !== next.spell)
    return next.spell?.id || next.spell?.name
      ? `Đã ghi phụ trợ của ${who}: ${named(next.spell)}`
      : `Đã bỏ phụ trợ của ${who}`
  if (old.spellObservedAtSeconds !== next.spellObservedAtSeconds)
    return seenWords("phụ trợ", who, next.spellObservedAtSeconds)
  if (old.enchantments !== next.enchantments)
    return loadoutWords("phù hiệu", who, old.enchantments, next.enchantments, (entry) => named(entry.selection))
  if (old.arcana !== next.arcana)
    return loadoutWords("bảng ngọc", who, old.arcana, next.arcana, (entry) => arcanaLabel(entry.selection.name))
  if (old.equipmentSnapshots !== next.equipmentSnapshots)
    return timedWords("mốc trang bị", who, old.equipmentSnapshots, next.equipmentSnapshots)
  if (old.equipmentEvents !== next.equipmentEvents)
    return timedWords("lần mua bán", who, old.equipmentEvents, next.equipmentEvents)
  return old.note === next.note ? `Đã sửa thông tin của ${who}` : `Đã sửa ghi chú của ${who}`
}
