import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { invalidateHeroCatalogs } from "./publishing-cache"

import type { components } from "./generated/hero-api"
export type ImportJob = components["schemas"]["HeroImportJobView"]
export function useDismissImportNotification() {
  const { actor } = useSession()
  const cache = useQueryClient()
  const queryKey = ["hero-import-jobs", actor?.issuer, actor?.subject]
  return useMutation({
    mutationFn: (id: string) =>
      backendRequest<ImportJob>(`/admin/heroes/import/jobs/${id}/notification-dismissal`, { method: "PUT" }),
    onSuccess: async (job) => {
      await cache.cancelQueries({ queryKey, exact: true })
      cache.setQueryData<ImportJob[]>(queryKey, (jobs) => jobs?.map((item) => (item.id === job.id ? job : item)))
      void cache.invalidateQueries({ queryKey, exact: true })
    },
    onError: () => {
      // Reconcile a response lost after the server may already have committed.
      void cache.invalidateQueries({ queryKey, exact: true })
    },
  })
}
export function useImportJobs() {
  const { actor } = useSession()
  const cache = useQueryClient()
  const query = useQuery({
    queryKey: ["hero-import-jobs", actor?.issuer, actor?.subject],
    queryFn: () => backendRequest<ImportJob[]>("/admin/heroes/import/jobs"),
    enabled: !!actor?.capabilities.includes("hero:write"),
    refetchInterval: 3000,
  })
  const updates = query.data?.map((job) => job.updatedAt).join(",")
  const finishedUpdates = query.data
    ?.filter((job) => !["QUEUED", "RUNNING"].includes(job.status))
    .map((job) => `${job.id}:${job.updatedAt}`)
    .join(",")
  useEffect(() => {
    if (updates) void cache.invalidateQueries({ queryKey: ["publishing-heroes"] })
  }, [updates, cache])
  useEffect(() => {
    if (!finishedUpdates) return
    void invalidateHeroCatalogs(cache)
    for (const key of ["publishing-preview", "publishing-revisions", "hero-comparison"])
      void cache.invalidateQueries({ queryKey: [key] })
  }, [finishedUpdates, cache])
  return query
}
export function jobDescription(job: ImportJob) {
  if (job.status === "RUNNING") return `Đang xử lý ${job.completed}/${job.total} tướng`
  const failures = job.results.filter((row) => !row.succeeded).length
  return failures ? `Đã lưu ${job.total - failures}/${job.total} · ${failures} lỗi` : `Đã lưu ${job.total} bản nháp`
}
export function ImportJobHistory() {
  const jobs = useImportJobs()
  return (
    <section className="space-y-3" aria-label="Tiến trình trên máy chủ">
      <h2 className="font-semibold">Tiến trình trên máy chủ</h2>
      {jobs.isPending && <p className="text-sm text-muted-foreground">Đang tải tiến trình…</p>}
      {jobs.error && (
        <p role="alert" className="text-sm text-destructive">
          Không tải được tiến trình. {errorMessage(jobs.error)}
        </p>
      )}
      {jobs.data?.length === 0 && <p className="text-sm text-muted-foreground">Chưa có tác vụ import.</p>}
      {jobs.data?.map((job) => (
        <details key={job.id} className="rounded-xl border bg-card p-4" open={job.status === "RUNNING"}>
          <summary className="cursor-pointer text-sm font-medium">
            {jobDescription(job)}{" "}
            <span className="ml-2 font-normal text-muted-foreground">
              {new Date(job.createdAt).toLocaleString("vi-VN")}
            </span>
          </summary>
          <progress
            className="mt-3 h-2 w-full accent-primary"
            max={job.total}
            value={job.completed}
            aria-label="Tiến trình import trên máy chủ"
          />
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">
            {job.results.map((row) => (
              <li key={row.code} className={row.succeeded ? "" : "text-destructive"}>
                <strong>{row.code}</strong> — {row.succeeded ? "Đã lưu bản nháp" : row.detail || "Không thể lưu"}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
