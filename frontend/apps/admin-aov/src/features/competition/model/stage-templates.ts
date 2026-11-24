import { aogStages, type CompetitionPlan, type CompetitionStage } from "@aov/community-contracts"

export const STAGE_TEMPLATES = ["AOG", "LEAGUE_KNOCKOUT", "GROUPS_KNOCKOUT", "KNOCKOUT", "DOUBLE"] as const
export type StageTemplate = (typeof STAGE_TEMPLATES)[number]

export const STAGE_TEMPLATE_LABELS: Record<StageTemplate, string> = {
  AOG: "Mẫu AOG: vòng tròn 2 lượt, playoffs thắng/thua",
  LEAGUE_KNOCKOUT: "Vòng tròn 1 lượt, rồi loại trực tiếp",
  GROUPS_KNOCKOUT: "Hai bảng vòng tròn, rồi loại trực tiếp",
  KNOCKOUT: "Loại trực tiếp",
  DOUBLE: "Nhánh thắng / thua",
}

const stage = (code: string, name: string, format: string, more: Partial<CompetitionStage> = {}): CompetitionStage => ({
  ...aogStages()[0]!,
  code,
  name,
  format,
  bestOf: 3,
  legs: 1,
  advance: 0,
  tieBreakers: format === "ROUND_ROBIN" ? ["GAME_DIFF", "GAME_WINS"] : [],
  ...more,
})

export function templateStages(template: StageTemplate, sourceUrl: string): CompetitionStage[] {
  if (template === "AOG") return aogStages(sourceUrl)
  const knockout = stage("PLAYOFF", "Playoffs", "SINGLE_ELIMINATION", { bestOf: 5, advance: 1 })
  const stages: Record<Exclude<StageTemplate, "AOG">, CompetitionStage[]> = {
    LEAGUE_KNOCKOUT: [stage("GROUP", "Vòng bảng", "ROUND_ROBIN", { advance: 4 }), knockout],
    GROUPS_KNOCKOUT: [
      stage("GROUP_A", "Bảng A", "ROUND_ROBIN", { advance: 2 }),
      stage("GROUP_B", "Bảng B", "ROUND_ROBIN", { advance: 2 }),
      knockout,
    ],
    KNOCKOUT: [knockout],
    DOUBLE: [stage("PLAYOFF", "Playoffs", "DOUBLE_ELIMINATION", { bestOf: 5, advance: 1 })],
  }
  return stages[template].map((row) => ({ ...row, sourceUrl }))
}

/** A stage code nothing in the plan uses yet, starting from `base`. */
export function freeStageCode(plan: Pick<CompetitionPlan, "stages" | "matches">, base = "STAGE") {
  const taken = new Set([...plan.stages.map((row) => row.code), ...plan.matches.map((match) => match.stageCode)])
  const root = base.replace(/[^A-Z0-9_]/g, "").slice(0, 50) || "STAGE"
  for (let number = 2; ; number++) {
    const code = `${root.replace(/_\d+$/, "")}_${number}`
    if (!taken.has(code)) return code
  }
}

/** The stage once more under a name and a code of its own; its rules and patches come along, its matches do not. */
export const duplicatedStage = (
  plan: Pick<CompetitionPlan, "stages" | "matches">,
  source: CompetitionStage,
): CompetitionStage => ({
  ...source,
  code: freeStageCode(plan, source.code),
  name: `${source.name} (bản sao)`,
  teamIds: [],
})

/** The stages with one moved by a place; the same list when it has nowhere to go. */
export function movedStage(stages: CompetitionStage[], code: string, offset: -1 | 1): CompetitionStage[] {
  const at = stages.findIndex((row) => row.code === code)
  const other = stages[at + offset]
  if (at < 0 || !other) return stages
  const next = [...stages]
  next[at + offset] = next[at]!
  next[at] = other
  return next
}
