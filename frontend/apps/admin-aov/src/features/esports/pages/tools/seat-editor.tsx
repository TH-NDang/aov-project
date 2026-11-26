import { useEffect, useMemo, useRef, useState } from "react"
import type { Catalog, GameContent, Participant } from "@aov/community-contracts"
import { EquipmentEditor } from "@/features/tournaments/components/equipment-editor"
import { LANE_LABELS } from "@/lib/lanes"
import { ArcanaEditor } from "../../components/game/arcana-editor"
import { EnchantmentEditor } from "../../components/game/enchantment-editor"
import { NoteField } from "../../components/game/loadout-fields"
import { SeatParts, SeatStrip } from "../../components/game/seat-head"
import { SpellPicker } from "../../components/game/spell-picker"
import { usePlayheadValue } from "../../components/game/use-playhead"
import { LaneIcon } from "../../components/primitives"
import { useShownGame } from "../../data/pending-turns"
import { itemIndex } from "../../model/build"
import type { GameSeat } from "../../model/game-view"
import { MAIN_EMBLEM_TIER, type LoadoutPart } from "../../model/loadout"
import { participantAt, seatsChange, seatWords, seenAt } from "../../model/seat-changes"
import { seatSide, type SeatKey } from "../../model/timeline"
import { BuildEditor } from "../build-editor"
import { LoadError } from "../esports-shell"
import type { GameDesk } from "../game-desk"
import { Seen, type UpdateSeat } from "./seat-seen"

export const CATALOG_WAIT = "Đang tải danh mục của ván…"

/** A player as a sentence names them: by name, or by their place in the team while nobody is named. */
export const seatName = (desk: GameDesk, seat: GameSeat) =>
  seat.playerId ? seat.playerName : `${LANE_LABELS[seat.lane].name} của ${desk.view.sides[seat.side].team.shortName}`

/**
 * One player in the place of the board: the spell, the emblems, the arcana and the items, one part at a time. Another
 * player keeps the part, so one part is recorded down a whole team. Every edit is written at once and shown before it is
 * saved; a refused one goes back to what is saved.
 */
export function SeatEditor({
  desk,
  seat: key,
  part,
  onSeat,
  onPart,
  onBack,
}: {
  desk: GameDesk
  seat: SeatKey
  part: LoadoutPart
  onSeat: (seat: SeatKey) => void
  onPart: (part: LoadoutPart) => void
  onBack: () => void
}) {
  const { catalog, view, record: write } = desk
  const [content, show] = useShownGame(desk.entry.content)
  const items = useMemo(() => itemIndex(catalog?.items), [catalog?.items])
  const [choices, setChoices] = useState<Choices>({ allSlots: null, stamp: false })
  const root = useRef<HTMLDivElement>(null)
  // What was pressed to open the editor is gone, so the keys of the desk and Esc go on from here.
  useEffect(() => root.current?.focus({ preventScroll: true }), [])

  const seat = view.sides[seatSide(key)].seats.find((value) => value.key === key)
  const participant = participantAt(content, key)
  if (!seat || !participant) return null
  const who = seatName(desk, seat)
  const update: UpdateSeat = (change, text) => {
    const done = seatsChange(content, [key], change, text ?? seatWords(participant, change(participant), who))
    return done ? show(done.apply, () => write(done)) : undefined
  }

  return (
    <div
      ref={root}
      tabIndex={-1}
      className="esp-two outline-none"
      onKeyDown={(event) => {
        // A popover over the editor takes its own Esc first.
        if (event.key !== "Escape" || event.defaultPrevented) return
        event.stopPropagation()
        onBack()
      }}
    >
      <div className="esp-seat-top">
        <SeatStrip game={view} content={content} index={items} chosen={key} onChoose={onSeat} onBack={onBack} />
        <div className="esp-seat-who-row" data-side={seat.side}>
          <LaneIcon lane={seat.lane} size={16} className="shrink-0 text-[var(--side)]" />
          <b title={seat.playerName}>{who}</b>
          <span className="esp-seat-hero">{participant.hero?.name || "chưa có tướng"}</span>
          <Seen desk={desk} participant={participant} part={part} onUpdate={update} />
        </div>
        <SeatParts
          participant={participant}
          duration={content.durationSeconds}
          index={items}
          open={part}
          onOpen={onPart}
        />
      </div>
      <div className="esp-seat-part">
        {catalog ? (
          <Part
            key={`${key}-${part}`}
            desk={desk}
            content={content}
            catalog={catalog}
            participant={participant}
            part={part}
            who={who}
            choices={choices}
            onChoices={setChoices}
            onUpdate={update}
          />
        ) : desk.catalogError ? (
          <LoadError error={desk.catalogError} onRetry={desk.reloadCatalog} />
        ) : (
          <p className="type-body text-muted-foreground" role="status">
            {CATALOG_WAIT}
          </p>
        )}
        <NoteField
          // Another player has a note of their own; a refused or a taken back note is followed by the field itself.
          key={`note-${key}`}
          label="Ghi chú tuyển thủ"
          value={participant.note ?? ""}
          limit={2000}
          onCommit={(note) => update((value) => ({ ...value, note: note || undefined }))}
        />
      </div>
    </div>
  )
}

