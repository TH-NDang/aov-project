import { useCallback, useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Info } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { useBackgroundTasks } from "@/app/background-tasks"
import { errorMessage } from "@/lib/api/errors"
import { ImportContextPicker, type ImportContext } from "./import-context"
import { HeroImport, type ImportActivity } from "./hero-import"
import { createPublishingApi } from "./publishing-api"
import { ImportJobHistory } from "./import-jobs"
import { ImportUploadRecovery } from "./import-upload-recovery"
const api = createPublishingApi(backendRequest)
export function ImportHeroWorkspace() {
  const [context, setContext] = useState<ImportContext | null>(null)
  const [locale, setLocale] = useState("vi-VN")
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const { updateTask } = useBackgroundTasks()
  const canWrite = useSession().actor?.capabilities.includes("hero:write")
  const regions = useQuery({ queryKey: ["publishing-regions"], queryFn: api.regions, enabled: canWrite })
  const onActivityChange = useCallback(
    (activity: ImportActivity) => {
      if (activity.status === "idle") return
      updateTask({
        ...activity,
        status: activity.status,
        id: "hero-import",
        title: "Import tướng",
        path: "/hero/import",
      })
    },
    [updateTask],
  )
  return (
    <Page>
      <PageHeader
        title="Import tướng"
        actions={
          <Button asChild variant="outline">
            <Link to="/hero">
              <ArrowLeft className="size-4" />
              Danh sách tướng
            </Link>
          </Button>
        }
      />
      {!canWrite ? (
        <p>Bạn chưa có quyền import tướng.</p>
      ) : (
        <>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Sau khi máy chủ nhận tác vụ, bạn có thể tải lại hoặc đóng web. Tiến trình sẽ xuất hiện khi đăng nhập lại.
            Upload ảnh sẽ tạm dừng nếu đóng trang; mở lại và tiếp tục phiên đã lưu bên dưới.
          </p>
          {regions.error && (
            <p role="alert" className="text-destructive">
              {errorMessage(regions.error)}
            </p>
          )}
          <ImportUploadRecovery disabled={busy} onBusyChange={setRecovering} />
          <ImportContextPicker
            regions={regions.data ?? []}
            value={context}
            onChange={setContext}
            disabled={busy || recovering}
            locale={locale}
            onLocaleChange={setLocale}
          />
          <div inert={recovering}>
            <HeroImport
              key={`${context?.contextId}-${locale}`}
              context={context}
              locale={locale}
              onBusyChange={setBusy}
              onActivityChange={onActivityChange}
            />
          </div>
          <ImportJobHistory />
        </>
      )}
    </Page>
  )
}
