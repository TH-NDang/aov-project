import { Check, ChevronRight, CircleAlert, Clock3, ExternalLink, Send } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import { publicSite } from "@/features/community/api/page-api"
import { STEP_LABELS, type PendingChange, type RecordingTotals, type WorkspaceCheck } from "./model"
import { Chip, Panel, Progress, type Workspace } from "./parts"

function CheckRow({ check, onOpen }: { check: WorkspaceCheck; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid min-h-11 w-full grid-cols-[20px_minmax(0,1fr)_auto_16px] items-center gap-3 border-b px-4 py-2 text-left last:border-b-0 hover:bg-muted/60"
      >
        {check.state === "ok" ? (
          <Check className="size-4 text-[var(--aov-success)]" role="img" aria-label="Đã đủ" />
        ) : check.state === "waiting" ? (
          <Clock3 className="size-4 text-muted-foreground" role="img" aria-label="Chưa tới lúc" />
        ) : (
          <CircleAlert className="size-4 text-[var(--aov-warning)]" role="img" aria-label="Còn thiếu" />
        )}
        <span className="type-body">{check.label}</span>
        <span className="type-meta">
          {check.state === "ok" ? check.detail : `${check.detail} · ${STEP_LABELS[check.step]}`}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>
    </li>
  )
}

/** What blocks publishing, what is worth adding, and exactly what readers will get. */
export function PublishStep({
  ws,
  checks,
  pending,
  totals,
  onPublish,
  onWithdraw,
}: {
  ws: Workspace
  checks: WorkspaceCheck[]
  pending: PendingChange[]
  totals?: RecordingTotals
  onPublish: () => void
  onWithdraw: () => void
}) {
  const { entry, plan } = ws
  const required = checks.filter((check) => check.required)
  const advised = checks.filter((check) => !check.required)
  const done = (list: WorkspaceCheck[]) => list.filter((check) => check.state === "ok").length
  const blocked = required.some((check) => check.state !== "ok")
  const published = !!entry.publishedAt
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-5">
        <Panel
          title="Bắt buộc để công bố"
          action={
            <Chip tone={blocked ? "warn" : "ok"}>
              {done(required)}/{required.length}
            </Chip>
          }
        >
          <ul>
            {required.map((check) => (
              <CheckRow key={check.id} check={check} onOpen={() => ws.go(check.step)} />
            ))}
          </ul>
        </Panel>
        <Panel
          title="Nên bổ sung"
          meta="Không chặn công bố"
          action={
            <Chip tone={done(advised) === advised.length ? "ok" : "neutral"}>
              {done(advised)}/{advised.length}
            </Chip>
          }
        >
          <ul>
            {advised.map((check) => (
              <CheckRow key={check.id} check={check} onOpen={() => ws.go(check.step)} />
            ))}
          </ul>
        </Panel>
      </div>

      <aside className="space-y-5">
        <Panel
          title={published ? "Bản công bố" : "Công bố giải đấu"}
          icon={Send}
          className="border-primary/60"
          action={<Chip tone={published ? "ok" : "warn"}>{published ? "Đã công bố" : "Chưa công bố"}</Chip>}
        >
          <div className="space-y-4 p-4">
            {published && (
              <p className="type-meta">
                Lần công bố gần nhất: <LocalTime value={entry.publishedAt} />
              </p>
            )}
            <div>
              <p className="type-label mb-2 text-muted-foreground">Bản công bố sẽ gồm</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip>Thông tin giải</Chip>
                <Chip>{plan.entrants.length} đội</Chip>
                <Chip>{ws.rosters.length} dòng đội hình</Chip>
                <Chip>{plan.stages.length} giai đoạn</Chip>
                <Chip>{plan.matches.length} trận</Chip>
                <Chip>Bảng xếp hạng</Chip>
              </div>
            </div>
            {published && (
              <div>
                <p className="type-label mb-2 text-muted-foreground">Thay đổi chưa công bố · {pending.length}</p>
                {pending.length ? (
                  <ul className="space-y-1">
                    {pending.slice(0, 8).map((change, index) => (
                      <li key={index} className="type-body">
                        {change.text}
                      </li>
                    ))}
                    {pending.length > 8 && <li className="type-meta">và {pending.length - 8} thay đổi khác</li>}
                  </ul>
                ) : (
                  <p className="type-meta">Trang công khai đang khớp với bản nháp đã lưu.</p>
                )}
              </div>
            )}
            {ws.access.canPublish ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  disabled={ws.busy || blocked || (ws.dirty && !ws.access.canWrite)}
                  onClick={onPublish}
                >
                  <Send aria-hidden /> {published ? "Cập nhật bản công bố" : "Công bố giải đấu"}
                </Button>
                {published && (
                  <Button type="button" variant="outline" className="min-h-11" disabled={ws.busy} onClick={onWithdraw}>
                    Gỡ khỏi trang công khai
                  </Button>
                )}
              </div>
            ) : (
              <p className="type-meta">Tài khoản của bạn chưa có quyền công bố.</p>
            )}
            <p className="type-meta">
              {blocked
                ? "Hoàn tất các mục bắt buộc trước khi công bố."
                : "Mỗi lần công bố chụp lại cả giải: thông tin, đội hình, lịch, kết quả và bảng xếp hạng. Sửa bản nháp không đổi trang công khai cho tới lần công bố tiếp theo."}
            </p>
            {published && (
              <a
                className="type-body inline-flex items-center gap-1.5 underline"
                href={`${publicSite}/competitions/${entry.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Xem trang công khai <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </div>
        </Panel>
        <Panel title="Ván đấu" meta="Công bố riêng từng ván">
          <div className="space-y-3 p-4">
            {totals ? (
              <>
                <div className="type-body flex justify-between gap-3">
                  <span>Ván đã công bố</span>
                  <span className="font-semibold tabular-nums">
                    {totals.published}/{totals.games}
                  </span>
                </div>
                <Progress value={totals.published} total={totals.games} />
              </>
            ) : (
              <p className="type-meta">Đang đếm các ván đã ghi…</p>
            )}
            <button type="button" className="type-body underline" onClick={() => ws.go("schedule")}>
              Mở lịch để ghi và công bố ván
            </button>
          </div>
        </Panel>
      </aside>
    </div>
  )
}
