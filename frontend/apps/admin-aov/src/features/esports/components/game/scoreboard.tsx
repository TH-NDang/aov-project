import { useMemo } from "react"
import type { Side } from "@aov/community-contracts"
import { Ban, Crown, Flag, History, TriangleAlert } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { GameView, IconRef } from "../../model/game-view"
import {
  OBJECTIVE_LABELS,
  inventoryAt,
  killScoreAt,
  objectivesAt,
  seatStatsAt,
  type ItemRef,
  type ObjectiveKind,
  type SeatKey,
  type TimelineEvent,
} from "../../model/timeline"
import { HeroIcon, ItemSlot, LaneIcon, PlayerPhoto, ResultTag, TeamLogo } from "../primitives"
import { EntityRef } from "./entity-ref"
import { heroKeys, type HeroLocks } from "../../model/series-rules"

/** Slots whose content changed in this many seconds before the playhead get a highlight. */
const RECENT_WINDOW = 20

export function Scoreboard({
  game,
  events,
  at,
  focusSeat,
  onFocusSeat,
  itemIcon,
  itemTier,
  locks,
  heroIcon,
}: {
  game: GameView
  events: TimelineEvent[]
  at: number
  focusSeat: SeatKey | null
  onFocusSeat: (seat: SeatKey | null) => void
  itemIcon: (item: ItemRef) => string | null | undefined
  itemTier?: (item: ItemRef) => number | null | undefined
  /** Heroes each team already played earlier in the series, shown from game 2 on. */
  locks?: HeroLocks
  heroIcon?: (hero: { id?: string | null; name: string }) => string | null | undefined
}) {
  const stats = useMemo(() => seatStatsAt(events, at), [events, at])
  const objectives = useMemo(() => objectivesAt(events, at), [events, at])
  const score = useMemo(() => killScoreAt(events, at), [events, at])

  const side = (code: Side) => {
    const view = game.sides[code]
    const taken = Object.entries(objectives[code]) as [ObjectiveKind, number][]
    const used = locks?.byTeam.get(view.team.id) ?? []
    const usedIn = new Map(used.flatMap((use) => heroKeys(use.hero).map((key) => [key, use.gameNumber] as const)))
    return (
      <section key={code} data-side={code} className="@container min-w-0 overflow-hidden rounded-xl border bg-card">
        <header className="flex items-center gap-2.5 border-b bg-[var(--side-soft)] px-3 py-2">
          <span className="h-6 w-1 rounded-full bg-[var(--side)]" aria-hidden="true" />
          <TeamLogo team={view.team} size={28} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {view.team.name}
              {game.winner === code && (
                <Crown size={14} className="shrink-0 text-[var(--esp-gold)]" aria-hidden="true" />
              )}
              {game.winner && <ResultTag won={game.winner === code} />}
            </span>
            <span className="flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
              {code === "BLUE" ? "Đội Xanh" : "Đội Đỏ"}
              {taken.map(([kind, count]) => (
                <span key={kind} className="inline-flex items-center gap-0.5">
                  <Flag size={10} /> {OBJECTIVE_LABELS[kind]} ×{count}
                </span>
              ))}
            </span>
          </span>
          {/* Bans sit with the team that made them; picks are the rows below. */}
          <span className="hidden items-center gap-1 @sm:flex" aria-label={`Cấm của ${view.team.name}`}>
            <BanLabel />
            {view.bans.map((ban, index) => (
              <EntityRef key={index} kind="hero" entity={ban}>
                <BannedHero hero={ban} />
              </EntityRef>
            ))}
          </span>
          <span className="esp-num text-2xl font-black text-[var(--side)]" aria-label={`${score[code]} hạ gục`}>
            {score[code]}
          </span>
        </header>
        {view.bans.length > 0 && (
          <div
            className="flex items-center gap-1 border-b px-3 py-1.5 @sm:hidden"
            aria-label={`Cấm của ${view.team.name}`}
          >
            <BanLabel />
            {view.bans.map((ban, index) => (
              <EntityRef key={index} kind="hero" entity={ban}>
                <BannedHero hero={ban} />
              </EntityRef>
            ))}
          </div>
        )}
        {used.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1 border-b px-3 py-1.5"
            aria-label={`Tướng ${view.team.name} đã dùng ở ván trước`}
          >
            <span
              className="mr-0.5 inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase"
              title="Không được chọn lại trong loạt BO này"
            >
              <History size={10} strokeWidth={2.6} /> Đã dùng
            </span>
            {used.map((use, index) => (
              <EntityRef
                key={index}
                kind="hero"
                entity={{ id: use.hero.id, name: use.hero.name, iconUrl: heroIcon?.(use.hero) }}
              >
                <span className="relative inline-flex">
                  <HeroIcon
                    hero={{ id: use.hero.id, name: use.hero.name, iconUrl: heroIcon?.(use.hero) }}
                    size={22}
                    className="rounded-md opacity-50 grayscale"
                  />
                  <span className="absolute -right-1 -bottom-1 rounded bg-muted px-0.5 text-[8px] font-bold ring-1 ring-card">
                    V{use.gameNumber}
                  </span>
                </span>
              </EntityRef>
            ))}
          </div>
        )}
        <ul className="divide-y">
          {view.seats.map((seat) => {
            const kda = stats.get(seat.key) ?? { kills: 0, deaths: 0, assists: 0 }
            const slots = inventoryAt(seat.key, at, game.snapshots[seat.key] ?? [], events)
            const before = inventoryAt(
              seat.key,
              Math.max(-1, at - RECENT_WINDOW),
              game.snapshots[seat.key] ?? [],
              events,
            )
            const focused = focusSeat === seat.key
            const reused = heroKeys(seat.hero)
              .map((key) => usedIn.get(key))
              .find((number) => number != null)
            return (
              <li
                key={seat.key}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 px-3 py-2 transition @md:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
                  focused ? "bg-[var(--side-soft)]" : "hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1">
                  <EntityRef kind="hero" entity={seat.hero}>
                    <HeroIcon hero={seat.hero} size={40} className="ring-2 ring-[var(--side)]" />
                  </EntityRef>
                  {/* Loadout column like the in-game scoreboard: spell on top, main emblem below. */}
                  <span className="flex flex-col gap-0.5">
                    <LoadoutSlot kind="spell" entity={seat.spell} empty="Chưa ghi phụ trợ" />
                    <LoadoutSlot
                      kind="enchantment"
                      entity={seat.enchantments.entries.filter((entry) => entry.primary).at(-1)}
                      round
                      empty={
                        seat.enchantments.status === "NOT_SHOWN" ? "Nguồn không hiển thị phù hiệu" : "Chưa ghi phù hiệu"
                      }
                    />
                  </span>
                </span>
                <button
                  type="button"
                  aria-pressed={focused}
                  onClick={() => onFocusSeat(focused ? null : seat.key)}
                  className="min-w-0 text-left"
                  title="Lọc diễn biến theo tuyển thủ này"
                >
                  <span className="flex items-center gap-1.5">
                    {seat.photoUrl && <PlayerPhoto name={seat.playerName} url={seat.photoUrl} size={16} />}
                    <span className="truncate text-sm font-semibold">{seat.playerName}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <LaneIcon lane={seat.lane} size={14} className="text-[var(--side)]" />{" "}
                    {seat.hero?.name ?? "Chưa chọn tướng"}
                    {reused != null && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                        title="Theo luật BO, đội không được chọn lại tướng đã dùng ở ván trước"
                      >
                        <TriangleAlert size={10} /> đã dùng ở V{reused}
                      </span>
                    )}
                  </span>
                </button>
                <span className="flex items-center gap-2">
                  <span className="esp-num text-right text-sm font-semibold" aria-label="Hạ / chết / hỗ trợ">
                    {kda.kills}/<span className="text-[var(--esp-loss)]">{kda.deaths}</span>/{kda.assists}
                  </span>
                </span>
                <span className="col-span-3 flex gap-1 @md:col-span-1">
                  {slots.map((item, index) =>
                    item ? (
                      <EntityRef
                        key={index}
                        kind="item"
                        entity={{ ...item, iconUrl: itemIcon(item), tier: itemTier?.(item) }}
                      >
                        <ItemSlot
                          index={index}
                          item={item}
                          iconUrl={itemIcon(item)}
                          size={28}
                          changed={JSON.stringify(item) !== JSON.stringify(before[index])}
                        />
                      </EntityRef>
                    ) : (
                      <ItemSlot key={index} index={index} item={item} size={28} />
                    ),
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return <div className="grid gap-3 @5xl:grid-cols-2">{(["BLUE", "RED"] as const).map(side)}</div>
}

/** One square of the loadout column; an empty dashed square keeps unknown loadouts visible instead of hidden. */
function LoadoutSlot({
  kind,
  entity,
  empty,
  round,
}: {
  kind: "spell" | "enchantment"
  entity: IconRef | null | undefined
  empty: string
  round?: boolean
}) {
  const shape = round ? "rounded-full" : "rounded-[5px]"
  if (!entity)
    return (
      <span
        className={cn("block size-[19px] border border-dashed border-muted-foreground/40", shape)}
        title={empty}
        aria-label={empty}
        role="img"
      />
    )
  return (
    <EntityRef kind={kind} entity={entity}>
      <HeroIcon hero={entity} size={19} className={cn("ring-1 ring-[var(--esp-gold)]/70", shape)} />
    </EntityRef>
  )
}

function BanLabel() {
  return (
    <span className="mr-0.5 inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
      <Ban size={10} strokeWidth={2.6} /> Cấm
    </span>
  )
}

/** Faded portrait with a small ban badge, so a ban never reads as a pick. */
function BannedHero({ hero }: { hero: IconRef | null }) {
  return (
    <span className="relative inline-flex">
      <HeroIcon hero={hero} size={22} className="rounded-md opacity-45 grayscale-[0.6]" />
      <span className="absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-muted-foreground text-background ring-1 ring-card">
        <Ban size={8} strokeWidth={3} />
      </span>
    </span>
  )
}
