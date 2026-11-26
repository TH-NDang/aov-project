import { Link } from "react-router"
import { Activity, CheckCheck, CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, X } from "lucide-react"
import { useState } from "react"
import { useSession } from "../auth/auth-gate"
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@aov/ui/components/sidebar"
import { cn } from "@aov/ui/lib/utils"
import { useBackgroundTasks, type BackgroundTask } from "../background-tasks"
import {
  useImportJobs,
  useDismissImportNotification,
  jobDescription,
} from "@/features/publishing/components/import/import-jobs"

type StatusTask = BackgroundTask & { serverJob?: boolean }

/** How many tasks the sidebar lists before folding the rest away, so a busy session never pushes the menu off screen. */
const SHOWN = 3
const ORDER: Record<BackgroundTask["status"], number> = { running: 0, error: 1, review: 2, completed: 3 }

export function BackgroundTaskStatus() {
  const { actor } = useSession()
  const storageKey = `dismissed-imports:${actor?.issuer}:${actor?.subject}`
  return <TaskStatus key={storageKey} storageKey={storageKey} />
}

function TaskStatus({ storageKey }: { storageKey: string }) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]")
      return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : []
    } catch {
      return []
    }
  })
  const [expanded, setExpanded] = useState(false)
  const dismissal = useDismissImportNotification()
  const fingerprint = (task: StatusTask) => JSON.stringify([task.id, task.status, task.description])
  const dismissLocal = (tasks: StatusTask[]) => {
    const next = [...dismissed, ...tasks.map(fingerprint)].slice(-100)
    setDismissed(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* Keep dismissal available in memory. */
    }
  }
  const dismiss = (task: StatusTask) => {
    if (task.serverJob) dismissal.mutate(task.id)
    else dismissLocal([task])
  }
  const { tasks: localTasks } = useBackgroundTasks()
  const jobs = useImportJobs()
  const serverTasks: StatusTask[] = (jobs.data ?? [])
    .filter((job, index) => job.status === "RUNNING" || (index === 0 && !job.notificationDismissed))
    .map((job) => ({
      id: job.id,
      serverJob: true,
      // Several imports read alike; the time each one started tells them apart.
      title: `Nhập tướng ${new Date(job.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`,
      path: "/hero/import",
      // An import that saved only some heroes asks to be looked at like one that failed.
      status:
        job.status === "RUNNING"
          ? "running"
          : job.status === "COMPLETED" && job.results.every((row) => row.succeeded)
            ? "completed"
            : "error",
      description: jobs.error ? "Mất kết nối · đang thử tải lại tiến trình" : jobDescription(job),
      completed: job.completed,
      total: job.total,
    }))
  const allTasks: StatusTask[] = [...localTasks.filter((task) => task.status !== "completed"), ...serverTasks]
  const tasks = allTasks
    .filter((task) => task.status === "running" || task.serverJob || !dismissed.includes(fingerprint(task)))
    .sort((left, right) => ORDER[left.status] - ORDER[right.status])
  const { isMobile, setOpenMobile, state } = useSidebar()
  if (!tasks.length) return null

  const running = tasks.filter((task) => task.status === "running")
  const finished = tasks.filter((task) => task.status !== "running")
  const failed = tasks.filter((task) => task.status === "error").length
  const summary = [
    running.length && `${running.length} đang chạy`,
    failed && `${failed} lỗi`,
    finished.length - failed && `${finished.length - failed} xong`,
  ]
    .filter(Boolean)
    .join(" · ")
  const dismissFinished = () => {
    dismissLocal(finished.filter((task) => !task.serverJob))
    for (const task of finished.filter((task) => task.serverJob)) dismissal.mutate(task.id)
  }

  // The collapsed rail keeps one icon for all the work, with the summary in its tooltip.
  if (state === "collapsed" && !isMobile) {
    const first = tasks[0]!
    const Icon = running.length ? LoaderCircle : failed ? CircleAlert : CheckCircle2
    return (
      <SidebarMenu aria-label="Tác vụ dữ liệu">
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip={`Tác vụ dữ liệu: ${summary}`}>
            <Link to={first.path} aria-label={`Tác vụ dữ liệu: ${summary}`}>
              <Icon
                className={cn(
                  running.length
                    ? "animate-spin text-primary"
                    : failed
                      ? "text-(--aov-warning)"
                      : "text-muted-foreground",
                )}
              />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const shown = expanded ? tasks : tasks.slice(0, SHOWN)
  return (
    <div className="grid gap-1 border-t pt-2">
      <div className="flex items-center justify-between gap-2 px-2">
        <p className="type-label truncate text-muted-foreground">
          Tác vụ dữ liệu <span className="font-normal">· {summary}</span>
        </p>
        {finished.length > 1 && (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            title="Ẩn mọi thông báo đã xong, vẫn giữ lịch sử nhập"
            onClick={dismissFinished}
            disabled={dismissal.isPending}
          >
            <CheckCheck className="size-3.5" />
            Ẩn mục đã xong
          </button>
        )}
      </div>
      <SidebarMenu aria-label="Tác vụ dữ liệu" className={cn(expanded && "max-h-60 overflow-y-auto")}>
        {dismissal.isError && !jobs.data?.find((job) => job.id === dismissal.variables)?.notificationDismissed && (
          <SidebarMenuItem role="alert" className="px-2 py-1 text-xs text-destructive">
            Chưa xác nhận được việc đóng thông báo trên máy chủ. Bấm × để thử lại.
          </SidebarMenuItem>
        )}
        {shown.map((task) => {
          const active = task.status === "running"
          const Icon = active
            ? LoaderCircle
            : task.status === "error"
              ? CircleAlert
              : task.status === "completed"
                ? CheckCircle2
                : Activity
          const percent = task.total ? Math.min(100, Math.round((task.completed / task.total) * 100)) : 0
          return (
            <SidebarMenuItem key={task.id}>
              <SidebarMenuButton
                asChild
                className={cn("h-auto items-start py-1.5", active ? "pr-12" : "pr-8")}
                tooltip={`${task.title}: ${task.description}`}
              >
                <Link
                  to={task.path}
                  title={`${task.title}: ${task.description}`}
                  onClick={() => {
                    if (!active && !dismissal.isPending) dismiss(task)
                    if (isMobile) setOpenMobile(false)
                  }}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      active
                        ? "animate-spin text-primary"
                        : task.status === "error"
                          ? "text-(--aov-warning)"
                          : "text-muted-foreground",
                    )}
                  />
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate text-xs">
                      <span className="font-medium">{task.title}</span>
                      {/* A running task shows its count at the end of the row instead. */}
                      {!active && <span className="text-muted-foreground"> · {task.description}</span>}
                    </span>
                    {active && (
                      <span
                        role="progressbar"
                        aria-label={task.title}
                        aria-valuemin={0}
                        aria-valuemax={task.total || 1}
                        aria-valuenow={task.completed}
                        className="h-1 overflow-hidden rounded-full bg-sidebar-accent"
                      >
                        <span
                          className="block h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                    )}
                  </span>
                </Link>
              </SidebarMenuButton>
              {active ? (
                <span className="pointer-events-none absolute top-1.5 right-2 text-xs text-muted-foreground tabular-nums">
                  {task.completed}/{task.total}
                </span>
              ) : (
                <button
                  className="absolute top-1 right-1 rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  aria-label={`Ẩn thông báo ${task.title}`}
                  title="Ẩn thông báo, vẫn giữ lịch sử nhập"
                  onClick={() => dismiss(task)}
                  disabled={dismissal.isPending && !!task.serverJob}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
      {tasks.length > SHOWN && (
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
          {expanded ? "Thu gọn" : `Xem thêm ${tasks.length - SHOWN} tác vụ`}
        </button>
      )}
    </div>
  )
}
