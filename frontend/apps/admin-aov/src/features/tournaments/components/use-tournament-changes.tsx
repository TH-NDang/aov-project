import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, TournamentContent, TournamentPart, TournamentStatus } from "@aov/community-contracts"
import { toast } from "sonner"
import { confirmAction } from "@/components/confirm-dialog"
import { STATUS_LABELS } from "@/features/esports/model/labels"
import { exceptDeletionImpact, tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import { runOneByOne } from "../model/bulk-changes"
import { lifecycleUsages } from "../model/record-lifecycle-model"
import { ChangeList, type ListedChange } from "./change-list"
import { deletionBlocked, useDeletionCheck } from "./use-record-lifecycle"

type Entry = DocumentView<TournamentContent>

export type BulkProgress = { label: string; done: number; total: number }
/** How a run ended: what it did, how often, and the tournaments it could not change with the reason. */
export type BulkReport = { summary: string; failures: { id: string; name: string; reason: string }[] }

const statusLabel = (entry: Entry) => STATUS_LABELS[entry.content.status ?? "UNKNOWN"]
const listed = (entry: Entry, from?: string, to?: string): ListedChange => ({
  id: entry.id,
  tournament: entry.content,
  from,
  to,
})
const failed = (entry: Entry, reason: string) => ({ id: entry.id, name: entry.content.name, reason })
const counted = (count: number) => `${count} giải`

/**
 * Changes tournaments from the list, one or several at a time. Every change is asked for first with what it replaces;
 * a run then writes one tournament after another, and what failed stays selected with its reason.
 */
export function useTournamentChanges({
  parts,
  onSettled,
}: {
  /** Parts by the id of their main event: an event with parts cannot become a part itself. */
  parts: ReadonlyMap<string, TournamentPart[]>
  /** Called after a run with the tournaments it was asked to change and those still to deal with. */
  onSettled: (handled: string[], left: string[]) => void
}) {
  const client = useQueryClient()
  const check = useDeletionCheck()
  const [progress, setProgress] = useState<BulkProgress | null>(null)
  const [report, setReport] = useState<BulkReport | null>(null)
  const run = useMutation({
    meta: { silent: true },
    mutationFn: async ({
      entries,
      label,
      change,
    }: {
      entries: Entry[]
      label: string
      change: (entry: Entry) => Promise<unknown>
    }) => {
      const failures = await runOneByOne(entries, change, (done) => setProgress({ label, done, total: entries.length }))
      await client.invalidateQueries({ queryKey: tournamentKeys.all, predicate: exceptDeletionImpact })
      return failures.map(({ item, error }) => failed(item, tournamentError(error)))
    },
    onSettled: () => setProgress(null),
  })
  const busy = !!progress || run.isPending

  /** Runs the change, then reports: a toast when all went well, otherwise the failures with those left out before. */
  async function apply(
    asked: Entry[],
    entries: Entry[],
    label: string,
    done: (count: number) => string,
    change: (entry: Entry) => Promise<unknown>,
    leftOut: BulkReport["failures"] = [],
  ) {
    const failures = [...(await run.mutateAsync({ entries, label, change })), ...leftOut]
    const summary = done(entries.length - (failures.length - leftOut.length))
    onSettled(
      asked.map((entry) => entry.id),
      failures.map((row) => row.id),
    )
    if (failures.length) setReport({ summary, failures })
    else toast.success(summary)
  }

  async function changeStatus(entries: Entry[], status: TournamentStatus) {
    if (busy) return
    setReport(null)
    const changing = entries.filter((entry) => (entry.content.status ?? "UNKNOWN") !== status)
    if (!changing.length) {
      toast.info(`Đã ở trạng thái “${STATUS_LABELS[status]}”.`)
      return
    }
    const accepted = await confirmAction({
      title: changing.length === 1 ? "Đổi trạng thái giải?" : `Đổi trạng thái ${counted(changing.length)}?`,
      description: "Trang Stream chỉ đổi theo khi giải được xuất bản lại.",
      details: <ChangeList changes={changing.map((row) => listed(row, statusLabel(row), STATUS_LABELS[status]))} />,
      confirmLabel: "Đổi trạng thái",
      tone: "publish",
    })
    if (!accepted) return
    await apply(
      entries,
      changing,
      "Đang đổi trạng thái",
      (count) => `Đã đổi trạng thái ${counted(count)}.`,
      (entry) => tournamentApi.save("tournaments", entry, { ...entry.content, status }),
    )
  }

  async function attach(entries: Entry[], mainEvent: { id: string; name: string }) {
    if (busy) return
    setReport(null)
    const withParts = entries.filter((entry) => parts.get(entry.id)?.length)
    const leftOut = withParts.map((entry) =>
      failed(entry, `Đang có ${parts.get(entry.id)!.length} phần nên không thuộc giải khác được.`),
    )
    const changing = entries.filter((entry) => entry.id !== mainEvent.id && !withParts.includes(entry))
    if (!changing.length) {
      setReport({ summary: "Chưa gắn giải nào.", failures: leftOut })
      return
    }
    const accepted = await confirmAction({
      title: `Gắn ${counted(changing.length)} vào ${mainEvent.name}?`,
      description: "Mỗi giải thành một phần của giải chính và không còn là một dòng riêng trong danh sách.",
      details: (
        <ChangeList
          changes={[
            ...changing.map((row) => listed(row, "Giải chính", `Phần của ${mainEvent.name}`)),
            ...withParts.map((row, index) => listed(row, leftOut[index]!.reason)),
          ]}
        />
      ),
      confirmLabel: "Gắn vào giải chính",
      tone: "publish",
    })
    if (!accepted) return
    await apply(
      entries,
      changing,
      "Đang gắn vào giải chính",
      (count) => `Đã gắn ${counted(count)} vào ${mainEvent.name}.`,
      (entry) => tournamentApi.save("tournaments", entry, { ...entry.content, parentTournamentId: mainEvent.id }),
      leftOut,
    )
  }

  async function trash(entries: Entry[]) {
    if (busy) return
    setReport(null)
    const blocked: BulkReport["failures"] = []
    const unread = await runOneByOne(
      entries,
      async (entry) => {
        const impact = await check("tournaments", entry)
        if (!deletionBlocked(impact, entry.version)) return
        const usages = lifecycleUsages(impact.usages).map((usage) => `${usage.label} ${usage.count}`)
        blocked.push(
          failed(
            entry,
            usages.length ? `Còn dữ liệu liên quan: ${usages.join(", ")}.` : "Giải đã thay đổi, hãy tải lại.",
          ),
        )
      },
      (done) => setProgress({ label: "Đang kiểm tra dữ liệu liên quan", done, total: entries.length }),
    )
    setProgress(null)
    const leftOut = [...blocked, ...unread.map(({ item, error }) => failed(item, tournamentError(error)))]
    const kept = new Map(leftOut.map((row) => [row.id, row.reason]))
    const changing = entries.filter((entry) => !kept.has(entry.id))
    const accepted = await confirmAction({
      title: changing.length
        ? `Đưa ${counted(changing.length)} vào thùng rác?`
        : "Chưa đưa được giải nào vào thùng rác",
      description: "Giải trong thùng rác có thể khôi phục. Giải còn dữ liệu liên quan được giữ lại.",
      details: (
        <ChangeList
          changes={[
            ...changing.map((row) => listed(row, "Vào thùng rác")),
            ...entries.filter((row) => kept.has(row.id)).map((row) => listed(row, `Giữ lại. ${kept.get(row.id)}`)),
          ]}
        />
      ),
      confirmLabel: "Chuyển vào thùng rác",
      cancelLabel: "Giữ lại",
      confirmDisabled: !changing.length,
    })
    if (!accepted) return
    await apply(
      entries,
      changing,
      "Đang đưa vào thùng rác",
      (count) => `Đã đưa ${counted(count)} vào thùng rác.`,
      (entry) => tournamentApi.remove("tournaments", entry),
      leftOut,
    )
  }

  return { progress, report, dismiss: () => setReport(null), changeStatus, attach, trash }
}
