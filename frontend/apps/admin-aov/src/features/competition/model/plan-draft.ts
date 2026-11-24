import type { CompetitionPlan, PlannedMatch } from "@aov/community-contracts"
import type { WorkspaceStep } from "../workspace/model"

/** The plan being edited with the steps that can be taken back and brought again. */
export type PlanDraft = {
  plan: CompetitionPlan
  past: CompetitionPlan[]
  future: CompetitionPlan[]
  /** The field last typed in and when, so one stretch of typing is one step back. */
  lastField?: string
  lastAt: number
}

const MAX_STEPS = 100
/** Changes of one field closer together than this are one step. */
const TYPING_MS = 1200

export const planDraft = (plan: CompetitionPlan): PlanDraft => ({ plan, past: [], future: [], lastAt: 0 })

/**
 * The draft after a change. `field` names what was changed, such as one field of the plan; several changes in the same
 * event and quick changes of the same field share one step. A change that changes nothing adds no step.
 */
export function changedDraft(draft: PlanDraft, plan: CompetitionPlan, field: string, now: number): PlanDraft {
  if (JSON.stringify(plan) === JSON.stringify(draft.plan)) return draft
  const joins = draft.past.length > 0 && draft.lastField === field && now - draft.lastAt < TYPING_MS
  return {
    plan,
    past: joins ? draft.past : [...draft.past, draft.plan].slice(-MAX_STEPS),
    future: [],
    lastField: field,
    lastAt: now,
  }
}

export function undoneDraft(draft: PlanDraft): PlanDraft {
  const plan = draft.past.at(-1)
  if (!plan) return draft
  return { plan, past: draft.past.slice(0, -1), future: [draft.plan, ...draft.future], lastAt: 0 }
}

export function redoneDraft(draft: PlanDraft): PlanDraft {
  const [plan, ...future] = draft.future
  if (!plan) return draft
  return { plan, past: [...draft.past, draft.plan], future, lastAt: 0 }
}

/** One line of what the draft would save, and the step it belongs to. */
export type DraftChange = { step: WorkspaceStep; text: string }

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

const INFO_FIELDS = [
  ["circuitPageId", "Hệ thống giải"],
  ["organizerPageId", "Đơn vị tổ chức"],
  ["timezone", "Múi giờ"],
  ["prizePool", "Quỹ giải thưởng"],
  ["currency", "Tiền tệ"],
  ["sourceUrl", "Nguồn kiểm chứng"],
  ["notes", "Giới thiệu"],
  ["venues", "Địa điểm"],
] as const satisfies readonly (readonly [keyof CompetitionPlan, string])[]

/** What saving the draft would change, in the order of the steps. `teamName` words a team. */
export function draftChanges(
  before: CompetitionPlan,
  after: CompetitionPlan,
  teamName: (id: string) => string,
): DraftChange[] {
  const changes: DraftChange[] = []
  for (const [key, label] of INFO_FIELDS)
    if (!same(before[key], after[key])) changes.push({ step: "overview", text: `${label} đã đổi` })

  const entered = new Map(before.entrants.map((entry) => [entry.teamId, entry]))
  const kept = new Set(after.entrants.map((entry) => entry.teamId))
  const added = after.entrants.filter((entry) => !entered.has(entry.teamId))
  const removed = before.entrants.filter((entry) => !kept.has(entry.teamId))
  const edited = after.entrants.filter((entry) => entered.has(entry.teamId) && !same(entered.get(entry.teamId), entry))
  const names = (rows: { teamId: string }[]) =>
    rows
      .slice(0, 3)
      .map((row) => teamName(row.teamId))
      .join(", ") + (rows.length > 3 ? ` và ${rows.length - 3} đội khác` : "")
  if (added.length) changes.push({ step: "teams", text: `Thêm đội: ${names(added)}` })
  if (removed.length) changes.push({ step: "teams", text: `Gỡ đội: ${names(removed)}` })
  if (edited.length) changes.push({ step: "teams", text: `Đổi trạng thái: ${names(edited)}` })
  const order = (plan: CompetitionPlan) =>
    plan.entrants.filter((entry) => entered.has(entry.teamId) && kept.has(entry.teamId)).map((entry) => entry.teamId)
  if (!same(order(before), order(after))) changes.push({ step: "teams", text: "Đổi thứ tự đội" })

  const stagesBefore = new Map(before.stages.map((stage) => [stage.code, stage]))
  const stageCodes = new Set(after.stages.map((stage) => stage.code))
  for (const stage of after.stages) {
    const old = stagesBefore.get(stage.code)
    if (!old) changes.push({ step: "format", text: `Giai đoạn mới: ${stage.name}` })
    else if (!same(old, stage)) changes.push({ step: "format", text: `Sửa giai đoạn ${stage.name}` })
  }
  for (const stage of before.stages)
    if (!stageCodes.has(stage.code)) changes.push({ step: "format", text: `Bỏ giai đoạn ${stage.name}` })
  const stageOrder = (plan: CompetitionPlan) =>
    plan.stages.filter((stage) => stagesBefore.has(stage.code) && stageCodes.has(stage.code)).map((stage) => stage.code)
  if (!same(stageOrder(before), stageOrder(after))) changes.push({ step: "format", text: "Đổi thứ tự giai đoạn" })

  return [...changes, ...matchChanges(before, after)]
}

