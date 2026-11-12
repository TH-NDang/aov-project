import type { ReactNode } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@aov/ui/components/hover-card"
import { cn } from "@aov/ui/lib/utils"
import type { GameSeat } from "../../model/game-view"
import { LANE_LABELS } from "../../model/labels"
import {
  ARCANA_COLORS,
  STONES_PER_COLOR,
  TIER_NUMERALS,
  arcanaLabel,
  type ArcanaColor,
  type LoadoutPart,
} from "../../model/loadout"
import { HeroIcon, LaneIcon } from "../primitives"

const stoneCounts = (loadout: GameSeat["arcana"]) =>
  Object.fromEntries(
    ARCANA_COLORS.map((color) => [
      color.code,
      loadout.entries.filter((entry) => entry.color === color.code).reduce((total, entry) => total + entry.count, 0),
    ]),
  ) as Record<ArcanaColor, number>

/** A square with a question mark where nothing is recorded, so a missing loadout is seen rather than skipped. */
function EmptySlot({ round, size = 20 }: { round?: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "grid shrink-0 place-items-center border border-dashed border-muted-foreground/50 text-xs leading-none text-muted-foreground",
        round ? "rounded-full" : "rounded-[5px]",
      )}
    >
      ?
    </span>
  )
}

/**
 * The arcana page as one mark: a ring of three arcs in the stone colours, each filled as far as that colour is
 * recorded, so a whole page, a partial one and an empty one read differently at icon size.
 */
