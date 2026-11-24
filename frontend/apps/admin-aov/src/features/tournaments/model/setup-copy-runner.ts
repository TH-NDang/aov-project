import type { competitionApi } from "@/features/competition/competition-api"
import {
  COPY_PARTS,
  copiedRoster,
  planWithCopy,
  rosterBatches,
  rosterContents,
  tournamentWithCopy,
  type CopyPart,
} from "@/features/competition/model/copy-setup"
import type { tournamentApi } from "../api/tournament-api"

export type SetupApi = {
  competition: Pick<typeof competitionApi, "read" | "save">
  tournament: Pick<typeof tournamentApi, "list" | "read" | "save" | "rosterBatch">
}

/** How one part of a setup fared. `count` is what was written; `total` what there was to write. */
export type PartOutcome = {
  part: CopyPart
  state: "waiting" | "running" | "done" | "failed" | "skipped"
  count?: number
  total?: number
  error?: unknown
}

const PLAN_PARTS: readonly CopyPart[] = ["info", "entrants", "stages"]
const PEOPLE_PARTS: readonly CopyPart[] = ["staff", "broadcast"]

/**
 * Copies the chosen parts of `sourceId` into the new tournament `targetId`: the plan in one write, then the rosters of
 * its teams, then the people of the tournament record. Each write reads its record again first, since an earlier one
 * may have moved its version. A part that fails stops only the parts built on it. It can run again for what is
 * missing: teams, roster lines and people already there are kept.
 */
export async function copySetup(
  {
    targetId,
    sourceId,
    parts,
    api,
  }: { targetId: string; sourceId: string; parts: ReadonlySet<CopyPart>; api: SetupApi },
  onChange: (outcomes: PartOutcome[]) => void = () => {},
): Promise<PartOutcome[]> {
  let outcomes: PartOutcome[] = COPY_PARTS.filter((part) => parts.has(part)).map((part) => ({ part, state: "waiting" }))
  const set = (changed: readonly CopyPart[], change: (part: CopyPart) => Partial<PartOutcome>) => {
    outcomes = outcomes.map((row) => (changed.includes(row.part) ? { ...row, ...change(row.part) } : row))
    onChange(outcomes)
  }
  const step = async (wanted: readonly CopyPart[], write: () => Promise<void>) => {
    const chosen = wanted.filter((part) => parts.has(part))
    if (!chosen.length) return
    set(chosen, () => ({ state: "running" }))
    try {
      await write()
    } catch (error) {
      set(chosen, () => ({ state: "failed", error }))
    }
  }

  await step(PLAN_PARTS, async () => {
    const source = (await api.competition.read(sourceId)).content.plan
    const target = await api.competition.read(targetId)
    const plan = planWithCopy(target.content.plan, source, parts)
    await api.competition.save(target, plan)
    const counts: Partial<Record<CopyPart, number>> = { entrants: plan.entrants.length, stages: plan.stages.length }
    set(PLAN_PARTS, (part) => ({ state: "done", count: counts[part], total: counts[part] }))
  })

  // Rosters and staff belong to the teams of the plan: without them there is nobody to copy for.
  const entered = outcomes.find((row) => row.part === "entrants")?.state
  const teams = async () =>
    new Set((await api.competition.read(targetId)).content.plan.entrants.map((entry) => entry.teamId))
  if (entered === "failed") set(["rosters", "staff"], () => ({ state: "skipped" }))
  else
    await step(["rosters"], async () => {
      const [from, existing, teamIds] = [
        await api.tournament.list("roster-memberships", undefined, { tournamentId: sourceId }),
        await api.tournament.list("roster-memberships", undefined, { tournamentId: targetId }),
        await teams(),
      ]
      const lines = copiedRoster(rosterContents(from), targetId, rosterContents(existing), teamIds)
      let written = 0
      set(["rosters"], () => ({ count: 0, total: lines.length }))
      for (const batch of rosterBatches(lines)) {
        await api.tournament.rosterBatch(batch)
        written += batch.create?.length ?? 0
        set(["rosters"], () => ({ count: written }))
      }
      set(["rosters"], () => ({ state: "done" }))
    })

  const people = PEOPLE_PARTS.filter((part) => outcomes.some((row) => row.part === part && row.state === "waiting"))
  await step(people, async () => {
    const source = (await api.tournament.read("tournaments", sourceId)).content
    const teamIds = people.includes("staff") ? await teams() : new Set<string>()
    const target = await api.tournament.read("tournaments", targetId)
    const content = tournamentWithCopy(target.content, source, new Set(people), teamIds)
    const counts = { staff: content.staff?.length ?? 0, broadcast: content.broadcast?.length ?? 0 }
    await api.tournament.save("tournaments", target, content)
    set(people, (part) => {
      const count = part === "staff" ? counts.staff : counts.broadcast
      return { state: "done", count, total: count }
    })
  })
  return outcomes
}

export const setupFinished = (outcomes: readonly PartOutcome[]) => outcomes.every((row) => row.state === "done")

/** The parts worth another try. */
export const missingParts = (outcomes: readonly PartOutcome[]) =>
  new Set(outcomes.filter((row) => row.state !== "done").map((row) => row.part))
