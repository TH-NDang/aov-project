import type { GameContent, Selection, Side } from "@aov/community-contracts"

/** A hero a team already played in an earlier game of the series. */
export type HeroUse = { gameNumber: number; hero: { id?: string | null; name: string } }
export type HeroLocks = { decider: boolean; byTeam: Map<string, HeroUse[]> }
export type Unavailable = { reason: string }

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").trim().toLocaleLowerCase()

/** Every key a hero can be matched by: its catalogue id and its folded name, so id-less observations still match. */
export function heroKeys(hero: Selection | null | undefined): string[] {
  const keys: string[] = []
  if (hero?.id) keys.push(`id:${hero.id}`)
  if (hero?.name?.trim()) keys.push(`name:${fold(hero.name)}`)
  return keys
}

const present = (hero: Selection | null | undefined): hero is Selection => heroKeys(hero).length > 0

/**
 * Series pick rule: a team cannot pick a hero it already played in an earlier game of the same series. The last
 * possible game of the series (game `bestOf`) opens every hero again. Bans only last for their own game.
 */
export function seriesLocks(games: { content: GameContent }[], number: number, bestOf: number): HeroLocks {
  const decider = bestOf > 1 && number >= bestOf
  const byTeam = new Map<string, HeroUse[]>()
  if (decider) return { decider, byTeam }
  const earlier = games
    .filter((game) => game.content.number < number)
    .sort((a, b) => a.content.number - b.content.number)
  for (const { content } of earlier)
    for (const side of content.sides) {
      if (!side.teamId) continue
      const used = byTeam.get(side.teamId) ?? []
      for (const participant of side.participants)
        if (present(participant.hero))
          used.push({
            gameNumber: content.number,
            hero: { id: participant.hero.id, name: participant.hero.name?.trim() || "Tướng chưa rõ tên" },
          })
      byTeam.set(side.teamId, used)
    }
  return { decider, byTeam }
}

export type DraftSlot = { side: Side; kind: "ban" | "pick"; index: number }

/**
 * Heroes that cannot fill a slot of this game, with the reason: anything already banned or picked in the game by
 * either team, and for picks also what the picking team played earlier in the series.
 */
export function draftUnavailable(
  content: Pick<GameContent, "sides">,
  slot: DraftSlot,
  locks: HeroLocks,
  teamName: (teamId: string) => string,
): Map<string, Unavailable> {
  const blocked = new Map<string, Unavailable>()
  const add = (hero: Selection | null | undefined, reason: string) => {
    for (const key of heroKeys(hero)) if (!blocked.has(key)) blocked.set(key, { reason })
  }
  for (const side of content.sides) {
    side.bans.forEach((ban, index) => {
      if (slot.kind === "ban" && slot.side === side.side && slot.index === index) return
      add(ban, "Đã bị cấm ở ván này")
    })
    side.participants.forEach((participant, index) => {
      if (slot.kind === "pick" && slot.side === side.side && slot.index === index) return
      add(participant.hero, `${teamName(side.teamId)} đã chọn ở ván này`)
    })
  }
  if (slot.kind === "pick") {
    const teamId = content.sides.find((side) => side.side === slot.side)?.teamId
    for (const use of (teamId && locks.byTeam.get(teamId)) || [])
      add(use.hero, `${teamName(teamId!)} đã dùng ở ván ${use.gameNumber}`)
  }
  return blocked
}

export const unavailableReason = (blocked: Map<string, Unavailable>, hero: Selection | null | undefined) =>
  heroKeys(hero)
    .map((key) => blocked.get(key))
    .find(Boolean)?.reason ?? null

/** Catalogue entries a slot may still take; the slot's current value always stays listed. */
export function allowedOptions<T extends { id: string; name: string }>(
  options: T[],
  blocked: Map<string, Unavailable> | undefined,
  value?: Selection | null,
): T[] {
  if (!blocked) return options
  const own = new Set(heroKeys(value))
  return options.filter(
    (option) =>
      heroKeys(option).some((key) => own.has(key)) ||
      unavailableReason(blocked, { id: option.id, name: option.name }) === null,
  )
}
