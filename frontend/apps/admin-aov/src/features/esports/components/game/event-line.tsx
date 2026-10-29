import { ArrowRightLeft, ChevronsRight, Flag, ShoppingBag, Skull, Sparkles, Swords, Tag } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { GameSeat, GameView } from "../../model/game-view"
import { LANE_LABELS } from "../../model/labels"
import {
  ITEM_ACTION_LABELS,
  OBJECTIVE_LABELS,
  eventSide,
  objectiveActor,
  type ItemRef,
  type ObjectiveKind,
  type SeatKey,
  type TimelineEvent,
} from "../../model/timeline"
import { HeroIcon, ItemSlot } from "../primitives"
import { seatLookup } from "./event-text"

// Original emblems generated for this project; `new URL` keeps them bundled by Vite and loadable in Node tests.
const OBJECTIVE_ART: Partial<Record<ObjectiveKind, string>> = {
  DARK_SLAYER: new URL("../../assets/objectives/dark-slayer.webp", import.meta.url).href,
  ABYSSAL_DRAGON: new URL("../../assets/objectives/abyssal-dragon.webp", import.meta.url).href,
  TURRET: new URL("../../assets/objectives/turret.webp", import.meta.url).href,
  BASE: new URL("../../assets/objectives/base.webp", import.meta.url).href,
}

export function ObjectiveIcon({ objective, size = 28 }: { objective: ObjectiveKind; size?: number }) {
  const art = OBJECTIVE_ART[objective]
  return art ? (
    <img
      src={art}
      alt={OBJECTIVE_LABELS[objective]}
      title={OBJECTIVE_LABELS[objective]}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
      style={{ width: size, height: size }}
      title={OBJECTIVE_LABELS[objective]}
    >
      <Flag size={size * 0.5} />
    </span>
  )
}

function Portrait({ seat, size, fallen }: { seat?: GameSeat; size: number; fallen?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0" data-side={seat?.side}>
      <HeroIcon
        hero={seat?.hero}
        size={size}
        title={seat ? `${seat.playerName} · ${seat.hero?.name ?? "Chưa chọn tướng"}` : "Chưa rõ"}
        className={cn("ring-2 ring-[var(--side,var(--border))]", fallen && "grayscale")}
      />
      {fallen && (
        <span
          className="absolute -right-1 -bottom-1 grid place-items-center rounded-full bg-foreground text-background ring-2 ring-background"
          style={{ width: size * 0.42, height: size * 0.42 }}
        >
          <Skull size={size * 0.26} strokeWidth={2.6} />
        </span>
      )}
    </span>
  )
}

const who = (seat?: GameSeat) => (seat ? seat.playerName : "Chưa rõ")
const hero = (seat?: GameSeat) => seat?.hero?.name ?? (seat ? LANE_LABELS[seat.lane].short : "")

/** One moment drawn like an in-game kill feed line: portraits first, names underneath. */
export function EventLine({
  event,
  game,
  itemIcon,
  itemTier,
  size = 32,
}: {
  event: TimelineEvent
  game: GameView
  itemIcon: (item: ItemRef) => string | null | undefined
  itemTier?: (item: ItemRef) => number | null | undefined
  size?: number
}) {
  const seat = seatLookup(game)
  const side = eventSide(event)
  switch (event.kind) {
    case "KILL": {
      const killer = seat(event.killer)
      const victim = seat(event.victim)
      const assists = event.assists.map((key: SeatKey) => seat(key)).filter((entry): entry is GameSeat => !!entry)
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center gap-1.5">
            <Portrait seat={killer} size={size} />
            <Swords size={14} className="text-[var(--side,var(--muted-foreground))]" data-side={side ?? undefined} />
            <Portrait seat={victim} size={size} fallen />
          </span>
          <span className="min-w-0 text-sm leading-snug">
            <span className="line-clamp-2 block">
              <strong data-side={killer?.side} className="text-[var(--side,inherit)]">
                {who(killer)}
              </strong>
              <span className="text-muted-foreground"> ({hero(killer)}) hạ </span>
              <strong data-side={victim?.side} className="text-[var(--side,inherit)]">
                {who(victim)}
              </strong>
              <span className="text-muted-foreground"> ({hero(victim)})</span>
            </span>
            {assists.length > 0 && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                Hỗ trợ
                {assists.map((assist) => (
                  <span key={assist.key} data-side={assist.side}>
                    <HeroIcon
                      hero={assist.hero}
                      size={18}
                      title={`${assist.playerName} · ${assist.hero?.name ?? ""}`}
                      className="ring-1 ring-[var(--side)]"
                    />
                  </span>
                ))}
              </span>
            )}
          </span>
        </span>
      )
    }
    case "OBJECTIVE": {
      const by = seat(event.by)
      const team = game.sides[event.side].team
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          <ObjectiveIcon objective={event.objective} size={size} />
          <span className="min-w-0 text-sm leading-snug">
            <span className="line-clamp-2 block">
              <strong data-side={event.side} className="text-[var(--side)]">
                {team.name}
              </strong>{" "}
              giành {OBJECTIVE_LABELS[event.objective].toLocaleLowerCase()}
            </span>
            {by && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {objectiveActor(event.objective)}
                <span data-side={by.side}>
                  <HeroIcon hero={by.hero} size={18} className="ring-1 ring-[var(--side)]" />
                </span>
                {who(by)}
              </span>
            )}
          </span>
        </span>
      )
    }
    case "ITEM": {
      const owner = seat(event.seat)
      const tier = event.item ? itemTier?.(event.item) : null
      const Icon = event.action === "SELL" ? Tag : event.action === "SWAP" ? ArrowRightLeft : ShoppingBag
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex shrink-0 items-center gap-1.5">
            <Portrait seat={owner} size={size} />
            <ChevronsRight size={14} className="text-muted-foreground" />
            <ItemSlot
              item={event.item ?? null}
              iconUrl={event.item ? itemIcon(event.item) : null}
              index={event.slot - 1}
              size={size}
            />
          </span>
          <span className="min-w-0 text-sm leading-snug">
            <span className="line-clamp-2 block">
              <strong data-side={owner?.side} className="text-[var(--side,inherit)]">
                {who(owner)}
              </strong>{" "}
              <span className="text-muted-foreground">{ITEM_ACTION_LABELS[event.action].toLocaleLowerCase()}</span>{" "}
              {event.item?.name ?? "trang bị"}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon size={11} /> Ô {event.slot}
              {event.toSlot ? ` → ô ${event.toSlot}` : ""}
              {tier ? <span className="rounded bg-muted px-1 font-semibold">Cấp {tier}</span> : null}
            </span>
          </span>
        </span>
      )
    }
    case "NOTE":
      return (
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid shrink-0 place-items-center rounded-full bg-[var(--esp-gold)] text-[var(--esp-ink)]"
            style={{ width: size, height: size }}
          >
            <Sparkles size={size * 0.45} />
          </span>
          <span className="min-w-0 text-sm leading-snug">
            <strong className="line-clamp-2 block">{event.title}</strong>
            <span className="text-xs text-muted-foreground">
              {event.side ? game.sides[event.side].team.name : "Khoảnh khắc đáng chú ý"}
            </span>
          </span>
        </span>
      )
  }
}
