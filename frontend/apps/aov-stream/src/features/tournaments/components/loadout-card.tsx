import type { ReactNode } from "react"
import { Link } from "react-router"
import type { Catalog, GameSide, Loadout, Participant, PublishedGame, Selection } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { enchantmentBranches, isRecorded, type BuildView, type BuiltItem } from "../../../lib/build-view"
import { laneName } from "../../../lib/feed-words"
import {
  clock,
  hasLoadout,
  OBSERVATION_NAMES,
  present,
  referenceName,
  UNKNOWN_REFERENCE,
  type CatalogKind,
} from "../../../lib/tournament-model"
import { BuildItem } from "./build-item"
import { BuildPath, EndSlots } from "./build-path"
import { heroHref, nicknameOf, SeatNames } from "./loadout-names"
import { ReferenceArt } from "./reference-art"
import "./loadout-card.css"

type Say = (vi: string, en: string) => string
type Named = { catalog: Catalog; kind: CatalogKind; selection: Selection }

const TIERS = ["", "I", "II", "III"]

/** One thing a player had: its picture, its name and a word beside it. */
function Line({ note, ...named }: Named & { note?: ReactNode }) {
  const { text } = useStreamLocale()
  return (
    <li data-kind={named.kind}>
      <ReferenceArt {...named} />
      <span>
        <b>{referenceName(named.catalog, named.kind, named.selection, text(...UNKNOWN_REFERENCE))}</b>
        {note && <small>{note}</small>}
      </span>
    </li>
  )
}

/** An item of an inventory with its name. */
function ItemLine({ catalog, built }: { catalog: Catalog; built: BuiltItem }) {
  const { text } = useStreamLocale()
  return (
    <li>
      <BuildItem catalog={catalog} built={built} />
      <span>
        <b>{referenceName(catalog, "items", built.item, text(...UNKNOWN_REFERENCE))}</b>
      </span>
    </li>
  )
}

/** The lines of one kind; `note` says how the record knows them and `caveat` what it lacks. */
function Part({
  label,
  note,
  caveat,
  whole,
  children,
}: {
  label?: string
  note?: string | null
  caveat?: (string | false | null | undefined)[]
  /** The lines take the width of the card under their name. */
  whole?: boolean
  children: ReactNode
}) {
  const said = (caveat ?? []).filter(Boolean)
  return (
    <div data-continued={!label || undefined} data-whole={whole || undefined}>
      <dt>
        {label}
        {note && <small>{note}</small>}
      </dt>
      <dd>
        {children}
        {said.length > 0 && <p>{said.join(". ")}</p>}
      </dd>
    </div>
  )
}

/** What a loadout lacks: in the words of its record, or that the source showed a part of it. */
const caveatOf = ({ status, note }: Loadout<unknown>, text: Say) =>
  note?.trim() || (status === "PARTIAL" ? text(...OBSERVATION_NAMES.PARTIAL) : null)

function Enchantments({ catalog, seat }: { catalog: Catalog; seat: Participant }) {
  const { text } = useStreamLocale()
  const branches = enchantmentBranches(seat)
  const label = text("Phù hiệu", "Enchantments")
  if (!branches.length)
    return (
      <Part label={label}>
        <p>{text("Chưa rõ", "Not known")}</p>
      </Part>
    )
  return branches.map(({ primary, entries }, at) => (
    <Part
      key={String(primary)}
      label={at === 0 ? label : undefined}
      note={primary ? text("nhánh chính", "primary branch") : text("nhánh phụ", "secondary branch")}
      caveat={at === branches.length - 1 ? [caveatOf(seat.enchantments, text)] : []}
    >
      <ul>
        {entries.map(({ selection, tier }, index) => (
          <Line key={index} catalog={catalog} kind="enchantments" selection={selection} note={TIERS[tier] ?? tier} />
        ))}
      </ul>
    </Part>
  ))
}

/** When the source showed the inventory that stands in for the items nobody wrote down. */
function inventoryNote({ atSeconds }: BuildView, duration: number | null | undefined, text: Say) {
  if (atSeconds === duration) return text("lúc ván kết thúc", "when the game ended")
  return text(`lúc ${clock(atSeconds ?? 0)}`, `at ${clock(atSeconds ?? 0)}`)
}

/**
 * The items of a player: the slots they ended with, then the path that led there. An inventory the source showed stands
 * in, with when it was shown, while nobody wrote the items down.
 */
