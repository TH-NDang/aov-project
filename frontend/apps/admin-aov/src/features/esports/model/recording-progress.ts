import type { DocumentView, GameContent, Loadout, Participant, Selection } from "@aov/community-contracts"
import { DRAFT_ORDER, readDraft } from "./draft"
import { readTimeline } from "./timeline-io"
import { VIDEO_MARK, formatClock, youtubeVideoId } from "./vod"

export type StepStatus = "done" | "partial" | "todo"
/** Where an admin fixes a step: one of the match page's panels, or the full game data page. */
export type ProgressTarget = "sync" | "draft" | "loadout" | "composer" | "result" | "data"
export type ProgressStep = {
  id: string
  label: string
  detail: string
  status: StepStatus
  /** Required steps must be done before the game can be confirmed (published). */
  required: boolean
  target: ProgressTarget
}
/** `confirmed`: published and unchanged since; `changed`: published, then edited in the draft. */
export type RecordingState = "recording" | "ready" | "confirmed" | "changed"
export type RecordingProgress = {
  steps: ProgressStep[]
  done: number
  total: number
  state: RecordingState
  /** Fields the service still reports as missing for publication. */
  missing: string[]
}

const SEATS = 10
const BANS = 8
/** Publishing touches the record right after setting `publishedAt`; anything later is an edit. */
const EDIT_MARGIN_MS = 2000

const present = (selection: Selection | null | undefined) => !!(selection?.id || selection?.name?.trim())
const status = (value: number, total: number): StepStatus => (value >= total ? "done" : value > 0 ? "partial" : "todo")

function loadoutStep(
  id: string,
  label: string,
  participants: Participant[],
  pick: (participant: Participant) => Loadout<unknown>,
): ProgressStep {
  const loadouts = participants.map(pick)
  const known = loadouts.filter((loadout) => loadout.status === "KNOWN").length
  const partial = loadouts.filter((loadout) => loadout.status === "PARTIAL").length
  const hidden = loadouts.filter((loadout) => loadout.status === "NOT_SHOWN").length
  const missing = SEATS - known - partial - hidden
  const timed = loadouts.filter((loadout) => loadout.observedAtSeconds != null).length
  const parts = [
    known && `${known} rõ`,
    partial && `${partial} một phần`,
    hidden && `${hidden} không hiển thị`,
    missing > 0 && `${missing} chưa ghi`,
    timed && `${timed} có mốc`,
  ].filter(Boolean)
  return {
    id,
    label,
    detail: parts.join(" · ") || "Chưa ghi",
    status: missing <= 0 ? "done" : missing < SEATS ? "partial" : "todo",
    required: false,
    target: "loadout",
  }
}

/**
 * What has been recorded for one game and what is still missing before it can be confirmed. Bans, picks, players,
 * spells, the result and the service's publication checks are required; the video, ban/pick turns, emblems,
 * arcana and moments are tracked but optional because a broadcast may not show them.
 */
export function recordingProgress(entry: DocumentView<GameContent>): RecordingProgress {
  const content = entry.content
  const participants = content.sides.flatMap((side) => side.participants)
  const draft = readDraft(content)
  const events = readTimeline(content)
  const live = content.sourceTimestampSeconds != null
  const video = !!youtubeVideoId(content.sourceUrl)

  const bans = content.sides.flatMap((side) => side.bans).filter(present).length
  const heroes = participants.filter((participant) => present(participant.hero)).length
  const players = participants.filter((participant) => participant.playerId).length
  const spells = participants.filter((participant) => present(participant.spell)).length
  const spellTimes = participants.filter((participant) => participant.spellObservedAtSeconds != null).length
  const kills = events.filter((event) => event.kind === "KILL").length
  const objectives = events.filter((event) => event.kind === "OBJECTIVE").length
  const turns = draft.turns.length

  const steps: ProgressStep[] = [
    {
      id: "video",
      label: "Video & vào trận",
      detail:
        video && live
          ? `Vào trận tại ${VIDEO_MARK} ${formatClock(content.sourceTimestampSeconds)}`
          : video
            ? "Đã gắn video, chưa đặt mốc vào trận"
            : "Chưa gắn video",
      status: video && live ? "done" : video ? "partial" : "todo",
      required: false,
      target: "sync",
    },
    {
      id: "draft",
      label: "Cấm chọn theo lượt",
      detail:
        draft.startSecond == null && !turns
          ? "Chưa ghi theo lượt"
          : `${turns}/${DRAFT_ORDER.length} lượt · ${draft.lockedSecond != null ? `chốt ${VIDEO_MARK} ${formatClock(draft.lockedSecond)}` : "chưa chốt"}`,
      status:
        turns >= DRAFT_ORDER.length && draft.lockedSecond != null
          ? "done"
          : turns || draft.startSecond != null
            ? "partial"
            : "todo",
      required: false,
      target: "draft",
    },
    {
      id: "bans",
      label: "Cấm",
      detail: `${bans}/${BANS}`,
      status: status(bans, BANS),
      required: true,
      target: "draft",
    },
    {
      id: "heroes",
      label: "Tướng",
      detail: `${heroes}/${SEATS}`,
      status: status(heroes, SEATS),
      required: true,
      target: "draft",
    },
    {
      id: "players",
      label: "Tuyển thủ",
      detail: `${players}/${SEATS}`,
      status: status(players, SEATS),
      required: true,
      target: "draft",
    },
    {
      id: "spells",
      label: "Phụ trợ",
      detail: `${spells}/${SEATS}${spellTimes ? ` · ${spellTimes} có mốc` : ""}`,
      status: status(spells, SEATS),
      required: true,
      target: "loadout",
    },
    loadoutStep("enchantments", "Phù hiệu", participants, (participant) => participant.enchantments),
    loadoutStep("arcana", "Bảng ngọc", participants, (participant) => participant.arcana),
    {
      id: "moments",
      label: "Diễn biến",
      detail: events.length ? `${kills} hạ gục · ${objectives} mục tiêu · ${events.length} mốc` : "Chưa ghi mốc nào",
      status: events.length ? "done" : "todo",
      required: false,
      target: "composer",
    },
    {
      id: "result",
      label: "Kết quả",
      detail: [
        content.winner ? `Đội ${content.winner === "BLUE" ? "Xanh" : "Đỏ"} thắng` : "Chưa có đội thắng",
        content.durationSeconds != null ? `⏱ ${formatClock(content.durationSeconds)}` : "chưa có thời lượng",
      ].join(" · "),
      status:
        content.winner && content.durationSeconds != null
          ? "done"
          : content.winner || content.durationSeconds != null
            ? "partial"
            : "todo",
      required: true,
      target: "result",
    },
    {
      id: "checks",
      label: "Điều kiện xuất bản",
      detail: entry.missingFields.length
        ? `Máy chủ còn báo ${entry.missingFields.length} mục`
        : "Máy chủ không báo thiếu",
      status: entry.missingFields.length ? "todo" : "done",
      required: true,
      target: "data",
    },
  ]

  const required = steps.filter((step) => step.required)
  const done = required.filter((step) => step.status === "done").length
  const published = entry.publishedAt ? Date.parse(entry.publishedAt) : null
  const edited = published != null && Date.parse(entry.updatedAt) - published > EDIT_MARGIN_MS
  return {
    steps,
    done,
    total: required.length,
    missing: entry.missingFields,
    state: published != null ? (edited ? "changed" : "confirmed") : done === required.length ? "ready" : "recording",
  }
}
