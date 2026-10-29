import type { Side } from "@aov/community-contracts"
import { ChevronRight, ShoppingBag, Skull, Sparkles, Swords } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { GameView, IconRef } from "../../model/game-view"
import { leadEvent, type EventCluster } from "../../model/timeline"
import { HeroIcon, TeamLogo } from "../primitives"
import type { ItemLookups } from "./cluster-card"
import { ObjectiveIcon } from "./event-line"
import { seatLookup } from "./event-text"

function Face({ hero, side, fallen }: { hero?: IconRef | null; side?: Side; fallen?: boolean }) {
  return (
    <span className="relative inline-flex" data-side={side}>
      <HeroIcon hero={hero} size={22} className={cn("rounded-md ring-1 ring-[var(--side)]", fallen && "grayscale")} />
      {fallen && (
        <span className="absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-foreground text-background">
          <Skull size={8} strokeWidth={2.6} />
        </span>
      )}
    </span>
  )
}

/**
 * Readable without hovering: killer ⚔ victim, hero › finished item, finisher (or team) › objective emblem.
 */
export function MarkerPill({
  cluster,
  game,
  lookups,
}: {
  cluster: EventCluster
  game: GameView
  lookups: ItemLookups
}) {
  const lead = leadEvent(cluster)
  const seat = seatLookup(game)
  switch (lead.kind) {
    case "KILL": {
      const killer = seat(lead.killer)
      const victim = seat(lead.victim)
      return (
        <>
          <Face hero={killer?.hero} side={killer?.side} />
          <Swords size={11} strokeWidth={2.6} className="text-[var(--side)]" />
          <Face hero={victim?.hero} side={victim?.side} fallen />
        </>
      )
    }
    case "ITEM": {
      const owner = seat(lead.seat)
      const icon = lead.item ? lookups.itemIcon(lead.item) : null
      return (
        <>
          <Face hero={owner?.hero} side={owner?.side} />
          <ChevronRight size={11} strokeWidth={2.6} className="text-muted-foreground" />
          {icon ? (
            <img src={icon} alt="" className="size-[22px] rounded-md object-cover ring-1 ring-[var(--esp-gold)]" />
          ) : (
            <ShoppingBag size={14} />
          )}
        </>
      )
    }
    case "OBJECTIVE": {
      const by = seat(lead.by)
      return (
        <>
          {by ? (
            <Face hero={by.hero} side={by.side} />
          ) : (
            <TeamLogo team={game.sides[lead.side].team} size={22} className="rounded-md" />
          )}
          <ChevronRight size={11} strokeWidth={2.6} className="text-muted-foreground" />
          <ObjectiveIcon objective={lead.objective} size={24} />
        </>
      )
    }
    case "NOTE":
      return <Sparkles size={14} className="mx-1 text-[var(--esp-gold-text)]" />
  }
}