function Items({ game, build, wide }: { game: PublishedGame; build: BuildView | null; wide: boolean }) {
  const { text } = useStreamLocale()
  const { catalog, content } = game
  if (!build)
    return (
      <Part label={text("Trang bị", "Items")}>
        <p>{text("Chưa rõ", "Not known")}</p>
      </Part>
    )
  const { end, path, unread } = build
  if (build.source === "INVENTORY")
    return (
      <Part
        label={text("Trang bị", "Items")}
        note={inventoryNote(build, content.durationSeconds, text)}
        caveat={[
          unread > 0 && text(`${unread} ô chưa rõ`, `${unread} ${unread === 1 ? "slot" : "slots"} not known`),
          build.note,
        ]}
      >
        {end.length > 0 ? (
          <ul>
            {end.map((built, index) => (
              <ItemLine key={index} catalog={catalog} built={built} />
            ))}
          </ul>
        ) : (
          !unread && <p>{text("Không có trang bị", "No items")}</p>
        )}
      </Part>
    )
  return (
    <>
      <Part label={text("Cuối ván", "End of game")}>
        {end.length > 0 ? (
          <EndSlots catalog={catalog} build={build} />
        ) : (
          <p>{text("Đã bán hết", "Everything was sold")}</p>
        )}
      </Part>
      <Part
        label={text("Lộ trình lên đồ", "Build path")}
        note={text(`${path.length} món`, `${path.length} items`)}
        whole
      >
        <BuildPath catalog={catalog} path={path} duration={content.durationSeconds} wide={wide} />
      </Part>
    </>
  )
}

/** The pages of the player and the hero, as rows large enough for a finger. */
function Doors({ game, seat, hero }: { game: PublishedGame; seat: Participant; hero: string }) {
  const { text } = useStreamLocale()
  const nickname = nicknameOf(game, seat)
  const href = heroHref(game, seat)
  return (
    <p className="tn-loadout-doors">
      {nickname && (
        <Link to={`/players/${seat.playerId}`}>
          {text(`Trang của ${nickname}`, `${nickname}'s page`)}
          <StreamIcon name="chevronRight" size={16} />
        </Link>
      )}
      {href && (
        <Link to={href}>
          {text(`${hero} ở giải này`, `${hero} in this tournament`)}
          <StreamIcon name="chevronRight" size={16} />
        </Link>
      )}
    </p>
  )
}

/**
 * Everything recorded of one player of a game: the hero, the spell, the enchantments by branch, the arcana, and the
 * items they ended with and the path that led there. `build` are the items the lineup shows at the moment.
 */
export function LoadoutCard({
  game,
  side,
  seat,
  build,
}: {
  game: PublishedGame
  side: GameSide
  seat: Participant
  build: BuildView | null
}) {
  const { text } = useStreamLocale()
  const wide = usePageLayout() === "wide"
  const { catalog } = game
  const team = game.teams[side.teamId]
  return (
    <div className="tn-loadout-card">
      <header>
        <span className="tn-loadout-face" data-side={side.side} aria-hidden="true">
          <ReferenceArt catalog={catalog} kind="heroes" selection={seat.hero} />
        </span>
        <SeatNames game={game} seat={seat} linked={wide} mvp />
        {wide && <small>{[laneName(seat.lane, text), team?.shortName || team?.name].filter(Boolean).join(", ")}</small>}
      </header>
      {build || isRecorded(seat, catalog) ? (
        <dl>
          <Part label={text("Phụ trợ", "Spell")}>
            {present(seat.spell) ? (
              <ul>
                <Line catalog={catalog} kind="spells" selection={seat.spell} />
              </ul>
            ) : (
              <p>{text("Chưa rõ", "Not known")}</p>
            )}
          </Part>
          <Enchantments catalog={catalog} seat={seat} />
          {hasLoadout(seat, "arcana") && (
            <Part label={text("Bảng ngọc", "Arcana")} caveat={[caveatOf(seat.arcana, text)]}>
              <ul>
                {seat.arcana.entries.map(({ selection, count }, index) => (
                  <Line key={index} catalog={catalog} kind="arcana" selection={selection} note={`×${count}`} />
                ))}
              </ul>
            </Part>
          )}
          <Items game={game} build={build} wide={wide} />
        </dl>
      ) : (
        <p className="tn-loadout-nothing">
          {text("Chưa ghi trang bị, phụ trợ và phù hiệu.", "Items, spell and enchantments are not recorded yet.")}
        </p>
      )}
      {!wide && (
        <Doors game={game} seat={seat} hero={referenceName(catalog, "heroes", seat.hero, text(...UNKNOWN_REFERENCE))} />
      )}
    </div>
  )
}