export function ArcanaRing({ counts, size = 20 }: { counts: Record<ArcanaColor, number>; size?: number }) {
  const radius = 7.5
  const around = 2 * Math.PI * radius
  const third = around / 3
  const gap = 2.6
  const arc = third - gap
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" className="shrink-0 -rotate-90">
      {ARCANA_COLORS.map((color, index) => {
        const filled = arc * Math.min(1, counts[color.code] / STONES_PER_COLOR)
        const offset = -(index * third + gap / 2)
        return (
          <g key={color.code} data-arcana={color.code} fill="none" strokeWidth={3}>
            <circle
              cx={10}
              cy={10}
              r={radius}
              stroke="currentColor"
              className="text-muted-foreground/25"
              strokeDasharray={`${arc} ${around - arc}`}
              strokeDashoffset={offset}
            />
            {filled > 0 && (
              <circle
                cx={10}
                cy={10}
                r={radius}
                stroke="var(--arcana)"
                strokeDasharray={`${filled} ${around - filled}`}
                strokeDashoffset={offset}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** The emblem set in the five slots the game shows; a slot nothing is recorded for keeps its question mark. */
export function EnchantmentCard({ loadout }: { loadout: GameSeat["enchantments"] }) {
  if (loadout.status === "NOT_SHOWN") return <p>Video không hiện phù hiệu của tuyển thủ này.</p>
  const primary = loadout.entries.filter((entry) => entry.primary)
  const secondary = loadout.entries.filter((entry) => !entry.primary)
  const slots = [
    ...[1, 2, 3].map((tier) => ({
      label: `Chính ${TIER_NUMERALS[tier - 1]}`,
      entry: primary.find((entry) => entry.level === tier),
    })),
    { label: "Phụ", entry: secondary[0] },
    { label: "Phụ", entry: secondary[1] },
  ]
  const placed = new Set(slots.map((slot) => slot.entry))
  const rows = [
    ...slots,
    ...loadout.entries
      .filter((entry) => !placed.has(entry))
      .map((entry) => ({ label: entry.primary ? "Chính" : "Phụ", entry })),
  ]
  return (
    <div className="space-y-1.5">
      <p className="font-semibold">
        Phù hiệu <span className="font-normal text-muted-foreground">· {loadout.entries.length}/5</span>
      </p>
      <ul className="space-y-1">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2" data-filled={!!row.entry || undefined}>
            <span className="w-14 shrink-0 text-muted-foreground">{row.label}</span>
            {row.entry ? (
              <>
                <HeroIcon hero={row.entry} size={22} title="" className="rounded-full" />
                <span className="font-medium">{row.entry.name}</span>
              </>
            ) : (
              <>
                <EmptySlot round size={22} />
                <span className="text-muted-foreground">Chưa ghi</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The arcana page colour by colour, with the stat each kind of stone gives and how many of it. */
export function ArcanaCard({ loadout }: { loadout: GameSeat["arcana"] }) {
  if (loadout.status === "NOT_SHOWN") return <p>Video không hiện bảng ngọc của tuyển thủ này.</p>
  const counts = stoneCounts(loadout)
  const total = loadout.entries.reduce((sum, entry) => sum + entry.count, 0)
  const loose = loadout.entries.filter((entry) => !ARCANA_COLORS.some((color) => color.code === entry.color))
  return (
    <div className="space-y-1.5">
      <p className="font-semibold">
        Bảng ngọc{" "}
        <span className="font-normal text-muted-foreground">
          · {total}/{STONES_PER_COLOR * 3} viên
        </span>
      </p>
      <ul className="space-y-1.5">
        {ARCANA_COLORS.map((color) => {
          const entries = loadout.entries.filter((entry) => entry.color === color.code)
          return (
            <li key={color.code} data-arcana={color.code} className="space-y-1">
              <p className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[var(--arcana)]" aria-hidden="true" />
                <span className="font-medium">{color.label}</span>
                <span className="esp-num text-muted-foreground">
                  {counts[color.code]}/{STONES_PER_COLOR}
                </span>
              </p>
              {entries.length ? (
                entries.map((entry, index) => (
                  <p key={index} className="flex items-center gap-2 pl-3.5">
                    <HeroIcon hero={entry} size={20} title="" className="rounded-md" />
                    <span className="esp-num w-6 text-muted-foreground">×{entry.count}</span>
                    <span>{arcanaLabel(entry.name)}</span>
                  </p>
                ))
              ) : (
                <p className="flex items-center gap-2 pl-3.5 text-muted-foreground">
                  <EmptySlot size={20} /> Chưa ghi
                </p>
              )}
            </li>
          )
        })}
        {loose.map((entry, index) => (
          <li key={`loose-${index}`} className="text-muted-foreground">
            ×{entry.count} {arcanaLabel(entry.name)} · chưa rõ màu
          </li>
        ))}
      </ul>
    </div>
  )
}

/** One icon of the row: its card on hover or focus and, while recording, a click that opens that part for editing. */
function Peek({
  label,
  card,
  onEdit,
  children,
}: {
  label: string
  card: ReactNode
  onEdit?: () => void
  children: ReactNode
}) {
  const shape = "inline-flex shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-[var(--esp-gold)]"
  return (
    <HoverCard openDelay={80} closeDelay={80}>
      <HoverCardTrigger asChild>
        {onEdit ? (
          <button
            type="button"
            aria-label={`${label}. Bấm để sửa`}
            onClick={onEdit}
            className={cn(shape, "cursor-pointer hover:ring-2 hover:ring-[var(--esp-gold)]/60")}
          >
            {children}
          </button>
        ) : (
          <span role="img" tabIndex={0} aria-label={label} className={shape}>
            {children}
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-auto max-w-72 min-w-36 p-3 text-xs">
        {card}
        {onEdit && <p className="mt-2 border-t pt-1.5 text-muted-foreground">Bấm để sửa</p>}
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * What a player took into the game, as the row of icons under their name: lane, spell, the main emblem and the
 * arcana ring. Each icon shows what is recorded on hover; while recording, the last three open the recording panel
 * on that player and part.
 */
export function SeatLoadout({ seat, onEdit }: { seat: GameSeat; onEdit?: (part: LoadoutPart) => void }) {
  const lane = LANE_LABELS[seat.lane].name
  const emblem = seat.enchantments.entries.filter((entry) => entry.primary).at(-1) ?? seat.enchantments.entries[0]
  const counts = stoneCounts(seat.arcana)
  const stones = seat.arcana.entries.reduce((sum, entry) => sum + entry.count, 0)
  const edit = (part: LoadoutPart) => (onEdit ? () => onEdit(part) : undefined)
  return (
    <span className="flex items-center gap-1.5" data-seat-loadout={seat.key}>
      <Peek label={`Đường: ${lane}`} card={<p className="font-semibold">{lane}</p>}>
        <LaneIcon lane={seat.lane} size={18} className="text-[var(--side)]" />
      </Peek>
      <Peek
        label={seat.spell ? `Phụ trợ: ${seat.spell.name}` : "Phụ trợ: chưa ghi"}
        onEdit={edit("spell")}
        card={
          <p>
            <span className="font-semibold">Phụ trợ</span>{" "}
            <span className={seat.spell ? undefined : "text-muted-foreground"}>· {seat.spell?.name ?? "chưa ghi"}</span>
          </p>
        }
      >
        {seat.spell ? (
          <HeroIcon hero={seat.spell} size={20} title="" className="rounded-[5px] ring-1 ring-[var(--esp-gold)]/70" />
        ) : (
          <EmptySlot />
        )}
      </Peek>
      <Peek
        label={
          seat.enchantments.status === "NOT_SHOWN"
            ? "Phù hiệu: video không hiện"
            : `Phù hiệu: ${seat.enchantments.entries.length} trên 5 ô`
        }
        onEdit={edit("enchantments")}
        card={<EnchantmentCard loadout={seat.enchantments} />}
      >
        {emblem ? (
          <HeroIcon hero={emblem} size={20} title="" className="rounded-full ring-1 ring-[var(--esp-gold)]/70" />
        ) : (
          <EmptySlot round />
        )}
      </Peek>
      <Peek
        label={
          seat.arcana.status === "NOT_SHOWN"
            ? "Bảng ngọc: video không hiện"
            : `Bảng ngọc: ${stones} trên ${STONES_PER_COLOR * 3} viên`
        }
        onEdit={edit("arcana")}
        card={<ArcanaCard loadout={seat.arcana} />}
      >
        <ArcanaRing counts={counts} />
      </Peek>
    </span>
  )
}