function matchChanges(before: CompetitionPlan, after: CompetitionPlan): DraftChange[] {
  const old = new Map(before.matches.map((match) => [match.key, match]))
  const keys = new Set(after.matches.map((match) => match.key))
  const added = after.matches.filter((match) => !old.has(match.key)).length
  const removed = before.matches.filter((match) => !keys.has(match.key)).length
  const counts = { time: 0, sides: 0, round: 0, other: 0 }
  for (const match of after.matches) {
    const was = old.get(match.key)
    if (!was || same(was, match)) continue
    if (!same(was.scheduledAt, match.scheduledAt)) counts.time++
    if (!same([was.a, was.b], [match.a, match.b])) counts.sides++
    if (was.round !== match.round) counts.round++
    if (!same(rest(was), rest(match))) counts.other++
  }
  const changes: DraftChange[] = []
  const add = (count: number, text: string) => count && changes.push({ step: "schedule", text })
  add(added, `Thêm ${added} trận`)
  add(removed, `Bỏ ${removed} trận`)
  add(counts.time, `Đổi giờ ${counts.time} trận`)
  add(counts.sides, `Đổi đội hoặc suất của ${counts.sides} trận`)
  add(counts.round, `Đổi vòng của ${counts.round} trận`)
  add(counts.other, `Đổi tên, BO hoặc giai đoạn của ${counts.other} trận`)
  if (!same(before.playoffSeeds, after.playoffSeeds)) changes.push({ step: "schedule", text: "Hạt giống đã đổi" })
  const order = (plan: CompetitionPlan) =>
    plan.matches.filter((match) => old.has(match.key) && keys.has(match.key)).map((match) => match.key)
  if (!changes.length && !same(order(before), order(after))) changes.push({ step: "schedule", text: "Đổi thứ tự trận" })
  return changes
}

const rest = ({ key, label, title, bestOf, stageCode, seriesId }: PlannedMatch) => [
  key,
  label ?? null,
  title ?? null,
  bestOf,
  stageCode,
  seriesId ?? null,
]

/**
 * The plan of the past, made fit to save today: matches that became real series since then stay in the schedule, since
 * the server keeps every linked match, and so do the teams and stages those matches name.
 */
export function restoredPlan(current: CompetitionPlan, past: CompetitionPlan): CompetitionPlan {
  const linked = new Map(current.matches.filter((match) => match.seriesId).map((match) => [match.seriesId!, match]))
  const pastSeries = new Set(past.matches.map((match) => match.seriesId).filter(Boolean))
  const pastKeys = new Set(past.matches.map((match) => match.key))
  const missing = [...linked.values()].filter((match) => !pastSeries.has(match.seriesId) && !pastKeys.has(match.key))
  const matches = [
    ...past.matches.map((match) => {
      const now = current.matches.find((row) => row.key === match.key)
      return now?.seriesId && !match.seriesId ? now : match
    }),
    ...missing,
  ]
  const stageCodes = new Set(past.stages.map((stage) => stage.code))
  const needed = new Set(matches.map((match) => match.stageCode))
  const teamIds = new Set(past.entrants.map((entry) => entry.teamId))
  const used = new Set(matches.flatMap((match) => [match.a.teamId, match.b.teamId]).filter((id): id is string => !!id))
  return {
    ...past,
    stages: [
      ...past.stages,
      ...current.stages.filter((stage) => !stageCodes.has(stage.code) && needed.has(stage.code)),
    ],
    entrants: [
      ...past.entrants,
      ...current.entrants.filter((entry) => !teamIds.has(entry.teamId) && used.has(entry.teamId)),
    ],
    matches,
  }
}
