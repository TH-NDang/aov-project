import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@aov/ui/components/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import { followTrail, type PeekTarget } from "./peek-model"
import { usePeekWorld, type PeekWorld } from "./peek-world"
import { PlayerCard } from "./player-card"
import { TeamCard } from "./team-card"
import "./peek.css"

const OPEN_DELAY = 350
const CLOSE_DELAY = 180

/** The card on top of the trail, with the way back to the one under it. */
function PeekCards({
  world,
  trail,
  onTrail,
  onDone,
}: {
  world: PeekWorld
  trail: PeekTarget[]
  onTrail: (trail: PeekTarget[]) => void
  onDone: () => void
}) {
  const current = trail.at(-1)!
  const previous = trail.at(-2)
  const open = (next: PeekTarget) => onTrail(followTrail(trail, next))
  const back = previous ? () => onTrail(trail.slice(0, -1)) : undefined
  return current.kind === "team" ? (
    <TeamCard key={current.id} world={world} teamId={current.id} onOpen={open} onBack={back} onDone={onDone} />
  ) : (
    <PlayerCard key={current.id} world={world} playerId={current.id} onOpen={open} onBack={back} onDone={onDone} />
  )
}

/**
 * A team or player name of the tournament that shows their card: pointed at for a moment with a mouse, or pressed.
 * On a wide screen the card opens beside the name; on a compact one it rises from the bottom and closes when dragged
 * down or tapped outside. A card links to the other cards it names, and back.
 */
function Peek({ target, className, children }: { target: PeekTarget; className?: string; children: ReactNode }) {
  const world = usePeekWorld()
  const compact = usePageLayout() === "compact"
  const [trail, setTrail] = useState<PeekTarget[] | null>(null)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!world) return <span className={className}>{children}</span>

  const open = !!trail
  const show = (pin: boolean) => {
    clearTimeout(timer.current)
    setTrail((value) => value ?? [target])
    if (pin) setPinned(true)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setTrail(null)
    setPinned(false)
  }
  const later = (action: () => void, delay: number) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(action, delay)
  }
  const mouse = (event: { pointerType: string }) => event.pointerType === "mouse"
  const trigger = (
    <button
      type="button"
      className={cn("esp-peek-name", className)}
      data-open={open || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      onPointerEnter={(event) => !compact && mouse(event) && !open && later(() => show(false), OPEN_DELAY)}
      onPointerLeave={(event) => !compact && mouse(event) && !pinned && later(hide, CLOSE_DELAY)}
      onClick={(event) => {
        // A name inside a row that opens on a click of its own opens only the card.
        event.stopPropagation()
        if (compact) return show(true)
        // A card opened by pointing stays when the name is pressed; Radix would otherwise close it.
        event.preventDefault()
        if (open && pinned) hide()
        else show(true)
      }}
    >
      {children}
    </button>
  )
  const cards = trail && <PeekCards world={world} trail={trail} onTrail={setTrail} onDone={hide} />

  if (compact)
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={(value) => !value && hide()}>
          <DrawerContent className="esp-peek-sheet" onClick={(event) => event.stopPropagation()}>
            <DrawerTitle className="sr-only">{target.kind === "team" ? "Đội tuyển" : "Tuyển thủ"}</DrawerTitle>
            <DrawerDescription className="sr-only">Thông tin tại giải và lối sang hồ sơ</DrawerDescription>
            {cards}
          </DrawerContent>
        </Drawer>
      </>
    )
  return (
    <Popover open={open} onOpenChange={(value) => !value && hide()}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="esp-peek-popover w-[372px] max-h-(--radix-popover-content-available-height) overflow-y-auto p-0"
        onOpenAutoFocus={(event) => !pinned && event.preventDefault()}
        onPointerEnter={() => clearTimeout(timer.current)}
        onPointerLeave={(event) => mouse(event) && !pinned && later(hide, CLOSE_DELAY)}
        onClick={(event) => event.stopPropagation()}
      >
        {cards}
      </PopoverContent>
    </Popover>
  )
}

/** A team's name that opens its card in the tournament. */
export function TeamName({ id, className, children }: { id: string; className?: string; children?: ReactNode }) {
  const world = usePeekWorld()
  return (
    <Peek target={{ kind: "team", id }} className={className}>
      {children ?? world?.team(id).name}
    </Peek>
  )
}

/** A player's name that opens their card in the tournament. */
export function PlayerName({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <Peek target={{ kind: "player", id }} className={className}>
      {children}
    </Peek>
  )
}
