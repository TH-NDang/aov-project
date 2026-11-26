import type { GameSide, Participant, PublishedGame } from "@aov/community-contracts"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { isRecorded, shownBuild } from "../../../lib/build-view"
import { loadoutWords } from "../../../lib/build-words"
import { laneName } from "../../../lib/feed-words"
import { referenceName, UNKNOWN_REFERENCE } from "../../../lib/tournament-model"
import { LoadoutCard } from "./loadout-card"
import { isMvp, nicknameOf, SeatNames } from "./loadout-names"
import { LoadoutItems, LoadoutKit } from "./player-loadout"
import { ReferenceArt } from "./reference-art"
import "./loadout-seat.css"

/** What the card of a seat keeps clear of: the edges of the window and, at its top, the bars of the app. */
const ROOM = { top: 116, right: 16, bottom: 16, left: 16 }

/** What a lineup has to show of its seats: items, the spell and the enchantment alone, or the heroes alone. */
export type Shown = "ITEMS" | "KIT" | "HEROES"

/**
 * One player of a lane: the hero, who played it, the spell, the main enchantment and the items. The seat opens all that
 * is recorded of the player; its names are links of their own where there is room to press them apart. `at` is the
 * second of the game whose inventory is shown instead of the build.
 */
export function LoadoutSeat({
  game,
  side,
  seat,
  slot,
  shown,
  kit,
  board,
  told,
  at,
}: {
  game: PublishedGame
  side: GameSide
  seat: Participant | undefined
  slot: "a" | "b"
  shown: Shown
  /** Some spell or enchantment of the game is known, so every seat keeps a place for both. */
  kit: boolean
  /** The two sides stand above each other, a column for each lane. */
  board: boolean
  /** The head of the side says that none of its players is known. */
  told: boolean
  at: number | null
}) {
  const { text } = useStreamLocale()
  const wide = usePageLayout() === "wide"
  const place = {
    "data-slot": slot,
    "data-shown": shown,
    "data-kitless": !kit || undefined,
    "data-board": board || undefined,
  }
  if (!seat) return <div className="tn-loadout-seat" {...place} />
  const { catalog } = game
  const build = shownBuild(seat, catalog, at)
  const hero = referenceName(catalog, "heroes", seat.hero, text(...UNKNOWN_REFERENCE))
  const nickname = nicknameOf(game, seat)
  const who = nickname
    ? text(`${nickname} chơi ${hero}`, `${nickname} playing ${hero}`)
    : told
      ? hero
      : text(`${hero}, chưa rõ tuyển thủ`, `${hero}, player not known`)
  const mvp = isMvp(game, seat)
  const team = game.teams[side.teamId]
  const face = (
    <>
      <span className="tn-loadout-art">
        <span aria-hidden="true">
          <ReferenceArt catalog={catalog} kind="heroes" selection={seat.hero} />
        </span>
        {mvp && (
          <span className="tn-loadout-star" title={text("MVP ván", "Game MVP")}>
            <StreamIcon name="spark" size={13} />
            <span className="sr-only">MVP</span>
          </span>
        )}
      </span>
      {kit && <LoadoutKit catalog={catalog} seat={seat} />}
      {shown === "ITEMS" && <LoadoutItems catalog={catalog} build={build} />}
    </>
  )
  return (
    <div className="tn-loadout-seat" {...place} data-side={side.side}>
      {!wide || isRecorded(seat, catalog) || build ? (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="tn-loadout-open">
              <span className="sr-only">
                {[mvp ? `${who}, MVP.` : `${who}.`, loadoutWords(seat, catalog, build, text)].join(" ")}
              </span>
              <span className="tn-loadout-parts" aria-hidden="true">
                {face}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="hub-popover tn-loadout-panel"
            drawerTitle={[laneName(seat.lane, text), team?.shortName || team?.name].filter(Boolean).join(", ")}
            aria-label={who}
            side={slot === "a" ? "right" : "left"}
            align="start"
            sideOffset={14}
            collisionPadding={ROOM}
          >
            <LoadoutCard game={game} side={side} seat={seat} build={build} />
          </PopoverContent>
        </Popover>
      ) : (
        <div className="tn-loadout-open">{face}</div>
      )}
      {/* The button has said the names already where they are no links. */}
      <div className="tn-loadout-who" aria-hidden={!wide || undefined}>
        <SeatNames game={game} seat={seat} linked={wide} told={told} />
      </div>
    </div>
  )
}
