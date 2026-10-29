import { useEffect, useMemo, useRef, useState } from "react"
import type { DraftKind, GameContent, Lane, Reference, Selection, Side } from "@aov/community-contracts"
import { ArrowLeftRight, Ban, History, Lock, LockOpen, Undo2, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { cn } from "@aov/ui/lib/utils"
import {
  assignHero,
  draftSlots,
  earliestLive,
  readDraft,
  setDraftTimes,
  teamPicks,
  turnUnavailable,
  withTurns,
} from "../../model/draft"
import type { GameView, IconRef } from "../../model/game-view"
import { LANE_LABELS } from "../../model/labels"
import { heroKeys, type HeroLocks } from "../../model/series-rules"
import { formatClock } from "../../model/vod"
import { HeroIcon, LaneIcon, TeamLogo, TimeTag, VIDEO_MARK } from "../primitives"
import { ReferencePicker } from "./reference-picker"

export type RosterOption = { id: string; name: string; lane?: Lane | null }

const otherSide = (side: Side): Side => (side === "BLUE" ? "RED" : "BLUE")

/** Swaps which team plays blue, keeping each team's bans, picks and turns with it. */
export function swapSides(content: GameContent): GameContent {
  const draft = readDraft(content)
  return {
    ...content,
    sides: content.sides
      .map((side) => ({ ...side, side: otherSide(side.side) }))
      .sort((a, b) => (a.side === b.side ? 0 : a.side === "BLUE" ? -1 : 1)),
    ...(draft.turns.length
      ? { draft: { ...draft, turns: draft.turns.map((turn) => ({ ...turn, side: otherSide(turn.side) })) } }
      : {}),
  }
}

/** Fills empty player slots from the registered roster by lane. */
export function fillFromRoster(content: GameContent, roster: (teamId: string) => RosterOption[]): GameContent {
  return {
    ...content,
    sides: content.sides.map((side) => {
      const members = roster(side.teamId)
      return {
        ...side,
        participants: side.participants.map((participant) =>
          participant.playerId
            ? participant
            : { ...participant, playerId: members.find((member) => member.lane === participant.lane)?.id ?? null },
        ),
      }
    }),
  }
}

/**
 * The ban/pick phase entered turn by turn while watching the video. Turns belong to teams, not players: after the
 * picks teammates still swap heroes, so lanes and players are set in the line-up below and fixed by the lock mark.
 * Hero suggestions follow the series rule: nothing another turn took, and no hero the picking team played earlier.
 */
export function DraftEditor({
  content,
  view,
  heroes,
  spells,
  roster,
  locks,
  videoNow,
  onChange,
}: {
  content: GameContent
  view: GameView
  heroes: Reference[]
  spells: Reference[]
  roster: (teamId: string) => RosterOption[]
  locks: HeroLocks
  /** Current player position; recorded turns take it as their mark. */
  videoNow: number | null
  onChange: (change: (content: GameContent) => GameContent) => void
}) {
  const draft = readDraft(content)
  const slots = draftSlots(draft)
  const [stamp, setStamp] = useState(true)
  const [pending, setPending] = useState<{ kind: DraftKind; side: Side } | null>(null)
  const next = draft.turns.length
  const teamOf = (side: Side) => content.sides.find((entry) => entry.side === side)?.teamId
  const teamName = (teamId: string) =>
    Object.values(view.sides).find((side) => side.team.id === teamId)?.team.name ?? "Đội"
  const icon = useMemo(() => {
    const byId = new Map(heroes.map((hero) => [hero.id, hero]))
    return (hero: Selection | null | undefined): IconRef | null =>
      hero?.id || hero?.name
        ? {
            id: hero.id,
            name: hero.name || byId.get(hero.id ?? "")?.name || "Tướng",
            iconUrl: byId.get(hero.id ?? "")?.iconUrl,
          }
        : null
  }, [heroes])
  const spellIcon = (spell: Selection | null | undefined): IconRef | null => {
    const match = spells.find((option) => option.id === spell?.id)
    return spell?.id || spell?.name
      ? { id: spell.id, name: spell.name || match?.name || "", iconUrl: match?.iconUrl }
      : null
  }
  const canStamp = stamp && videoNow != null && draft.startSecond != null && videoNow >= draft.startSecond
  const firstMark = Math.min(
    ...[draft.lockedSecond, ...draft.turns.map((turn) => turn.atSecond), content.sourceTimestampSeconds].filter(
      (value): value is number => value != null,
    ),
  )
  const canMarkStart = videoNow != null && videoNow <= firstMark
  const lockFloor = earliestLive({ ...draft, lockedSecond: null })
  const canLock = videoNow != null && draft.startSecond != null && videoNow >= lockFloor

  const setTurn = (index: number, hero: Selection) =>
    onChange((current) => {
      const recorded = readDraft(current).turns
      const turns = [...recorded]
      if (!hero.id && !hero.name) {
        // Clearing the last turn undoes it; an earlier ban may stay empty, an earlier pick may not.
        if (index === turns.length - 1) turns.pop()
        else if (turns[index]?.kind === "BAN") turns[index] = { ...turns[index]!, hero: null }
        else return current
      } else if (index < turns.length) turns[index] = { ...turns[index]!, hero }
      else {
        const template = pending ??
          draftSlots(readDraft(current))[index] ?? { kind: "PICK" as const, side: "BLUE" as const }
        turns.push({
          order: index + 1,
          kind: template.kind,
          side: template.side,
          hero,
          atSecond: canStamp ? Math.floor(videoNow!) : null,
        })
      }
      return withTurns(current, turns)
    })
  const flipTurn = (index: number, change: "kind" | "side") => {
    if (index >= next) {
      const slot = pending ?? slots[index]!
      setPending(
        change === "kind"
          ? { ...slot, kind: slot.kind === "BAN" ? "PICK" : "BAN" }
          : { ...slot, side: otherSide(slot.side) },
      )
      return
    }
    onChange((current) => {
      const turns = readDraft(current).turns.map((turn, position) =>
        position !== index
          ? turn
          : change === "kind"
            ? { ...turn, kind: turn.kind === "BAN" ? ("PICK" as const) : ("BAN" as const) }
            : { ...turn, side: otherSide(turn.side) },
      )
      return withTurns(current, turns)
    })
  }

  // Moving past the last turn brings the line-up forward, where heroes are swapped and the draft is locked.
  const [tab, setTab] = useState<"turns" | "lineup">(() => (next >= slots.length ? "lineup" : "turns"))
  const previousNext = useRef(next)
  useEffect(() => {
    if (previousNext.current < slots.length && next >= slots.length) setTab("lineup")
    previousNext.current = next
  }, [next, slots.length])

  const indexed = slots.map((slot, index) => ({
    ...slot,
    ...(index === next && pending ? pending : {}),
    index,
  }))
  const upcoming = indexed[next]

  const slotButton = (slot: (typeof indexed)[number]) => {
    const team = view.sides[slot.side].team
    const enabled = slot.index <= next
    const label = `Lượt ${slot.index + 1} · ${slot.kind === "BAN" ? "Cấm" : "Chọn"} · ${team.name}`
    return (
      <ReferencePicker
        key={slot.index}
        label={label}
        value={slot.hero}
        options={heroes}
        disabled={!enabled}
        blocked={turnUnavailable(draft, slot.index, slot, teamOf(slot.side), locks, teamName)}
        allowManual
        onChange={(hero) => {
          setTurn(slot.index, hero)
          if (slot.index === next) setPending(null)
        }}
      >
        <span
          className={cn(
            "relative inline-flex rounded-md",
            slot.index === next && "ring-2 ring-[var(--esp-gold)] ring-offset-1 ring-offset-card",
            !enabled && "opacity-40",
          )}
          title={[
            label,
            slot.hero?.name,
            slot.atSecond != null ? `${VIDEO_MARK} ${formatClock(slot.atSecond)}` : slot.recorded ? "không có mốc" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <HeroIcon
            hero={icon(slot.hero)}
            size={34}
            title=""
            className={cn(
              "rounded-md",
              !slot.hero?.id && !slot.hero?.name && "border border-dashed",
              slot.kind === "BAN" && (slot.hero?.id || slot.hero?.name) && "opacity-55 grayscale-[0.6]",
            )}
          />
          <span className="esp-num absolute -top-1 -left-1 rounded bg-card px-0.5 text-[9px] font-bold text-muted-foreground ring-1 ring-border">
            {slot.index + 1}
          </span>
          {slot.kind === "BAN" && (
            <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-muted-foreground text-background ring-1 ring-card">
              <Ban size={9} strokeWidth={3} />
            </span>
          )}
        </span>
      </ReferencePicker>
    )
  }

  const turnsView = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["BLUE", "RED"] as const).map((code) => {
          const team = view.sides[code].team
          const used = locks.byTeam.get(teamOf(code) ?? "") ?? []
          const own = (kind: DraftKind) => indexed.filter((slot) => slot.side === code && slot.kind === kind)
          return (
            <section key={code} data-side={code} className="min-w-0 space-y-1.5 rounded-lg border p-2">
              <header className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="h-4 w-1 rounded-full bg-[var(--side)]" aria-hidden="true" />
                <TeamLogo team={team} size={18} />
                <span className="min-w-0 flex-1 truncate">{team.name}</span>
              </header>
              {(["BAN", "PICK"] as const).map((kind) => (
                <div key={kind} className="flex items-center gap-1.5">
                  <span className="w-8 shrink-0 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                    {kind === "BAN" ? "Cấm" : "Chọn"}
                  </span>
                  <span className="flex flex-wrap gap-1.5">{own(kind).map(slotButton)}</span>
                </div>
              ))}
              {used.length > 0 && (
                <div
                  className="flex flex-wrap items-center gap-1 border-t pt-1.5"
                  aria-label={`Tướng ${team.name} đã dùng ở ván trước`}
                  title="Đã dùng ở ván trước · không được chọn lại"
                >
                  <History size={11} className="text-muted-foreground" />
                  {used.map((use, index) => (
                    <HeroIcon
                      key={index}
                      hero={icon(use.hero)}
                      size={18}
                      title={`${use.hero.name} · ván ${use.gameNumber}`}
                      className="rounded opacity-50 grayscale"
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
        {upcoming ? (
          <>
            <span>
              Lượt {next + 1}: <b>{upcoming.kind === "BAN" ? "Cấm" : "Chọn"}</b> ·{" "}
              <span data-side={upcoming.side} className="font-semibold text-[var(--side)]">
                {view.sides[upcoming.side].team.name}
              </span>
            </span>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-background"
              title="Thể thức khác: đổi lượt này giữa cấm và chọn"
              onClick={() => flipTurn(next, "kind")}
            >
              Đổi cấm/chọn
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-background"
              title="Thể thức khác: giao lượt này cho đội kia"
              onClick={() => flipTurn(next, "side")}
            >
              Đổi đội
            </button>
          </>
        ) : (
          <button
            type="button"
            className="font-medium underline-offset-2 hover:underline"
            onClick={() => setTab("lineup")}
          >
            Đã đủ lượt · sang Đội hình & chốt
          </button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7"
          disabled={!next}
          onClick={() => onChange((current) => withTurns(current, readDraft(current).turns.slice(0, -1)))}
        >
          <Undo2 size={13} /> Hoàn tác
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {locks.decider
          ? `Ván ${content.number} là ván cuối của BO: mở lại toàn bộ tướng.`
          : "Chỉ gợi ý tướng còn hợp lệ: chưa bị cấm/chọn ở ván này và đội chưa dùng ở ván trước."}
      </p>
    </div>
  )

  const lineup = (code: Side) => {
    const side = content.sides.find((entry) => entry.side === code)!
    const team = view.sides[code].team
    const picks = teamPicks(draft, code)
    const members = roster(side.teamId)
    const update = (lane: number, change: Partial<(typeof side.participants)[number]>) =>
      onChange((current) => ({
        ...current,
        sides: current.sides.map((entry) =>
          entry.side !== code
            ? entry
            : {
                ...entry,
                participants: entry.participants.map((participant, index) =>
                  index === lane ? { ...participant, ...change } : participant,
                ),
              },
        ),
      }))
    return (
      <section key={code} data-side={code} className="min-w-0 space-y-1.5 rounded-lg border p-2">
        <header className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="h-4 w-1 rounded-full bg-[var(--side)]" aria-hidden="true" />
          <TeamLogo team={team} size={18} />
          <span className="min-w-0 flex-1 truncate">{team.name}</span>
        </header>
        <ul className="space-y-1">
          {side.participants.map((participant, index) => (
            <li key={participant.lane} className="flex items-center gap-1.5">
              <LaneIcon lane={participant.lane} size={14} className="shrink-0 text-[var(--side)]" />
              <LineupHero
                label={`Tướng ${LANE_LABELS[participant.lane].name} của ${team.name}`}
                value={participant.hero}
                picks={picks}
                icon={icon}
                onPick={(hero) => onChange((current) => assignHero(current, code, index, hero))}
              />
              <ReferencePicker
                label={`Phụ trợ ${LANE_LABELS[participant.lane].name} của ${team.name}`}
                value={participant.spell}
                options={spells}
                onChange={(spell) => update(index, { spell })}
              >
                <HeroIcon
                  hero={spellIcon(participant.spell)}
                  size={22}
                  className={cn(
                    "rounded-md",
                    !(participant.spell?.id || participant.spell?.name) && "border border-dashed",
                  )}
                />
              </ReferencePicker>
              <select
                aria-label={`Tuyển thủ ${LANE_LABELS[participant.lane].name} của ${team.name}`}
                value={participant.playerId ?? ""}
                onChange={(event) => update(index, { playerId: event.target.value || null })}
                className="h-7 min-w-0 flex-1 rounded-md border bg-background px-1.5 text-[11px]"
              >
                <option value="">Tuyển thủ…</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.lane && member.lane !== participant.lane ? ` (${LANE_LABELS[member.lane].name})` : ""}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        {!members.length && <p className="text-[10px] text-muted-foreground">Chưa có danh sách đăng ký ở giải.</p>}
      </section>
    )
  }

  const missingPlayers = content.sides.some((side) => side.participants.some((participant) => !participant.playerId))
  const canFill = missingPlayers && content.sides.some((side) => roster(side.teamId).some((member) => member.lane))

  const lineupView = (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">{(["BLUE", "RED"] as const).map(lineup)}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-[11px] text-muted-foreground">Bấm ô tướng để hoán đổi trong đội, rồi chốt.</span>
        {canFill && (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => onChange((current) => fillFromRoster(current, roster))}
          >
            <Users size={13} /> Điền tuyển thủ
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7" onClick={() => onChange(swapSides)}>
          <ArrowLeftRight size={13} /> Đổi bên
        </Button>
        {draft.lockedSecond != null ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => onChange((current) => setDraftTimes(current, { lockedSecond: null }))}
          >
            <LockOpen size={13} /> Bỏ chốt
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7"
            disabled={!canLock}
            title={canLock ? undefined : "Phát video tới lúc đội hình đã cố định"}
            onClick={() => onChange((current) => setDraftTimes(current, { lockedSecond: Math.floor(videoNow ?? 0) }))}
          >
            <Lock size={13} /> Chốt tại {VIDEO_MARK} {formatClock(videoNow)}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-2.5 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
          Bắt đầu {draft.startSecond != null ? <TimeTag kind="video" seconds={draft.startSecond} /> : "chưa ghi"}
        </span>
        {/* A game recorded before drafts existed, or a start marked late, gets its draft start from the player. */}
        <button
          type="button"
          className="rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
          disabled={!canMarkStart}
          title={canMarkStart ? undefined : "Tua video tới màn cấm chọn, trước lượt đầu tiên và trước lúc vào trận"}
          onClick={() => onChange((current) => setDraftTimes(current, { startSecond: Math.floor(videoNow ?? 0) }))}
        >
          Đặt tại {VIDEO_MARK} {formatClock(videoNow)}
        </button>
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
          <Lock size={11} />{" "}
          {draft.lockedSecond != null ? <TimeTag kind="video" seconds={draft.lockedSecond} /> : "chưa chốt"}
        </span>
        <label
          className="ml-auto inline-flex items-center gap-1 text-muted-foreground"
          title="Mỗi lượt lấy vị trí video lúc chọn tướng"
        >
          <input type="checkbox" checked={stamp} onChange={(event) => setStamp(event.target.checked)} />
          Ghi mốc theo lượt
        </label>
      </div>
      <div
        className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5 text-xs"
        role="tablist"
        aria-label="Phần cấm chọn"
      >
        {(
          [
            ["turns", `Lượt cấm chọn ${Math.min(next, slots.length)}/${slots.length}`],
            ["lineup", `Đội hình & chốt${draft.lockedSecond != null ? " ✓" : ""}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "h-7 rounded-md font-medium transition",
              tab === id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "turns" ? turnsView : lineupView}
    </div>
  )
}

/** A lane's hero, chosen among its team's picks; choosing a teammate's hero swaps the two. */
function LineupHero({
  label,
  value,
  picks,
  icon,
  onPick,
}: {
  label: string
  value: Selection
  picks: Selection[]
  icon: (hero: Selection | null | undefined) => IconRef | null
  onPick: (hero: Selection) => void
}) {
  const [open, setOpen] = useState(false)
  const current = new Set(heroKeys(value))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value?.name || "chưa có"}`}
          disabled={!picks.length}
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--esp-gold)] disabled:opacity-60"
        >
          <HeroIcon
            hero={icon(value)}
            size={36}
            className={cn("ring-2 ring-[var(--side)]", !value?.id && !value?.name && "ring-dashed opacity-60")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw-1.5rem)] p-2">
        <p className="mb-1.5 text-[11px] text-muted-foreground">Tướng đội đã chọn · chọn để hoán đổi</p>
        <div className="flex flex-wrap gap-1" role="listbox" aria-label={label}>
          {picks.map((hero) => (
            <button
              key={heroKeys(hero)[0]}
              type="button"
              role="option"
              aria-selected={heroKeys(hero).some((key) => current.has(key))}
              onClick={() => {
                onPick(hero)
                setOpen(false)
              }}
              className="flex w-14 flex-col items-center gap-0.5 rounded-md p-1 text-[10px] hover:bg-muted aria-selected:bg-[var(--esp-gold-soft)]"
            >
              <HeroIcon hero={icon(hero)} size={34} />
              <span className="line-clamp-1 w-full text-center">{hero.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
