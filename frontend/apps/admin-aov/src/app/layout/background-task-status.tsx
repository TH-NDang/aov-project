import { Link } from "react-router"
import { Activity, CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react"
import { useState } from "react"
import { useSession } from "../auth/auth-gate"
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@aov/ui/components/sidebar"
import { useBackgroundTasks } from "../background-tasks"
import { useImportJobs, useDismissImportNotification, jobDescription } from "@/features/publishing/import-jobs"
import type { BackgroundTask } from "../background-tasks"
type StatusTask = BackgroundTask & { serverJob?: boolean }
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
  const dismissal = useDismissImportNotification()
  const fingerprint = (task: StatusTask) => JSON.stringify([task.id, task.status, task.description])
  const dismiss = (task: StatusTask) => {
    if (task.serverJob) {
      dismissal.mutate(task.id)
      return
    }
    const next = [...dismissed, fingerprint(task)].slice(-100)
    setDismissed(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      /* Keep dismissal available in memory. */
    }
  }
  const { tasks: localTasks } = useBackgroundTasks()
  const jobs = useImportJobs()
  const serverTasks: StatusTask[] = (jobs.data ?? [])
    .filter((job, index) => job.status === "RUNNING" || (index === 0 && !job.notificationDismissed))
    .map((job) => ({
      id: job.id,
      serverJob: true,
      title: "Import tướng",
      path: "/hero/import",
      status: job.status === "RUNNING" ? "running" : job.status === "COMPLETED" ? "completed" : "error",
      description: jobs.error ? "Mất kết nối · đang thử tải lại tiến trình" : jobDescription(job),
      completed: job.completed,
      total: job.total,
    }))
  const allTasks: StatusTask[] = [...localTasks.filter((task) => task.status !== "completed"), ...serverTasks]
  const tasks = allTasks.filter(
    (task) => task.status === "running" || task.serverJob || !dismissed.includes(fingerprint(task)),
  )
  const { isMobile, setOpenMobile } = useSidebar()
  if (!tasks.length) return null
  return (
    <SidebarMenu aria-label="Tác vụ dữ liệu">
      {dismissal.isError && !jobs.data?.find((job) => job.id === dismissal.variables)?.notificationDismissed && (
        <SidebarMenuItem role="alert" className="px-2 py-1 text-xs text-destructive">
          Chưa xác nhận được việc đóng thông báo trên máy chủ. Bấm × để thử lại.
        </SidebarMenuItem>
      )}
      {tasks.map((task) => {
        const running = task.status === "running"
        const Icon = running
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
              className="h-auto min-h-14 items-center py-2 pr-8"
              tooltip={`${task.title}: ${task.description}`}
            >
              <Link
                to={task.path}
                onClick={() => {
                  if (!running && !dismissal.isPending) dismiss(task)
                  if (isMobile) setOpenMobile(false)
                }}
              >
                <Icon
                  className={`size-4 shrink-0 ${running ? "animate-spin text-primary" : task.status === "error" ? "text-amber-500" : "text-muted-foreground"}`}
                />
                <span className="grid min-w-0 flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
                  <span className="flex items-center justify-between gap-2 text-xs font-medium">
                    <span>{task.title}</span>
                    {running && (
                      <span>
                        {task.completed}/{task.total}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{task.description}</span>
                  {running && (
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
            {!running && (
              <button
                className="absolute right-1 top-1 rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
                aria-label={`Ẩn thông báo ${task.title}`}
                title="Ẩn thông báo, vẫn giữ lịch sử import"
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
  )
}
