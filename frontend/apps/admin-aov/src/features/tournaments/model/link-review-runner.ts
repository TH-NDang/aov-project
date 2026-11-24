import type { CrewMember, LinkMention, TournamentAward } from "@aov/community-contracts"
import type { tournamentApi } from "../api/tournament-api"
import { awardRecipient, awardTeam, pickedName, withAwardRecipient, withAwardTeam } from "./final-table-model"

type LinkApi = Pick<typeof tournamentApi, "read" | "save">
/** A record a row is linked to; a broadcast is linked to several people. */
export type LinkChoice = { id: string; name: string; imageUrl?: string | null }
/** Puts a link back as it was before, unless somebody changed it since. */
export type Unlink = () => Promise<void>

/** Somebody linked the same place in the meantime; what they chose stays. */
export class LinkTakenError extends Error {
  constructor() {
    super("Chỗ này vừa được liên kết ở nơi khác.")
    this.name = "LinkTakenError"
  }
}

const one = (choices: readonly LinkChoice[]) => {
  const choice = choices[0]
  if (!choice) throw new Error("No record to link.")
  return choice
}

async function linkGame(api: LinkApi, mention: LinkMention, { id }: LinkChoice): Promise<Unlink> {
  const game = await api.read("games", mention.recordId)
  if (game.content.mvpPlayerId) throw new LinkTakenError()
  await api.save("games", game, { ...game.content, mvpPlayerId: id })
  return async () => {
    const latest = await api.read("games", mention.recordId)
    if (latest.content.mvpPlayerId !== id) throw new LinkTakenError()
    await api.save("games", latest, { ...latest.content, mvpPlayerId: null })
  }
}

async function linkSeries(api: LinkApi, mention: LinkMention, { id }: LinkChoice): Promise<Unlink> {
  const series = await api.read("series", mention.recordId)
  if (series.content.mvpPlayerId) throw new LinkTakenError()
  await api.save("series", series, { ...series.content, mvpPlayerId: id })
  return async () => {
    const latest = await api.read("series", mention.recordId)
    if (latest.content.mvpPlayerId !== id) throw new LinkTakenError()
    await api.save("series", latest, { ...latest.content, mvpPlayerId: null })
  }
}

async function linkBroadcast(api: LinkApi, mention: LinkMention, people: readonly LinkChoice[]): Promise<Unlink> {
  const crew: CrewMember[] = people.map((person) => ({ pageId: person.id, role: "CASTER" }))
  const series = await api.read("series", mention.recordId)
  if (series.content.broadcast?.length) throw new LinkTakenError()
  await api.save("series", series, { ...series.content, broadcast: crew })
  return async () => {
    const latest = await api.read("series", mention.recordId)
    if (JSON.stringify(latest.content.broadcast) !== JSON.stringify(crew)) throw new LinkTakenError()
    await api.save("series", latest, { ...latest.content, broadcast: [] })
  }
}

/** Links one award the way the final table does: the record's own name is written beside the link. */
async function linkAward(api: LinkApi, mention: LinkMention, choice: LinkChoice): Promise<Unlink> {
  const player = mention.kind === "AWARD_PLAYER"
  const linkOf = player ? awardRecipient : awardTeam
  const withLink = player ? withAwardRecipient : withAwardTeam
  const open = (award: TournamentAward) =>
    !linkOf(award).id && award.title === mention.label && linkOf(award).name === mention.text

  const tournament = await api.read("tournaments", mention.recordId)
  const awards = tournament.content.awards ?? []
  const index = awards.findIndex(open)
  const before = awards[index]
  if (!before) throw new LinkTakenError()
  const linked = withLink(before, pickedName(choice.id, choice.name))
  const replaced = (rows: TournamentAward[], award: TournamentAward) =>
    rows.map((row, at) => (at === index ? award : row))
  await api.save("tournaments", tournament, { ...tournament.content, awards: replaced(awards, linked) })
  return async () => {
    const latest = await api.read("tournaments", mention.recordId)
    const rows = latest.content.awards ?? []
    const row = rows[index]
    if (!row || row.title !== before.title || linkOf(row).id !== choice.id) throw new LinkTakenError()
    const back = withLink(row, { id: null, name: linkOf(before).name })
    await api.save("tournaments", latest, { ...latest.content, awards: replaced(rows, back) })
  }
}

/**
 * Writes the link of one row, on the record as it is now, and returns how to take it back. Notes keep their text: a
 * row leaves the list because its link is set, as it does when the link is set in its own editor.
 */
export function linkMention(api: LinkApi, mention: LinkMention, choices: readonly LinkChoice[]): Promise<Unlink> {
  switch (mention.kind) {
    case "GAME_MVP":
      return linkGame(api, mention, one(choices))
    case "SERIES_MVP":
      return linkSeries(api, mention, one(choices))
    case "SERIES_BROADCAST":
      one(choices)
      return linkBroadcast(api, mention, choices)
    case "AWARD_PLAYER":
    case "AWARD_TEAM":
      return linkAward(api, mention, one(choices))
  }
}

export type LinkJob = { mention: LinkMention; choices: readonly LinkChoice[] }
export type LinkRun = { linked: { job: LinkJob; unlink: Unlink }[]; failed: { job: LinkJob; error: unknown }[] }

/**
 * Links rows one after another, since several may be lines of one record. A row that fails is reported and does not
 * stop the others.
 */
export async function runLinks(
  api: LinkApi,
  jobs: readonly LinkJob[],
  onStep: (done: number) => void = () => {},
): Promise<LinkRun> {
  const run: LinkRun = { linked: [], failed: [] }
  for (const job of jobs) {
    try {
      run.linked.push({ job, unlink: await linkMention(api, job.mention, job.choices) })
    } catch (error) {
      run.failed.push({ job, error })
    }
    onStep(run.linked.length + run.failed.length)
  }
  return run
}

/** Takes links back in the reverse order they were made; the first failure stops it. */
export async function undoLinks(run: Pick<LinkRun, "linked">) {
  for (const { unlink } of [...run.linked].reverse()) await unlink()
}