/** How the editor records; it holds from one player to the next. */
type Choices = {
  /** All five emblem slots, or the main one alone; null while what is recorded decides. */
  allSlots: boolean | null
  /** Items are added with the time of the video. */
  stamp: boolean
}

/** The game second on screen a loadout is seen at, or null where none can be taken. */
const useSeenNow = (desk: GameDesk) =>
  usePlayheadValue(desk.playhead, (second) =>
    desk.videoId === null ? null : seenAt(desk.chapter, Math.floor(second)).second,
  )

function Part({
  desk,
  content,
  catalog,
  participant,
  part,
  who,
  choices,
  onChoices,
  onUpdate,
}: {
  desk: GameDesk
  content: GameContent
  catalog: Catalog
  participant: Participant
  part: LoadoutPart
  who: string
  choices: Choices
  onChoices: (choices: Choices) => void
  onUpdate: UpdateSeat
}) {
  const now = useSeenNow(desk)
  const items = useMemo(() => itemIndex(catalog.items), [catalog.items])
  switch (part) {
    case "spell":
      return (
        <section data-part="spell" aria-label="Phụ trợ">
          <SpellPicker
            label={`Phụ trợ của ${who}`}
            value={participant.spell}
            spells={catalog.spells}
            onPick={(spell) =>
              onUpdate((value) => ({
                ...value,
                spell,
                spellObservedAtSeconds: value.spellObservedAtSeconds ?? (spell.id || spell.name ? now : null),
              }))
            }
          />
        </section>
      )
    case "enchantments": {
      const more = participant.enchantments.entries.some((entry) => !entry.primary || entry.tier !== MAIN_EMBLEM_TIER)
      return (
        <EnchantmentEditor
          value={participant.enchantments}
          catalog={catalog}
          allSlots={choices.allSlots ?? more}
          onAllSlots={(allSlots) => onChoices({ ...choices, allSlots })}
          onChange={(change) =>
            onUpdate((value) => {
              const enchantments = change(value.enchantments)
              return enchantments === value.enchantments ? value : { ...value, enchantments }
            })
          }
        />
      )
    }
    case "arcana":
      return (
        <ArcanaEditor
          value={participant.arcana}
          catalog={catalog}
          onChange={(change) =>
            onUpdate((value) => {
              const arcana = change(value.arcana)
              return arcana === value.arcana ? value : { ...value, arcana }
            })
          }
        />
      )
    case "equipment":
      return (
        <>
          <BuildEditor
            participant={participant}
            index={items}
            duration={content.durationSeconds}
            nowGame={now}
            stamp={choices.stamp}
            inline={desk.compact}
            onStamp={(stamp) => onChoices({ ...choices, stamp })}
            onSeekGame={desk.videoId !== null && desk.chapter.live ? (second) => desk.seekGame(second) : undefined}
            onEdit={(change, text) => onUpdate(change, `${text} của ${who}`)}
          />
          <EquipmentEditor
            participant={participant}
            catalog={catalog}
            nowGame={now}
            // The editor answers with a whole player; only its own two lists are taken from that copy.
            onChange={(next) =>
              onUpdate((value) => ({
                ...value,
                equipmentSnapshots: next.equipmentSnapshots,
                equipmentEvents: next.equipmentEvents,
              }))
            }
          />
        </>
      )
  }
}
