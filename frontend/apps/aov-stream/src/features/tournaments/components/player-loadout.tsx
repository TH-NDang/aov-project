import type { Participant, PublishedGame } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  clock,
  hasLoadout,
  OBSERVATION_NAMES,
  referenceName,
  snapshotAt,
  UNKNOWN_REFERENCE,
  type LoadoutKind,
} from "../../../lib/tournament-model"
import { ReferenceArt } from "./reference-art"
import "./player-loadout.css"

/** Each kind of loadout in Vietnamese and in English. */
export const KIND_NAMES: Record<LoadoutKind, readonly [string, string]> = {
  equipment: ["Trang bị", "Equipment"],
  arcana: ["Bảng ngọc", "Arcana"],
  enchantments: ["Phù hiệu", "Enchantments"],
}

const TIERS = ["", "I", "II", "III"]

/** The six slots of a player at a moment; the time it was seen and its note open on hover. */
function Inventory({ participant, game, time }: { participant: Participant; game: PublishedGame; time: number }) {
  const { text } = useStreamLocale()
  const snapshot = snapshotAt(participant.equipmentSnapshots, time)
  const seen = snapshot && text(`Ghi nhận lúc ${clock(snapshot.atSeconds)}`, `Recorded at ${clock(snapshot.atSeconds)}`)
  return (
    <span className="tn-slots" title={[seen, snapshot?.note].filter(Boolean).join(". ") || undefined}>
      {Array.from({ length: 6 }, (_, slot) => {
        const value = snapshot?.slots.find((item) => item.slot === slot + 1)
        const known = value?.known === true
        const place = text(`Ô ${slot + 1}`, `Slot ${slot + 1}`)
        const what = !known
          ? text("chưa quan sát", "not observed")
          : value.item
            ? referenceName(game.catalog, "items", value.item, text(...UNKNOWN_REFERENCE))
            : text("trống", "empty")
        return (
          <span key={slot} className="tn-slot" data-unknown={!known || undefined} title={`${place}: ${what}`}>
            {known && value.item ? (
              <ReferenceArt catalog={game.catalog} kind="items" selection={value.item} />
            ) : (
              <span aria-hidden="true">{known ? "" : "?"}</span>
            )}
            <span className="sr-only">
              {place}: {what}
            </span>
          </span>
        )
      })}
    </span>
  )
}

function Arcana({ participant, game }: { participant: Participant; game: PublishedGame }) {
  const { text } = useStreamLocale()
  return (
    <span className="tn-runes">
      {participant.arcana.entries.map((entry, index) => (
        <span key={index} title={referenceName(game.catalog, "arcana", entry.selection, text(...UNKNOWN_REFERENCE))}>
          <ReferenceArt catalog={game.catalog} kind="arcana" selection={entry.selection} />×{entry.count}
        </span>
      ))}
    </span>
  )
}

/** Enchantments by branch, the primary one first. */
function Enchantments({ participant, game }: { participant: Participant; game: PublishedGame }) {
  const { text } = useStreamLocale()
  const branches = [true, false].map((primary) => ({
    primary,
    entries: participant.enchantments.entries.filter((entry) => entry.primary === primary),
  }))
  return (
    <span className="tn-runes">
      {branches.flatMap(({ primary, entries }) =>
        entries.map((entry, index) => {
          const branch = primary ? text("Nhánh chính", "Primary branch") : text("Nhánh phụ", "Secondary branch")
          const name = referenceName(game.catalog, "enchantments", entry.selection, text(...UNKNOWN_REFERENCE))
          return (
            <span key={`${String(primary)}:${index}`} data-branch={primary || undefined} title={`${name} (${branch})`}>
              <span className="sr-only">{branch}: </span>
              <ReferenceArt catalog={game.catalog} kind="enchantments" selection={entry.selection} />
              {TIERS[entry.tier] ?? entry.tier}
            </span>
          )
        }),
      )}
    </span>
  )
}

/** What one player built, of the kind chosen. A player nothing is recorded for shows a dash. */
export function PlayerLoadout({
  game,
  participant,
  kind,
  time,
}: {
  game: PublishedGame
  participant: Participant
  kind: LoadoutKind
  time: number
}) {
  const { text } = useStreamLocale()
  if (!hasLoadout(participant, kind))
    return (
      <div className="tn-build" data-empty="">
        <span title={text("Chưa ghi nhận", "Not recorded")}>–</span>
      </div>
    )
  // A partial observation still shows what the source showed, and says that it is partial.
  const loadout = kind === "equipment" ? null : participant[kind]
  const caveat = [loadout?.status === "PARTIAL" && text(...OBSERVATION_NAMES.PARTIAL), loadout?.note]
    .filter(Boolean)
    .join(". ")
  return (
    <div className="tn-build">
      {kind === "equipment" ? (
        <Inventory participant={participant} game={game} time={time} />
      ) : kind === "arcana" ? (
        <Arcana participant={participant} game={game} />
      ) : (
        <Enchantments participant={participant} game={game} />
      )}
      {caveat && <small>{caveat}</small>}
    </div>
  )
}
