import { useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react"
import type { Selection } from "@aov/community-contracts"
import { TriangleAlert } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { Popover, PopoverAnchor, PopoverContent } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import { NativeSelect } from "@/components/native-select"
import { LANE_LABELS } from "@/lib/lanes"
import { initials, type GameSeat, type IconRef } from "../../model/game-view"
import type { ItemLookups } from "../../model/item-lookups"
import { rosterOptionLabel, type RosterOption } from "../../model/line-up"
import { ARCANA_COLORS, STONES_PER_COLOR, type LoadoutPart } from "../../model/loadout"
import { heroKeys } from "../../model/series-rules"
import type { SeatStats, SlotState } from "../../model/timeline"
import { HeroIcon } from "../primitives"
import { useMouseList } from "../series/mouse-list"
import { EntityRef, type RefKind } from "./entity-ref"
import { ArcanaCard, ArcanaRing, EnchantmentCard, stoneCounts } from "./loadout-summary"

/**
 * Makes every press on a picture its own, before the Wiki card around it can take it. The card itself is drawn elsewhere
 * on the page, so presses inside it are left alone. Enter presses what has the focus; Space does once the keyboard
 * reached it, otherwise it plays the video.
 */
function pressing(act: () => void) {
  const take = (event: SyntheticEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    act()
  }
  const own = (event: SyntheticEvent<HTMLElement>) =>
    event.target instanceof Node && event.currentTarget.contains(event.target)
  return {
    onClickCapture: (event: SyntheticEvent<HTMLElement>) => {
      if (own(event)) take(event)
    },
    onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => {
      if (!own(event)) return
      const reached = document.activeElement?.matches(":focus-visible")
      if (event.key === "Enter" || (event.key === " " && reached)) take(event)
    },
  }
}

/**
 * A picture with its Wiki card on hover. While recording, a press opens the part for editing instead of the card, which
 * takes every press for itself; what is not recorded yet has no card and is a plain button.
 */
function Openable({
  kind,
  entity,
  label,
  onOpen,
  children,
}: {
  kind: RefKind
  entity: IconRef | null
  label: string
  onOpen?: () => void
  children: ReactNode
}) {
  const card = (
    <EntityRef kind={kind} entity={entity}>
      {children}
    </EntityRef>
  )
  if (!onOpen) return card
  if (!entity)
    return (
      <button type="button" className="esp-seat-open" aria-label={label} title={label} onClick={onOpen}>
        {children}
      </button>
    )
  return (
    <span className="contents" {...pressing(onOpen)}>
      {card}
    </span>
  )
}

/** A picture that shows what is recorded of a part on hover; while recording, a press opens that part. */
function Peek({
  label,
  card,
  onOpen,
  children,
}: {
  label: string
  card: ReactNode
  onOpen?: () => void
  children: ReactNode
}) {
  return (
    <HoverCard openDelay={80} closeDelay={80}>
      <HoverCardTrigger asChild>
        {onOpen ? (
          <button type="button" className="esp-seat-open" aria-label={`${label}. Bấm để sửa`} onClick={onOpen}>
            {children}
          </button>
        ) : (
          <span role="img" tabIndex={0} aria-label={label} className="esp-seat-open">
            {children}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-72 min-w-36 p-3 text-xs">
        {card}
      </HoverCardContent>
    </HoverCard>
  )
}

/** The hero of a seat; while recording a press offers the team's picks, and taking a teammate's swaps the two. */
function SeatFace({
  seat,
  picks,
  warning,
  onSwap,
}: {
  seat: GameSeat
  picks: IconRef[]
  warning: string | null
  onSwap?: (hero: Selection) => void
}) {
  const [open, setOpen] = useState(false)
  const own = new Set(heroKeys(seat.hero))
  const lane = LANE_LABELS[seat.lane].name
  const face = (
    <>
      <EntityRef kind="hero" entity={seat.hero}>
        <HeroIcon hero={seat.hero} size={46} title="" className="rounded-md ring-2 ring-[var(--side)]" />
      </EntityRef>
      {warning && (
        <span className="esp-seat-warn" role="img" aria-label={warning} title={warning}>
          <TriangleAlert size={14} aria-hidden />
        </span>
      )}
    </>
  )
  if (!onSwap || !picks.length) return <span className="esp-seat-face">{face}</span>
  // A seat without its hero has no card to carry the focus.
  const empty = { role: "button", tabIndex: 0, "aria-label": `Chọn tướng ${lane}` } as const
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span
          className="esp-seat-face"
          data-swap
          title="Hoán đổi tướng"
          {...pressing(() => setOpen(true))}
          {...(seat.hero ? {} : empty)}
        >
          {face}
        </span>
      </PopoverAnchor>
      <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw-1.5rem)] p-2">
        <div className="esp-seat-picks" role="listbox" aria-label={`Hoán đổi tướng ${lane}`}>
          {picks.map((hero) => (
            <button
              key={heroKeys(hero)[0]}
              type="button"
              role="option"
              className="esp-seat-pick"
              aria-selected={heroKeys(hero).some((key) => own.has(key))}
              onClick={() => {
                setOpen(false)
                if (!heroKeys(hero).some((key) => own.has(key))) onSwap({ id: hero.id, name: hero.name })
              }}
            >
              <HeroIcon hero={hero} size={40} title="" className="rounded-md" />
              <span>{hero.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const NO_ROSTER = "Chưa có đội hình đăng ký ở giải"

/** Who plays the seat: a list of the team's players while recording, those registered for the lane first. */
function SeatPlayer({
  seat,
  team,
  members,
  onPlayer,
}: {
  seat: GameSeat
  team: string
  members: RosterOption[]
  onPlayer?: (playerId: string | null) => void
}) {
  const list = useMouseList()
  // The lane mark stands at the inner end of the names.
  const inner = seat.side === "BLUE" ? "pr-2.5 pl-0" : "pr-0 pl-2.5"
  if (!onPlayer)
    return (
      <span className={cn("esp-seat-name", inner, !seat.playerId && "text-muted-foreground")} title={seat.playerName}>
        {seat.playerName}
      </span>
    )
  const ordered = [...members].sort((a, b) => Number(b.lane === seat.lane) - Number(a.lane === seat.lane))
  return (
    <NativeSelect
      aria-label={`Tuyển thủ ${LANE_LABELS[seat.lane].name} của ${team}`}
      title={members.length ? undefined : NO_ROSTER}
      value={seat.playerId ?? ""}
      {...list.handlers}
      onChange={(event) => {
        onPlayer(event.target.value || null)
        if (list.byMouse()) event.currentTarget.blur()
      }}
      className={cn(
        "esp-seat-name h-6 w-full rounded-sm border-0 bg-transparent font-semibold shadow-none dark:bg-transparent",
        inner,
        !seat.playerId && "text-(--aov-warning)",
      )}
    >
      {/* A list with nobody in it says why. */}
      <option value="">{seat.playerId ? "Chưa rõ tuyển thủ" : members.length ? "Ghi tuyển thủ" : NO_ROSTER}</option>
      {seat.playerId && !members.some((member) => member.id === seat.playerId) && (
        <option value={seat.playerId}>{seat.playerName}</option>
      )}
      {ordered.map((member) => (
        <option key={member.id} value={member.id}>
          {rosterOptionLabel(member, seat.lane)}
        </option>
      ))}
    </NativeSelect>
  )
}

/** Spell, main emblem and arcana page. */
function SeatLoadout({ seat, onPart }: { seat: GameSeat; onPart?: (part: LoadoutPart) => void }) {
  const emblem = seat.enchantments.entries.filter((entry) => entry.primary).at(-1) ?? seat.enchantments.entries[0]
  const total = seat.arcana.entries.reduce((sum, entry) => sum + entry.count, 0)
  const open = (part: LoadoutPart) => onPart && (() => onPart(part))
  return (
    <>
      <Openable kind="spell" entity={seat.spell} label={`Ghi phụ trợ của ${seat.playerName}`} onOpen={open("spell")}>
        {seat.spell ? (
          <HeroIcon hero={seat.spell} size={22} title="" className="rounded-md" />
        ) : (
          <span className="esp-seat-empty" role="img" aria-label="Phụ trợ: chưa ghi" />
        )}
      </Openable>
      <Peek
        label={
          seat.enchantments.status === "NOT_SHOWN"
            ? "Phù hiệu: video không hiện"
            : `Phù hiệu: ${seat.enchantments.entries.length} trên 5 ô`
        }
        card={<EnchantmentCard loadout={seat.enchantments} />}
        onOpen={open("enchantments")}
      >
        {emblem ? (
          <HeroIcon hero={emblem} size={22} title="" className="rounded-full" />
        ) : (
          <span className="esp-seat-empty" data-round />
        )}
      </Peek>
      <Peek
        label={
          seat.arcana.status === "NOT_SHOWN"
            ? "Bảng ngọc: video không hiện"
            : `Bảng ngọc: ${total} trên ${STONES_PER_COLOR * ARCANA_COLORS.length} viên`
        }
        card={<ArcanaCard loadout={seat.arcana} />}
        onOpen={open("arcana")}
      >
        <ArcanaRing counts={stoneCounts(seat.arcana)} size={22} />
      </Peek>
    </>
  )
}

function SeatItem({
  item,
  before,
  index,
  seat,
  lookups,
  onOpen,
}: {
  item: SlotState
  before: SlotState
  index: number
  seat: GameSeat
  lookups: ItemLookups
  onOpen?: () => void
}) {
  const state = item === undefined ? "unknown" : item === null ? "empty" : "filled"
  const label =
    state === "unknown" ? `Ô ${index + 1}: chưa quan sát` : state === "empty" ? `Ô ${index + 1}: trống` : item!.name
  const icon = item ? lookups.itemIcon(item) : null
  const changed = !!item && JSON.stringify(item) !== JSON.stringify(before)
  return (
    <Openable
      kind="item"
      entity={item ? { ...item, iconUrl: icon, tier: lookups.itemTier(item) } : null}
      label={`Ghi trang bị của ${seat.playerName}`}
      onOpen={onOpen}
    >
      <span
        className="esp-seat-item"
        role="img"
        aria-label={label}
        title={label}
        data-state={state}
        data-changed={changed || undefined}
      >
        {icon ? <img src={icon} alt="" loading="lazy" /> : item ? initials(item.name).slice(0, 2) : null}
      </span>
    </Openable>
  )
}

/** One player of the game: who, on which hero, with what they took into it and the items held at the second on screen. */
export function LineupSeat({
  seat,
  team,
  slots,
  before,
  stats,
  lookups,
  members,
  picks,
  warning,
  onSwap,
  onPlayer,
  onPart,
}: {
  seat: GameSeat
  team: string
  slots: SlotState[]
  /** The slots a little earlier; what differs was just bought. */
  before: SlotState[]
  /** Absent while no kill of the game is recorded. */
  stats?: SeatStats
  lookups: ItemLookups
  members: RosterOption[]
  /** Heroes the team picked. */
  picks: IconRef[]
  /** Why the hero should not have been picked. */
  warning: string | null
  onSwap?: (hero: Selection) => void
  onPlayer?: (playerId: string | null) => void
  onPart?: (part: LoadoutPart) => void
}) {
  return (
    <div className="esp-seat" data-side={seat.side} data-seat={seat.key}>
      <SeatFace seat={seat} picks={picks} warning={warning} onSwap={onSwap} />
      <div className="esp-seat-who">
        <SeatPlayer seat={seat} team={team} members={members} onPlayer={onPlayer} />
        <span className="esp-seat-took">
          <SeatLoadout seat={seat} onPart={onPart} />
          {stats && (
            <span className="esp-seat-kda" aria-label="Hạ, chết, hỗ trợ">
              {stats.kills}/{stats.deaths}/{stats.assists}
            </span>
          )}
        </span>
      </div>
      <div className="esp-seat-items">
        {slots.map((item, index) => (
          <SeatItem
            key={index}
            item={item}
            before={before[index]}
            index={index}
            seat={seat}
            lookups={lookups}
            onOpen={onPart && (() => onPart("equipment"))}
          />
        ))}
      </div>
    </div>
  )
}
