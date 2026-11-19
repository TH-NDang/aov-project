import type { ObjectiveKind, Side } from "@aov/community-contracts"
import { useMemo } from "react"
import { Ban, Crown, Flag, History, PackagePlus, TriangleAlert, UserPlus } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { GameView, IconRef } from "../../model/game-view"
import {
  OBJECTIVE_LABELS,
  inventoryAt,
  killScoreAt,
  objectivesAt,
  seatStatsAt,
  type ItemRef,
  type SeatKey,
  type TimelineEvent,
} from "../../model/timeline"
import { HeroIcon, ItemSlot, PlayerPhoto, ResultTag, TeamLogo } from "../primitives"
import { EntityRef } from "./entity-ref"
import { SeatLoadout } from "./loadout-summary"
import type { LoadoutPart } from "../../model/loadout"
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
  onEditLoadout,
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
  /** While recording: opens the recording panel on this seat's player, spell, emblems, arcana or equipment. */
  onEditLoadout?: (seat: SeatKey, part: LoadoutPart) => void
}) {
  const stats = useMemo(() => seatStatsAt(events, at), [events, at])
  const objectives = useMemo(() => objectivesAt(events, at), [events, at])
  const score = useMemo(() => killScoreAt(events, at), [events, at])

  const side = (code: Side) => {
    const view = game.sides[code]
    // Side by side, the red panel is the blue one in a mirror: portraits on the outer edges, scores facing each
    // other in the middle. Stacked on a narrow screen both read the same way. `on` adds a class in the mirror only.
    const mirror = code === "RED"
    const on = (classes: string) => (mirror ? classes : undefined)
    const taken = Object.entries(objectives[code]) as [ObjectiveKind, number][]
    const used = locks?.byTeam.get(view.team.id) ?? []
    const usedIn = new Map(used.flatMap((use) => heroKeys(use.hero).map((key) => [key, use.gameNumber] as const)))
    return (
      <section key={code} data-side={code} className="@container min-w-0 overflow-hidden admin-panel">
        <header
          className={cn(
            "flex items-center gap-2.5 border-b bg-[var(--side-soft)] px-3 py-2",
            on("@5xl/board:flex-row-reverse"),
          )}
        >
          <span className="h-6 w-1 rounded-full bg-[var(--side)]" aria-hidden="true" />
          <TeamLogo team={view.team} size={28} />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "flex items-center gap-1.5 truncate text-sm font-semibold",
                on("@5xl/board:flex-row-reverse"),
              )}
            >
              {view.team.name}
              {game.winner === code && (
                <Crown size={14} className="shrink-0 text-[var(--esp-gold)]" aria-hidden="true" />
              )}
              {game.winner && <ResultTag won={game.winner === code} />}
            </span>
            <span
              className={cn("flex flex-wrap gap-x-2 text-xs text-muted-foreground", on("@5xl/board:flex-row-reverse"))}
            >
              {code === "BLUE" ? "Đội Xanh" : "Đội Đỏ"}
              {taken.map(([kind, count]) => (
                <span key={kind} className="inline-flex items-center gap-0.5">
                  <Flag size={10} /> {OBJECTIVE_LABELS[kind]} ×{count}
                </span>
              ))}
            </span>
          </span>
          {/* Bans sit with the team that made them; picks are the rows below. */}
          <span
            className={cn("hidden items-center gap-1 @sm:flex", on("@5xl/board:flex-row-reverse"))}
            aria-label={`Cấm của ${view.team.name}`}
          >
            <BanLabel />
            {view.bans.map((ban, index) => (
              <EntityRef key={index} kind="hero" entity={ban}>
                <BannedHero hero={ban} />
              </EntityRef>
            ))}
          </span>
          <span className="esp-num text-2xl font-bold text-[var(--side)]" aria-label={`${score[code]} hạ gục`}>
            {score[code]}
          </span>
        </header>
        {view.bans.length > 0 && (
          <div
            className={cn("flex items-center gap-1 border-b px-3 py-1.5 @sm:hidden", on("@5xl/board:flex-row-reverse"))}
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
            className={cn("flex flex-wrap items-center gap-1 border-b px-3 py-1.5", on("@5xl/board:flex-row-reverse"))}
            aria-label={`Tướng ${view.team.name} đã dùng ở ván trước`}
          >
            <span
              className="mr-0.5 inline-flex items-center gap-0.5 rounded bg-muted px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase"
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
                  <span className="absolute -right-1 -bottom-1 rounded bg-muted px-0.5 text-xs leading-none font-bold ring-1 ring-card">
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
                  // A right-to-left grid lays the same columns out in mirror order; each cell reads left to right again.
                  on("@5xl/board:[direction:rtl]"),
                  focused ? "bg-[var(--side-soft)]" : "hover:bg-muted/50",
                )}
              >
                <EntityRef kind="hero" entity={seat.hero}>
                  <HeroIcon hero={seat.hero} size={40} className="ring-2 ring-[var(--side)]" />
                </EntityRef>
                {/* The name leads; the hero is the portrait beside it, whose card names it. */}
                <span className={cn("min-w-0 space-y-1", on("@5xl/board:[direction:ltr]"))}>
                  {!seat.playerId && onEditLoadout ? (
                    // While recording, an empty seat asks for its player and opens the picker in one click.
                    <button
                      type="button"
                      onClick={() => onEditLoadout(seat.key, "player")}
                      className={cn(
                        "flex max-w-full items-center gap-1 rounded-md border border-dashed border-(--aov-warning) px-1.5 py-0.5 text-left text-xs font-semibold text-(--aov-warning) hover:bg-(--aov-warning)/10",
                        on("@5xl/board:ml-auto @5xl/board:flex-row-reverse"),
                      )}
                      title="Chọn tuyển thủ chơi vị trí này"
                    >
                      <UserPlus size={13} aria-hidden="true" /> Ghi tuyển thủ
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-pressed={focused}
                      onClick={() => onFocusSeat(focused ? null : seat.key)}
                      className={cn(
                        "flex max-w-full items-center gap-1.5 text-left",
                        on("@5xl/board:ml-auto @5xl/board:flex-row-reverse @5xl/board:text-right"),
                      )}
                      title="Lọc diễn biến theo tuyển thủ này"
                    >
                      {seat.photoUrl && <PlayerPhoto name={seat.playerName} url={seat.photoUrl} size={16} />}
                      <span className="truncate text-sm font-semibold">{seat.playerName}</span>
                    </button>
                  )}
                  <span
                    className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", on("@5xl/board:flex-row-reverse"))}
                  >
                    <SeatLoadout
                      seat={seat}
                      className={on("@5xl/board:flex-row-reverse")}
                      onEdit={onEditLoadout ? (part) => onEditLoadout(seat.key, part) : undefined}
                    />
                    {reused != null && (
                      <span
                        className="inline-flex items-center gap-0.5 text-xs font-semibold text-(--aov-warning)"
                        title="Theo luật BO, đội không được chọn lại tướng đã dùng ở ván trước"
                      >
                        <TriangleAlert size={10} /> đã dùng ở V{reused}
                      </span>
                    )}
                  </span>
                </span>
                <span className={cn("flex items-center gap-2", on("@5xl/board:[direction:ltr]"))}>
                  <span className="esp-num text-right text-sm font-semibold" aria-label="Hạ / chết / hỗ trợ">
                    {kda.kills}/<span className="text-[var(--esp-loss)]">{kda.deaths}</span>/{kda.assists}
                  </span>
                </span>
                <span
                  className={cn(
                    "col-span-3 flex gap-1 @md:col-span-1",
                    on("@5xl/board:flex-row-reverse @5xl/board:[direction:ltr]"),
                  )}
                >
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
                  {onEditLoadout && (
                    // The six slots read what is recorded; this button beside them opens equipment recording.
                    <button
                      type="button"
                      onClick={() => onEditLoadout(seat.key, "equipment")}
                      className="grid size-7 shrink-0 place-items-center rounded-md border border-dashed text-muted-foreground hover:border-[var(--side)] hover:text-foreground"
                      title={`Ghi trang bị của ${seat.playerId ? seat.playerName : "vị trí này"} lúc này`}
                      aria-label={`Ghi trang bị của ${seat.playerId ? seat.playerName : "vị trí này"}`}
                    >
                      <PackagePlus size={14} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  // The board measures itself, so the panels sit side by side, and mirror, only where the board has the room.
  return (
    <div className="@container/board">
      <div className="grid gap-3 @5xl/board:grid-cols-2">{(["BLUE", "RED"] as const).map(side)}</div>
    </div>
  )
}

function BanLabel() {
  return (
    <span className="mr-0.5 inline-flex items-center gap-0.5 rounded bg-muted px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
      <Ban size={10} strokeWidth={2.6} /> Cấm
    </span>
  )
}

/** Faded portrait: the row already carries the ban label, so fading alone tells a ban from a pick. */
function BannedHero({ hero }: { hero: IconRef | null }) {
  return <HeroIcon hero={hero} size={22} className="rounded-md opacity-45 grayscale-[0.6]" />
}
